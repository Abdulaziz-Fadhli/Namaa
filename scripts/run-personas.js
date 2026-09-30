import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  defaultSettings,
  hijri,
  nisabFor,
  ramadanCalc,
  runEngineDetailed,
  traditionalCalc,
  validateAssetFlags,
  validateCashAmount,
} from '../src/engine/engine.js';

const iso = (date) => date.toISOString().slice(0, 10);
const dateOf = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new TypeError('Dates must use YYYY-MM-DD');
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || iso(date) !== value)
    throw new TypeError(`Invalid date: ${value}`);
  return date;
};
const readData = (name) =>
  JSON.parse(
    readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'),
  );

const arrayOrEmpty = (value, label) => {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  return value;
};
const recordKey = (record) =>
  JSON.stringify(
    Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, record[key]]),
    ),
  );
function normalizePersona(persona) {
  if (!persona || typeof persona !== 'object' || Array.isArray(persona))
    throw new TypeError('persona must be an object');
  for (const key of ['name', 'persona'])
    if (typeof persona[key] !== 'string' || !persona[key])
      throw new TypeError(`${key} must be a non-empty string`);
  if (!persona.period || typeof persona.period !== 'object')
    throw new TypeError('persona requires a period');
  if (dateOf(persona.period.start) > dateOf(persona.period.end))
    throw new RangeError('period end must not precede start');
  const normalized = { ...persona };
  for (const key of ['accounts', 'transactions', 'holdings', 'manual'])
    normalized[key] = arrayOrEmpty(persona[key], key);
  const accountIds = new Set();
  for (const account of normalized.accounts) {
    validateAssetFlags(account);
    if (
      typeof account.accountId !== 'string' ||
      !account.accountId ||
      accountIds.has(account.accountId)
    )
      throw new TypeError('invalid or duplicate account id');
    if (account.currency !== undefined && account.currency !== 'SAR')
      throw new TypeError('only SAR account amounts are supported');
    accountIds.add(account.accountId);
  }
  const ids = new Set(),
    records = new Set();
  for (const asset of [...normalized.holdings, ...normalized.manual]) {
    validateAssetFlags(asset);
    if (asset.id !== undefined) {
      if (typeof asset.id !== 'string' || !asset.id || ids.has(asset.id))
        throw new TypeError('duplicate or invalid asset id across sources');
      ids.add(asset.id);
    } else {
      const signature = recordKey(asset);
      if (records.has(signature))
        throw new TypeError('duplicate asset record without distinct lot ids');
      records.add(signature);
    }
  }
  return normalized;
}

// Adapt the saved account/holding schema to a daily cash ledger and complete
// asset inventory. Internal bank transfers never create new acquisition lots.
function holdingAt(holding, id, key, prices, periodStart, requireDate) {
  const kind = {
    gold: 'gold',
    silver: 'silver',
    stocks: 'stocks',
    fund: 'investmentProducts',
    investmentProducts: 'investmentProducts',
    property: 'properties',
    cash: 'cash',
  }[holding.type];
  if (!kind) throw new TypeError(`Unsupported holding schema: ${holding.type}`);
  const acquired =
    holding.acquired !== undefined ? holding.acquired : holding.date;
  if (acquired !== undefined) dateOf(acquired);
  if (holding.disposed !== undefined) dateOf(holding.disposed);
  if (holding.zakatExempt || (kind === 'cash' && holding.zakatable === false))
    return null;
  if (!acquired && requireDate)
    throw new TypeError('Manual assets require an acquisition date');
  // Opening holdings without earlier history are explicitly reported as such.
  const observedAcquired = dateOf(acquired ?? periodStart);
  if (observedAcquired > dateOf(key)) return null;
  if (holding.disposed && dateOf(holding.disposed) <= dateOf(key)) return null;
  const asset = { ...holding, id, kind, acquired: observedAcquired };
  if (kind === 'gold' || kind === 'silver') {
    asset.pricePerGram = prices[key][kind];
  }
  if (kind === 'stocks' || kind === 'investmentProducts') {
    asset.type = holding.intent?.toUpperCase();
    asset.marketValue = holding.values
      ? holding.values[key]
      : holding.marketValue;
    asset.zakatableValue = holding.zakatableValues
      ? holding.zakatableValues[key]
      : holding.zakatableValue;
  }
  if (kind === 'properties') {
    asset.intent = holding.intent?.toUpperCase();
    asset.marketValue = holding.values
      ? holding.values[key]
      : holding.marketValue;
    if (asset.intent === 'TRADING' && asset.marketValue == null)
      throw new Error(`Missing property value: ${key}`);
  }
  if (kind === 'cash')
    asset.value = holding.values ? holding.values[key] : holding.value;
  return asset;
}

