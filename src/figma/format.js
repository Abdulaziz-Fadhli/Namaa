// تنسيق الأرقام والتواريخ بالعربي كما في فيجما: «165.35 ر.س»، «12 شعبان 1446هـ»، «18 فبراير 2026».
import { hijri } from '../engine/engine.js';

export const HIJRI_MONTHS = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
export const GREG_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

// 66323 ← «66,323» و 165.35 ← «165.35» و 19.4 ← «19.40»
export function num(n, { decimals } = {}) {
  const v = round2(Number(n) || 0);
  const d = decimals ?? (Number.isInteger(v) ? 0 : 2);
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
export const money = (n, opts) => `${num(n, opts)} ر.س`;

export const toDate = iso => new Date(`${iso}T00:00:00Z`);
export const isoOf = d => d.toISOString().slice(0, 10);

export function hijriParts(iso) {
  const [y, m, d] = hijri(toDate(iso));
  return { y, m, d };
}
export const hijriText = (iso, suffix = 'هـ') => {
  const { y, m, d } = hijriParts(iso);
  return `${d} ${HIJRI_MONTHS[m - 1]} ${y}${suffix}`;
};
export const gregText = iso => {
  const dt = toDate(iso);
  return `${dt.getUTCDate()} ${GREG_MONTHS[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
};
export const gregShort = iso => {
  const dt = toDate(iso);
  return `${dt.getUTCDate()} ${GREG_MONTHS[dt.getUTCMonth()]}`;
};

// من هجري إلى ميلادي بنفس تقويم المحرك (نبحث يومًا يومًا حول التاريخ التقريبي)
export function hijriToIso(y, m, d) {
  const approx = Date.UTC(622, 6, 16) + ((y - 1) * 354.367 + (m - 1) * 29.53 + (d - 1)) * 86400000;
  for (let off = -40; off <= 40; off++) {
    const dt = new Date(approx + off * 86400000);
    dt.setUTCHours(0, 0, 0, 0);
    const [hy, hm, hd] = hijri(dt);
    if (hy === y && hm === m && hd === d) return isoOf(dt);
  }
  return null;
}

// أيام الشهر الهجري (29 أو 30) حسب تقويم المحرك
export function hijriMonthLength(y, m) {
  return hijriToIso(y, m, 30) ? 30 : 29;
}

export const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);

// «يوم واحد» «يومين» «3 أيام» «11 يومًا»
export function daysText(n) {
  if (n === 1) return 'يوم واحد';
  if (n === 2) return 'يومين';
  if (n >= 3 && n <= 10) return `${n} أيام`;
  return `${n} يومًا`;
}
