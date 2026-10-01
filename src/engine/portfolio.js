// ربط تطبيقات الاستثمار (محاكاة): محفظة فيها أسهم وصناديق ونقد، وكل عملية شراء أو بيع تحدّث الوعاء فورًا.
// الحكم لكل ورقة من src/securities (يزكي أو الزكاة عليك)، والقيمة الزكوية من محرك نماء (calculateAssetValue).
//
// الحول لا ينقطع بمبادلة مال زكوي بمال زكوي:
//   - شراء ورقة زكاتها عليك بنقد المحفظة: تأخذ الورقة حول النقد الذي اشتُريت به (لكل جزء حوله).
//   - بيع ورقة زكاتها عليك: النقد الناتج يكمل حولها.
//   - ورقة تزكيها الشركة عنك (سهم سعودي للاستثمار): لا تدخل الوعاء، والنقد من بيعها مال جديد يبدأ حوله يوم البيع.
// النقد المصروف في الشراء يؤخذ من الأحدث أولًا (مثل إعداد «الأحدث أولًا» الافتراضي)، والبيع من الأقدم أولًا.
import { assess, toEngineEntry } from '../securities/securities.js';
import { calculateAssetValue } from './engine.js';

export const USD_SAR = 3.75;
const EPS = 1e-9;
const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

// تطبيقات للعرض. الأسماء لشركات وساطة مرخّصة، والربط هنا محاكاة لا اتصال حقيقي.
export const PROVIDERS = [
  { id: 'alinma-invest', name: 'الإنماء للاستثمار', markets: ['تداول', 'صناديق'] },
  { id: 'derayah', name: 'دراية المالية', markets: ['تداول', 'السوق الأمريكي'] },
  { id: 'sahm', name: 'سهم كابيتال', markets: ['السوق الأمريكي'] },
  { id: 'rajhi-capital', name: 'الراجحي المالية', markets: ['تداول', 'صناديق'] },
  { id: 'snb-capital', name: 'الأهلي المالية', markets: ['تداول', 'السوق الأمريكي'] },
  { id: 'aljazira-capital', name: 'الجزيرة كابيتال', markets: ['تداول'] },
];

// محافظ توضيحية عند الربط. الأسعار توضيحية (الأمريكي بالدولار)، وتواريخ الحول قبل يوم العرض بأقل من سنة.
const SEEDS = {
  'alinma-invest': {
    lots: [['1150', 400, '2026-02-15'], ['9404', 1500, '2026-04-22'], ['2222', 300, '2026-03-01']],
    prices: { 1150: 26.4, 9404: 10.2, 2222: 25.1 },
    cash: [[5000, '2026-06-10']],
  },
  derayah: {
    lots: [['AAPL', 12, '2026-01-20'], ['VOO', 6, '2026-05-05'], ['7010', 150, '2026-02-02']],
    prices: { AAPL: 232, VOO: 560, 7010: 41.8 },
    cash: [[3200, '2026-08-01']],
  },
  sahm: {
    lots: [['NVDA', 40, '2026-03-10'], ['MSFT', 5, '2026-06-18']],
    prices: { NVDA: 178, MSFT: 470 },
    cash: [[1800, '2026-07-07']],
  },
  'rajhi-capital': {
    lots: [['1120', 100, '2026-01-11'], ['9413', 800, '2026-04-02']],
    prices: { 1120: 98, 9413: 12.5 },
    cash: [[2500, '2026-05-25']],
  },
  'snb-capital': {
    lots: [['1180', 200, '2026-02-24'], ['SPY', 4, '2026-06-30']],
    prices: { 1180: 39, SPY: 640 },
    cash: [[1000, '2026-08-20']],
  },
  'aljazira-capital': {
    lots: [['2010', 150, '2026-03-15']],
    prices: { 2010: 70 },
    cash: [[900, '2026-07-01']],
  },
};