export function personaDays(persona, prices, settings = defaultSettings) {
  persona = normalizePersona(persona);
  const accounts = new Map(
    persona.accounts.map((account) => [account.accountId, account]),
  );
  const byDate = new Map();
  const transactionIds = new Set(),
    transactionRecords = new Set(),
    transfers = new Map();
  for (const transaction of persona.transactions) {
    if (
      !transaction ||
      typeof transaction !== 'object' ||
      Array.isArray(transaction)
    )
      throw new TypeError('transaction must be an object');
    dateOf(transaction.date);
    validateCashAmount(transaction.amount);
    if (!['credit', 'debit'].includes(transaction.direction))
      throw new Error('Unknown transaction direction');
    if (
      transaction.internal !== undefined &&
      typeof transaction.internal !== 'boolean'
    )
      throw new TypeError('internal must be boolean');
    if (
      transaction.date < persona.period.start ||
      transaction.date > persona.period.end
    )
      throw new Error('Transaction outside period');
    if (transaction.id !== undefined) {
      if (
        typeof transaction.id !== 'string' ||
        !transaction.id ||
        transactionIds.has(transaction.id)
      )
        throw new TypeError('duplicate or invalid transaction id');
      transactionIds.add(transaction.id);
    } else {
      const signature = recordKey(transaction);
      if (transactionRecords.has(signature))
        throw new TypeError(
          'duplicate transaction record without distinct ids',
        );
      transactionRecords.add(signature);
    }
    const account = accounts.get(transaction.accountId);
    if (!account) throw new Error(`Unknown account: ${transaction.accountId}`);
    if (transaction.internal) {
      const counterparty = accounts.get(transaction.counterparty);
      if (
        !counterparty ||
        Boolean(account.zakatExempt) !== Boolean(counterparty.zakatExempt)
      ) {
        throw new Error(
          'Transfers across exempt/non-exempt accounts require an explicit adapter',
        );
      }
      const from =
        transaction.direction === 'debit'
          ? transaction.accountId
          : transaction.counterparty;
      const to =
        transaction.direction === 'credit'
          ? transaction.accountId
          : transaction.counterparty;
      const transferKey = JSON.stringify([
        transaction.date,
        from,
        to,
        transaction.amount,
      ]);
      transfers.set(
        transferKey,
        (transfers.get(transferKey) ?? 0) +
          (transaction.direction === 'credit' ? 1 : -1),
      );
      continue;
    }
    if (account.zakatExempt) continue;
    if (!['credit', 'debit'].includes(transaction.direction))
      throw new Error('Unknown transaction direction');
    if (
      transaction.date < persona.period.start ||
      transaction.date > persona.period.end
    )
      throw new Error('Transaction outside period');
    const day = byDate.get(transaction.date) ?? {
      deposits: [],
      withdrawals: [],
    };
    day[transaction.direction === 'credit' ? 'deposits' : 'withdrawals'].push(
      transaction.amount,
    );
    byDate.set(transaction.date, day);
  }
  if ([...transfers.values()].some((balance) => balance !== 0))
    throw new TypeError(
      'internal transfer must contain matching credit and debit records',
    );
  const inputs = [
    ...persona.holdings.map((holding, index) => ({
      holding,
      id: `holding:${holding.id ?? index}`,
      requireDate: false,
    })),
    ...persona.manual.map((holding, index) => ({
      holding,
      id: `manual:${holding.id ?? index}`,
      requireDate: true,
    })),
  ];
  const days = [];
  const end = dateOf(persona.period.end);
  for (
    let date = dateOf(persona.period.start);
    date <= end;
    date = new Date(date.getTime() + 86400000)
  ) {
    const key = iso(date);
    if (!prices[key]) throw new Error(`Missing prices: ${key}`);
    const assets = inputs
      .map(({ holding, id, requireDate }) =>
        holdingAt(holding, id, key, prices, persona.period.start, requireDate),
      )
      .filter(Boolean);
    days.push({
      date,
      ...byDate.get(key),
      nisab: nisabFor(prices[key], settings),
      assets,
    });
  }
  return days;
}

