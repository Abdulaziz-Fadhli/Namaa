// المنهجية الشرعية في نماء: أدلة هيئة الزكاة والضريبة والجمارك، كل قاعدة مع موضعها في الدليل.
// المحرك (engine.js) يطبق هذه القواعد، وهذا الملف يجمع مصادرها ويحسب زكاة بهيمة الأنعام والحبوب والثمار
// بصيغة تفهمها الشاشات (نص عربي للفريضة، والسبب، والمصدر).
import {
  CROP_NISAB_KG,
  CROP_NISAB_LITERS,
  CROP_NISAB_SAA,
  CROP_RATES,
  LIVESTOCK_NISAB,
  hijri,
  isHawlComplete,
  livestockObligations,
} from './engine.js';

export const ZATCA = Object.freeze({
  authority: 'هيئة الزكاة والضريبة والجمارك',
  authorityEn: 'Zakat, Tax and Customs Authority (ZATCA)',
  basis: 'فتاوى اللجنة الدائمة للبحوث العلمية والإفتاء',
  guides: Object.freeze({
    individual: Object.freeze({
      id: 'ZATCA-INDIVIDUAL-2023-03',
      title: 'الدليل الإرشادي للأحكام الفقهية لزكاة الأفراد',
      short: 'دليل زكاة الأفراد',
      edition: 'مارس 2023م',
    }),
    livestockCrops: Object.freeze({
      id: 'ZATCA-LIVESTOCK-CROPS',
      title: 'الدليل المبسط لجباية زكاة بهيمة الأنعام والحبوب والثمار',
      short: 'دليل بهيمة الأنعام والحبوب والثمار',
      edition: null,
    }),
  }),
  statement:
    'يحسب نماء الزكاة وفق الدليل الإرشادي للأحكام الفقهية لزكاة الأفراد، والدليل المبسط لجباية زكاة بهيمة الأنعام والحبوب والثمار، الصادرين عن هيئة الزكاة والضريبة والجمارك والمبنيين على فتاوى اللجنة الدائمة للبحوث العلمية والإفتاء.',
  short: 'وفق أدلة هيئة الزكاة والضريبة والجمارك',
  // نص التنويه في الدليل نفسه
  disclaimer:
    'الدليل إرشادي وليس مستندًا نظاميًا، ونصوصه غير ملزمة للهيئة. نماء أداة حساب مساعدة ولا يمثّل الهيئة، وللمسائل الخاصة راجع جهة إفتاء.',
  // قنوات الهيئة الرسمية لإخراج الزكاة
  channels: Object.freeze({
    money: 'منصة «زكاتي» من هيئة الزكاة والضريبة والجمارك، وتصل الزكاة إلى مستحقيها في الضمان الاجتماعي',
    livestockCrops: 'بوابة الهيئة الإلكترونية ← «زكاة بهيمة الأنعام والثمار»، وتصدر شهادة زكاة بعد الدفع',
  }),
});

