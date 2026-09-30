// الأسعار الحية في الواجهة: تسأل /api/prices (خدمة Vercel في api/prices.js) وترجع للأسعار المحفوظة
// من بيانات المحرك إذا ما ردّت الخدمة، حتى ما تتعطل الشاشة وقت العرض.
import { useCallback, useEffect, useState } from 'react';
import view from '../data/ahmad-view.json';

const cache = new Map();   // نفس الطلب ما يتكرر لو رجع المستخدم للشاشة
const SAUDI = new Set(['TASI', 'NOMU']);

export const saudiSymbol = r => (r?.found && SAUDI.has(r.market) && /^\d{4}$/.test(r.symbol ?? '') ? r.symbol : null);

export const FALLBACK_METALS = {
  source: 'fallback',
  goldPerGram: view.prices.goldPerGram,
  silverPerGram: view.prices.silverPerGram,
  at: view.prices.date,
};

function load(symbols) {
  const key = symbols.join(',');
  if (!cache.has(key)) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    cache.set(key, fetch(`/api/prices?symbols=${key}`, { signal: ctrl.signal })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .catch(() => { cache.delete(key); return null; })
      .finally(() => clearTimeout(timer)));
  }
  return cache.get(key);
}

// symbols: رموز تداول ونمو المطلوبة (قد تكون فاضية للذهب والفضة فقط)
export function useLivePrices(symbols = []) {
  const key = symbols.filter(Boolean).join(',');
  const [state, setState] = useState({ key: null, data: null });
  useEffect(() => {
    let alive = true;
    load(key ? key.split(',') : []).then(data => { if (alive) setState({ key, data }); });
    return () => { alive = false; };
  }, [key]);
  const data = state.key === key ? state.data : null;
  const loading = state.key !== key;
  const metals = data?.metals?.source && data.metals.source !== 'fallback' ? data.metals : FALLBACK_METALS;
  return {
    loading,
    metals,
    quotes: data?.stocks?.quotes ?? {},
    stocksSource: data?.stocks?.source ?? (loading ? 'loading' : 'fallback'),
    delayedMinutes: data?.stocks?.delayedMinutes ?? null,
    fetchedAt: data?.fetchedAt ?? null,
  };
}

// «09:41» بتوقيت الرياض
export const timeOf = iso => {
  if (!iso || !/T/.test(iso)) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' });
};

// ---------------------------------------------------------------------------
// الوضع المباشر: طلب عند الدخول، وزر للتحديث
// ---------------------------------------------------------------------------

// تاريخ اليوم بتوقيت الرياض بصيغة YYYY-MM-DD
export const riyadhToday = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(now);

// يجلب الأسعار (الذهب والفضة + الرموز الأمريكية) مرة واحدة لما يدخل المستخدم الوضع المباشر،
// ومرة لما يضيف سهمًا أمريكيًا جديدًا، وبعدها يوقف. وللتحديث زر يستدعي refresh().
// يتذكر الرد السابق حتى نعرف اتجاه كل سعر (صعود أو نزول) ونومّضه في الواجهة.
// لو ما ردّت الخدمة نكمل بالأسعار المحفوظة، وما تتعطل الشاشة.
// delayMs: انتظار قبل الطلب، حتى ما نرسل طلبًا مع كل حرف يكتبه المستخدم في البحث.
export function useLiveFeed({ enabled = true, us = [], delayMs = 0 } = {}) {
  const key = [...new Set(us.filter(Boolean).map(s => s.toUpperCase()))].sort().join(',');
  const [state, setState] = useState({ data: null, prev: null, error: null, receivedAt: null, loading: false });
  const [nonce, setNonce] = useState(0); // كل ضغطة على زر التحديث تزيده فيُعاد الطلب

  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    const ctrl = new AbortController();
    const start = setTimeout(async () => {
      setState(s => ({ ...s, loading: true }));
      const abort = setTimeout(() => ctrl.abort(), 8000);
      try {
        const res = await fetch(`/api/prices${key ? `?us=${key}` : ''}`, { signal: ctrl.signal, cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (alive) setState(s => ({ data, prev: s.data ?? data, error: null, receivedAt: Date.now(), loading: false }));
      } catch (e) {
        if (alive) setState(s => ({ ...s, error: e.name === 'AbortError' ? 'timeout' : String(e.message ?? e), loading: false }));
      } finally {
        clearTimeout(abort);
      }
    }, delayMs);
    return () => { alive = false; clearTimeout(start); ctrl.abort(); };
  }, [enabled, key, delayMs, nonce]);

  const refresh = useCallback(() => setNonce(n => n + 1), []);

  const { data, prev } = state;
  const metalsLive = data?.metals && data.metals.source !== 'fallback';
  const metals = metalsLive ? data.metals : FALLBACK_METALS;
  const quotes = data?.us?.quotes ?? {};
  const sign = (a, b) => (a == null || b == null || a === b ? 0 : a > b ? 1 : -1);
  return {
    refresh,
    loading: state.loading,
    ready: Boolean(data),
    metalsLive,
    metals,
    quotes,
    market: data?.market ?? null,
    fetchedAt: data?.fetchedAt ?? null,
    receivedAt: state.receivedAt,
    error: state.error,
    // اتجاه آخر حركة: 1 صعود، -1 نزول، 0 بدون تغيير
    metalDir: m => sign(data?.metals?.[`${m}PerGram`], prev?.metals?.[`${m}PerGram`]),
    quoteDir: s => sign(quotes[s]?.price, prev?.us?.quotes?.[s]?.price),
  };
}
