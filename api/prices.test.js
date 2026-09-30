// خدمة الأسعار: نختبرها بدون إنترنت (fetch وهمي) — الرد الطبيعي، والاحتياط لما يفشل المصدر أو يغيب المفتاح.
import { describe, expect, it } from 'vitest';
import handler, {
  FALLBACK, fetchMetals, fetchStocks, fetchUsQuotes, getPrices, marketStatus, normalizeFinnhub, normalizeQuote, ouncePriceToGram,
  parseSymbols, parseUsSymbols,
} from './prices.js';

const ok = body => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
const fail = status => Promise.resolve({ ok: false, status, json: () => Promise.resolve({}) });

function fakeFetch(routes) {
  const calls = [];
  const impl = (url, opts) => {
    calls.push({ url, headers: opts?.headers ?? {} });
    const hit = Object.entries(routes).find(([k]) => url.includes(k));
    return hit ? hit[1](url) : Promise.reject(new Error('offline'));
  };
  impl.calls = calls;
  return impl;
}

describe('parseSymbols', () => {
  it('keeps only Tadawul/Nomu codes, unique, max 50', () => {
    expect(parseSymbols('1120, 2222,AAPL,1120,abc,12345')).toEqual(['1120', '2222']);
    expect(parseSymbols(Array.from({ length: 60 }, (_, i) => 1000 + i).join(','))).toHaveLength(50);
    expect(parseSymbols(undefined)).toEqual([]);
  });
});

describe('stocks (SAHMK)', () => {
  it('normalizes quotes given as strings', () => {
    expect(normalizeQuote({ symbol: '2222', price: '28.30', change: '-0.15', change_percent: '-0.53%', name_en: 'Saudi Aramco' }))
      .toMatchObject({ symbol: '2222', price: 28.3, change: -0.15, changePercent: -0.53, name: 'Saudi Aramco' });
    expect(normalizeQuote({ symbol: '2222', price: '0' })).toBeNull();
    expect(normalizeQuote({ price: '10' })).toBeNull();
  });

  it('sends the key in X-API-Key and returns quotes by symbol', async () => {
    const f = fakeFetch({ 'api.sahmk.sa': () => ok({ quotes: [{ symbol: '1120', price: '97.40' }, { symbol: '9999', price: '1' }] }) });
    const r = await fetchStocks(['1120'], { key: 'k', fetchImpl: f });
    expect(r.source).toBe('sahmk');
    expect(r.quotes).toEqual({ '1120': expect.objectContaining({ price: 97.4 }) });
    expect(f.calls[0].url).toContain('/quotes/?symbols=1120');
    expect(f.calls[0].headers['X-API-Key']).toBe('k');
  });

  it('falls back without a key or when the source fails', async () => {
    expect((await fetchStocks(['1120'], { key: '' })).source).toBe('fallback');
    const r = await fetchStocks(['1120'], { key: 'k', fetchImpl: fakeFetch({ 'api.sahmk.sa': () => fail(429) }) });
    expect(r).toMatchObject({ source: 'fallback', quotes: {} });
    expect(r.reason).toMatch(/429/);
  });
});

describe('metals (gold-api.com)', () => {
  it('converts USD per ounce to SAR per gram', async () => {
    const f = fakeFetch({ '/XAU': () => ok({ price: 3000, updatedAt: '2026-09-30T10:00:00Z' }), '/XAG': () => ok({ price: 40 }) });
    const m = await fetchMetals({ fetchImpl: f });
    expect(m.source).toBe('gold-api');
    expect(m.goldPerGram).toBeCloseTo((3000 * 3.75) / 31.1034768, 3);
    expect(m.silverPerGram).toBeCloseTo(ouncePriceToGram(40), 3);
  });
  it('falls back to the last saved engine prices', async () => {
    const m = await fetchMetals({ fetchImpl: fakeFetch({}) });
    expect(m).toMatchObject({ source: 'fallback', goldPerGram: FALLBACK.goldPerGram, silverPerGram: FALLBACK.silverPerGram });
  });
});

describe('handler', () => {
  const run = async fetchImpl => {
    const headers = {};
    let body = '';
    const res = { setHeader: (k, v) => { headers[k] = v; }, end: b => { body = b; } };
    const original = globalThis.fetch;
    globalThis.fetch = fetchImpl;
    try { await handler({ url: '/api/prices?symbols=1120' }, res); } finally { globalThis.fetch = original; }
    return { headers, body: JSON.parse(body), status: res.statusCode };
  };

  it('caches a live answer for 15 minutes on the CDN', async () => {
    process.env.SAHMK_API_KEY = 'k';
    const r = await run(fakeFetch({
      'api.sahmk.sa': () => ok({ quotes: [{ symbol: '1120', price: '97.40' }] }),
      '/XAU': () => ok({ price: 3000 }), '/XAG': () => ok({ price: 40 }),
    }));
    delete process.env.SAHMK_API_KEY;
    expect(r.status).toBe(200);
    expect(r.headers['Cache-Control']).toContain('s-maxage=900');
    expect(r.body.stocks.quotes['1120'].price).toBe(97.4);
  });

  it('answers with saved prices when everything is offline, and caches only briefly', async () => {
    const r = await run(fakeFetch({}));
    expect(r.body.metals.source).toBe('fallback');
    expect(r.headers['Cache-Control']).toBe('public, s-maxage=60');
  });

  it('getPrices never throws', async () => {
    await expect(getPrices({ symbols: '1120' }, { key: 'k', fetchImpl: () => { throw new Error('boom'); } })).resolves.toBeTruthy();
  });
});

