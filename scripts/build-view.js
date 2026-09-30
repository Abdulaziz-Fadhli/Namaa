// يبني بيانات شاشات فيجما من محرك الشباب: يشغّل المحرك على شخصية أحمد وأسعار الذهب والفضة،
// ويحفظ ما تحتاجه الشاشات في src/data/ahmad-view.json. شغّله بعد أي تعديل على المحرك أو البيانات:
//   npm run view
// واختبار src/figma/view.test.js يتأكد أن الملف المحفوظ مطابق لمخرجات المحرك الحالية.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { defaultSettings, hijri, runEngineDetailed } from '../src/engine/engine.js';
import { personaDays } from './run-personas.js';

const iso = (d) => d.toISOString().slice(0, 10);
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const DAY = 86400000;

export function buildView(persona, prices, settings = defaultSettings) {
  const days = personaDays(persona, prices, settings);
  const result = runEngineDetailed(days, settings);
  const last = result.series.at(-1);
  const today = persona.period.end;
  const todayDate = new Date(`${today}T00:00:00Z`);

  // رصيد كل حساب من حركاته (الحساب المعفى يظهر لكن لا يدخل الوعاء)
  const accounts = persona.accounts.map((a) => {
    const txs = persona.transactions.filter((t) => t.accountId === a.accountId);
    const balance = txs.reduce((s, t) => s + (t.direction === 'credit' ? t.amount : -t.amount), 0);
    return {
      id: a.accountId,
      bank: a.bank,
      type: a.type,
      product: a.product ?? null,
      exempt: a.zakatExempt === true,
      balance: round2(balance),
      lastActivity: txs.reduce((m, t) => (t.date > m ? t.date : m), ''),
    };
  });

  const event = (e) => ({
    type: e.type,
    date: iso(e.date),
    hijri: hijri(e.date),
    base: e.base ?? null,
    zakat: e.zakat == null ? null : round2(e.zakat),
    explanation: e.explanation ?? '',
  });
  const events = result.events.map(event);
  const dues = events.filter((e) => e.type === 'DUE');
  const due = dues.find((e) => e.date === today) ?? null;
  const start = events.find((e) => e.type === 'START') ?? null;

  // منحنى الوعاء: قراءة أسبوعية لآخر 34 أسبوعًا تنتهي باليوم
  const series = [];
  for (let i = result.series.length - 1; i >= 0 && series.length < 35; i -= 7) {
    const row = result.series[i];
    series.unshift({ date: iso(row.date), hijri: hijri(row.date), total: round2(row.total) });
  }

  const p = prices[today];
  const next = result.nextDue;
  return {
    source: 'npm run view — محرك نماء على بيانات أحمد',
    persona: persona.persona,
    name: persona.name,
    today,
    todayHijri: hijri(todayDate),
    accounts,
    bankTotal: round2(last.cashBalance),
    exemptBalance: round2(accounts.filter((a) => a.exempt).reduce((s, a) => s + a.balance, 0)),
    total: round2(last.total),
    nisab: round2(last.nisab),
    nisabBasis: settings.nisabBasis,
    nisabByMetal: {
      gold: round2(settings.goldGrams * p.gold),
      silver: round2(settings.silverGrams * p.silver),
    },
    prices: { date: today, goldPerGram: p.gold, silverPerGram: p.silver },
    settings: {
      acquiredMoneyMode: settings.acquiredMoneyMode,
      spendOrder: settings.spendOrder,
      goldGrams: settings.goldGrams,
      silverGrams: settings.silverGrams,
    },
    start,
    due,
    dues,
    events,
    nextDue: next && {
      date: iso(next.dueDate),
      hijri: next.targetHijri,
      hawlStart: iso(next.start),
      zakat: round2(next.zakat),
      inDays: Math.round((next.dueDate - todayDate) / DAY),
    },
    series,
  };
}

const read = (name) =>
  JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'));

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const view = buildView(read('ahmad'), read('prices'));
  writeFileSync(new URL('../src/data/ahmad-view.json', import.meta.url), `${JSON.stringify(view, null, 1)}\n`);
  console.log(`ahmad-view.json: وعاء ${view.total} · زكاة اليوم ${view.due?.zakat} · الوجوب التالي بعد ${view.nextDue?.inDays} يومًا`);
}