export function comparePersona(persona, prices, settings = defaultSettings) {
  persona = normalizePersona(persona);
  const days = personaDays(persona, prices, settings);
  const result = runEngineDetailed(days, settings);
  // Retain the earlier cash-only comparison as a clearly separate baseline.
  const cashResult = runEngineDetailed(
    days.map(({ date, deposits, withdrawals, nisab }) => ({
      date,
      deposits,
      withdrawals,
      nisab,
    })),
    settings,
  );
  if (!result.series.length) throw new Error('Empty persona period');
  const due = result.events
    .filter((event) => event.type === 'DUE')
    .map((event) => {
      const row = result.series.find(
        (row) => row.date.getTime() === event.date.getTime(),
      );
      const traditional = traditionalCalc(row.total, row.nisab);
      return {
        date: iso(event.date),
        hijri: hijri(event.date),
        base: event.base,
        zakat: event.zakat,
        cashBase: event.cashBase,
        otherAssetsBase: event.otherAssetsBase,
        assets: event.assets,
        traditionalAllAssets: traditional,
        differenceAllAssets: traditional - event.zakat,
      };
    });
  const cashDue = cashResult.events.filter((event) => event.type === 'DUE');
  const years = [...new Set(result.series.map((row) => hijri(row.date)[0]))];
  const ramadan = years.map((year) => {
    const row = result.series.find((row) => {
      const [y, m, d] = hijri(row.date);
      return y === year && m === 9 && d === 1;
    });
    if (!row)
      return { year, status: 'غير متاح: أول رمضان غير موجود في الفترة' };
    const baseline = ramadanCalc(result.series, year);
    const namaaDue = due
      .filter((event) => event.date <= iso(row.date))
      .reduce((total, event) => total + event.zakat, 0);
    const cashBaseline = ramadanCalc(cashResult.series, year);
    const namaaCashDue = cashDue
      .filter((event) => event.date <= row.date)
      .reduce((total, event) => total + event.zakat, 0);
    return {
      year,
      date: iso(row.date),
      totalSnapshot: baseline.base,
      traditionalAllAssets: baseline.zakat,
      namaaDueToDate: namaaDue,
      differenceAllAssets: baseline.zakat - namaaDue,
      cashBase: cashBaseline.base,
      traditionalCash: cashBaseline.zakat,
      namaaCashDueToDate: namaaCashDue,
      differenceCash: cashBaseline.zakat - namaaCashDue,
    };
  });
  const last = result.series.at(-1);
  const next = (result) =>
    result.nextDue && {
      date: iso(result.nextDue.dueDate),
      hijri: result.nextDue.targetHijri,
      expectedZakat: result.nextDue.zakat,
    };
  const exemptBalance = persona.transactions
    .filter(
      (transaction) =>
        persona.accounts.find(
          (account) => account.accountId === transaction.accountId,
        )?.zakatExempt,
    )
    .reduce(
      (balance, transaction) =>
        balance +
        (transaction.direction === 'credit'
          ? transaction.amount
          : -transaction.amount),
      0,
    );
  validateCashAmount(exemptBalance);
  const limitations = [
    'الأرصدة والأصول الافتتاحية تبدأ متابعة الحول من أول يوم متاح؛ لا يُفترض بلوغ النصاب قبل بداية السجل.',
  ];
  for (const holding of persona.holdings) {
    if (!holding.zakatExempt && !holding.acquired && !holding.date)
      limitations.push(
        `تاريخ تملك ${holding.name ?? holding.type} غير مسجل؛ استُخدم أول يوم في البيانات كبداية المتابعة، وليس كتاريخ شراء معلوم.`,
      );
  }
  return {
    persona: persona.persona,
    name: persona.name,
    period: persona.period,
    scope:
      'نماء يشمل النقد والذهب والفضة والأسهم والصناديق والعقار التجاري والإدخال اليدوي الموجود في البيانات.',
    limitations,
    due,
    totalZakatDue: due.reduce((sum, event) => sum + event.zakat, 0),
    totalCashZakatDue: cashDue.reduce((sum, event) => sum + event.zakat, 0),
    nextDue: next(result),
    nextCashDue: next(cashResult),
    exemptBalance,
    endSnapshot: {
      date: iso(last.date),
      cashBalance: last.cashBalance,
      otherAssets: last.otherAssets,
      total: last.total,
      traditionalCash: traditionalCalc(last.cashBalance, last.nisab),
      traditionalAllAssets: traditionalCalc(last.total, last.nisab),
    },
    ramadan,
    events: result.events,
  };
}

export function runPersonas() {
  const prices = readData('prices');
  return ['ahmad', 'khalid', 'noura'].map((name) =>
    comparePersona(readData(name), prices),
  );
}