// كل قاعدة يطبقها نماء ومكانها في الدليل (رقم الفقرة ورقم الصفحة المطبوع).
const RULE_LIST = [
  ['ZAKATABLE_TYPES', 'individual', '2.2.1', 10, 'الأموال الزكوية أربعة: الذهب والفضة والنقود، وعروض التجارة، والخارج من الأرض من الحبوب والثمار، وبهيمة الأنعام.'],
  ['ONE_ZAKAT', 'individual', '2.2.1.1', 11, 'المال الذي اجتمع فيه وصفان يزكّى زكاة واحدة؛ فالأنعام المعدّة للتجارة تزكّى زكاة عروض التجارة فقط.'],
  ['FULL_OWNERSHIP', 'individual', '2.2.3', 11, 'يشترط الملك التام؛ فلا زكاة في الأوقاف ولا في التركة قبل تمكن الورثة من قسمتها.'],
  ['NISAB_GOLD_SILVER', 'individual', '2.2.4', 12, 'نصاب الذهب 85 غرامًا خالصًا، ونصاب الفضة 595 غرامًا خالصة.'],
  ['NISAB_CASH', 'individual', '2.2.4', 12, 'نصاب النقود الورقية وعروض التجارة: أدنى النصابين من الذهب أو الفضة.'],
  ['HAWL_LUNAR', 'individual', '2.2.5', 13, 'الحول سنة هجرية: اثنا عشر شهرًا قمريًا، ولا يشترط في الحبوب والثمار.'],
  ['NEW_MONEY', 'individual', '2.2.5.1', 14, 'المال المستفاد من غير ربح تجارة ولا نتاج أنعام: للمزكي أن يجعل له حولًا مستقلًا، أو يعجّل زكاته مع ماله الأول.'],
  ['SALARY', 'individual', '3.3', 19, 'الراتب: لكل راتب حوله، أو يجعل المزكي يومًا في السنة يزكي فيه كل نقوده؛ زكاة في وقتها لما حال حوله، ومعجّلة لما لم يحل.'],
  ['GOLD_SILVER', 'individual', '3.1', 15, 'زكاة الذهب والفضة ربع العشر من قيمتها يوم الوجوب، والذهب المخلوط بنسبة عياره من 24.'],
  ['JEWELRY', 'individual', '3.1.2', 16, 'الحلي المعدّ للاستعمال أو الإعارة لا زكاة فيه، والمعدّ للبيع أو التجارة أو الإيجار فيه الزكاة.'],
  ['CASH', 'individual', '3.2.1', 18, 'النقود الورقية فيها ربع العشر (2.5%) إذا بلغت النصاب وحال عليها الحول.'],
  ['DEBTS', 'individual', '3.4', 19, 'الدين على مليء غير مماطل يزكّى كل سنة، وعلى المعسر أو المماطل يزكّى سنة واحدة بعد قبضه، والدين الذي عليك لا يُخصم.'],
  ['TRADE_GOODS', 'individual', '3.5', 20, 'عروض التجارة تقوّم بسعر السوق يوم الوجوب وتزكّى ربع العشر.'],
  ['SHARES', 'individual', '3.6', 22, 'أسهم الاستثمار تزكّى بحسب موجودات الشركة الزكوية، والشركات المساهمة في المملكة تزكّي عنها الهيئة، وأسهم المضاربة تزكّى بقيمتها السوقية.'],
  ['DEBT_INSTRUMENTS', 'individual', '3.7', 23, 'الصكوك والسندات: للاستثمار بحسب موجوداتها الزكوية، وللمضاربة بقيمتها السوقية.'],
  ['REAL_ESTATE', 'individual', '3.8', 24, 'عقار السكن لا زكاة فيه، وعقار الإيجار يزكّى إيجاره، وعقار التجارة يزكّى بقيمته يوم الوجوب.'],
  ['FUNDS', 'individual', '3.9', 24, 'الصناديق للاستثمار بحسب موجوداتها (وعاء زكاة الصندوق × نسبة الملكية × 2.5%)، وللمضاربة بقيمتها السوقية.'],
  ['TIMING', 'individual', '4.2', 26, 'تخرج الزكاة فور وجوبها، ومن فاتته سنوات زكاها بقيمة كل سنة.'],
  ['ADVANCE', 'individual', '5', 28, 'يجوز تعجيل الزكاة لسنتين.'],
  ['RECIPIENTS', 'individual', '6', 29, 'تصرف الزكاة في مصارفها الثمانية.'],
  ['LIVESTOCK_CONDITIONS', 'livestockCrops', null, 5, 'تجب في الإبل والبقر والغنم المعدّة للدر والنسل، السائمة كل الحول أو أكثره، إذا حال عليها الحول وبلغت النصاب؛ والعاملة لا زكاة فيها، والمعدّة للتجارة فيها زكاة عروض التجارة.'],
  ['CAMELS', 'livestockCrops', null, 6, 'نصاب الإبل خمس، وفريضتها حسب جدول الدليل، وما زاد على 120 ففي كل 50 حقة وفي كل 40 بنت لبون.'],
  ['CATTLE', 'livestockCrops', null, 8, 'نصاب البقر ثلاثون، وفي كل 30 تبيع وفي كل 40 مسنة.'],
  ['SHEEP', 'livestockCrops', null, 8, 'نصاب الغنم (الضأن والماعز) أربعون، ثم تستقر الفريضة بعد 399 في كل مائة شاة، ولا شيء في كسور المئات.'],
  ['LIVESTOCK_QUALITY', 'livestockCrops', null, 9, 'يراعى في المخرج: السلامة من العيوب، والأنوثة في الإبل والغنم، والسن، والوسط.'],
  ['CROPS', 'livestockCrops', null, 10, 'تجب في الحبوب والثمار المكيلة المدخرة إذا بلغت بعد تصفيتها وجفافها خمسة أوسق، ولا زكاة في الخضروات والفواكه، ووقت الوجوب اشتداد الحب وبدو صلاح الثمر.'],
  ['CROP_NISAB_WEIGHT', 'individual', '2.2.4', 12, 'نصاب الزروع والثمار خمسة أوسق، وتعادل 612 كيلوغرامًا تقريبًا من القمح ونحوه.'],
];

