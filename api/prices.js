// خدمة الأسعار الحية (Vercel Function): GET /api/prices?symbols=1120,2222
// - الأسهم السعودية (تداول ونمو) من SAHMK، متأخرة 15 دقيقة في الباقة المجانية. المفتاح في متغير البيئة SAHMK_API_KEY
//   ولا يوصل للمتصفح أبدًا.
// - الذهب والفضة من gold-api.com (بدون مفتاح): دولار للأونصة ← ريال للغرام (الريال مربوط على 3.75).
// - كل مصدر له احتياط: إذا فشل أو ما فيه مفتاح نرجع آخر سعر محفوظ من src/data/prices.json ونقول ذلك صراحة.
// - الرد يُخزَّن في شبكة Vercel 15 دقيقة (نفس تأخر الأسعار) حتى ما نتجاوز حد 100 طلب يوميًا.
import prices from '../src/data/prices.json' with { type: 'json' };

export const SAR_PER_USD = 3.75;
export const GRAMS_PER_OUNCE = 31.1034768;
const SAHMK = 'https://api.sahmk.sa/api/v1';
const GOLD_API = 'https://api.gold-api.com/price';
const TIMEOUT_MS = 4000;
const CACHE_SECONDS = 900;

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

export async function getPrices(query, { key = process.env.SAHMK_API_KEY, fetchImpl = fetch } = {}) {
  const symbols = parseSymbols(query.symbols);
  const [stocks, metals] = await Promise.all([fetchStocks(symbols, { key, fetchImpl }), fetchMetals({ fetchImpl })]);
  return { fetchedAt: new Date().toISOString(), stocks, metals };
}

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const body = await getPrices(Object.fromEntries(url.searchParams));
  // لا نخزّن ردًا احتياطيًا طويلًا حتى يرجع المصدر الحي بسرعة
  const live = body.metals.source !== 'fallback' && body.stocks.source !== 'fallback';
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', live ? `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=3600` : 'public, s-maxage=60');
  res.statusCode = 200;
  res.end(JSON.stringify(body));
}
