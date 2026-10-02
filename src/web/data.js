// ما تعرضه الشاشات فوق مخرجات المحرك: أسماء البنوك وآخر أرقام الحسابات كما في فيجما، وتنسيقات التاريخ.
import { HIJRI_MONTHS, gregText, hijriText, money, num } from '../figma/format.js';

// أسماء البنوك وآخر أرقام الحسابات للعرض (البيانات تسمّي بعضها «بنك أ/ب»). المعرّفات لا تتكرر بين الشخصيات.
export const ACCOUNTS = {
  A1: { bank: 'مصرف الإنماء', short: 'الإنماء', kind: 'جاري', mask: '1842', synced: '9:41 ص' },
  A2: { bank: 'البنك الأهلي', short: 'الأهلي', kind: 'ادخار', mask: '7730', synced: '9:38 ص' },
  A3: { bank: 'مصرف الإنماء', short: 'الإنماء', kind: 'صندوق', mask: '5501', synced: '9:41 ص' },
  K1: { bank: 'مصرف الإنماء', short: 'الإنماء', kind: 'جاري', mask: '3391', synced: 'الآن' },
  K2: { bank: 'البنك الأهلي السعودي', short: 'الأهلي', kind: 'جاري', mask: '6204', synced: 'الآن' },
  K3: { bank: 'مصرف الراجحي', short: 'الراجحي', kind: 'ادخار', mask: '5518', synced: 'الآن' },
  K4: { bank: 'مصرف الإنماء', short: 'الإنماء', kind: 'استثماري', mask: '7720', synced: 'الآن' },
  N1: { bank: 'مصرف الإنماء', short: 'الإنماء', kind: 'جاري', mask: '2087', synced: '9:41 ص' },
};

// الشخصيتان في الموقع: نورة المشكلة، وخالد الحل الحي
export const PERSONAS = {
  noura: { key: 'noura', name: 'نورة', full: 'نورة', avatar: 'ن', email: 'noura@namaa.demo', phone: '+966 54 210 6618', role: 'المشكلة', tag: 'Problem',
    line: 'مصممة مستقلة بدخل غير منتظم. لا تعرف متى بدأ حول مالها.', asOfLabel: 'زمن توضيحي', entry: '/noura' },
  khalid: { key: 'khalid', name: 'خالد', full: 'خالد', avatar: 'خ', email: 'khalid@namaa.demo', phone: '+966 50 371 2290', role: 'الحل الحي', tag: 'Live',
    line: 'مستثمر لديه حسابات في ثلاثة بنوك، يسجّل في نماء لأول مرة.', asOfLabel: 'يوم العرض · 3 أكتوبر 2026', entry: '/khalid' },
};

export const accountTitle = a => (a.fund ? a.product : a.exempt ? `محفظة ${a.product}` : `${ACCOUNTS[a.id]?.bank ?? a.bank} · ${ACCOUNTS[a.id]?.kind ?? ''}`);

// البنوك المرتبطة للشخصية الحالية: من حساباتها + ما ربطه المستخدم الآن
export const linkedBanks = (view, pending = []) => [
  ...BANKS.filter(b => view.accounts.some(a => b.startsWith(ACCOUNTS[a.id]?.bank ?? '-'))),
  ...pending.filter(b => !ACCOUNTS[b]),
];

export const BANKS = ['مصرف الإنماء', 'البنك الأهلي السعودي', 'مصرف الراجحي', 'بنك الرياض', 'البنك السعودي الأول', 'بنك البلاد', 'بنك الجزيرة', 'البنك العربي الوطني'];

// «22 ربيع الآخر 1448هـ · 3 أكتوبر 2026»
export const bothDates = iso => `${hijriText(iso)} · ${gregText(iso)}`;
export const hijriFromParts = ([y, m, d]) => `${d} ${HIJRI_MONTHS[m - 1]} ${y}هـ`;
export const monthName = m => HIJRI_MONTHS[m - 1];
export const kFmt = n => `${(n / 1000).toFixed(1)}k`;
export const sar = (n, d = 2) => money(n, { decimals: d });
export const plain = (n, d = 2) => num(n, { decimals: d });

const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const weekday = iso => WEEKDAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()];

export const greeting = () => (new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير');

// عدد أيام بين تاريخين
export const daysFrom = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);

// «9:41 ص» بتوقيت الرياض
export const clock = d => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Riyadh' })
  .replace(' AM', ' ص').replace(' PM', ' م');