describe('US stocks and ETFs (Finnhub)', () => {
  it('parses US tickers: uppercase, unique, max 20', () => {
    expect(parseUsSymbols('aapl, SPY,brk.b,AAPL,1120,$$$')).toEqual(['AAPL', 'SPY', 'BRK.B']);
    expect(parseUsSymbols(Array.from({ length: 30 }, (_, i) => `A${i}`).join(','))).toHaveLength(20);
    expect(parseUsSymbols(undefined)).toEqual([]);
  });

  it('normalizes a quote and rejects unknown symbols (all zeros)', () => {
    expect(normalizeFinnhub('AAPL', { c: 227.5, d: 1.2, dp: 0.53, pc: 226.3, t: 1790000000 }))
      .toMatchObject({ symbol: 'AAPL', price: 227.5, change: 1.2, changePercent: 0.53, previousClose: 226.3 });
    expect(normalizeFinnhub('NOPE', { c: 0, d: null, dp: null, pc: 0, t: 0 })).toBeNull();
  });

  it('sends the key in a header, not the URL, and keeps partial results', async () => {
    const f = fakeFetch({
      'symbol=AAPL': () => ok({ c: 227.5, d: 1, dp: 0.4, pc: 226.5, t: 1790000000 }),
      'symbol=SPY': () => fail(429),
    });
    const r = await fetchUsQuotes(['AAPL', 'SPY'], { key: 'fk', fetchImpl: f });
    expect(r.source).toBe('finnhub');
    expect(r.quotes.AAPL.price).toBe(227.5);
    expect(r.missing).toEqual(['SPY']);
    expect(f.calls[0].headers['X-Finnhub-Token']).toBe('fk');
    expect(f.calls.every(c => !c.url.includes('fk'))).toBe(true);
  });

  it('falls back without a key or when every symbol fails', async () => {
    expect((await fetchUsQuotes(['AAPL'], { key: '' })).source).toBe('fallback');
    expect((await fetchUsQuotes(['AAPL'], { key: 'fk', fetchImpl: fakeFetch({}) })).source).toBe('fallback');
    expect((await fetchUsQuotes([], { key: 'fk' })).source).toBe('none');
  });
});

describe('marketStatus', () => {
  const at = iso => marketStatus(new Date(iso));

  it('demo day (Saturday 3 Oct 2026, noon Riyadh): every market is closed', () => {
    expect(at('2026-10-03T09:00:00Z')).toMatchObject({ metals: { open: false }, us: { open: false }, tasi: { open: false } });
  });

  it('Wednesday 6 pm Riyadh: US and metals open, Tadawul closed', () => {
    expect(at('2026-09-30T15:00:00Z')).toMatchObject({ metals: { open: true }, us: { open: true }, tasi: { open: false } });
  });

  it('Sunday 11 am Riyadh: Tadawul open, US closed, metals not yet open', () => {
    expect(at('2026-10-04T08:00:00Z')).toMatchObject({ metals: { open: false }, us: { open: false }, tasi: { open: true } });
  });

  it('metals pause daily between 5 and 6 pm New York time', () => {
    expect(at('2026-09-30T21:30:00Z').metals.open).toBe(false); // 5:30 pm EDT
    expect(at('2026-09-30T22:30:00Z').metals.open).toBe(true);  // 6:30 pm EDT
  });
});

describe('handler (fast mode: metals + US only)', () => {
  it('caches for 10 seconds and returns market status and US quotes', async () => {
    const headers = {};
    let body = '';
    const res = { setHeader: (k, v) => { headers[k] = v; }, end: b => { body = b; } };
    const original = globalThis.fetch;
    globalThis.fetch = fakeFetch({
      'symbol=SPY': () => ok({ c: 570.1, d: -2, dp: -0.35, pc: 572.1, t: 1790000000 }),
      '/XAU': () => ok({ price: 3000 }), '/XAG': () => ok({ price: 40 }),
    });
    process.env.FINNHUB_API_KEY = 'fk';
    try { await handler({ url: '/api/prices?us=SPY' }, res); } finally { globalThis.fetch = original; delete process.env.FINNHUB_API_KEY; }
    const r = JSON.parse(body);
    expect(headers['Cache-Control']).toContain('s-maxage=10');
    expect(r.us.quotes.SPY.price).toBe(570.1);
    expect(r.market).toHaveProperty('us.open');
    expect(r.stocks.source).toBe('none');
  });
});