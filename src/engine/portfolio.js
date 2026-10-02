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

// أنواع التطبيقات التي يستثمر فيها العميل
export const KINDS = {
  broker: { label: 'شركات الوساطة', markets: 'تداول' },
  brokerUS: { label: 'شركات الوساطة', markets: 'تداول والسوق الأمريكي' },
  robo: { label: 'المستشارون الآليون', markets: 'صناديق مؤشرات وصكوك وذهب' },
  crowd: { label: 'التمويل الجماعي بالدين', markets: 'تمويل منشآت بعائد' },
  intl: { label: 'منصات دولية', markets: 'السوق الأمريكي' },
};
export const GROUPS = [['شركات الوساطة', ['brokerUS', 'broker']], ['المستشارون الآليون', ['robo']], ['التمويل الجماعي بالدين', ['crowd']], ['منصات دولية', ['intl']]];

// التطبيقات للعرض: شركات الوساطة التي يتداول عبرها الأفراد (ترتيب أرقام لشركات الوساطة 2025)،
// والمستشارون الآليون، ومنصات التمويل الجماعي بالدين، ومنصات دولية. الربط هنا محاكاة لا اتصال حقيقي.
export const PROVIDERS = [
  ['rajhi-capital', 'الراجحي المالية', 'brokerUS'], ['snb-capital', 'الأهلي المالية', 'brokerUS'], ['derayah', 'دراية المالية', 'brokerUS'],
  ['alinma-invest', 'الإنماء للاستثمار', 'brokerUS'], ['riyad-capital', 'الرياض المالية', 'brokerUS'], ['sahm', 'سهم كابيتال', 'brokerUS'],
  ['aljazira-capital', 'الجزيرة كابيتال', 'brokerUS'], ['albilad', 'البلاد المالية', 'brokerUS'], ['sab-invest', 'ساب إنفست', 'brokerUS'],
  ['bsf-capital', 'السعودي الفرنسي كابيتال', 'brokerUS'], ['anb-capital', 'العربي المالية', 'brokerUS'], ['alistithmar', 'الاستثمار كابيتال', 'brokerUS'],
  ['awaed', 'عوائد الأصول', 'brokerUS'], ['yaqeen', 'يقين كابيتال', 'brokerUS'], ['alkhabeer', 'الخبير المالية', 'brokerUS'],
  ['jadwa', 'جدوى للاستثمار', 'brokerUS'], ['musharaka', 'مشاركة المالية', 'brokerUS'], ['audi-capital', 'عودة كابيتال', 'brokerUS'],
  ['enbd-capital', 'الإمارات دبي الوطني كابيتال', 'brokerUS'], ['hsbc-sa', 'إتش إس بي سي العربية السعودية', 'broker'],
  ['efg-hermes', 'إي إف جي هيرميس السعودية', 'broker'], ['alkhair', 'الخير كابيتال', 'broker'], ['gib-capital', 'جي آي بي كابيتال', 'broker'],
  ['sico', 'سيكو كابيتال', 'broker'], ['arbah', 'أرباح المالية', 'broker'], ['nefaie', 'النفيعي للاستثمار', 'broker'],
  ['osool-bakheet', 'أصول وبخيت للاستثمار', 'broker'],
  ['malaa', 'ملاءة', 'robo'], ['abyan', 'أبيان كابيتال', 'robo'], ['drahim', 'دراهم', 'robo'], ['tamra', 'تمرة كابيتال', 'robo'],
  ['derayah-smart', 'دراية الذكية', 'robo'], ['mod5r', 'مدخر', 'robo'],
  ['lendo', 'ليندو', 'crowd'], ['tameed', 'تعميد', 'crowd'], ['raqamyah', 'رقمية', 'crowd'], ['forus', 'فرص', 'crowd'],
  ['themar', 'ثمار', 'crowd'], ['ulend', 'يولند', 'crowd'],
  ['etoro', 'إيتورو', 'intl'], ['ibkr', 'إنتراكتيف بروكرز', 'intl'],
].map(([id, name, kind]) => ({ id, name, kind, markets: KINDS[kind].markets }));