// كيف يُعرض كل حساب: عادي يدخل الوعاء، صندوق يدخل بحصته الزكوية، أو يحتاج مراجعة (لا معفى تلقائيًا)
export function accountInfo(a) {
  const m = ACCOUNTS[a.id] ?? { bank: a.bank, kind: '', mask: '', synced: '' };
  if (a.fund) return {
    title: a.id === 'K4' ? 'المحفظة الاستثمارية' : a.product ?? `صندوق · ${m.bank}`, sub: `صندوق استثماري · يدخل بحصته الزكوية`,
    pill: ['info', 'بحصته الزكوية'], kind: 'fund', included: false, mask: m.mask, synced: m.synced,
  };
  if (a.exempt && a.id === 'K4') return {
    title: 'المحفظة الاستثمارية', sub: 'منتج استثماري قديم · نحتاج نوعه قبل حسابه',
    pill: ['warn', 'يحتاج مراجعة'], kind: 'review', included: false, mask: m.mask, synced: m.synced,
  };
  if (a.exempt) return { title: `محفظة ${a.product}`, sub: 'منتج معفى بدليل', pill: ['', 'معفى'], kind: 'exempt', included: false, mask: m.mask, synced: m.synced };
  return { title: `${m.bank} · ${m.kind}`, sub: `حساب ${m.kind} · ${m.mask} ••••`, pill: ['ok', 'نعم'], kind: 'cash', included: true, mask: m.mask, synced: m.synced };
}

// قيمة سلسلة يومية في تاريخ (أو آخر قيمة قبله)
const valueAt = (series, iso) => {
  if (series[iso] != null) return series[iso];
  const k = Object.keys(series).filter(d => d <= iso).sort().at(-1);
  return k ? series[k] : 0;
};

// أصول الشخصية من مصدر البيانات (ليست مضافة يدويًا): الذهب بسعر يومه، والأسهم بقيمتها السوقية، والصندوق بحصته الزكوية.
// تاريخ التملك المجهول يُؤخذ تلقائيًا من أول كشف، ويظهر ذلك بوضوح.
export function personaHoldings(data, view) {
  const gp = view.prices.goldPerGram;
  return (data.holdings ?? []).map((h, i) => {
    const auto = !h.acquired;
    const acquired = h.acquired ?? data.period.start;
    if (h.type === 'gold') {
      const v = h.grams * (h.karat / 24) * gp;
      return { id: h.id ?? `gold-${i}`, kind: 'gold', acquired, auto, market: v, zakatable: v,
        title: `ذهب عيار ${h.karat} · ${h.grams} غ`, sub: `اشتُري بـ ${plain(h.cost, 0)} ر.س من ${ACCOUNTS[h.paidFrom]?.short ?? h.paidFrom} · يُقيَّم بسعر يومه`,
        source: `سعر الجرام ${plain(gp)} ر.س · ${gregText(view.prices.date)}` };
    }
    if (h.type === 'stocks') {
      const v = h.values ? valueAt(h.values, view.today) : h.marketValue;
      return { id: h.id ?? `stocks-${i}`, kind: 'stock', acquired, auto, market: v, zakatable: v,
        title: `${h.name ?? 'محفظة أسهم'} · ${h.intent === 'trading' ? 'للمضاربة' : 'للاستثمار'}`,
        sub: h.intent === 'trading' ? 'للمتاجرة: تُزكّى بقيمتها السوقية كاملة' : 'للاستثمار',
        source: `القيمة السوقية · ${gregText(view.today)}` };
    }
    if (h.type === 'fund') {
      const k4 = h.id === 'K4-FUND';
      return { id: h.id ?? `fund-${i}`, kind: 'fund', acquired, auto: k4 || auto, market: h.marketValue, zakatable: h.zakatableValue,
        title: k4 ? 'المحفظة الاستثمارية · صندوق' : data.accounts.find(a => a.fund)?.product ?? 'صندوق',
        sub: `قيمة ${plain(h.marketValue, 0)} ر.س · يدخل بحصته الزكوية`,
        source: k4 ? 'الحصة الزكوية من إفصاح الصندوق (أدخلها المستخدم)' : 'إفصاح الصندوق · افتراض سيناريو معتمد' };
    }
    return { id: h.id ?? `h-${i}`, kind: h.type, acquired, auto, market: h.marketValue ?? 0, zakatable: h.zakatableValue ?? h.marketValue ?? 0, title: h.name ?? 'أصل', sub: '', source: '' };
  });
}

// «بعد 7 أيام» / «بعد 62 يومًا» / «بعد يوم» / «بعد يومين»
// «مرة واحدة» / «مرتين» / «3 مرات» / «11 مرة»
export const times = n => (n === 1 ? 'مرة واحدة' : n === 2 ? 'مرتين' : n >= 3 && n <= 10 ? `${n} مرات` : `${n} مرة`);
export const days = n => (n === 1 ? 'يوم' : n === 2 ? 'يومين' : n >= 3 && n <= 10 ? `${n} أيام` : `${n} يومًا`);