// مقدار الواجب في الحبوب والثمار ليس منصوصًا في الدليلين؛ حاسبة الهيئة تطلب «طريقة الكلفة»
// (دليل بهيمة الأنعام والحبوب والثمار ص27)، والنسب من الحديث، فنذكر مصدرها كما هو.
const CROP_RATE = Object.freeze({
  id: 'CROP_RATE', guide: null, section: null, page: null,
  text: 'العشر فيما سُقي بلا كلفة، ونصف العشر فيما سُقي بكلفة، وثلاثة أرباع العشر لما سُقي بهما مناصفة.',
  source: 'حديث «فيما سقت السماء والعيون أو كان عثريًا العشر، وما سُقي بالنضح نصف العشر» (رواه البخاري)، وحاسبة الهيئة تحسب الواجب حسب طريقة الكلفة (دليل بهيمة الأنعام والحبوب والثمار، ص27)',
});

export const RULES = Object.freeze({
  ...Object.fromEntries(RULE_LIST.map(([id, guide, section, page, text]) =>
    [id, Object.freeze({ id, guide, section, page, text, source: citeParts(guide, section, page) })])),
  CROP_RATE,
});

function citeParts(guide, section, page) {
  const g = ZATCA.guides[guide];
  return `${g.short}${section ? ` §${section}` : ''}، ص${page}`;
}

// «دليل زكاة الأفراد §2.2.4، ص12 — هيئة الزكاة والضريبة والجمارك»
export function cite(ruleId) {
  const rule = Object.hasOwn(RULES, ruleId) ? RULES[ruleId] : null;
  if (!rule) throw new TypeError(`unknown ZATCA rule: ${ruleId}`);
  return rule.guide ? `${rule.source} — ${ZATCA.authority}` : rule.source;
}

// ملخص المنهجية لشاشات نماء (يدخل في buildView)
export function methodologySummary(settings) {
  const mode = settings?.acquiredMoneyMode ?? 'INDEPENDENT_HAWL';
  return {
    authority: ZATCA.authority,
    basis: ZATCA.basis,
    statement: ZATCA.statement,
    short: ZATCA.short,
    disclaimer: ZATCA.disclaimer,
    guides: Object.values(ZATCA.guides).map(g => ({ id: g.id, title: g.title, edition: g.edition })),
    applied: [
      { rule: 'NISAB_CASH', text: RULES.NISAB_CASH.text, source: RULES.NISAB_CASH.source },
      { rule: 'HAWL_LUNAR', text: RULES.HAWL_LUNAR.text, source: RULES.HAWL_LUNAR.source },
      mode === 'ANNUAL_ADVANCE'
        ? { rule: 'SALARY', text: 'يوم واحد في السنة يزكّى فيه كل المال: ما حال حوله في وقته، وما لم يحل معجّلًا.', source: RULES.SALARY.source }
        : { rule: 'NEW_MONEY', text: 'حول مستقل لكل مبلغ من يوم دخوله.', source: RULES.NEW_MONEY.source },
      { rule: 'CASH', text: RULES.CASH.text, source: RULES.CASH.source },
      { rule: 'DEBTS', text: 'الديون التي عليك لا تُخصم من الوعاء.', source: RULES.DEBTS.source },
    ],
    acquiredMoneyMode: mode,
  };
}

// ---------- بهيمة الأنعام ----------

export const LIVESTOCK_TYPES = Object.freeze({
  camels: { label: 'إبل', unit: 'رأس', nisab: LIVESTOCK_NISAB.camels, rule: 'CAMELS' },
  cattle: { label: 'بقر', unit: 'رأس', nisab: LIVESTOCK_NISAB.cattle, rule: 'CATTLE' },
  sheep: { label: 'غنم (ضأن أو ماعز)', unit: 'رأس', nisab: LIVESTOCK_NISAB.sheep, rule: 'SHEEP' },
});

