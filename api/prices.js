// خدمة الأسعار الحية (Vercel Function): GET /api/prices?symbols=4340&us=AAPL
// - صناديق تداول (ريت ومؤشرات) من SAHMK، متأخرة 15 دقيقة في الباقة المجانية. المفتاح في متغير البيئة SAHMK_API_KEY.
//   أسهم الشركات السعودية ما نطلب سعرها: الشركة تدفع الزكاة عن مساهميها فلا تدخل الوعاء. المفتاح لا يوصل للمتصفح.
// - الذهب والفضة من gold-api.com (بدون مفتاح): دولار للأونصة ← ريال للغرام (الريال مربوط على 3.75).
// - كل مصدر له احتياط: إذا فشل أو ما فيه مفتاح نرجع آخر سعر محفوظ من src/data/prices.json ونقول ذلك صراحة.
// - الأسهم والصناديق الأمريكية (ETF) من Finnhub باللحظة: GET /api/prices?us=AAPL,SPY
//   المفتاح في FINNHUB_API_KEY ولا يوصل للمتصفح. الباقة المجانية 60 طلبًا في الدقيقة، طلب لكل رمز.
// - حالة الأسواق (مفتوح/مغلق) محسوبة من الساعة: الذهب والفضة، والسوق الأمريكي، وتداول.
// - التخزين في شبكة Vercel: 15 دقيقة لو فيه أسهم سعودية (حد SAHMK 100 طلب يوميًا)،
//   و10 ثوانٍ للذهب والفضة والأمريكي حتى تتحرك الأسعار على الشاشة.
import prices from '../src/data/prices.json' with { type: 'json' };

export const SAR_PER_USD = 3.75;
export const GRAMS_PER_OUNCE = 31.1034768;
const SAHMK = 'https://api.sahmk.sa/api/v1';
const GOLD_API = 'https://api.gold-api.com/price';
const FINNHUB = 'https://finnhub.io/api/v1';
const TIMEOUT_MS = 4000;
const CACHE_SECONDS = 900;      // صناديق تداول (حد SAHMK اليومي)
const FAST_CACHE_SECONDS = 10;  // الذهب والفضة والأمريكي

const lastDate = Object.keys(prices).sort().at(-1);
export const FALLBACK = { date: lastDate, goldPerGram: prices[lastDate].gold, silverPerGram: prices[lastDate].silver };

const num = v => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[,%\s]/g, ''));
  return Number.isFinite(n) ? n : null;
};

// رموز تداول ونمو فقط (4 أرقام)، بحد أقصى 50 رمز في الطلب
export function parseSymbols(raw) {
  return [...new Set(String(raw ?? '').split(',').map(s => s.trim()).filter(s => /^\d{4}$/.test(s)))].slice(0, 50);
}

async function getJson(fetchImpl, url, headers = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { headers, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export function normalizeQuote(q) {
  const price = num(q?.price ?? q?.last_price ?? q?.close);
  if (!q?.symbol || price == null || price <= 0) return null;
  return {
    symbol: String(q.symbol),
    price,
    change: num(q.change),
    changePercent: num(q.change_percent),
    name: q.name_ar ?? q.name ?? q.name_en ?? null,
    at: q.updated_at ?? q.timestamp ?? q.time ?? null,
  };
}

export async function fetchStocks(symbols, { key, fetchImpl = fetch } = {}) {
  if (!symbols.length) return { source: 'none', quotes: {} };
  if (!key) return { source: 'fallback', reason: 'SAHMK_API_KEY غير مضبوط', quotes: {} };
  try {
    const data = await getJson(fetchImpl, `${SAHMK}/quotes/?symbols=${symbols.join(',')}`, { 'X-API-Key': key });
    const list = Array.isArray(data) ? data : data.quotes ?? data.results ?? data.data ?? [];
    const quotes = {};
    for (const q of list) {
      const n = normalizeQuote(q);
      if (n && symbols.includes(n.symbol)) quotes[n.symbol] = n;
    }
    return { source: 'sahmk', delayedMinutes: 15, quotes };
  } catch (e) {
    return { source: 'fallback', reason: `SAHMK: ${e.message}`, quotes: {} };
  }
}

export const ouncePriceToGram = usdPerOunce => (usdPerOunce * SAR_PER_USD) / GRAMS_PER_OUNCE;

export async function fetchMetals({ fetchImpl = fetch } = {}) {
  try {
    const [gold, silver] = await Promise.all([
      getJson(fetchImpl, `${GOLD_API}/XAU`),
      getJson(fetchImpl, `${GOLD_API}/XAG`),
    ]);
    const g = num(gold?.price), s = num(silver?.price);
    if (!(g > 0 && s > 0)) throw new Error('رد غير متوقع');
    return {
      source: 'gold-api',
      goldPerGram: Math.round(ouncePriceToGram(g) * 10000) / 10000,
      silverPerGram: Math.round(ouncePriceToGram(s) * 10000) / 10000,
      at: gold.updatedAt ?? silver.updatedAt ?? null,
    };
  } catch (e) {
    return { source: 'fallback', reason: `gold-api: ${e.message}`, ...FALLBACK, at: FALLBACK.date };
  }
}


// رموز السوق الأمريكي: حروف إنجليزية وأرقام ونقطة أو شرطة (BRK.B)، بحد أقصى 20 رمزًا
export function parseUsSymbols(raw) {
  return [...new Set(String(raw ?? '').split(',').map(s => s.trim().toUpperCase()).filter(s => /^[A-Z][A-Z0-9.-]{0,9}$/.test(s)))].slice(0, 20);
}

// رد Finnhub: c السعر الحالي، d التغير، dp نسبة التغير، pc إغلاق أمس، t وقت آخر صفقة (ثوانٍ)
export function normalizeFinnhub(symbol, q) {
  const price = num(q?.c);
  if (!(price > 0)) return null; // الرمز غير موجود يرجع أصفارًا
  return {
    symbol,
    price,
    change: num(q.d),
    changePercent: num(q.dp),
    previousClose: num(q.pc),
    at: q.t ? new Date(q.t * 1000).toISOString() : null,
  };
}

export async function fetchUsQuotes(symbols, { key, fetchImpl = fetch } = {}) {
  if (!symbols.length) return { source: 'none', quotes: {} };
  if (!key) return { source: 'fallback', reason: 'FINNHUB_API_KEY غير مضبوط', quotes: {} };
  const results = await Promise.allSettled(symbols.map(sym =>
    getJson(fetchImpl, `${FINNHUB}/quote?symbol=${encodeURIComponent(sym)}`, { 'X-Finnhub-Token': key })
      .then(q => normalizeFinnhub(sym, q))));
  const quotes = {};
  const failed = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) quotes[symbols[i]] = r.value;
    else failed.push(symbols[i]);
  });
  if (!Object.keys(quotes).length) return { source: 'fallback', reason: `Finnhub: تعذر جلب ${failed.join(', ')}`, quotes };
  return { source: 'finnhub', quotes, ...(failed.length ? { missing: failed } : {}) };
}

