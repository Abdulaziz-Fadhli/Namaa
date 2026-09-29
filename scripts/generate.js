// scripts/generate.js
// يولّد بيانات الشخصيات الثلاث (أحمد وخالد ونورة) بصيغة خدمات معلومات الحساب
// في المصرفية المفتوحة: حسابات، وعمليات لكل حساب، وأصول غير نقدية.
//
// التشغيل:  node scripts/generate.js
// الناتج:   src/data/ahmad.json و src/data/khalid.json و src/data/noura.json
//
// البيانات ثابتة: كل تشغيل يطلّع نفس النتيجة بالضبط (بذرة ثابتة).
// التغيير الوحيد يجي من ملف الأسعار (قيمة ذهب خالد والتحقق من النصاب).
// لتعديل أي شخصية: غيّر كائن إعداداتها تحت، وأعد التشغيل.

import { readFileSync, writeFileSync } from 'node:fs';

const START = '2025-04-01';      // أول يوم في البيانات
const DEMO_TODAY = '2026-10-03'; // يوم العرض: آخر يوم في البيانات

const prices = JSON.parse(readFileSync('src/data/prices.json', 'utf8'));

// ------------------------------------------------------------
// إعدادات الشخصيات (الأرقام من الملحق ج-2، معدلة على الأسعار الحقيقية)
// ------------------------------------------------------------

const AHMAD = {
  seed: 101,
  opening: 2000,              // موظف جديد: يبدأ تحت النصاب
  firstSalary: '2025-04-27',  // أول راتب = بداية الحول
  salary: 14000, salaryDay: 27,
  rent: 3500, rentDay: 1,
  savings: 2000, savingsDay: 2,          // تحويل شهري لحسابه في بنك أ
  monthlySpending: 7500,
  preJobDailySpending: 40,               // قبل أول راتب
  bonus: { date: '2025-10-14', amount: 10000 }, // 22 ربيع الآخر 1447: يحل حولها يوم العرض
  namaa: 20000,
};

const KHALID = {
  seed: 202,
  opening: { K1: 25000, K2: 15000, K3: 20000 },
  income: { amount: 20000, day: 5 },                     // أرباح نشاط في الإنماء
  rent: { amount: 8000, day: 10, months: [1, 4, 7, 10] }, // إيجار عقار كل 3 أشهر في بنك أ
  savings: { amount: 5000, day: 6 },                     // من الإنماء إلى بنك ب
  monthlySpending: 15000,
  gold: { date: '2025-12-15', grams: 100, karat: 24 },   // يُشترى من حساب بنك ب
  stocks: { start: 30000, dailyVolatility: 0.015 },
  namaa: 50000,
};

const NOURA = {
  seed: 303,
  opening: 1800,
  rent: 3000, rentDay: 1, rentFrom: '2025-05-01',
  monthlySpending: 3000, // مع الإيجار يصير مصروفها قرابة 6,000 شهريًا
  // دفعات المشاريع: لا دخل في أكتوبر ونوفمبر وديسمبر 2025، فينقطع حولها في يناير
  projects: [
    ['2025-04-08', 10000],
    ['2025-05-12', 16000],
    ['2025-06-20', 6000],
    ['2025-07-15', 11000],
    ['2025-08-18', 7000],
    ['2025-09-10', 9000],
    ['2026-01-21', 22000],
    ['2026-03-15', 10000],
    ['2026-04-20', 15000],
    ['2026-06-01', 8000],
    ['2026-07-10', 16000],
    ['2026-08-20', 9000],
    ['2026-09-15', 12000],
  ],
};

// ------------------------------------------------------------
// أدوات
// ------------------------------------------------------------

// مولّد أرقام عشوائية ببذرة ثابتة (Math.random ما يقبل بذرة)
function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// كل التواريخ نصوص YYYY-MM-DD بتوقيت UTC حتى ما يتأخر أي يوم
const addDays = (iso, n) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dayOf = iso => +iso.slice(8, 10);
const monthOf = iso => +iso.slice(5, 7);
function* eachDay(from, to) {
  for (let d = from; d <= to; d = addDays(d, 1)) yield d;
}

const CATEGORIES = ['بقالة', 'مطاعم', 'وقود', 'صيدلية', 'مشتريات', 'قهوة', 'فواتير', 'توصيل طلبات'];

