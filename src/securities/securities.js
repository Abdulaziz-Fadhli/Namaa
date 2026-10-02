// نَماء — البحث عن سهم أو صندوق، ومعرفة هل «يزكي» أو الزكاة على المستثمر
// الأسواق: تداول (الرئيسية ونمو) والسوق الأمريكي، ومعها الصناديق غير المدرجة بالاسم
import data from '../data/securities.json';

const { securities } = data;

const USD_SAR = 3.75;

// ---------- توحيد النص العربي والإنجليزي للبحث ----------
const STOP = new Set(['شركه', 'صندوق', 'مجموعه', 'company', 'co', 'the', 'inc', 'corporation', 'group', 'fund', 'ltd', 'plc', 'holding']);
function norm(s) {
  return String(s || '').toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')          // التشكيل والتطويل
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))       // الأرقام العربية
    .replace(/[^\p{L}\p{N}.\s]/gu, ' ').replace(/\s+/g, ' ').trim()
    .replace(/(^| )(ال)?مصرف( |$)/g, '$1بنك$3');                // «مصرف الراجحي» = «بنك الراجحي»
}
// كلمة بدون «ال» التعريف، عشان «راجحي» تطابق «الراجحي»
const bare = w => (w.length > 4 && w.startsWith('ال') ? w.slice(2) : w);
const tokens = s => norm(s).split(' ').filter(w => w && !STOP.has(w)).map(bare);

