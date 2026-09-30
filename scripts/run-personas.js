import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  calculateZakatableSnapshot,
  defaultSettings,
  hijri,
  nisabFor,
  ramadanCalc,
  runEngineDetailed,
  traditionalCalc,
} from '../src/engine/engine.js';

const iso = (date) => date.toISOString().slice(0, 10);
const dateOf = (value) => new Date(`${value}T00:00:00Z`);
const readData = (name) =>
  JSON.parse(
    readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'),
  );

// Keep asset valuation separate: the existing hawl engine accepts cash flows only.
// Treating market-price changes as cash deposits would fabricate acquisition dates.
export function personaDays(persona, prices, settings = defaultSettings) {
  if (persona.manual.length)
    throw new Error('Manual asset schema requires an explicit adapter');
  const accounts = new Map(
    persona.accounts.map((account) => [account.accountId, account]),
  );
  const byDate = new Map();
  for (const transaction of persona.transactions) {
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
  const days = [];
  for (
    let date = dateOf(persona.period.start);
    date <= dateOf(persona.period.end);
    date = new Date(date.getTime() + 86400000)
  ) {
    const key = iso(date);
    if (!prices[key]) throw new Error(`Missing prices: ${key}`);
    days.push({
      date,
      ...byDate.get(key),
      nisab: nisabFor(prices[key], settings),
    });
  }
  return days;
}

function snapshotAt(persona, prices, row) {
  const key = iso(row.date);
  const gold = [],
    stocks = [];
  for (const holding of persona.holdings) {
    if (holding.zakatExempt || (holding.acquired && holding.acquired > key))
      continue;
    if (holding.type === 'gold') {
      gold.push({
        ...holding,
        purpose: holding.purpose ?? 'INVESTMENT',
        pricePerGram: prices[key].gold,
      });
    } else if (holding.type === 'stocks' && holding.intent === 'trading') {
      if (holding.values[key] == null)
        throw new Error(`Missing stock value: ${key}`);
      stocks.push({ type: 'TRADING', marketValue: holding.values[key] });
    } else {
      throw new Error(`Unsupported holding schema: ${holding.type}`);
    }
  }
  return calculateZakatableSnapshot({ cashBalance: row.total, gold, stocks });
}

export function comparePersona(persona, prices, settings = defaultSettings) {
  const days = personaDays(persona, prices, settings);
  const result = runEngineDetailed(days, settings);
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
        traditionalCash: traditional,
        differenceCash: traditional - event.zakat,
      };
    });
  const years = [...new Set(result.series.map((row) => hijri(row.date)[0]))];
  const ramadan = years.map((year) => {
    const row = result.series.find((row) => {
      const [y, m, d] = hijri(row.date);
      return y === year && m === 9 && d === 1;
    });
    if (!row)
      return { year, status: 'غير متاح: أول رمضان غير موجود في الفترة' };
    const baseline = ramadanCalc(result.series, year);
    const snapshot = snapshotAt(persona, prices, row);
    const namaaCashDue = due
      .filter((event) => event.date <= iso(row.date))
      .reduce((total, event) => total + event.zakat, 0);
    return {
      year,
      date: iso(row.date),
      cashBase: baseline.base,
      traditionalCash: baseline.zakat,
      namaaCashDueToDate: namaaCashDue,
      differenceCash: baseline.zakat - namaaCashDue,
      totalSnapshot: snapshot.total,
      traditionalAllAssets: traditionalCalc(snapshot.total, row.nisab),
    };
  });
  const last = result.series.at(-1);
  const snapshot = snapshotAt(persona, prices, last);
  return {
    persona: persona.persona,
    name: persona.name,
    period: persona.period,
    scope:
      'نتائج نماء للحول النقدي فقط؛ المقارنة الشاملة للأصول لقيمة الوعاء فقط',
    limitations: persona.holdings.some((holding) => !holding.zakatExempt)
      ? [
          'المحرك الحالي لا يتتبع حول الذهب والأسهم؛ لا يتوفر مبلغ نماء شامل للأصول. الرصيد الافتتاحي يبدأ حوله من أول يوم متاح لغياب تاريخ سابق.',
        ]
      : ['الرصيد الافتتاحي يبدأ حوله من أول يوم متاح لغياب تاريخ سابق.'],
    due,
    totalCashZakatDue: due.reduce((sum, event) => sum + event.zakat, 0),
    nextCashDue: result.nextDue && {
      date: iso(result.nextDue.dueDate),
      hijri: result.nextDue.targetHijri,
      expectedZakat: result.nextDue.zakat,
    },
    endSnapshot: {
      date: iso(last.date),
      ...snapshot,
      traditionalCash: traditionalCalc(last.total, last.nisab),
      traditionalAllAssets: traditionalCalc(snapshot.total, last.nisab),
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
  const money = (number) => number.toFixed(2);
  const lines = [
    '# نتائج مهام الثلاثاء — العضو الثاني',
    '',
    'التشغيل: `npm run personas -- --output report.json`، أو `node scripts/run-personas.js`.',
    '',
    'البيانات محاكاة محفوظة حتى 2026-10-03، وتتضمن أيامًا لاحقة لتاريخ العمل. الأسعار المحفوظة قد تكون ممتدة من آخر سعر متاح بحسب سكربت جلب الأسعار. لم نُعد توليد البيانات أو نجلب أسعارًا جديدة.',
    '',
    'التحويلات الداخلية بين الحسابات غير المعفاة مستبعدة، وحسابات zakatExempt مستبعدة. تواريخ الوجوب التالية توقعات إذا بقيت الدفعات كما هي؛ الزكاة المستحقة لا تُسحب تلقائيًا من الرصيد.',
    '',
    'المقارنة في يوم الوجوب: الحاسبة التقليدية للنقد في اليوم نفسه ناقص زكاة نماء النقدية لذلك الحدث. مقارنة رمضان: حاسبة النقد في أول رمضان ناقص مجموع زكاة نماء النقدية المستحقة حتى ذلك اليوم؛ هذه مقارنة بين منهجين زمنيين وليست فرقًا في فاتورة واحدة.',
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
      `مجموع الزكاة النقدية المستحقة خلال الفترة: ${money(report.totalCashZakatDue)} ريال.`,
      '',
      '| الوجوب الميلادي | الهجري | نماء النقدي | التقليدية للنقد يوم الوجوب | الفرق |',
      '|---|---|---:|---:|---:|',
      ...report.due.map(
        (event) =>
          `| ${event.date} | ${event.hijri.join('/')} | ${money(event.zakat)} | ${money(event.traditionalCash)} | ${money(event.differenceCash)} |`,
      ),
      '',
    );
    if (!report.due.length) lines.push('لم يكتمل حول نقدي خلال الفترة.', '');
    if (report.nextCashDue)
      lines.push(
        `الوجوب النقدي المتوقع: ${report.nextCashDue.date}، ${money(report.nextCashDue.expectedZakat)} ريال.`,
        '',
      );
    lines.push(
      '| أول رمضان | الحاسبة النقدية | نماء النقدي حتى اليوم | الفرق | الحاسبة لجميع الأصول |',
      '|---|---:|---:|---:|---:|',
      ...report.ramadan.map((row) =>
        row.date
          ? `| ${row.date} (${row.year}) | ${money(row.traditionalCash)} | ${money(row.namaaCashDueToDate)} | ${money(row.differenceCash)} | ${money(row.traditionalAllAssets)} |`
          : `| ${row.year}: ${row.status} | — | — | — | — |`,
      ),
      '',
      `نهاية الفترة: النقد ${money(report.endSnapshot.cashBalance)} ريال؛ الأصول الأخرى ${money(report.endSnapshot.otherAssets)} ريال؛ الحاسبة لجميع الأصول ${money(report.endSnapshot.traditionalAllAssets)} ريال.`,
      '',
    );
  }
  lines.push(
    '## مسائل منفصلة',
    '',
    'واجهة Manual.jsx تتضمن معدلات ري 10% و5% وشروط الرعي. لم تُستخدم في المحرك أو في هذا التقرير. يلزم مراجعتها منفصلًا وفق المرجع المعتمد.',
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
