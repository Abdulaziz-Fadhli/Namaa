// ما تعرضه الشاشات فوق مخرجات المحرك: أسماء البنوك وآخر أرقام الحسابات كما في فيجما، وتنسيقات التاريخ.
import { HIJRI_MONTHS, gregText, hijriText, money, num } from '../figma/format.js';

// بيانات أحمد التجريبية: «بنك أ» في الملف هو حساب الادخار في البنك الأهلي في التصميم
export const ACCOUNTS = {
  A1: { bank: 'مصرف الإنماء', short: 'الإنماء', kind: 'جاري', mask: '1842', synced: '9:41 ص' },
  A2: { bank: 'البنك الأهلي', short: 'الأهلي', kind: 'ادخار', mask: '7730', synced: '9:38 ص' },
  A3: { bank: 'مصرف الإنماء', short: 'الإنماء', kind: 'استثماري', mask: '5501', synced: '9:41 ص' },
};
export const accountTitle = a => (a.exempt ? `محفظة ${a.product}` : `${ACCOUNTS[a.id]?.bank ?? a.bank} · ${ACCOUNTS[a.id]?.kind ?? ''}`);

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