export function markdownReport(reports) {
  const money = (number) =>
    new Intl.NumberFormat('en', {
      useGrouping: false,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(number);
  const lines = [
    '# نتائج مهام الثلاثاء — العضو الثاني',
    '',
    'التشغيل: `npm run personas -- --output report.json`، أو `node scripts/run-personas.js`.',
    '',
    'البيانات محاكاة محفوظة حتى 2026-10-03، وتتضمن أيامًا لاحقة لتاريخ العمل. الأسعار المحفوظة قد تكون ممتدة من آخر سعر متاح بحسب سكربت جلب الأسعار. لم نُعد توليد البيانات أو نجلب أسعارًا جديدة.',
    '',
    'يُتتبع حول كل دفعة، وتُقيّم الأصول بسعر يوم الوجوب. الوعاء اليومي يضم النقد والأصول المؤهلة. تغيّر الأسعار لا ينشئ دفعة جديدة. المصروفات البنكية تخصم من النقد، وشراء الذهب المسجل يسحب تكلفة الشراء مرة واحدة ثم يُضاف الذهب كدفعة مستقلة بتاريخ تملكه.',
    '',
    'التحويلات الداخلية بين الحسابات غير المعفاة مستبعدة، وحسابات zakatExempt ظاهرة كرصيد مستبعد. تواريخ الوجوب التالية توقعات بأسعار وأرصدة نهاية الفترة؛ الزكاة المستحقة لا تُسحب تلقائيًا من الرصيد.',
    '',
    'المقارنة في يوم الوجوب: الحاسبة التقليدية لجميع الأصول في اليوم نفسه ناقص زكاة نماء لذلك الحدث. مقارنة رمضان: الحاسبة لجميع الأصول في أول رمضان ناقص مجموع زكاة نماء المستحقة حتى ذلك اليوم؛ هذه مقارنة بين منهجين زمنيين وليست فرقًا في فاتورة واحدة. لا يجوز تقديم الفرق على أنه وفر مضمون.',
    '',
  ];
  for (const report of reports) {
    lines.push(
      `## ${report.name}`,
      '',
      report.scope,
      '',
      ...report.limitations,
      '',
      `مجموع الزكاة المستحقة خلال الفترة لجميع الأصول: ${money(report.totalZakatDue)} ريال.`,
      `للمقارنة فقط، نتيجة المحرك عند الاقتصار على النقد البنكي: ${money(report.totalCashZakatDue)} ريال.`,
      '',
      '| الوجوب الميلادي | الهجري | نماء لجميع الأصول | منها زكاة الأصول الأخرى | التقليدية يوم الوجوب | الفرق |',
      '|---|---|---:|---:|---:|---:|',
      ...report.due.map(
        (event) =>
          `| ${event.date} | ${event.hijri.join('/')} | ${money(event.zakat)} | ${money(event.otherAssetsBase / 40)} | ${money(event.traditionalAllAssets)} | ${money(event.differenceAllAssets)} |`,
      ),
      '',
    );
    if (!report.due.length) lines.push('لم يكتمل حول خلال الفترة.', '');
    if (report.nextDue)
      lines.push(
        `الوجوب المتوقع لجميع الأصول: ${report.nextDue.date}، ${money(report.nextDue.expectedZakat)} ريال.`,
        '',
      );
    lines.push(
      '| أول رمضان | الحاسبة لجميع الأصول | نماء المستحق حتى اليوم | الفرق |',
      '|---|---:|---:|---:|',
      ...report.ramadan.map((row) =>
        row.date
          ? `| ${row.date} (${row.year}) | ${money(row.traditionalAllAssets)} | ${money(row.namaaDueToDate)} | ${money(row.differenceAllAssets)} |`
          : `| ${row.year}: ${row.status} | — | — | — |`,
      ),
      '',
      `نهاية الفترة: النقد البنكي ${money(report.endSnapshot.cashBalance)} ريال؛ الأصول الأخرى بما فيها النقد اليدوي ${money(report.endSnapshot.otherAssets)} ريال؛ الحاسبة لجميع الأصول ${money(report.endSnapshot.traditionalAllAssets)} ريال.`,
      `رصيد الحسابات المعفاة المستبعد من الحساب: ${money(report.exemptBalance)} ريال.`,
      '',
    );
  }
  lines.push(
    '## مسائل منفصلة',
    '',
    'المحاصيل والمواشي تقوّم بدوال الأهلية المنفصلة، ولا تدخل في وعاء 2.5%. لا توجد منها بيانات في الشخصيات الثلاث. واجهة Manual.jsx تتضمن معدلات ري 10% و5% وشروط الرعي؛ لم تُستخدم أو تُعدل ضمن مهام المحرك. ربط الواجهة بالمحرك يظل من مهام الأربعاء.',
  );
  return lines.join('\n');
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const reports = runPersonas();
  const outputIndex = process.argv.indexOf('--output');
  if (outputIndex !== -1) {
    if (!process.argv[outputIndex + 1])
      throw new Error('--output requires a path');
    writeFileSync(
      process.argv[outputIndex + 1],
      JSON.stringify(reports, null, 2),
    );
  }
  console.log(markdownReport(reports));
}
