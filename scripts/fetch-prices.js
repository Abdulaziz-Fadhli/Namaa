// scripts/fetch-prices.js
// يسحب أسعار الذهب والفضة اليومية من Metals.dev ويحفظها بالريال لكل جرام.
//
// التشغيل:              node --env-file=.env scripts/fetch-prices.js
// لإعادة السحب من النت:  node --env-file=.env scripts/fetch-prices.js --refresh
//
// أول تشغيل يسحب من الإنترنت (قرابة 25 طلبًا) ويحفظ الخام في scripts/prices-raw.json.
// أي تشغيل بعده يستخدم الملف المحفوظ بدون استهلاك أي طلب.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const START = '2024-10-01';    // بداية السلسلة
const DEMO_END = '2026-10-03'; // يوم العرض: نمد آخر سعر متاح إليه
const CHUNK_DAYS = 30;         // أقصى مدى يسمح به Metals.dev في الطلب الواحد
const RAW_FILE = 'scripts/prices-raw.json';
const OUT_FILE = 'src/data/prices.json';

const SAR_PER_USD = 3.75;      // الريال مربوط بالدولار
const GRAMS_PER_OZ = 31.1035;  // الأونصة = 31.1035 جرام

// كل التواريخ بتوقيت UTC حتى ما يتأخر أي يوم بسبب فرق التوقيت
const addDays = (iso, n) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const minDate = (a, b) => (a < b ? a : b);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const toSarPerGram = usdPerOz => +((usdPerOz * SAR_PER_USD) / GRAMS_PER_OZ).toFixed(4);

async function fetchRaw() {
  const key = process.env.METALS_API_KEY;
  if (!key) {
    throw new Error('ما لقيت METALS_API_KEY. تأكد إنك شغلت الأمر مع --env-file=.env وإن الملف فيه المفتاح');
  }

  // Metals.dev ما يقبل تاريخ اليوم، فنوقف عند أمس
  const yesterday = addDays(new Date().toISOString().slice(0, 10), -1);
  const raw = {};
  let requests = 0;

  for (let from = START; from <= yesterday; from = addDays(from, CHUNK_DAYS)) {
    const to = minDate(addDays(from, CHUNK_DAYS - 1), yesterday);
    const url = `https://api.metals.dev/v1/timeseries?api_key=${key}&start_date=${from}&end_date=${to}`;
    const res = await fetch(url);
    const json = await res.json();
    requests++;

    if (json.status !== 'success') {
      // لا نطبع الرابط لأن فيه المفتاح
      throw new Error(`فشل الطلب ${from} ← ${to}: ${json.error_code} ${json.error_message}`);
    }
    for (const [date, day] of Object.entries(json.rates)) {
      raw[date] = { gold: day.metals.gold, silver: day.metals.silver };
    }
    console.log(`✓ ${from} ← ${to}`);
    await sleep(300);
  }

  console.log(`عدد الطلبات المستخدمة: ${requests}`);
  return raw;
}

// 1) الأسعار الخام: من الملف المحفوظ أو من الإنترنت
let raw;
if (existsSync(RAW_FILE) && !process.argv.includes('--refresh')) {
  raw = JSON.parse(readFileSync(RAW_FILE, 'utf8'));
  console.log('استخدمت الأسعار المحفوظة بدون أي طلب. لإعادة السحب أضف --refresh');
} else {
  raw = await fetchRaw();
  writeFileSync(RAW_FILE, JSON.stringify(raw, null, 1));
}

// 2) تحويل لريال/جرام، وتعبئة أي يوم ناقص بآخر سعر متاح، حتى يوم العرض
const out = {};
let last = null;
let filled = 0;
for (let d = START; d <= DEMO_END; d = addDays(d, 1)) {
  const r = raw[d];
  if (r && r.gold > 0 && r.silver > 0) {
    last = { gold: toSarPerGram(r.gold), silver: toSarPerGram(r.silver) };
  } else {
    filled++;
  }
  if (!last) throw new Error(`ما فيه سعر لتاريخ البداية ${d}`);
  out[d] = last;
}
writeFileSync(OUT_FILE, JSON.stringify(out, null, 1));

// 3) ملخص للتأكد
const nisab = p => ({ silver: Math.round(595 * p.silver), gold: Math.round(85 * p.gold) });
const first = nisab(out[START]);
const end = nisab(out[DEMO_END]);
console.log('');
console.log(`تم حفظ ${Object.keys(out).length} يومًا في ${OUT_FILE}`);
console.log(`أيام معبأة من آخر سعر متاح: ${filled}`);
console.log(`نصاب الفضة: ${first.silver} ريال (${START}) ← ${end.silver} ريال (${DEMO_END})`);
console.log(`نصاب الذهب: ${first.gold} ريال (${START}) ← ${end.gold} ريال (${DEMO_END})`);