// يبني دليل الأوراق المالية (src/data/securities.json) من ملفات المصادر في scripts/securities-sources
// لتحديث القائمة: عدّلوا ملفات CSV ثم شغّلوا: npm run securities ثم npm test
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, 'securities-sources');
const OUT = path.join(HERE, '..', 'src', 'data', 'securities.json');
const readCsv = f => {
  const [head, ...rows] = fs.readFileSync(path.join(SRC, f), 'utf8').trim().split(/\r?\n/);
  const keys = head.split('|');
  return rows.filter(Boolean).map(r => Object.fromEntries(r.split('|').map((v, i) => [keys[i], v.trim()])));
};
const list = s => (s || '').split(';').map(x => x.trim()).filter(Boolean);

// سوق الرمز السعودي: نمو من 9300 وما فوق عدا صناديق المؤشرات (94xx)
const saudiMarket = c => (+c >= 9500 || (+c >= 9300 && +c < 9400) ? 'NOMU' : 'TASI');

// تصنيف احتياطي بالرمز لو ظهر صندوق جديد غير موجود في funds.csv
function guessSaudiType(code) {
  const n = +code;
  if ((n >= 4330 && n <= 4399) || (n >= 9300 && n <= 9399)) return { type: 'REIT', category: 'REIT' };
  if (n >= 9400 && n <= 9499) return { type: 'ETF', category: 'UNKNOWN' };
  if (n >= 4700 && n <= 4799) return { type: 'CEF', category: 'MULTI_ASSET' };
  return { type: 'COMPANY', category: 'COMPANY' };
}

const out = new Map();
const ar = Object.fromEntries(readCsv('tadawul-ar.csv').map(r => [r.code, r]));

for (const r of readCsv('tadawul-en.csv')) {
  const g = guessSaudiType(r.code);
  out.set(r.code, {
    symbol: r.code, market: saudiMarket(r.code), ...g,
    nameAr: ar[r.code]?.name_ar || '', nameEn: r.name_en, aliases: list(ar[r.code]?.aliases),
    verified: g.type === 'COMPANY',            // صندوق صنّفناه بالرمز فقط يحتاج مراجعة
  });
}
for (const r of readCsv('funds.csv')) {        // الصناديق تتقدّم على أي تصنيف سابق
  out.set(r.code, {
    symbol: r.code, market: r.market, type: r.type, category: r.category,
    nameAr: r.name_ar, nameEn: r.name_en, aliases: list(r.aliases), verified: r.verified === 'yes',
  });
}
// الأسهم الأمريكية: القائمة الحالية لـ S&P 500 وناسداك 100 (us-current) أولاً، ثم أعضاء S&P 600 وغيرها
// من مكتبة pytickersymbols (us-index)، ثم إضافات يدوية (us-extra)، ثم الأسماء العربية (us-stocks)
const usAr = Object.fromEntries(readCsv('us-stocks.csv').map(r => [r.code, r]));
const key = n => n.toLowerCase().replace(/\b(the|inc|incorporated|corp|corporation|co|company|companies|group|holdings?|plc|ltd|limited|class [abc])\b/g, '')
  .replace(/[^a-z0-9]/g, '');
const byName = new Map();
let renamed = 0;
const addUS = (r, primary) => {
  if (out.has(r.code)) return;
  const k = key(r.name_en);
  const cur = byName.get(k);
  // نفس الشركة برمز قديم (غيّرت رمزها): نضيف الرمز القديم اسماً بديلاً بدل ورقة مكررة
  if (!primary && cur) { if (!cur.aliases.includes(r.code)) cur.aliases.push(r.code); renamed++; return; }
  const e = { symbol: r.code, market: 'US', type: 'COMPANY', category: 'COMPANY',
    nameAr: usAr[r.code]?.name_ar || '', nameEn: r.name_en, aliases: list(usAr[r.code]?.aliases), verified: true };
  out.set(r.code, e);
  if (primary && !byName.has(k)) byName.set(k, e);
};
readCsv('us-current.csv').forEach(r => addUS(r, true));
readCsv('us-index.csv').forEach(r => addUS(r, false));
readCsv('us-extra.csv').forEach(r => addUS(r, false));
// رموز قديمة ما زالت في مكتبة المؤشرات (الشركة غيّرت رمزها): تصير اسماً بديلاً للرمز الجديد
const STALE = { BK: 'BNY' };
for (const [old, now] of Object.entries(STALE)) if (out.has(old) && out.has(now)) { out.delete(old); out.get(now).aliases.push(old); renamed++; }
const missingAr = Object.keys(usAr).filter(c => !out.has(c));
if (missingAr.length) throw new Error(`أسماء عربية لرموز أمريكية غير موجودة في القوائم: ${missingAr}`);

// شركات مدرجة في تداول لكنها مسجلة خارج المملكة (لا تدفع الزكاة السعودية عن مساهميها)
const FOREIGN = { 6015: 'مسجلة في سوق أبوظبي العالمي' };
for (const [code, where] of Object.entries(FOREIGN)) out.get(code).foreign = where;

const securities = [...out.values()].sort((a, b) => a.market.localeCompare(b.market) || a.symbol.localeCompare(b.symbol));
const count = k => securities.filter(s => `${s.market}:${s.type}` === k).length;
fs.writeFileSync(OUT, JSON.stringify({
  builtAt: new Date().toISOString().slice(0, 10),
  sources: [
    'قائمة الأسهم المدرجة في تداول: stockanalysis.com/list/saudi-stock-exchange (سبتمبر 2026)',
    'الأسماء العربية ورموز الريت وصناديق المؤشرات: صفحة أسعار الشركات في أرقام (argaam.com)',
    'الأسهم الأمريكية: قوائم S&P 500 وناسداك 100 الحالية من stockanalysis.com (سبتمبر 2026)، وأعضاء S&P 600 من مكتبة pytickersymbols (رخصة MIT)',
  ],
  securities,
}, null, 1));
console.log(`securities.json: ${securities.length} ورقة مالية (رموز أمريكية قديمة صارت أسماء بديلة: ${renamed})`,
  `(شركات سعودية ${count('TASI:COMPANY') + count('NOMU:COMPANY')}، ريت ${count('TASI:REIT') + count('NOMU:REIT')}،`,
  `صناديق مؤشرات سعودية ${count('TASI:ETF')}، أمريكية: شركات ${count('US:COMPANY')} وصناديق ${count('US:ETF')})`);