// سجل عمليات يمنع أي سحب أكبر من الرصيد (المحرك يرفضه)
function createLedger(accounts) {
  const balance = Object.fromEntries(accounts.map(a => [a.accountId, 0]));
  const transactions = [];
  const warnings = [];
  const push = (accountId, date, amount, direction, desc, extra = {}) =>
    transactions.push({ accountId, date, amount, direction, desc, ...extra });

  return {
    transactions, warnings, balance,
    credit(acc, date, amount, desc) {
      amount = Math.round(amount);
      balance[acc] += amount;
      push(acc, date, amount, 'credit', desc);
    },
    debit(acc, date, amount, desc) {
      amount = Math.round(amount);
      if (amount > balance[acc]) {
        warnings.push(`${date} ${acc}: تخطيت «${desc}» (${amount}) لأن الرصيد ${balance[acc]}`);
        return false;
      }
      balance[acc] -= amount;
      push(acc, date, amount, 'debit', desc);
      return true;
    },
    // تحويل بين حسابات العميل نفسه: طرفان، وكلاهما internal
    transfer(from, to, date, amount, desc) {
      amount = Math.round(amount);
      if (amount > balance[from]) {
        warnings.push(`${date}: تخطيت تحويل ${amount} من ${from} لأن الرصيد ${balance[from]}`);
        return false;
      }
      balance[from] -= amount;
      balance[to] += amount;
      push(from, date, amount, 'debit', `${desc} إلى ${to}`, { internal: true, counterparty: to });
      push(to, date, amount, 'credit', `${desc} من ${from}`, { internal: true, counterparty: from });
      return true;
    },
  };
}

// مصروفات يومية عشوائية متوسطها الشهري = monthly، ولا تنزل بالرصيد تحت reserve
function dailySpending(ledger, rand, acc, date, monthly, reserve = 300) {
  if (rand() < 0.2) return; // 20% من الأيام بدون مصروف
  const avg = monthly / 30 / 0.8;
  const amount = Math.round(avg * (0.3 + rand() * 1.4));
  const take = Math.min(amount, ledger.balance[acc] - reserve);
  if (take >= 10) ledger.debit(acc, date, take, CATEGORIES[Math.floor(rand() * CATEGORIES.length)]);
}

const namaaAccount = id => ({
  accountId: id, bank: 'الإنماء', type: 'investment',
  product: 'نماء الاستثماري', currency: 'SAR', zakatExempt: true,
});

// ------------------------------------------------------------
// الشخصيات
// ------------------------------------------------------------

function buildAhmad(c) {
  const rand = mulberry32(c.seed);
  const accounts = [
    { accountId: 'A1', bank: 'الإنماء', type: 'current', currency: 'SAR' },
    { accountId: 'A2', bank: 'بنك أ', type: 'savings', currency: 'SAR' },
    namaaAccount('A3'),
  ];
  const L = createLedger(accounts);

  for (const date of eachDay(START, DEMO_TODAY)) {
    if (date === START) {
      L.credit('A1', date, c.opening, 'رصيد افتتاحي');
      L.credit('A3', date, c.namaa, 'رصيد افتتاحي');
    }
    const employed = date >= c.firstSalary;
    if (employed && dayOf(date) === c.salaryDay) L.credit('A1', date, c.salary, 'راتب');
    if (date === c.bonus.date) L.credit('A1', date, c.bonus.amount, 'مكافأة');
    if (date > c.firstSalary && dayOf(date) === c.rentDay) L.debit('A1', date, c.rent, 'إيجار');
    if (date > c.firstSalary && dayOf(date) === c.savingsDay) L.transfer('A1', 'A2', date, c.savings, 'تحويل ادخار');

    if (employed) dailySpending(L, rand, 'A1', date, c.monthlySpending);
    else if (rand() < 0.5) L.debit('A1', date, 20 + Math.round(rand() * 60), CATEGORIES[Math.floor(rand() * CATEGORIES.length)]);
  }

  return {
    persona: 'ahmad', name: 'أحمد', description: 'موظف حكومي بدأ وظيفته في أبريل 2025',
    accounts, transactions: L.transactions, holdings: [], manual: [], warnings: L.warnings,
  };
}