function lev(a, b) {                                       // مسافة التحرير، للأخطاء الإملائية البسيطة
  if (Math.abs(a.length - b.length) > 1) return 2;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

const BY_SYMBOL = new Map(securities.map(s => [s.symbol, s]));
// فهرس مسبق: لكل ورقة كل أسمائها بعد التوحيد
const INDEX = securities.map(s => {
  const names = [s.nameAr, s.nameEn, ...s.aliases].filter(Boolean);
  return { s, sym: s.symbol.toLowerCase(), full: names.map(n => tokens(n).join(' ')), words: new Set(names.flatMap(tokens)) };
});

function score(e, q, qt) {
  if (e.sym === q) return 100;
  if (e.full.includes(qt.join(' '))) return 95;                            // اسم أو اسم بديل مطابق
  if (e.full.some(f => f.startsWith(qt.join(' ')))) return 85;             // بداية الاسم
  const hit = qt.filter(t => e.words.has(t)).length;
  if (hit === qt.length) return 70 + Math.min(hit, 5);                     // كل الكلمات موجودة
  const partial = qt.filter(t => t.length >= 3 && [...e.words].some(w => w.startsWith(t))).length;
  if (partial === qt.length) return 60;
  // خطأ إملائي بحرف واحد، فقط للكلمات الطويلة وبنفس الحرف الأول (حتى لا تطابق Ford كلمة Food)
  const fuzzy = qt.filter(t => t.length >= 5 && [...e.words].some(w => w[0] === t[0] && lev(w, t) <= 1)).length;
  if (fuzzy === qt.length) return 45;
  return 0;
}

// بحث: يرجّع أفضل النتائج مرتبة (يقبل الرمز أو الاسم بالعربي أو الإنجليزي)
function search(query, { limit = 8, market, fundsOnly = false } = {}) {
  const q = norm(query), qt = tokens(query);
  if (!q) return [];
  return INDEX
    .filter(e => (!market || e.s.market === market) && (!fundsOnly || e.s.type !== 'COMPANY'))
    .map(e => ({ s: e.s, score: score(e, q, qt.length ? qt : [q]) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || (a.s.market === 'US') - (b.s.market === 'US') || a.s.symbol.localeCompare(b.s.symbol))
    .slice(0, limit)
    .map(x => ({ ...x.s, score: x.score }));
}

// ---------- صندوق غير مدرج: نستنتج نوعه من اسمه ----------
const FUND_HINTS = [
  [/ريت|reit/i, 'REIT'],
  [/بيتكوين|bitcoin|ethereum|ايثيريوم|عملات رقميه|crypto/i, 'CRYPTO'],
  [/فضه|silver/i, 'SILVER'],
  [/ذهب|gold/i, 'GOLD'],
  [/سندات|bond|treasury/i, 'BONDS'],
  [/مرابح|murabah|نقد|money market|سيول/i, 'MURABAHA'],
  [/صكوك|sukuk|دخل ثابت|fixed income/i, 'SUKUK'],
  [/امريك|us |usa|s ?p 500|ناسداك|nasdaq|عالمي|global|world|دولي|international|صين|china|هند|india|يابان|اوروب/i, 'FOREIGN_EQUITY'],
  [/متعدد|متوازن|multi|balanced/i, 'MULTI_ASSET'],
  [/عقار|real estate/i, 'REAL_ESTATE'],
  [/اسهم (ال)?سعودي|سعودي(ه)? للاسهم|saudi equit|saudi stock|tasi|تاسي|اسهم (ال)?محلي/i, 'SAUDI_EQUITY'],
];
function fundFromName(name) {
  const n = norm(name) + ' ';
  const hit = FUND_HINTS.find(([re]) => re.test(n));
  return { symbol: null, market: 'FUND', type: 'FUND', category: hit ? hit[1] : 'UNKNOWN', nameAr: name, nameEn: '', aliases: [], verified: false };
}

// ---------- الحكم: هل يزكي؟ ----------
// الأساس: الشركات السعودية تدفع الزكاة لهيئة الزكاة عن حصص ملاكها السعوديين والخليجيين،
// فالمستثمر (غير المضارب) لا زكاة عليه في أصل السهم. أما الصناديق فلا تخضع لجباية الزكاة
// والزكاة على مالك الوحدة (قواعد جباية الزكاة من المستثمرين في الصناديق)، والشركات الأمريكية لا تزكي.
const DIVIDENDS = 'الأرباح الموزّعة إذا قبضتها تصير نقداً يُضم لحسابك ويجري عليه الحول.';
const CAT_AR = {
  REIT: 'صندوق ريت عقاري', SAUDI_EQUITY: 'صندوق أسهم سعودية', US_EQUITY: 'صندوق أسهم أمريكية', FOREIGN_EQUITY: 'صندوق أسهم خارجية',
  SUKUK: 'صندوق صكوك', GOLD: 'صندوق ذهب', MURABAHA: 'صندوق مرابحة', MULTI_ASSET: 'صندوق متعدد الأصول',
  REAL_ESTATE: 'صندوق عقاري', BONDS: 'صندوق سندات', SILVER: 'صندوق فضة', CRYPTO: 'صندوق عملات رقمية', UNKNOWN: 'صندوق',
};
// أنواع الصناديق التي نسأل المستخدم عنها إذا لم نعرف نوع صندوقه من اسمه
const FUND_CHOICES = ['SAUDI_EQUITY', 'MURABAHA', 'SUKUK', 'REIT', 'REAL_ESTATE', 'FOREIGN_EQUITY', 'MULTI_ASSET', 'GOLD']
  .map(c => ({ category: c, label: CAT_AR[c] }));
const MARKET_AR = { TASI: 'تداول', NOMU: 'نمو', US: 'السوق الأمريكي', FUND: 'صندوق غير مدرج' };

function zakatStatus(sec, intent = 'INVEST') {
  const base = { symbol: sec.symbol, name: sec.nameAr || sec.nameEn, nameEn: sec.nameEn, market: sec.market, marketAr: MARKET_AR[sec.market],
    type: sec.type, category: sec.category, intent };
  const note = sec.verified === false ? 'نوع هذا الصندوق مستنتج من اسمه، تأكد منه في نشرة الصندوق.' : null;

  // المضارب: يزكي القيمة السوقية مهما كان نوع الورقة
  if (intent === 'TRADE') return { ...base, status: 'INVESTOR_PAYS', paysZakat: false, method: 'MARKET',
    badge: 'الزكاة عليك', headline: 'أنت مضارب فالزكاة عليك',
    detail: `من يشتري ليبيع يزكي القيمة السوقية لما يملكه يوم تمام الحول بنسبة 2.5% (دليل الهيئة §3.6)${sec.type === 'COMPANY' && sec.market !== 'US' ? '، حتى لو كانت الشركة تزكي' : ''}.`, note };

  // شركة مدرجة في تداول لكنها مسجلة خارج المملكة: لا تدفع الزكاة السعودية عن مساهميها
  if (sec.type === 'COMPANY' && sec.foreign) return { ...base, status: 'INVESTOR_PAYS', paysZakat: false, method: 'MARKET',
    badge: 'لا يزكي', headline: 'هذا السهم لا يزكي عنك، والزكاة عليك',
    detail: `الشركة مدرجة في تداول لكنها مسجلة خارج المملكة (${sec.foreign})، فلا تدفع الزكاة لهيئة الزكاة عن مساهميها. الأحوط أن تزكي 2.5% من القيمة السوقية يوم تمام الحول.`, note };

  if (sec.type === 'COMPANY' && (sec.market === 'TASI' || sec.market === 'NOMU')) return { ...base, status: 'COMPANY_PAYS', paysZakat: true, method: 'NONE',
    badge: 'يزكي', headline: 'هذا السهم يزكي',
    detail: `شركة سعودية مدرجة تجبي هيئة الزكاة والضريبة والجمارك زكاتها، فلا زكاة عليك في أصل السهم ما دمت مستثمراً ولست مضارباً، ويكفيك إخراج الشركة عنك (دليل الهيئة §3.6). ${DIVIDENDS}`,
    note: sec.symbol === '2222' ? 'زكاة مساهمي أرامكو تُحسب وتُخصم من مدفوعات الشركة للدولة بالأمر الملكي رقم 16712 (نوفمبر 2019).'
      : 'ينطبق على المساهم السعودي والخليجي، لأن الشركة تدفع الزكاة عن حصصهم.' };

  if (sec.type === 'COMPANY' && sec.market === 'US') return { ...base, status: 'INVESTOR_PAYS', paysZakat: false, method: 'MARKET',
    badge: 'لا يزكي', headline: 'هذا السهم لا يزكي، والزكاة عليك',
    detail: 'الشركات المدرجة في السوق الأمريكي لا تدفع زكاة لهيئة الزكاة. حسب دليل الهيئة (§3.6) يزكّي المستثمر حصته من موجودات الشركة الزكوية فقط (النقد والمخزون والذمم)، وإن لم تتوفر هذه الحصة فالأحوط 2.5% من القيمة السوقية يوم تمام الحول.', note };

  // الصناديق بأنواعها: لا تخضع لجباية الزكاة، والزكاة على مالك الوحدة، إلا ما تغطيه زكاة الشركات التي فيها
  const kind = CAT_AR[sec.category] || 'صندوق';
  const pays = (method, detail) => ({ ...base, status: 'INVESTOR_PAYS', paysZakat: false, method,
    badge: 'لا يزكي', headline: `${kind}: لا يزكي عنك، والزكاة عليك`, detail, note });

  if (sec.category === 'SAUDI_EQUITY' && sec.type === 'ETF') return { ...base, status: 'COVERED_BY_HOLDINGS', paysZakat: true, method: 'NONE',
    badge: 'يزكي', headline: `${kind}: الشركات التي فيه تزكي`,
    detail: 'صندوق مؤشر يملك أسهم شركات سعودية ولا يضارب بها، وهذه الشركات تدفع زكاتها، فلا زكاة على المستثمر غير المضارب عند كثير من العلماء. النقد غير المستثمر داخل الصندوق زكاته عليك.', note };
  if (sec.category === 'SAUDI_EQUITY') return pays('MARKET',
    'صناديق الأسهم النشطة تبيع وتشتري الأسهم بقصد الربح، فالزكاة على المستثمر: 2.5% من قيمة وحداتك يوم تمام الحول. إن كان الصندوق مؤشرياً لا يضارب (مثل صناديق المؤشرات المتداولة) فالشركات التي فيه تزكي ولا شيء عليك.');
  if (sec.category === 'REIT') return pays('FUND_BASE_OR_MARKET', sec.market === 'US'
    ? 'عقارات الريت مؤجرة وليست للبيع، فالزكاة على حصتك من النقد والذمم داخل الصندوق. الصناديق الأجنبية لا تنشر هذه الحصة، فالأحوط أن تزكي 2.5% من قيمة وحداتك.'
    : 'عقارات الريت مؤجرة وليست للبيع، فلا زكاة على قيمتها. زكاتك على حصتك من النقد والذمم داخل الصندوق، ومدير الصندوق ينشرها «زكاة لكل وحدة»؛ اضربها في عدد وحداتك. والتوزيعات التي تقبضها تُضم لنقدك ويجري عليها الحول. إن لم تجدها فالأحوط 2.5% من القيمة السوقية.');
  if (sec.category === 'REAL_ESTATE') return pays('FUND_BASE_OR_MARKET',
    'إذا نشر مدير الصندوق الزكاة لكل وحدة فاضربها في عدد وحداتك. وإلا: صندوق يطوّر عقارات للبيع زكاته على قيمة وحداتك، وصندوق عقارات مؤجرة زكاته على التوزيعات التي تقبضها فقط.');
  if (sec.category === 'MULTI_ASSET') return pays('FUND_BASE_OR_MARKET',
    'إذا نشر مدير الصندوق الزكاة لكل وحدة فاضربها في عدد وحداتك، وإلا فزكِّ 2.5% من قيمة وحداتك يوم تمام الحول.');
  return pays('MARKET', 'الصناديق لا تخضع لجباية الزكاة، والزكاة على مالك الوحدة: 2.5% من قيمة وحداتك يوم تمام الحول.');
}

// ---------- واجهة واحدة للأداة: نص المستخدم ← الحكم ----------
// check('الراجحي') ، check('AAPL') ، check('صندوق الإنماء للمرابحة') ، check('صندوق س', {category: 'MURABAHA'})
// كلمات كاملة فقط (Netflix فيها etf، وسينومي ريتيل فيها ريت)
const FUND_WORD = /(^| )(صندوق|fund|etf)( |$)/;
const FUND_HINT = /(^| )(صندوق|fund|etf|ريت|reit|مرابحه|صكوك|sukuk)( |$)/;
const LATIN_TICKER = /^[A-Za-z]{1,5}([.-][A-Za-z])?$/;
const SAUDI_CODE = /^\d{4}$/;
function check(query, { intent = 'INVEST', asFund = false, category } = {}) {
  query = String(query || '').trim();
  if (!query) return { found: false, message: 'اكتب اسم السهم أو الصندوق أو رمزه.', alternatives: [] };
  // كتب «صندوق ...»: لا نطابقه مع شركة (صندوق الراجحي ≠ مصرف الراجحي)
  const fundWord = FUND_WORD.test(norm(query));
  const matches = asFund || category ? [] : search(query, { limit: 6, fundsOnly: fundWord });
  const top = matches[0];
  const alts = matches.slice(1).map(brief);

  // 1) مطابقة واضحة: رمز أو اسم مطابق لورقة واحدة فقط، أو نتيجة قوية أعلى من غيرها
  //    (أقل من 70 = تطابق جزئي أو إملائي: نقترح ولا نحكم)
  // الرمز الأمريكي المطابق تماماً يتقدّم على اسم شركة أمريكية أخرى يشبهه (NOW ≠ «NOW Inc.»)،
  // لكن إذا طابق اسماً بديلاً لسهم سعودي (stc) نعرض الاثنين
  const strong = matches.filter(m => m.score >= 95 && !(top.score === 100 && m.score < 100 && m.market === 'US'));
  const clear = top && (strong.length === 1 || (!strong.length && top.score >= 70 && (!matches[1] || top.score > matches[1].score)));
  const q = norm(query);

  // 2) رمز أمريكي غير موجود في القائمة: لا نعرض تطابقات ضعيفة بدل الحكم
  if (LATIN_TICKER.test(query) && (!top || top.score < 70)) {
    const sym = query.toUpperCase().replace('-', '.');
    const sec = { symbol: sym, market: 'US', type: 'COMPANY', category: 'COMPANY', nameAr: '', nameEn: sym, aliases: [] };
    return { found: true, ...zakatStatus(sec, intent), unlisted: true, alternatives: matches.map(brief),
      note: 'الرمز ليس في قائمتنا فاعتبرناه مدرجاً في السوق الأمريكي. تأكد من كتابته، وإن كان صندوقاً (ETF) فالحكم نفسه: الزكاة عليك.' };
  }
  if (clear) return { found: true, ...zakatStatus(top, intent), alternatives: alts };

  // 3) أكثر من نتيجة متقاربة: نطلب الاختيار بدل ما نختار عنه
  if (strong.length > 1) return { found: false, ambiguous: true, message: 'هذا الاسم أو الرمز يطابق أكثر من ورقة، اختر المقصودة:',
    alternatives: strong.sort((a, b) => (a.market === 'US') - (b.market === 'US')).map(brief) };
  if (matches.length) return { found: false, ambiguous: true,
    message: top.score >= 70 ? 'وجدنا أكثر من نتيجة، اختر واحدة:' : 'ما لقينا تطابقاً تاماً، هل تقصد:', alternatives: matches.map(brief),
    ...(fundWord ? { fundName: query, choices: FUND_CHOICES, choicesMessage: 'أو إذا كان صندوقاً آخر غير مدرج في السوق، اختر نوعه:' } : {}) };

  // 4) رمز سعودي غير موجود في القائمة
  if (SAUDI_CODE.test(q)) {
    const n = +q, fund = (n >= 4330 && n <= 4399) || (n >= 9300 && n <= 9499) || (n >= 4700 && n <= 4799);
    return { found: false, message: `الرمز ${q} غير موجود في قائمتنا. تأكد منه، وإن كان إدراجاً جديداً: `
      + (fund ? 'هذا الرمز من نطاق الصناديق (ريت أو مؤشرات)، والصناديق لا تزكي عن مستثمريها.' : 'الشركات السعودية المدرجة تزكي، والصناديق (ريت أو مؤشرات) لا تزكي.'), alternatives: [] };
  }

  // 5) صندوق غير مدرج: نستنتج نوعه من اسمه، وإن لم نعرف نسأل المستخدم
  if (asFund || category || FUND_HINT.test(norm(query))) {
    const f = fundFromName(query);
    if (category && CAT_AR[category]) { f.category = category; f.verified = true; }
    if (f.category === 'UNKNOWN') return { found: false, needsCategory: true, fundName: query,
      message: 'ما عرفنا نوع هذا الصندوق من اسمه. اختر نوعه (تجده في نشرة الصندوق):', choices: FUND_CHOICES, alternatives: [] };
    return { found: true, ...zakatStatus(f, intent), alternatives: [] };
  }
  return { found: false, message: 'لم نجد هذا السهم. جرّب الرمز (مثل 1120 أو AAPL) أو جزءاً من الاسم. وإن كان صندوقاً اكتب «صندوق» قبل اسمه.', alternatives: [] };
}
const brief = s => ({ symbol: s.symbol, name: s.nameAr || s.nameEn, nameEn: s.nameEn, market: s.market, marketAr: MARKET_AR[s.market], type: s.type });

// ---------- الحساب: القيمة والوعاء الزكوي لورقة يملكها المستخدم ----------
// holding: {symbol | fundName, units, intent}   prices: {stocks:{رمز: سعر}, funds:{}, zakatPerUnit:{}, fx:{USD}}
function assess(holding, prices = {}, settings = {}) {
  const sec = holding.symbol ? BY_SYMBOL.get(String(holding.symbol).toUpperCase()) : null;
  let s = sec || (holding.symbol ? null : fundFromName(holding.fundName || holding.fund || ''));
  if (!s) return null;
  if (!sec && holding.category && CAT_AR[holding.category]) s = { ...s, category: holding.category, verified: true };
  const st = zakatStatus(s, holding.intent || 'INVEST');
  const key = s.symbol || holding.fundName || holding.fund;
  const px = holding.price ?? prices.stocks?.[key] ?? prices.funds?.[key] ?? 0;
  const fx = s.market === 'US' ? (prices.fx?.USD ?? USD_SAR) : 1;
  const value = holding.units * px * fx;
  let zakatable = !st.paysZakat;
  if (st.status === 'COMPANY_PAYS' && settings.companyPaysForInvestShares === false) zakatable = true;   // إعداد الهيئة الشرعية
  if (st.status === 'COVERED_BY_HOLDINGS' && settings.coverSaudiEquityFunds === false) zakatable = true;
  // الوعاء: زكاة الوحدة المنشورة × 40، أو نسبة الأصول الزكوية، أو القيمة السوقية
  // FUND_BASE_OR_MARKET: زكاة الوحدة المنشورة من المدير، وإلا القيمة السوقية (الأحوط)
  const zpu = holding.zakatPerUnit ?? prices.zakatPerUnit?.[key];
  let base = value, method = 'MARKET', needsZakatPerUnit = false;
  // زكاة الوحدة المعلنة من مدير الصندوق (§3.9): تُعتمد لأي صندوق استثماري إذا أدخلها المستخدم
  if (zakatable && zpu != null && (st.method.startsWith('FUND_BASE') || (holding.zakatPerUnit != null && st.type !== 'COMPANY' && st.intent !== 'TRADE'))) { base = holding.units * zpu * fx * 40; method = 'FUND_BASE'; }
  else if (zakatable && sec?.category === 'REIT' && sec.market !== 'US' && st.method !== 'MARKET') needsZakatPerUnit = true;   // الحد الأعلى
  // §3.6: المستثمر يزكي حصته من الموجودات الزكوية للشركة
  else if (zakatable && holding.zakatableRatio != null && st.intent !== 'TRADE') { base = value * holding.zakatableRatio; method = 'ZAKATABLE_ASSETS'; }
  return { ...st, units: holding.units, price: px, value, zakatable, base: zakatable ? base : 0, zakat: zakatable ? base / 40 : 0,
    calcMethod: zakatable ? method : 'NONE', needsZakatPerUnit };
}

// ---------- ربط مع محرك نماء (src/engine/engine.js → calculateAssetValue) ----------
// يحوّل نتيجة assess إلى مدخل يفهمه المحرك: stocks للأسهم، investmentProducts للصناديق.
// المضارب TRADING بالقيمة السوقية؛ المستثمر LONG_TERM بالقيمة الزكوية (صفر إذا الشركة أو شركات الصندوق تزكي).
export function toEngineEntry(a, id) {
  if (!a) return null;
  const entry = a.intent === 'TRADE'
    ? { type: 'TRADING', marketValue: a.value }
    : { type: 'LONG_TERM', marketValue: a.value, zakatableValue: a.zakatable ? a.base : 0 };
  if (id) entry.id = id;
  return { kind: a.type === 'COMPANY' ? 'stocks' : 'investmentProducts', entry };
}

export { search, check, zakatStatus, assess, fundFromName, norm, securities, FUND_CHOICES, MARKET_AR };
