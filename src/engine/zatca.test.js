// اختبارات المنهجية على جداول أدلة هيئة الزكاة والضريبة والجمارك نفسها:
// كل صف في جدول الإبل والبقر والغنم (دليل بهيمة الأنعام والحبوب والثمار ص6–8) وأمثلة الدليل.
import { describe, expect, test } from 'vitest';
import { RULES, ZATCA, assessCrop, assessLivestock, cite, methodologySummary } from './zatca.js';
import { defaultSettings, livestockObligations, validateShariaSettings } from './engine.js';

const herd = (type, count, patch = {}) =>
  assessLivestock({ type, count, acquired: '2025-01-01', asOf: '2026-10-03', ...patch });

describe('مصدر المنهجية', () => {
  test('كل قاعدة منسوبة لدليل من أدلة الهيئة مع الصفحة', () => {
    expect(ZATCA.authority).toBe('هيئة الزكاة والضريبة والجمارك');
    for (const rule of Object.values(RULES)) {
      if (rule.id === 'CROP_RATE') continue;
      expect(Object.keys(ZATCA.guides)).toContain(rule.guide);
      expect(rule.page).toBeGreaterThan(0);
      expect(cite(rule.id)).toContain(ZATCA.authority);
    }
    expect(() => cite('UNKNOWN')).toThrow();
    expect(() => cite('toString')).toThrow();
  });

  test('ملخص الشاشات يتبع خيار حول المال المستفاد', () => {
    const independent = methodologySummary(defaultSettings);
    expect(independent.statement).toContain('هيئة الزكاة والضريبة والجمارك');
    expect(independent.applied.map(r => r.rule)).toContain('NEW_MONEY');
    const annual = methodologySummary({ ...defaultSettings, acquiredMoneyMode: 'ANNUAL_ADVANCE' });
    expect(annual.applied.map(r => r.rule)).toContain('SALARY');
  });

  test('إعدادات المحرك هي ما في الدليل: أدنى النصابين و85غ/595غ ولا خصم للديون', () => {
    expect(defaultSettings).toMatchObject({ nisabBasis: 'MIN', goldGrams: 85, silverGrams: 595, deductDebts: false });
    expect(() => validateShariaSettings({ ...defaultSettings, nisabBasis: 'GOLD' })).toThrow();
    expect(() => validateShariaSettings({ ...defaultSettings, deductDebts: true })).toThrow();
  });
});

describe('الإبل (ص6–7)', () => {
  test.each([
    [5, 9, 'شاة واحدة'], [10, 14, 'شاتان'], [15, 19, '3 شياه'], [20, 24, '4 شياه'],
    [25, 35, 'بنت مخاض'], [36, 45, 'بنت لبون'], [46, 60, 'حقة'], [61, 75, 'جذعة'],
    [76, 90, 'بنتا لبون'], [91, 120, 'حقتان'],
    [121, 129, '3 بنات لبون'], [130, 139, 'حقة وبنتا لبون'], [140, 149, 'حقتان وبنت لبون'],
    [150, 159, '3 حقاق'], [160, 169, '4 بنات لبون'], [170, 179, 'حقة و3 بنات لبون'],
    [180, 189, 'حقتان وبنتا لبون'], [190, 199, '3 حقاق وبنت لبون'],
  ])('%i–%i: %s', (from, to, due) => {
    for (const n of [from, to]) expect(herd('camels', n).inKind).toBe(due);
  });
  test('200–209: 4 حقاق أو 5 بنات لبون', () => {
    expect(herd('camels', 200).alternatives.sort()).toEqual(['4 حقاق', '5 بنات لبون'].sort());
    expect(herd('camels', 209).alternatives).toHaveLength(2);
  });
  test('أقل من خمس لا زكاة فيها', () => {
    expect(herd('camels', 4).status).toBe('BELOW_NISAB');
  });
});

describe('البقر (ص8)', () => {
  test.each([
    [30, 39, 'تبيع أو تبيعة'], [40, 59, 'مسنة'], [60, 69, 'تبيعان'], [70, 79, 'مسنة وتبيع'],
    [80, 89, 'مسنتان'], [90, 99, '3 أتبعة'], [100, 109, 'مسنة وتبيعان'], [110, 119, 'مسنتان وتبيع'],
  ])('%i–%i: %s', (from, to, due) => {
    for (const n of [from, to]) expect(herd('cattle', n).inKind).toBe(due);
  });
  test('ثم في كل 30 تبيع وفي كل 40 مسنة', () => {
    expect(livestockObligations('cattle', 120)).toHaveLength(2);
    expect(herd('cattle', 29).status).toBe('BELOW_NISAB');
  });
});