// ساعة ودقيقة ويوم الأسبوع في منطقة زمنية معينة
function clock(now, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(now);
  const get = t => parts.find(p => p.type === t).value;
  return { day: get('weekday'), minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

// هل السوق مفتوح الحين؟ (لا تُحسب العطل الرسمية، فيوم العطلة قد يظهر مفتوحًا والسعر ثابت)
export function marketStatus(now = new Date()) {
  const ny = clock(now, 'America/New_York');
  const ry = clock(now, 'Asia/Riyadh');
  const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(ny.day);
  // الذهب والفضة: من الأحد 6 مساءً إلى الجمعة 5 مساءً بتوقيت نيويورك، مع توقف يومي من 5 إلى 6 مساءً
  const metalsOpen =
    (ny.day === 'Sun' && ny.minutes >= 18 * 60) ||
    (['Mon', 'Tue', 'Wed', 'Thu'].includes(ny.day) && (ny.minutes < 17 * 60 || ny.minutes >= 18 * 60)) ||
    (ny.day === 'Fri' && ny.minutes < 17 * 60);
  // السوق الأمريكي: الاثنين إلى الجمعة من 9:30 صباحًا إلى 4 عصرًا بتوقيت نيويورك
  const usOpen = weekday && ny.minutes >= 9 * 60 + 30 && ny.minutes < 16 * 60;
  // تداول: الأحد إلى الخميس من 10 صباحًا إلى 3 عصرًا بتوقيت الرياض
  const tasiOpen = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'].includes(ry.day) && ry.minutes >= 10 * 60 && ry.minutes < 15 * 60;
  return { metals: { open: metalsOpen }, us: { open: usOpen }, tasi: { open: tasiOpen }, at: now.toISOString() };
}

export async function getPrices(query, {
  key = process.env.SAHMK_API_KEY, finnhubKey = process.env.FINNHUB_API_KEY, fetchImpl = fetch, now = new Date(),
} = {}) {
  const symbols = parseSymbols(query.symbols);
  const us = parseUsSymbols(query.us);
  const [stocks, usQuotes, metals] = await Promise.all([
    fetchStocks(symbols, { key, fetchImpl }),
    fetchUsQuotes(us, { key: finnhubKey, fetchImpl }),
    fetchMetals({ fetchImpl }),
  ]);
  return { fetchedAt: now.toISOString(), market: marketStatus(now), stocks, us: usQuotes, metals };
}

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const body = await getPrices(Object.fromEntries(url.searchParams));
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (body.stocks.source !== 'none') {
    // فيه أسهم سعودية: نخزّن طويلًا حتى ما نتجاوز حد SAHMK، ولا نخزّن ردًا احتياطيًا طويلًا
    const live = body.metals.source !== 'fallback' && body.stocks.source !== 'fallback';
    res.setHeader('Cache-Control', live ? `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=3600` : 'public, s-maxage=60');
  } else {
    // الذهب والفضة والأمريكي: تخزين قصير حتى تتحرك الأسعار، ويشترك فيه كل من يفتح التطبيق
    res.setHeader('Cache-Control', `public, s-maxage=${FAST_CACHE_SECONDS}, stale-while-revalidate=30`);
  }
  res.statusCode = 200;
  res.end(JSON.stringify(body));
}