export const LIVESTOCK_PURPOSES = Object.freeze({
  BREEDING: 'للدر والنسل (الحليب والتكاثر)',
  TRADING: 'للتجارة (أشتريها لأبيعها)',
  WORK: 'للعمل (الحرث أو الحمل)',
});
export const GRAZING = Object.freeze({
  GRAZING: 'سائمة ترعى كل السنة أو أكثرها',
  FED: 'معلوفة أغلب السنة',
});

// أسماء الفريضة بالعربي مع العدد
const AR_ANIMAL = {
  SHEEP: ['شاة واحدة', 'شاتان', n => `${n} شياه`, n => `${n} شاة`],
  SHEEP_OR_GOAT: ['شاة واحدة', 'شاتان', n => `${n} شياه`, n => `${n} شاة`],
  GOAT: ['شاة واحدة', 'شاتان', n => `${n} شياه`, n => `${n} شاة`],
  BINT_MAKHAD: ['بنت مخاض', 'بنتا مخاض', n => `${n} بنات مخاض`, n => `${n} بنت مخاض`],
  BINT_LABUN: ['بنت لبون', 'بنتا لبون', n => `${n} بنات لبون`, n => `${n} بنت لبون`],
  HIQQA: ['حقة', 'حقتان', n => `${n} حقاق`, n => `${n} حقة`],
  JADHAA: ['جذعة', 'جذعتان', n => `${n} جذعات`, n => `${n} جذعة`],
  TABI: ['تبيع أو تبيعة', 'تبيعان', n => `${n} أتبعة`, n => `${n} تبيعًا`],
  MUSINNA: ['مسنة', 'مسنتان', n => `${n} مسنات`, n => `${n} مسنة`],
};
const AGE_NOTE = {
  BINT_MAKHAD: 'أنثى إبل أتمت سنة',
  BINT_LABUN: 'أنثى إبل أتمت سنتين',
  HIQQA: 'أنثى إبل أتمت 3 سنين',
  JADHAA: 'أنثى إبل أتمت 4 سنين',
  TABI: 'ما تم له سنة',
  MUSINNA: 'ما تم لها سنتان',
};
function animalText({ animal, count }) {
  const forms = AR_ANIMAL[animal];
  if (!forms) throw new TypeError(`unknown animal ${animal}`);
  if (count === 1) return forms[0];
  if (count === 2) return forms[1];
  return count <= 10 ? forms[2](count) : forms[3](count);
}
export function obligationText(alternative) {
  // في الجمع يكفي «تبيع» (مسنة وتبيع)، ونقدّم الأكبر سنًّا كما في جدول الدليل
  const list = alternative.length > 1 ? [...alternative].reverse() : alternative;
  return list.map(a => (alternative.length > 1 && a.animal === 'TABI' && a.count === 1 ? 'تبيع' : animalText(a))).join(' و');
}

const DAY = 86400000;
const isoDate = d => d.toISOString().slice(0, 10);
const toDate = v => {
  const d = v instanceof Date ? v : new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new TypeError('invalid date');
  return d;
};
// أول يوم يكتمل فيه الحول الهجري
function hawlDueDate(start) {
  for (let t = start.getTime() + 340 * DAY; t <= start.getTime() + 370 * DAY; t += DAY) {
    const d = new Date(t);
    if (isHawlComplete(start, d)) return d;
  }
  throw new RangeError('hawl due date outside supported range');
}

