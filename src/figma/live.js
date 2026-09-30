// الأسعار الحية في الواجهة: تسأل /api/prices (خدمة Vercel في api/prices.js) وترجع للأسعار المحفوظة
// من بيانات المحرك إذا ما ردّت الخدمة، حتى ما تتعطل الشاشة وقت العرض.
import { useEffect, useState } from 'react';
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