// محافظ مختارة يدويًا لأشهر التطبيقات. الأسعار توضيحية (الأمريكي بالدولار)، والحول قبل يوم العرض بأقل من سنة.
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
const SCRIPTS = {
  'alinma-invest': [['BUY', '9404', 200, 10.25], ['SELL', '1150', 150, 26.8], ['BUY', '2222', 100, 25.0], ['SELL', '9404', 300, 10.3]],
  derayah: [['BUY', 'AAPL', 3, 235], ['SELL', '7010', 50, 42], ['BUY', 'VOO', 1, 565], ['SELL', 'AAPL', 5, 238]],
  sahm: [['SELL', 'NVDA', 5, 182], ['BUY', 'MSFT', 2, 472], ['SELL', 'MSFT', 1, 475]],
  'rajhi-capital': [['BUY', '9413', 100, 12.6], ['SELL', '1120', 30, 99], ['BUY', '1120', 10, 98.5]],
  'snb-capital': [['SELL', '1180', 50, 39.5], ['BUY', 'SPY', 1, 645]],
  'aljazira-capital': [['SELL', '2010', 50, 71], ['BUY', '2010', 20, 70.5]],
};

// ---------- محافظ مولّدة لباقي التطبيقات بحسب نوعها (ثابتة لكل تطبيق) ----------
const PRICES = {
  1120: 98, 1180: 39, 1150: 26.4, 2222: 25.1, 7010: 41.8, 2010: 70, 1211: 52, 2280: 55, 1010: 28, 1060: 35, 4190: 13, 4013: 280,
  9404: 10.2, 9405: 14, 9413: 12.5,
  AAPL: 232, MSFT: 470, NVDA: 178, AMZN: 220, GOOGL: 190, META: 700, SPY: 640, VOO: 560, QQQ: 560, IVV: 640, SPUS: 45, HLAL: 55, GLD: 330, SPSK: 18,
};
const SA_STOCKS = ['1120', '1180', '1150', '2222', '7010', '2010', '1211', '2280', '1010', '1060', '4190', '4013'];
const SA_FUNDS = ['9404', '9405', '9413'];
const US_STOCKS = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META'];
const US_ETFS = ['SPY', 'VOO', 'QQQ', 'IVV', 'SPUS', 'HLAL'];
const ROBO = ['SPUS', 'HLAL', 'GLD', 'SPSK', '9404', '9405', '9413', 'VOO'];
const DATES = ['2026-01-11', '2026-01-27', '2026-02-15', '2026-03-10', '2026-04-02', '2026-04-22', '2026-05-25', '2026-06-18', '2026-07-07', '2026-08-01'];
const FIN_NAMES = ['تمويل فواتير توريد لمنشأة صغيرة', 'تمويل عقد مشتريات حكومية', 'تمويل رأس مال عامل لمتجر', 'تمويل مخزون لمنشأة تجزئة', 'تمويل مقاول من الباطن', 'تمويل منشأة لوجستية'];

const hashOf = s => [...String(s)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 2166136261);
// عناصر مختلفة من القائمة بحسب رقم ثابت
const pickN = (arr, h, n) => {
  const out = [];
  for (let i = 0; out.length < Math.min(n, arr.length); i++) {
    const x = arr[(h + i * 7 + (h >>> (i + 3))) % arr.length];
    if (!out.includes(x)) out.push(x);
  }
  return out;
};
const isFin = key => String(key).startsWith('FIN:');
const isUSKey = key => !isFin(key) && !/^\d{4}$/.test(key);
const fxOf = key => (isUSKey(key) ? USD_SAR : 1);
const unitsFor = (key, target) => (isFin(key) ? target : Math.max(1, Math.round(target / (PRICES[key] * fxOf(key)))));

function generate(kind, h) {
  const targets = [6000, 9000, 12000, 15000];
  const t = i => targets[(h >>> (i * 2)) % 4];
  const dates = pickN(DATES, h, 6);
  let keys;
  if (kind === 'broker') keys = [...pickN(SA_STOCKS, h, 2), ...pickN(SA_FUNDS, h >>> 4, 1)];
  else if (kind === 'brokerUS') keys = [...pickN(SA_STOCKS, h, 2), ...pickN(US_STOCKS, h >>> 3, 1), ...pickN(US_ETFS, h >>> 5, 1)];
  else if (kind === 'intl') keys = [...pickN(US_STOCKS, h, 2), ...pickN(US_ETFS, h >>> 4, 1)];
  else if (kind === 'robo') keys = pickN(ROBO, h, 3);
  else keys = [];
  const lots = keys.map((key, i) => [key, unitsFor(key, t(i)), dates[i]]);
  const names = {};
  if (kind === 'crowd') {
    pickN(FIN_NAMES, h, 3).forEach((n, i) => { const key = `FIN:${i + 1}`; names[key] = n; lots.push([key, [5000, 8000, 10000, 12000][(h >>> i) % 4], dates[i]]); });
  }
  const prices = Object.fromEntries(keys.map(k => [k, PRICES[k]]));
  for (const k of Object.keys(names)) prices[k] = 1;
  return { lots, prices, names, cash: [[[1500, 2500, 4000, 6000][h % 4], dates[5]]] };
}

