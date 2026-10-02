// اكتشاف الدخل المتكرر من حركات الحساب، وتمييز الإيجار عن غيره.
// حكم الإيجار من دليل هيئة الزكاة (§3.8): العقار المؤجر لا زكاة في قيمته، والأجرة المقبوضة تُزكّى إذا بقيت حولًا.
// الأجرة تصل الحساب نقدًا، فهي داخلة في الوعاء أصلًا؛ الاكتشاف يصنّفها ويمنع إضافة قيمة العقار نفسه بالخطأ.

const RENT = /(ايجار|اجره|اجار|rent)/i;
const SKIP = /(رصيد افتتاحي|تحويل)/;
export const normalizeAr = s => String(s ?? '')
  .replace(/[ً-ٰٟـ]/g, '')
  .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
  .trim();

const DAY = 86400000;
const days = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / DAY);
const addDays = (iso, n) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * DAY).toISOString().slice(0, 10);
const median = xs => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

const CADENCES = [
  ['monthly', 'شهري', 'كل شهر', 25, 35, 12],
  ['quarterly', 'ربع سنوي', 'كل 3 أشهر', 80, 100, 4],
  ['half', 'نصف سنوي', 'كل 6 أشهر', 170, 195, 2],
  ['yearly', 'سنوي', 'كل سنة', 350, 380, 1],
];

// دخل يتكرر بانتظام (3 مرات فأكثر، بمبلغ ثابت تقريبًا) في نفس الحساب وبنفس الوصف
export function detectIncome(transactions, today) {
  const groups = new Map();
  for (const t of transactions ?? []) {
    if (t.direction !== 'credit' || t.internal || (today && t.date > today) || SKIP.test(t.desc ?? '')) continue;
    const key = `${t.accountId}|${normalizeAr(t.desc)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  const out = [];
  for (const [key, list] of groups) {
    if (list.length < 3) continue;
    list.sort((a, b) => (a.date < b.date ? -1 : 1));
    const gaps = list.slice(1).map((t, i) => days(list[i].date, t.date));
    const every = median(gaps);
    const cad = CADENCES.find(([, , , lo, hi]) => every >= lo && every <= hi);
    if (!cad) continue;
    const amounts = list.map(t => t.amount);
    const amount = median(amounts);
    if (Math.max(...amounts) > amount * 1.1 || Math.min(...amounts) < amount * 0.9) continue;
    const last = list[list.length - 1].date;
    out.push({
      key, accountId: list[0].accountId, desc: list[0].desc, amount, count: list.length,
      cadence: cad[0], cadenceAr: cad[1], everyText: cad[2], every,
      first: list[0].date, last, next: addDays(last, every),
      total: amounts.reduce((s, a) => s + a, 0),
      perYear: amount * cad[5],
      kind: RENT.test(normalizeAr(list[0].desc)) ? 'rent' : 'income',
    });
  }
  return out.sort((a, b) => (a.kind === b.kind ? b.amount - a.amount : a.kind === 'rent' ? -1 : 1));
}

export const detectRent = (transactions, today) => detectIncome(transactions, today).filter(s => s.kind === 'rent');
