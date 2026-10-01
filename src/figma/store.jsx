// حالة النموذج، بوجهين:
// - «قصة أحمد» (story): أرقامه من ahmad-view.json، يوم العرض 3 أكتوبر، والأسعار المحفوظة.
// - «مباشر» (live): المحرك يشتغل هنا في المتصفح على تاريخ اليوم الحقيقي وسعر السوق الآن،
//   ويُعاد الحساب مع كل تحديث للأسعار، وتُعاد قيمة كل أصل مضاف (ذهب، فضة، سهم أمريكي).
// الوعاء = أرصدة البنوك من المحرك + calculateAssetValue على الأصول المضافة.
import { useMemo, useState } from 'react';
import { calculateAssetValue, defaultSettings, isHawlComplete } from '../engine/engine.js';
import { buildView } from '../engine/view.js';
import { StoreContext } from './model.js';
import { riyadhToday, useLiveFeed } from './live.js';
import storyView from '../data/ahmad-view.json';
import ahmad from '../data/ahmad.json';
import prices from '../data/prices.json';

const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

// قيمة الأصل بسعر اللحظة: المعادن من سعر الجرام، والسهم الأمريكي بنسبة تغيّر سعره
function reprice(asset, feed) {
  const l = asset.live;
  if (!l) return asset;
  if (l.metal) {
    const pricePerGram = l.metal === 'gold' ? feed.metals.goldPerGram : feed.metals.silverPerGram;
    const entry = l.metal === 'gold'
      ? { grams: l.grams, karat: l.karat, pricePerGram, ...(l.purpose ? { purpose: l.purpose } : {}) }
      : { grams: l.grams, purity: l.purity, pricePerGram, ...(l.purpose ? { purpose: l.purpose } : {}) };
    const engine = { [l.metal]: [entry] };
    return { ...asset, engine, value: calculateAssetValue(engine), livePrice: pricePerGram };
  }
  const q = l.symbol && feed.quotes[l.symbol];
  if (q && l.price > 0) {
    const r = q.price / l.price;
    const engine = Object.fromEntries(Object.entries(asset.engine).map(([k, list]) => [k, list.map(e => ({
      ...e,
      ...(e.marketValue != null ? { marketValue: e.marketValue * r } : {}),
      ...(e.zakatableValue != null ? { zakatableValue: e.zakatableValue * r } : {}),
    }))]));
    return { ...asset, engine, value: calculateAssetValue(engine), market: asset.market * r, livePrice: q.price };
  }
  return asset;
}

export function StoreProvider({ children }) {
  const [mode, setMode] = useState('story');           // 'story' | 'live'
  // كل وجه له أصوله: ما يضيفه المستخدم في المباشر ما يدخل قصة أحمد، والعكس
  const [assetsBy, setAssetsBy] = useState({ story: [], live: [] });
  const [pendingBanks, setPendingBanks] = useState([]);
  const [lastZakat, setLastZakat] = useState(null);     // { calendar: 'hijri'|'gregorian', iso }
  const [remembers, setRemembers] = useState('yes');     // هل يتذكر تاريخ آخر زكاة؟
  const [channel, setChannel] = useState('fund');
  const [payment, setPayment] = useState(null);

  const live = mode === 'live';
  const assets = assetsBy[mode];
  const usSymbols = assets.map(a => a.live?.symbol).filter(Boolean);
  const feed = useLiveFeed({ enabled: live, us: usSymbols });
  const today = live ? riyadhToday() : storyView.today;
  const { goldPerGram, silverPerGram } = feed.metals;

  // المحرك في المتصفح: يُعاد الحساب لما يتغير سعر الذهب أو الفضة أو اليوم
  const view = useMemo(
    () => (live
      ? buildView(ahmad, prices, defaultSettings, { today, live: feed.metalsLive ? { goldPerGram, silverPerGram } : null })
      : storyView),
    [live, today, feed.metalsLive, goldPerGram, silverPerGram],
  );

  const value = useMemo(() => {
    const priced = live ? assets.map(a => reprice(a, feed)) : assets;
    const merged = {};
    for (const a of priced) for (const [k, list] of Object.entries(a.engine)) merged[k] = [...(merged[k] ?? []), ...list];
    const otherAssets = priced.length ? calculateAssetValue(merged) : 0;
    const vault = view.bankTotal + otherAssets;
    // أصل مضاف يدويًا أكمل حولًا هجريًا من تاريخ تملكه (isHawlComplete من المحرك): تجب زكاته اليوم مع زكاة الحسابات
    const todayDate = new Date(`${view.today}T00:00:00Z`);
    const matured = priced.filter(a => a.value > 0 && isHawlComplete(new Date(`${a.acquired}T00:00:00Z`), todayDate));
    const maturedBase = matured.reduce((s, a) => s + a.value, 0);
    // قد لا يكون فيه وجوب اليوم (مثلًا في الوضع المباشر قبل يوم العرض): الشاشات تعرض الوجوب القادم بدله
    const bank = view.due ?? { base: 0, zakat: 0 };
    const due = {
      base: bank.base + maturedBase,
      zakat: round2(bank.zakat + maturedBase / 40),
      bankBase: bank.base,
      bankZakat: bank.zakat,
      matured,
      maturedBase,
      today: Boolean(view.due) || maturedBase > 0,
    };
    return {
      mode,
      live,
      setMode: m => { setMode(m); setPayment(null); },
      feed,
      view,
      assets: priced,
      otherAssets,
      vault,
      pendingBanks,
      lastZakat,
      remembers,
      channel,
      payment,
      due,
      dueNow: payment ? 0 : due.zakat,
      addAsset: a => setAssetsBy(by => ({ ...by, [mode]: [...by[mode], { ...a, id: `${a.kind}-${by[mode].length + 1}` }] })),
      addBank: name => setPendingBanks(list => (list.includes(name) ? list : [...list, name])),
      setLastZakat,
      setRemembers,
      setChannel,
      pay: () => {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0'), mm = String(now.getMinutes()).padStart(2, '0');
        const seq = String(Math.floor(1000 + Math.random() * 9000));
        setPayment({ amount: due.zakat, channel, time: `${hh}:${mm}`, ref: `NM-${view.today.slice(2).replaceAll('-', '')}-${seq}` });
      },
    };
  }, [mode, live, feed, view, assets, pendingBanks, lastZakat, remembers, channel, payment]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