describe('الغنم (ص8–9)', () => {
  test.each([[40, 1], [120, 1], [121, 2], [200, 2], [201, 3], [399, 3],
    [450, 4], [560, 5], [999, 9], [1150, 11], [1900, 19], [3000, 30]])('%i رأس: %i', (count, due) => {
    expect(livestockObligations('sheep', count)[0][0].count).toBe(due);
  });
  test('الضأن والماعز نصاب واحد، وأقل من 40 لا زكاة فيها', () => {
    expect(herd('sheep', 39).status).toBe('BELOW_NISAB');
    expect(herd('sheep', 40).inKind).toBe('شاة واحدة');
  });
});

describe('شروط زكاة الأنعام (ص5)', () => {
  test('المعلوفة والعاملة لا زكاة فيها', () => {
    expect(herd('sheep', 300, { grazing: 'FED' }).status).toBe('EXEMPT');
    expect(herd('camels', 30, { purpose: 'WORK' }).status).toBe('EXEMPT');
  });
  test('المعدّة للتجارة زكاة عروض تجارة فقط وتدخل وعاء النقود بقيمتها', () => {
    const r = herd('sheep', 300, { purpose: 'TRADING', marketValue: 360000 });
    expect(r).toMatchObject({ status: 'TRADE_GOODS', vaultValue: 360000, inKind: null });
    expect(() => herd('sheep', 300, { purpose: 'TRADING' })).toThrow();
  });
  test('قبل تمام الحول: تظهر الفريضة وموعدها ولا تجب الآن', () => {
    const r = herd('sheep', 80, { acquired: '2026-06-01' });
    expect(r.status).toBe('NOT_YET');
    expect(r.dueHijri).toEqual([1448, 12, 15]);
    expect(r.inDays).toBeGreaterThan(0);
    expect(herd('sheep', 80).status).toBe('DUE');
  });
  test('المدخلات غير الصحيحة ترفض', () => {
    expect(() => herd('horses', 40)).toThrow();
    expect(() => herd('toString', 40)).toThrow();
    expect(() => herd('sheep', 40.5)).toThrow();
    expect(() => herd('sheep', -1)).toThrow();
    expect(() => herd('sheep', 40, { acquired: '2027-01-01' })).toThrow();
  });
});

describe('الحبوب والثمار (ص10)', () => {
  test('النصاب 612 كغ تقريبًا، و900 لتر، و300 صاع', () => {
    expect(assessCrop({ kind: 'WHEAT', quantity: 611 }).status).toBe('BELOW_NISAB');
    expect(assessCrop({ kind: 'WHEAT', quantity: 612 }).status).toBe('DUE');
    expect(assessCrop({ kind: 'DATES', quantity: 899, unit: 'L' }).status).toBe('BELOW_NISAB');
    expect(assessCrop({ kind: 'DATES', quantity: 900, unit: 'L' }).status).toBe('DUE');
    expect(assessCrop({ kind: 'BARLEY', quantity: 300, unit: 'SAA' }).status).toBe('DUE');
  });
  test.each([['WITHOUT_COST', 100], ['WITH_COST', 50], ['HALF_COST', 75]])('السقي %s من 1000 كغ: %i كغ', (irrigation, due) => {
    expect(assessCrop({ kind: 'WHEAT', quantity: 1000, irrigation })).toMatchObject({ dueQuantity: due, requiresHawl: false });
  });
  test('القيمة اختيارية بسعر الوحدة', () => {
    expect(assessCrop({ kind: 'WHEAT', quantity: 1000, pricePerUnit: 11 }).value).toBe(550);
    expect(assessCrop({ kind: 'WHEAT', quantity: 1000 }).value).toBeNull();
  });
  test('الخضروات والفواكه الطازجة لا زكاة فيها، ولا على من ملكها بعد وقت الوجوب', () => {
    expect(assessCrop({ kind: 'VEGETABLES', quantity: 50000 }).status).toBe('EXEMPT');
    expect(assessCrop({ kind: 'FRESH_FRUIT', quantity: 50000 }).status).toBe('EXEMPT');
    expect(assessCrop({ kind: 'DATES', quantity: 5000, ownedAtRipening: false }).status).toBe('EXEMPT');
  });
  test('لا تدخل وعاء النقود، والنصاب بالوزن تقريبي', () => {
    const r = assessCrop({ kind: 'DATES', quantity: 2000 });
    expect(r.vaultValue).toBe(0);
    expect(r.approximate).toBe(true);
    expect(r.sources.join(' ')).toContain('دليل بهيمة الأنعام والحبوب والثمار');
  });
  test('المدخلات غير الصحيحة ترفض', () => {
    expect(() => assessCrop({ kind: 'COTTON', quantity: 1000 })).toThrow();
    expect(() => assessCrop({ kind: 'WHEAT', quantity: -1 })).toThrow();
    expect(() => assessCrop({ kind: 'WHEAT', quantity: 1000, unit: 'TON' })).toThrow();
    expect(() => assessCrop({ kind: 'WHEAT', quantity: 1000, irrigation: 'MIXED' })).toThrow();
  });
});
