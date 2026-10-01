// حالة النموذج، بوجهين:
// - «قصة أحمد» (story): أرقامه من ahmad-view.json، يوم العرض 3 أكتوبر، والأسعار المحفوظة.
// - «مباشر» (live): المحرك يشتغل هنا في المتصفح على تاريخ اليوم الحقيقي وسعر السوق الآن،
//   ويُعاد الحساب مع كل تحديث للأسعار، وتُعاد قيمة كل أصل مضاف (ذهب، فضة، سهم أمريكي).
// الوعاء = أرصدة البنوك من المحرك + calculateAssetValue على الأصول المضافة.
import { useEffect, useMemo, useState } from 'react';
import { calculateAssetValue, defaultSettings, isHawlComplete, resolveHawlDueDate } from '../engine/engine.js';
import { nextScripted, portfolioAssets, providerOf, receiveNext, seedPortfolio } from '../engine/portfolio.js';
import { assessCrop, assessLivestock } from '../engine/zatca.js';
import { buildView } from '../engine/view.js';
import { StoreContext } from './model.js';
import { riyadhToday, useLiveFeed } from './live.js';
import storyView from '../data/ahmad-view.json';
import ahmad from '../data/ahmad.json';
import { PERSONA_DATA, khalidWith } from './persona-data.js';
import prices from '../data/prices.json';

const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const clock12 = d => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Riyadh' }).replace(' AM', ' ص').replace(' PM', ' م');

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

