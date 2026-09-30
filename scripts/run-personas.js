import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  defaultSettings,
  hijri,
  ramadanCalc,
  runEngineDetailed,
  traditionalCalc,
  validateCashAmount,
} from '../src/engine/engine.js';
import { iso, normalizePersona, personaDays } from '../src/engine/personas.js';

// personaDays انتقل إلى src/engine/personas.js حتى يشتغل في المتصفح، ونعيد تصديره هنا للسكربتات والاختبارات القديمة
export { personaDays };

const readData = (name) =>
  JSON.parse(
    readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'),
  );

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
