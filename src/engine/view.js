// يبني ما تحتاجه شاشات نماء من المحرك: الأرصدة، والوعاء، والنصاب، وزكاة اليوم، والوجوب التالي، والأحداث.
// ملف نقي بدون node:fs، فيشتغل في المتصفح (الوضع المباشر) وفي سكربت npm run view (ahmad-view.json).
import { defaultSettings, hijri, runEngineDetailed } from './engine.js';
import { personaDays } from './personas.js';

const iso = (d) => d.toISOString().slice(0, 10);
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const DAY = 86400000;

export function buildView(persona, prices, settings = defaultSettings, options = {}) {
  // الوضع المباشر: تاريخ اليوم الحقيقي وسعر السوق الآن بدل يوم العرض والأسعار المحفوظة
  if (options.today || options.live) ({ persona, prices } = liveInputs(persona, prices, options));
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

// يقص بيانات الشخصية عند تاريخ اليوم، ويكمّل الأسعار الناقصة بآخر سعر معروف،
// ويضع سعر السوق الآن مكان سعر اليوم. لا يغيّر المدخلات الأصلية.
export function liveInputs(persona, prices, { today, live } = {}) {
  const end = today ?? persona.period.end;
  if (end < persona.period.start) throw new RangeError('today is before the persona period');
  const trimmed = {
    ...persona,
    period: { ...persona.period, end },
    transactions: (persona.transactions ?? []).filter(t => t.date <= end),
  };
  const filled = {};
  let last = null;
  for (let d = new Date(`${persona.period.start}T00:00:00Z`); iso(d) <= end; d = new Date(d.getTime() + DAY)) {
    const key = iso(d);
    if (prices[key]) last = prices[key];
    if (!last) throw new Error(`Missing prices: ${key}`);
    filled[key] = last;
  }
  if (live) filled[end] = { gold: live.goldPerGram, silver: live.silverPerGram };
  return { persona: trimmed, prices: filled };
}