// عمليات تصل من التطبيق تلقائيًا بعد الربط (محاكاة لإشعارات الوسيط)، بالترتيب، وكلها ضمن النقد والكميات المتاحة
export const SCRIPTS = {
  'alinma-invest': [['BUY', '9404', 200, 10.25], ['SELL', '1150', 150, 26.8], ['BUY', '2222', 100, 25.0], ['SELL', '9404', 300, 10.3]],
  derayah: [['BUY', 'AAPL', 3, 235], ['SELL', '7010', 50, 42], ['BUY', 'VOO', 1, 565], ['SELL', 'AAPL', 5, 238]],
  sahm: [['SELL', 'NVDA', 5, 182], ['BUY', 'MSFT', 2, 472], ['SELL', 'MSFT', 1, 475]],
  'rajhi-capital': [['BUY', '9413', 100, 12.6], ['SELL', '1120', 30, 99], ['BUY', '1120', 10, 98.5]],
  'snb-capital': [['SELL', '1180', 50, 39.5], ['BUY', 'SPY', 1, 645]],
  'aljazira-capital': [['SELL', '2010', 50, 71], ['BUY', '2010', 20, 70.5]],
};

// العملية التالية التي سيرسلها التطبيق، أو null إذا انتهت
export function nextScripted(p) {
  const step = SCRIPTS[p.provider]?.[p.scriptAt ?? 0];
  return step ? { side: step[0], key: step[1], units: step[2], price: step[3] } : null;
}

export const providerOf = id => PROVIDERS.find(p => p.id === id);

// حكم الورقة وقيمتها لعدد من الوحدات بسعر معيّن
export function judge(key, units, price) {
  const a = assess({ symbol: key, units, price, intent: 'INVEST' });
  if (!a) throw new Error(`ورقة غير معروفة: ${key}`);
  return a;
}
const isUS = key => judge(key, 1, 1).market === 'US';
const fxOf = key => (isUS(key) ? USD_SAR : 1);

export function seedPortfolio(providerId, linkedAt) {
  const seed = SEEDS[providerId];
  if (!seed) throw new Error('تطبيق غير مدعوم');
  return {
    id: providerId,
    provider: providerId,
    linkedAt,
    prices: { ...seed.prices },
    lots: seed.lots.map(([key, units, hawlFrom]) => ({ key, units, hawlFrom })),
    cash: seed.cash.map(([amount, hawlFrom]) => ({ amount, hawlFrom })),
    trades: [],
    scriptAt: 0,
  };
}

const cashTotal = p => p.cash.reduce((s, c) => s + c.amount, 0);

// دمج دفعات النقد التي لها نفس تاريخ الحول
function mergeCash(cash) {
  const by = new Map();
  for (const c of cash) if (c.amount > EPS) by.set(c.hawlFrom, (by.get(c.hawlFrom) ?? 0) + c.amount);
  return [...by].map(([hawlFrom, amount]) => ({ amount: round2(amount), hawlFrom })).sort((a, b) => (a.hawlFrom < b.hawlFrom ? -1 : 1));
}
function mergeLots(lots) {
  const by = new Map();
  for (const l of lots) if (l.units > EPS) {
    const k = `${l.key}|${l.hawlFrom}`;
    by.set(k, { ...l, units: (by.get(k)?.units ?? 0) + l.units });
  }
  return [...by.values()];
}

// ملخص المحفظة: كل ورقة بقيمتها وحكمها ودفعاتها، والنقد، وما يدخل الوعاء
export function summarize(p) {
  const keys = [...new Set(p.lots.map(l => l.key))];
  const holdings = keys.map(key => {
    const lots = p.lots.filter(l => l.key === key).sort((a, b) => (a.hawlFrom < b.hawlFrom ? -1 : 1));
    const units = lots.reduce((s, l) => s + l.units, 0);
    const a = judge(key, units, p.prices[key]);
    return {
      key, name: a.name || a.nameEn || key, nameEn: a.nameEn, market: a.market, marketAr: a.marketAr, type: a.type,
      units, price: p.prices[key], fx: a.market === 'US' ? USD_SAR : 1, value: round2(a.value),
      zakatable: a.zakatable, base: round2(a.base), badge: a.badge, headline: a.headline, detail: a.detail, lots,
    };
  });
  const cash = round2(cashTotal(p));
  const value = round2(holdings.reduce((s, h) => s + h.value, 0) + cash);
  const base = round2(holdings.reduce((s, h) => s + h.base, 0) + cash);
  return { holdings, cash, cashLots: p.cash, value, base, zakat: round2(base / 40) };
}