// input: { type, count, purpose, grazing, acquired, asOf, marketValue? }
// يعيد: الحكم، والفريضة بالعربي، وقيمة ما يدخل وعاء النقود (للتجارة فقط)، والمصدر.
export function assessLivestock(input) {
  if (!input || typeof input !== 'object') throw new TypeError('livestock must be an object');
  const { type, count, purpose = 'BREEDING', grazing = 'GRAZING' } = input;
  const meta = LIVESTOCK_TYPES[type];
  if (!meta || !Object.hasOwn(LIVESTOCK_TYPES, type)) throw new TypeError('unsupported livestock type');
  if (!Number.isSafeInteger(count) || count < 0 || count > 1e6) throw new RangeError('livestock count must be a whole number');
  if (!Object.hasOwn(LIVESTOCK_PURPOSES, purpose)) throw new TypeError('unsupported livestock purpose');
  if (!Object.hasOwn(GRAZING, grazing)) throw new TypeError('unsupported grazing');
  const acquired = toDate(input.acquired);
  const asOf = toDate(input.asOf);
  if (acquired > asOf) throw new RangeError('acquisition is in the future');
  const base = { kind: 'livestock', type, typeLabel: meta.label, count, purpose, nisab: meta.nisab, acquired: isoDate(acquired) };
  const conditions = RULES.LIVESTOCK_CONDITIONS.source;

  if (purpose === 'TRADING') {
    const marketValue = Number(input.marketValue);
    if (!Number.isFinite(marketValue) || marketValue < 0) throw new RangeError('trading livestock needs a market value');
    return { ...base, status: 'TRADE_GOODS', vaultValue: marketValue, inKind: null,
      headline: 'تزكّى زكاة عروض التجارة',
      reason: 'المعدّة للتجارة تُقوّم بسعر السوق يوم الوجوب وتضم إلى نقودك، ولا تجب فيها زكاة الأنعام معها؛ لأن المال الذي اجتمع فيه وصفان يزكّى زكاة واحدة.',
      sources: [conditions, RULES.ONE_ZAKAT.source, RULES.TRADE_GOODS.source] };
  }
  if (purpose === 'WORK') return { ...base, status: 'EXEMPT', vaultValue: 0, inKind: null,
    headline: 'لا زكاة فيها', reason: 'الأنعام المتخذة للعمل كالحرث والحمل لا تجب فيها الزكاة.', sources: [conditions] };
  if (grazing === 'FED') return { ...base, status: 'EXEMPT', vaultValue: 0, inKind: null,
    headline: 'لا زكاة فيها', reason: 'المعلوفة التي تُحبس وتُعلف أغلب السنة لا تجب فيها الزكاة؛ الشرط أن تكون سائمة كل الحول أو أكثره.', sources: [conditions] };
  if (count < meta.nisab) return { ...base, status: 'BELOW_NISAB', vaultValue: 0, inKind: null,
    headline: 'دون النصاب', reason: `نصاب ال${meta.label.split(' ')[0]} ${meta.nisab}، وعددك ${count}.`, sources: [conditions, RULES[meta.rule].source] };

  const alternatives = livestockObligations(type, count);
  const texts = alternatives.map(obligationText);
  const animals = [...new Set(alternatives.flat().map(a => a.animal))].filter(a => AGE_NOTE[a]);
  const due = hawlDueDate(acquired);
  const complete = isHawlComplete(acquired, asOf);
  return { ...base,
    status: complete ? 'DUE' : 'NOT_YET',
    vaultValue: 0,
    inKind: texts.join(' أو '),
    alternatives: texts,
    ageNotes: animals.map(a => `${AR_ANIMAL[a][0]}: ${AGE_NOTE[a]}`),
    dueDate: isoDate(due),
    dueHijri: hijri(due),
    inDays: Math.round((due - asOf) / DAY),
    headline: complete ? `الواجب: ${texts.join(' أو ')}` : `تجب عند تمام الحول: ${texts.join(' أو ')}`,
    reason: `${count} من ال${meta.label.split(' ')[0]} السائمة المعدّة للدر والنسل بلغت النصاب (${meta.nisab})، والواجب فيها ${texts.join(' أو ')}. يُخرج من الوسط، سليمًا من العيوب، ${type === 'cattle' ? '' : 'أنثى، '}وليس هرمًا.`,
    payVia: ZATCA.channels.livestockCrops,
    sources: [conditions, RULES[meta.rule].source, RULES.LIVESTOCK_QUALITY.source],
  };
}

// ---------- الحبوب والثمار ----------

export const CROP_KINDS = Object.freeze({
  WHEAT: { label: 'قمح', group: 'GRAIN' },
  BARLEY: { label: 'شعير', group: 'GRAIN' },
  RICE: { label: 'أرز', group: 'GRAIN' },
  CORN: { label: 'ذرة', group: 'GRAIN' },
  DATES: { label: 'تمر', group: 'FRUIT' },
  RAISINS: { label: 'زبيب', group: 'FRUIT' },
  VEGETABLES: { label: 'خضروات', group: 'NONE' },
  FRESH_FRUIT: { label: 'فواكه طازجة', group: 'NONE' },
});
export const CROP_UNITS = Object.freeze({
  KG: { label: 'كيلوغرام', short: 'كغ', nisab: CROP_NISAB_KG, approximate: true },
  L: { label: 'لتر (بالكيل)', short: 'لتر', nisab: CROP_NISAB_LITERS, approximate: false },
  SAA: { label: 'صاع', short: 'صاع', nisab: CROP_NISAB_SAA, approximate: false },
});
export const IRRIGATION = Object.freeze({
  WITHOUT_COST: { label: 'بلا كلفة (مطر أو عيون أو أنهار)', rateText: 'العشر (10%)' },
  WITH_COST: { label: 'بكلفة (آبار ومكائن ري)', rateText: 'نصف العشر (5%)' },
  HALF_COST: { label: 'نصفها بكلفة ونصفها بلا كلفة', rateText: 'ثلاثة أرباع العشر (7.5%)' },
});