// عمليات مولّدة تناسب نوع التطبيق، ونتأكد أن كل واحدة ممكنة (نقد كافٍ وكمية مملوكة)
function generateScript(p, kind, h) {
  const bump = (key, k) => (isFin(key) ? 1 : Math.round(p.prices[key] * (1 + (((h >>> k) % 5) - 1) / 100) * 100) / 100);
  const steps = [];
  let cur = p;
  const tryStep = (side, key, units) => {
    if (!(units > 0)) return;
    const st = [side, key, units, cur.prices[key] ?? PRICES[key] ?? 1];
    if (!isFin(key)) st[3] = bump(key, steps.length + 1);
    try { cur = applyTrade(cur, { side: st[0], key: st[1], units: st[2], price: st[3], date: cur.linkedAt }).portfolio; steps.push(st); } catch { /* لا تكفي، نتخطاها */ }
  };
  const cash = () => cashTotal(cur);
  const held = key => cur.lots.filter(l => l.key === key).reduce((x, l) => x + l.units, 0);
  const keys = [...new Set(p.lots.map(l => l.key))];
  if (kind === 'crowd') {
    cur = { ...cur, names: { ...cur.names, 'FIN:4': FIN_NAMES[(h + 3) % FIN_NAMES.length] }, prices: { ...cur.prices, 'FIN:4': 1 } };
    tryStep('BUY', 'FIN:4', Math.round(cash() * 0.6));
    tryStep('SELL', 'FIN:1', Math.round(held('FIN:1') * 0.4));
    tryStep('BUY', 'FIN:4', Math.round(cash() * 0.5));
    return { steps, names: cur.names };
  }
  const zak = keys.find(k => judge(k, 1, cur.prices[k]).zakatable);
  const exempt = keys.find(k => !judge(k, 1, cur.prices[k]).zakatable);
  const price = k => cur.prices[k] * fxOf(k);
  if (zak) tryStep('BUY', zak, Math.floor((cash() * 0.4) / price(zak)));
  if (exempt) tryStep('SELL', exempt, Math.floor(held(exempt) / 3));
  if (exempt) tryStep('BUY', exempt, Math.floor((cash() * 0.5) / price(exempt)));
  if (zak) tryStep('SELL', zak, Math.floor(held(zak) / 2));
  // إعادة توازن (مثل المستشار الآلي): بيع جزء من ورقة وشراء أخرى بالنقد، حتى تكتمل العمليات
  for (let i = 0; steps.length < 3 && i < keys.length; i++) {
    const a = keys[i], b = keys[(i + 1) % keys.length];
    tryStep('SELL', a, Math.max(1, Math.floor(held(a) / 3)));
    if (steps.length < 3) tryStep('BUY', b, Math.floor((cash() * 0.7) / price(b)));
  }
  return { steps, names: cur.names };
}

export const providerOf = id => PROVIDERS.find(p => p.id === id);

// علامة نصية للشركة (ليست شعارها الرسمي): أول حرف من الكلمة المميزة في اسمها، بلون ثابت لها
const MARK_COLORS = ['#002134', '#0F5257', '#2C4A6E', '#2E6B45', '#7A2E3A', '#6B5B1E', '#4B3A6E', '#6E4A2E', '#1F5F8B', '#5A3E5D'];
const GENERIC = new Set(['المالية', 'كابيتال', 'للاستثمار', 'الاستثمار', 'السعودية', 'العربية', 'الوطني', 'الذكية', 'تطبيق']);
export function markOf(p) {
  const words = String(p.name ?? '').split(/\s+/).filter(Boolean);
  const w = words.find(x => !GENERIC.has(x)) ?? words[0] ?? '؟';
  const core = w.startsWith('ال') && w.length > 3 ? w.slice(2) : w;
  return { letter: core[0], color: MARK_COLORS[hashOf(p.id ?? p.name) % MARK_COLORS.length] };
}