function buildKhalid(c) {
  const rand = mulberry32(c.seed);
  const stockRand = mulberry32(c.seed + 1); // مستقل حتى ما تتغير الأسهم لو عدلنا المصروفات
  const accounts = [
    { accountId: 'K1', bank: 'الإنماء', type: 'current', currency: 'SAR' },
    { accountId: 'K2', bank: 'بنك أ', type: 'current', currency: 'SAR' },
    { accountId: 'K3', bank: 'بنك ب', type: 'savings', currency: 'SAR' },
    namaaAccount('K4'),
  ];
  const L = createLedger(accounts);
  const holdings = [];
  const stockValues = {};
  let stock = c.stocks.start;

  for (const date of eachDay(START, DEMO_TODAY)) {
    if (date === START) {
      for (const [acc, amount] of Object.entries(c.opening)) L.credit(acc, date, amount, 'رصيد افتتاحي');
      L.credit('K4', date, c.namaa, 'رصيد افتتاحي');
    }
    if (dayOf(date) === c.income.day) L.credit('K1', date, c.income.amount, 'أرباح نشاط تجاري');
    if (dayOf(date) === c.rent.day && c.rent.months.includes(monthOf(date))) L.credit('K2', date, c.rent.amount, 'إيجار عقار');
    if (dayOf(date) === c.savings.day) L.transfer('K1', 'K3', date, c.savings.amount, 'تحويل ادخار');

    if (date === c.gold.date) {
      const cost = c.gold.grams * (c.gold.karat / 24) * prices[date].gold;
      if (L.debit('K3', date, cost, `شراء ذهب ${c.gold.grams} جم عيار ${c.gold.karat}`)) {
        holdings.push({ type: 'gold', grams: c.gold.grams, karat: c.gold.karat, acquired: date, cost: Math.round(cost), paidFrom: 'K3' });
      }
    }

    dailySpending(L, rand, 'K1', date, c.monthlySpending);

    stockValues[date] = Math.round(stock);
    stock *= 1 + (stockRand() * 2 - 1) * c.stocks.dailyVolatility;
  }

  holdings.push({ type: 'stocks', intent: 'trading', name: 'محفظة أسهم', values: stockValues });

  return {
    persona: 'khalid', name: 'خالد', description: 'مستثمر لديه حسابات في ثلاثة بنوك',
    accounts, transactions: L.transactions, holdings, manual: [], warnings: L.warnings,
  };
}

function buildNoura(c) {
  const rand = mulberry32(c.seed);
  const accounts = [{ accountId: 'N1', bank: 'الإنماء', type: 'current', currency: 'SAR' }];
  const L = createLedger(accounts);
  const projects = new Map(c.projects);

  for (const date of eachDay(START, DEMO_TODAY)) {
    if (date === START) L.credit('N1', date, c.opening, 'رصيد افتتاحي');
    if (projects.has(date)) L.credit('N1', date, projects.get(date), 'دفعة مشروع تصميم');
    if (date >= c.rentFrom && dayOf(date) === c.rentDay) L.debit('N1', date, c.rent, 'إيجار');
    dailySpending(L, rand, 'N1', date, c.monthlySpending);
  }

  return {
    persona: 'noura', name: 'نورة', description: 'مصممة مستقلة بدخل غير منتظم',
    accounts, transactions: L.transactions, holdings: [], manual: [], warnings: L.warnings,
  };
}

// ------------------------------------------------------------
// التشغيل
// ------------------------------------------------------------

for (const p of [buildAhmad(AHMAD), buildKhalid(KHALID), buildNoura(NOURA)]) {
  const { warnings, ...data } = p;
  data.period = { start: START, end: DEMO_TODAY };
  writeFileSync(`src/data/${p.persona}.json`, JSON.stringify(data, null, 1));

  const credits = data.transactions.filter(t => t.direction === 'credit' && !t.internal).length;
  const debits = data.transactions.filter(t => t.direction === 'debit' && !t.internal).length;
  console.log(`✓ ${p.name}: ${data.transactions.length} عملية (${credits} إيداع، ${debits} سحب) ← src/data/${p.persona}.json`);
  for (const w of warnings) console.log(`   ⚠ ${w}`);
}