// personaMode: موقع الويب (ثلاث شخصيات). بدونه يبقى التطبيق القديم (#/phone) على قصة أحمد الأصلية كما هو.
export function StoreProvider({ children, personaMode = false }) {
  // الشخصية الحالية تبقى بعد تحديث الصفحة (تفضيل عرض لكل متصفح فقط)
  const [persona, setPersonaState] = useState(() => {
    try { const p = sessionStorage.getItem('namaa.persona'); return PERSONA_DATA[p] ? p : 'ahmad'; } catch { return 'ahmad'; }
  });
  const setPersona = p => { setPersonaState(p); try { sessionStorage.setItem('namaa.persona', p); } catch { /* التخزين غير متاح */ } };
  const [modeState, setMode] = useState('story');       // 'story' | 'live'
  // الشخصيات للعرض فقط على أسعار محفوظة؛ خالد وحده يقدر يحدّث الأسعار الآن (مسار تقييم حالي منفصل)
  const [khalidLive, setKhalidLive] = useState(false);
  const [k4, setK4] = useState(null);                   // حقائق حساب خالد K4 بعد مراجعته
  const [confirmedBy, setConfirmedBy] = useState({});
  const [portfoliosBy, setPortfoliosBy] = useState({});  // تطبيقات الاستثمار المرتبطة لكل شخصية   // أصول الشخصية التي راجعها المستخدم وأكّدها
  const mode = personaMode ? (persona === 'khalid' && khalidLive ? 'live' : 'story') : modeState;
  const scope = personaMode ? `${persona}:${mode}` : mode;
  // كل شخصية (وكل وجه) لها أصولها وإخراجها وبنوكها: ما يضيفه خالد ما يظهر عند أحمد
  const [assetsBy, setAssetsBy] = useState({});
  const [banksBy, setBanksBy] = useState({});
  const [paymentBy, setPaymentBy] = useState({});
  const [lastZakat, setLastZakat] = useState(null);     // { calendar: 'hijri'|'gregorian', iso }
  const [remembers, setRemembers] = useState('yes');     // هل يتذكر تاريخ آخر زكاة؟
  const [channel, setChannel] = useState('charity');
  const pkey = personaMode ? persona : 'phone';
  const payment = paymentBy[pkey] ?? null;
  const setPayment = p => setPaymentBy(by => ({ ...by, [pkey]: p }));
  const pendingBanks = banksBy[pkey] ?? [];
  // خيارات المنهجية من الإعدادات (كلاهما من دليل الهيئة): تغييرها يعيد تشغيل المحرك فعليًا
  const [settings, setSettingsState] = useState(defaultSettings);
  const [fromAccount, setFromAccount] = useState('A1');

  const live = mode === 'live';
  const assets = useMemo(() => assetsBy[scope] ?? [], [assetsBy, scope]);
  const usSymbols = assets.map(a => a.live?.symbol).filter(Boolean);
  const feed = useLiveFeed({ enabled: live, us: usSymbols });
  const pd = useMemo(() => (persona === 'khalid' ? { ...PERSONA_DATA.khalid, data: khalidWith(k4) } : PERSONA_DATA[persona]), [persona, k4]);
  const today = personaMode ? pd.asOf : live ? riyadhToday() : storyView.today;
  const { goldPerGram, silverPerGram } = feed.metals;

  // المحرك في المتصفح: يُعاد الحساب لما يتغير سعر الذهب أو الفضة أو اليوم
  const custom = settings !== defaultSettings;
  const view = useMemo(
    () => (personaMode
      ? buildView(pd.data, prices, settings, { today, live: live && feed.metalsLive ? { goldPerGram, silverPerGram } : null })
      : live
        ? buildView(ahmad, prices, settings, { today, live: feed.metalsLive ? { goldPerGram, silverPerGram } : null })
        : custom ? buildView(ahmad, prices, settings) : storyView),
    [personaMode, pd, live, custom, settings, today, feed.metalsLive, goldPerGram, silverPerGram],
  );

  const portfolios = useMemo(() => portfoliosBy[pkey] ?? [], [portfoliosBy, pkey]);
  const [feedPaused, setFeedPaused] = useState(false);
  const [events, setEvents] = useState([]);              // عمليات وصلت من التطبيقات (لإشعار يظهر في أي صفحة)
  const today0 = personaMode ? pd.asOf : today;
  // العمليات تصل من التطبيق تلقائيًا: أول عملية بعد 5 ثوانٍ من الربط، ثم كل 9 ثوانٍ، حتى تنتهي
  useEffect(() => {
    if (feedPaused) return undefined;
    const p = portfolios.find(x => nextScripted(x));
    if (!p) return undefined;
    const t = setTimeout(() => {
      const res = receiveNext(p, today0, clock12(new Date()));
      if (!res) return;
      setPortfoliosBy(by => ({ ...by, [pkey]: (by[pkey] ?? []).map(x => (x.id === p.id ? res.portfolio : x)) }));
      setEvents(ev => [{ id: `${pkey}:${p.id}:${res.trade.id}`, pkey, portfolio: p.id, provider: providerOf(p.provider).name, trade: res.trade, at: Date.now() }, ...ev].slice(0, 20));
    }, p.trades.length === 0 ? 5000 : 9000);
    return () => clearTimeout(t);
  }, [portfolios, feedPaused, pkey, today0]);
  const value = useMemo(() => {
    // المواشي والمحاصيل: يعاد الحكم بتاريخ اليوم (الحول في الأنعام)، وزكاتها عينية خارج وعاء النقود
    const priced = (live ? assets.map(a => reprice(a, feed)) : assets).map(a => (!a.agri ? a : {
      ...a,
      result: a.kind === 'livestock' ? assessLivestock({ ...a.agri, asOf: view.today }) : assessCrop(a.agri),
    }));
    const inKind = priced.filter(a => a.result?.status === 'DUE' && a.result.inKind);
    // أصول تطبيقات الاستثمار المرتبطة: كل دفعة بحولها، وتدخل الوعاء والوجوب مثل أي أصل
    const linked = portfolios.flatMap(portfolioAssets);
    const all = [...priced, ...linked];
    const merged = {};
    for (const a of all) for (const [k, list] of Object.entries(a.engine)) merged[k] = [...(merged[k] ?? []), ...list];
    const otherAssets = all.length ? calculateAssetValue(merged) : 0;
    const linkedValue = linked.reduce((s2, a) => s2 + a.value, 0);
    // الوعاء = البنوك + أصول الشخصية من مصدرها (view.total) + ما أضافه المستخدم يدويًا
    const vault = view.total + otherAssets;
    // أصل مضاف يدويًا أكمل حولًا هجريًا من تاريخ تملكه (isHawlComplete من المحرك): تجب زكاته اليوم مع زكاة الحسابات
    const todayDate = new Date(`${view.today}T00:00:00Z`);
    const matured = all.filter(a => a.value > 0 && a.acquired && isHawlComplete(new Date(`${a.acquired}T00:00:00Z`), todayDate));
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
      inKind,
    };
    // المواعيد القادمة: من المحرك (البنوك وأصول الشخصية) + حول كل أصل مضاف أو مرتبط لم يحل بعد
    const groups = new Map(view.upcoming.map(u => [u.date, { date: u.date, base: u.base, zakat: u.zakat }]));
    for (const a of all) {
      if (!(a.value > 0) || !a.acquired || matured.includes(a)) continue;
      const d = resolveHawlDueDate(new Date(`${a.acquired}T00:00:00Z`)).toISOString().slice(0, 10);
      const g = groups.get(d) ?? { date: d, base: 0, zakat: 0 };
      groups.set(d, { ...g, base: g.base + a.value, zakat: round2(g.zakat + a.value / 40) });
    }
    const upcoming = [...groups.values()].sort((x, y) => (x.date < y.date ? -1 : 1))
      .map(u => ({ ...u, inDays: Math.round((new Date(`${u.date}T00:00:00Z`) - todayDate) / 86400000) }));
    return {
      personaMode,
      persona,
      setPersona: p => { if (PERSONA_DATA[p]) setPersona(p); },
      personaData: pd.data,
      historical: personaMode && pd.historical,
      khalidLive,
      setKhalidLive,
      k4,
      setK4,
      confirmed: confirmedBy[pkey] ?? {},
      confirmHolding: id => setConfirmedBy(by => ({ ...by, [pkey]: { ...(by[pkey] ?? {}), [id]: true } })),
      resetPersona: p => {
        setAssetsBy(by => Object.fromEntries(Object.entries(by).filter(([k]) => !k.startsWith(`${p}:`))));
        setBanksBy(by => ({ ...by, [p]: [] }));
        setPaymentBy(by => ({ ...by, [p]: null }));
        setConfirmedBy(by => ({ ...by, [p]: {} }));
        setPortfoliosBy(by => ({ ...by, [p]: [] }));
        if (p === 'khalid') { setK4(null); setKhalidLive(false); }
      },
      mode,
      live,
      setMode: m => { setMode(m); setPayment(null); },
      setPendingBanks: list => setBanksBy(by => ({ ...by, [pkey]: list })),
      feed,
      view,
      assets: priced,
      otherAssets,
      portfolios,
      linkedValue,
      upcoming,
      nextDue: upcoming[0] ?? null,
      linkPortfolio: providerId => setPortfoliosBy(by => ((by[pkey] ?? []).some(x => x.id === providerId) ? by
        : { ...by, [pkey]: [...(by[pkey] ?? []), seedPortfolio(providerId, view.today)] })),
      unlinkPortfolio: id => setPortfoliosBy(by => ({ ...by, [pkey]: (by[pkey] ?? []).filter(x => x.id !== id) })),
      feedPaused,
      setFeedPaused,
      events: events.filter(e => e.pkey === pkey),
      vault,
      pendingBanks,
      lastZakat,
      remembers,
      channel,
      payment,
      settings,
      setSettings: patch => setSettingsState(s => {
        const next = { ...s, ...patch };
        return Object.entries(defaultSettings).every(([k, v]) => next[k] === v) ? defaultSettings : next;
      }),
      fromAccount,
      setFromAccount,
      due,
      dueNow: payment ? 0 : due.zakat,
      removeAsset: id => setAssetsBy(by => ({ ...by, [scope]: (by[scope] ?? []).filter(a => a.id !== id) })),
      addAsset: a => {
        const id = `${a.kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        setAssetsBy(by => ({ ...by, [scope]: [...(by[scope] ?? []), { ...a, id }] }));
        return id;
      },
      addBank: name => setBanksBy(by => ({ ...by, [pkey]: (by[pkey] ?? []).includes(name) ? by[pkey] : [...(by[pkey] ?? []), name] })),
      setLastZakat,
      setRemembers,
      setChannel,
      pay: () => {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0'), mm = String(now.getMinutes()).padStart(2, '0');
        const seq = String(Math.floor(1000 + Math.random() * 9000));
        setPayment({ amount: due.zakat, base: due.base, channel, fromAccount, time: `${hh}:${mm}`, date: view.today, ref: `NM-${view.today.slice(2).replaceAll('-', '')}-${seq}` });
      },
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personaMode, persona, pd, khalidLive, k4, confirmedBy, portfolios, feedPaused, events, mode, scope, pkey, live, feed, view, assets, pendingBanks, lastZakat, remembers, channel, payment, settings, fromAccount]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