// عملية من التطبيق: { side: 'BUY'|'SELL', key, units, price, date }. ترجع المحفظة الجديدة وأثر العملية.
export function applyTrade(p, { side, key, units, price, date, time }) {
  if (!(units > 0) || !(price > 0)) throw new Error('أدخل كمية وسعرًا أكبر من صفر');
  const a = judge(key, units, price);
  const fx = fxOf(key);
  const amount = units * price * fx;
  const before = summarize(p);
  let lots = p.lots.map(l => ({ ...l }));
  let cash = p.cash.map(c => ({ ...c }));

  if (side === 'BUY') {
    if (amount > cashTotal(p) + 0.005) throw new Error('النقد في المحفظة لا يكفي لهذه العملية');
    // نصرف من النقد الأحدث أولًا، ونعرف من أي حول جاء كل جزء
    let left = amount;
    const pieces = [];
    for (const c of [...cash].sort((x, y) => (x.hawlFrom > y.hawlFrom ? -1 : 1))) {
      if (left <= EPS) break;
      const take = Math.min(c.amount, left);
      c.amount -= take; left -= take;
      pieces.push({ amount: take, hawlFrom: c.hawlFrom });
    }
    lots = a.zakatable
      ? [...lots, ...pieces.map(x => ({ key, units: units * (x.amount / amount), hawlFrom: x.hawlFrom }))]
      : [...lots, { key, units, hawlFrom: date }];
  } else if (side === 'SELL') {
    const held = lots.filter(l => l.key === key).reduce((s, l) => s + l.units, 0);
    if (units > held + EPS) throw new Error('الكمية أكبر مما تملك من هذه الورقة');
    // نبيع من الأقدم أولًا، والنقد الناتج يكمل حول الورقة إن كانت زكاتها عليك
    let left = units;
    for (const l of lots.filter(x => x.key === key).sort((x, y) => (x.hawlFrom < y.hawlFrom ? -1 : 1))) {
      if (left <= EPS) break;
      const take = Math.min(l.units, left);
      l.units -= take; left -= take;
      cash.push({ amount: take * price * fx, hawlFrom: a.zakatable ? l.hawlFrom : date });
    }
  } else throw new Error('نوع العملية غير معروف');

  const next = { ...p, lots: mergeLots(lots), cash: mergeCash(cash), prices: { ...p.prices, [key]: price } };
  const after = summarize(next);
  const trade = {
    id: `${date}-${p.trades.length + 1}`, side, key, name: a.name || a.nameEn || key, units, price, fx, amount: round2(amount), date, time,
    zakatable: a.zakatable,
    impact: { valueBefore: before.value, valueAfter: after.value, baseBefore: before.base, baseAfter: after.base },
  };
  return { portfolio: { ...next, trades: [trade, ...p.trades] }, trade };
}

// تطبيق العملية التالية الواردة من التطبيق
export function receiveNext(p, date, time) {
  const t = nextScripted(p);
  if (!t) return null;
  const res = applyTrade(p, { ...t, date, time });
  return { portfolio: { ...res.portfolio, scriptAt: (p.scriptAt ?? 0) + 1 }, trade: res.trade };
}

// أصول المحفظة كما يقرأها المتجر: كل دفعة بحولها، والنقد بحوله، والقيمة الزكوية من المحرك
export function portfolioAssets(p) {
  const prov = providerOf(p.provider);
  const out = [];
  for (const l of p.lots) {
    const a = judge(l.key, l.units, p.prices[l.key]);
    const e = toEngineEntry(a);
    const engine = { [e.kind]: [e.entry] };
    out.push({
      id: `${p.id}:${l.key}:${l.hawlFrom}`, portfolio: p.id, kind: a.type === 'COMPANY' ? 'stock' : 'fund',
      engine, value: calculateAssetValue(engine), market: a.value, acquired: l.hawlFrom,
      title: `${a.name || a.nameEn} · ${prov?.name ?? ''}`, short: a.name || a.nameEn, detail: a.badge,
    });
  }
  for (const c of p.cash) {
    const engine = { manualAssets: [{ value: c.amount }] };
    out.push({
      id: `${p.id}:cash:${c.hawlFrom}`, portfolio: p.id, kind: 'cash', engine, value: calculateAssetValue(engine), acquired: c.hawlFrom,
      title: `نقد في ${prov?.name ?? 'المحفظة'}`, short: 'نقد المحفظة', detail: 'نقد غير مستثمر',
    });
  }
  return out;
}