const round = (n, d = 2) => Math.round((n + Number.EPSILON) * 10 ** d) / 10 ** d;

// input: { kind, quantity, unit, irrigation, pricePerUnit?, ownedAtRipening = true }
export function assessCrop(input) {
  if (!input || typeof input !== 'object') throw new TypeError('crop must be an object');
  const { kind, unit = 'KG', irrigation = 'WITH_COST', ownedAtRipening = true } = input;
  const meta = CROP_KINDS[kind];
  if (!meta || !Object.hasOwn(CROP_KINDS, kind)) throw new TypeError('unsupported crop kind');
  if (!Object.hasOwn(CROP_UNITS, unit)) throw new TypeError('unsupported crop unit');
  if (!Object.hasOwn(IRRIGATION, irrigation)) throw new TypeError('unsupported irrigation');
  const quantity = Number(input.quantity);
  if (!Number.isFinite(quantity) || quantity < 0 || quantity > 1e12) throw new RangeError('crop quantity must be a non-negative number');
  const u = CROP_UNITS[unit];
  const base = { kind: 'crop', crop: kind, cropLabel: meta.label, quantity, unit, unitShort: u.short, nisab: u.nisab, vaultValue: 0, requiresHawl: false };
  const cropRule = RULES.CROPS.source;

  if (meta.group === 'NONE') return { ...base, status: 'EXEMPT', inKind: null, headline: 'لا زكاة فيها',
    reason: 'لا تجب الزكاة في الخضروات ولا في الفواكه الطازجة؛ لأنها لا تُكال ولا تُدّخر.', sources: [cropRule] };
  if (ownedAtRipening === false) return { ...base, status: 'EXEMPT', inKind: null, headline: 'الزكاة على من ملكها وقت الوجوب',
    reason: 'وقت الوجوب اشتداد الحب وبدو صلاح الثمر؛ فمن اشتراها بعده لا زكاة عليه فيها.', sources: [cropRule] };
  const nisabSources = unit === 'KG' ? [cropRule, RULES.CROP_NISAB_WEIGHT.source] : [cropRule];
  const measured = meta.group === 'GRAIN' ? 'بعد تصفيته' : 'بعد جفافه';
  if (quantity < u.nisab) return { ...base, status: 'BELOW_NISAB', inKind: null, headline: 'دون النصاب',
    reason: `النصاب خمسة أوسق من المحصول ${measured}: ${u.nisab} ${u.short}${u.approximate ? ' تقريبًا' : ''}، ومحصولك ${quantity} ${u.short}.`, sources: nisabSources };

  const rate = CROP_RATES[irrigation];
  const dueQuantity = round(quantity * rate, 3);
  const price = input.pricePerUnit == null || input.pricePerUnit === '' ? null : Number(input.pricePerUnit);
  if (price != null && (!Number.isFinite(price) || price < 0)) throw new RangeError('crop price must be a non-negative number');
  const value = price == null ? null : round(dueQuantity * price);
  return { ...base, status: 'DUE', rate, rateText: IRRIGATION[irrigation].rateText,
    dueQuantity, inKind: `${round(dueQuantity, 2)} ${u.short} ${meta.label}`, value,
    approximate: u.approximate,
    headline: `الواجب: ${round(dueQuantity, 2)} ${u.short} ${meta.label}`,
    reason: `بلغ المحصول النصاب (${u.nisab} ${u.short}${u.approximate ? ' تقريبًا' : ''}) ${measured}، والسقي ${IRRIGATION[irrigation].label}، فالواجب ${IRRIGATION[irrigation].rateText}. تجب عند الحصاد ولا يشترط لها حول.`,
    note: u.approximate ? 'النصاب بالوزن تقريبي كما في دليل الهيئة؛ الأدق أن يُقاس بالكيل: 900 لتر.' : null,
    payVia: ZATCA.channels.livestockCrops,
    sources: [...nisabSources, RULES.HAWL_LUNAR.source, RULES.CROP_RATE.source],
  };
}