const fmt = n => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
// وصف العملية للعرض: «شراء 3 أبل» أو «تمويل جديد 2,400 ر.س · ...» أو «سداد 3,200 ر.س من ...»
export function tradeLabel(t) {
  if (isFin(t.key)) return t.side === 'BUY' ? `تمويل جديد ${fmt(t.amount)} ر.س · ${t.name}` : `سداد ${fmt(t.amount)} ر.س من ${t.name}`;
  return `${t.side === 'BUY' ? 'شراء' : 'بيع'} ${fmt(t.units)} ${t.name}`;
}
// أثر العملية على الحول بجملة قصيرة
export function tradeNote(t) {
  if (isFin(t.key)) return t.side === 'BUY' ? 'من نقد المحفظة إلى تمويل، والحول مستمر' : 'السداد نقد يكمل حول التمويل';
  return t.side === 'BUY'
    ? (t.zakatable ? 'تكمل حول النقد' : 'تزكيه الشركة، فخرج المبلغ من الوعاء')
    : (t.zakatable ? 'النقد يكمل حولها' : 'نقد جديد يبدأ حوله اليوم');
}

// حكم الورقة وقيمتها لعدد من الوحدات بسعر معيّن. التمويل الجماعي دين مرجو السداد يُزكّى أصله كل حول.
export function judge(key, units, price, names = {}) {
  if (isFin(key)) {
    const v = units * price;
    return {
      name: names[key] ?? 'تمويل قائم', market: 'FIN', marketAr: 'تمويل جماعي', type: 'FINANCING', zakatable: true, value: v, base: v,
      badge: 'الزكاة عليك', headline: 'تمويل قائم: الزكاة عليك',
      detail: 'مبلغ مقرَض لمنشأة عبر منصة تمويل جماعي، دين مرجو السداد فيُزكّى أصله كل حول، والعائد يُضم لنقدك إذا قبضته.',
    };
  }
  const a = assess({ symbol: key, units, price, intent: 'INVEST' });
  if (!a) throw new Error(`ورقة غير معروفة: ${key}`);
  return a;
}

// محفظة عند الربط: مختارة لأشهر التطبيقات، ومولّدة بحسب النوع لباقيها ولأي تطبيق يضيفه العميل باسمه
export function seedPortfolio(providerId, linkedAt, custom) {
  const prov = providerOf(providerId) ?? (custom && { id: providerId, name: custom.name, kind: custom.kind });
  if (!prov || !KINDS[prov.kind]) throw new Error('تطبيق غير مدعوم');
  const h = hashOf(providerId);
  const seed = SEEDS[providerId] ?? generate(prov.kind, h);
  const base = {
    id: providerId, provider: providerId, name: prov.name, kind: prov.kind, custom: Boolean(custom), linkedAt,
    prices: { ...seed.prices }, names: { ...(seed.names ?? {}) },
    lots: seed.lots.map(([key, units, hawlFrom]) => ({ key, units, hawlFrom })),
    cash: seed.cash.map(([amount, hawlFrom]) => ({ amount, hawlFrom })),
    trades: [], scriptAt: 0,
  };
  if (SCRIPTS[providerId]) return { ...base, script: SCRIPTS[providerId] };
  const g = generateScript(base, prov.kind, h);
  return { ...base, script: g.steps, names: g.names };
}

// العملية التالية التي سيرسلها التطبيق، أو null إذا انتهت
export function nextScripted(p) {
  const step = p.script?.[p.scriptAt ?? 0];
  return step ? { side: step[0], key: step[1], units: step[2], price: step[3] } : null;
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
    const a = judge(key, units, p.prices[key], p.names);
    return {
      key, name: a.name || a.nameEn || key, nameEn: a.nameEn, market: a.market, marketAr: a.marketAr, type: a.type,
      units, price: p.prices[key], fx: fxOf(key), value: round2(a.value),
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
  const a = judge(key, units, price, p.names);
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
  const out = [];
  for (const l of p.lots) {
    const a = judge(l.key, l.units, p.prices[l.key], p.names);
    const e = isFin(l.key) ? { kind: 'manualAssets', entry: { value: a.base } } : toEngineEntry(a);
    const engine = { [e.kind]: [e.entry] };
    out.push({
      id: `${p.id}:${l.key}:${l.hawlFrom}`, portfolio: p.id, kind: isFin(l.key) ? 'financing' : a.type === 'COMPANY' ? 'stock' : 'fund',
      engine, value: calculateAssetValue(engine), market: a.value, acquired: l.hawlFrom,
      title: `${a.name || a.nameEn} · ${p.name}`, short: a.name || a.nameEn, detail: a.badge,
    });
  }
  for (const c of p.cash) {
    const engine = { manualAssets: [{ value: c.amount }] };
    out.push({
      id: `${p.id}:cash:${c.hawlFrom}`, portfolio: p.id, kind: 'cash', engine, value: calculateAssetValue(engine), acquired: c.hawlFrom,
      title: `نقد في ${p.name}`, short: 'نقد المحفظة', detail: 'نقد غير مستثمر',
    });
  }
  return out;
}
