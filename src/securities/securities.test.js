// اختبارات «هل هذا السهم يزكي؟» — تشتغل مع npm test (vitest)
import { describe, it, expect } from 'vitest';
import assert from 'node:assert/strict';
import { check, search, assess, securities, toEngineEntry } from './securities.js';
import { calculateAssetValue } from '../engine/engine.js';

const is = (q, symbol, status, opts) => {
  const r = check(q, opts);
  assert.equal(r.found, true, `${q}: not found`);
  if (symbol !== undefined) assert.equal(r.symbol, symbol, q);
  assert.equal(r.status, status, q);
};

describe('هل هذا السهم يزكي؟', () => {
  // 1) الأسهم السعودية: «يزكي» بالاسم أو الرمز أو بدون «ال» أو بالأرقام العربية
  it('saudi company by name', () => is('الراجحي', '1120', 'COMPANY_PAYS'));
  it('saudi company no ال', () => is('راجحي', '1120', 'COMPANY_PAYS'));
  it('saudi company hamza-less', () => is('ارامكو', '2222', 'COMPANY_PAYS'));
  it('saudi company by code', () => is('2222', '2222', 'COMPANY_PAYS'));
  it('arabic digits', () => is('١١٢٠', '1120', 'COMPANY_PAYS'));
  it('english name', () => is('Alinma', '1150', 'COMPANY_PAYS'));
  it('nomu company', () => is('9557', '9557', 'COMPANY_PAYS'));
  it('alias', () => is('الاتصالات السعودية', '7010', 'COMPANY_PAYS'));

  // 2) المضارب: الزكاة عليه حتى في سهم شركة تزكي
  it('trader pays', () => is('الراجحي', '1120', 'INVESTOR_PAYS', { intent: 'TRADE' }));

  // 3) الفخ: ريت وصناديق المؤشرات مدرجة في تداول لكنها صناديق
  it('REIT is not a company', () => is('الراجحي ريت', '4340', 'INVESTOR_PAYS'));
  it('REIT by code', () => is('4333', '4333', 'INVESTOR_PAYS'));
  it('nomu REIT', () => is('9300', '9300', 'INVESTOR_PAYS'));
  it('gold ETF', () => is('البلاد للذهب', '9405', 'INVESTOR_PAYS'));
  it('sukuk ETF', () => is('9404', '9404', 'INVESTOR_PAYS'));
  it('US equity ETF on tadawul', () => is('9406', '9406', 'INVESTOR_PAYS'));
  it('saudi equity ETF covered', () => is('فالكم', '9400', 'COVERED_BY_HOLDINGS'));

  // 4) الأسهم والصناديق الأمريكية
  it('US by ticker', () => is('AAPL', 'AAPL', 'INVESTOR_PAYS'));
  it('US by arabic name', () => is('ابل', 'AAPL', 'INVESTOR_PAYS'));
  it('US by english name', () => is('Tesla', 'TSLA', 'INVESTOR_PAYS'));
  it('US ETF', () => is('SPUS', 'SPUS', 'INVESTOR_PAYS'));
  it('unknown US ticker', () => is('ZZZZ', 'ZZZZ', 'INVESTOR_PAYS'));

  // 5) صناديق غير مدرجة بالاسم
  it('murabaha fund', () => { const r = check('صندوق الإنماء للمرابحة'); assert.equal(r.category, 'MURABAHA'); assert.equal(r.status, 'INVESTOR_PAYS'); });
  it('saudi equity ETF by fund name', () => is('صندوق الراجحي للأسهم السعودية', '9413', 'COVERED_BY_HOLDINGS'));
  it('active saudi equity mutual fund: investor pays', () => { const r = check('صندوق جدوى للأسهم السعودية'); assert.equal(r.category, 'SAUDI_EQUITY'); assert.equal(r.status, 'INVESTOR_PAYS'); });
  it('unknown fund asks for type', () => { const r = check('صندوق النفيعي'); assert.equal(r.needsCategory, true); assert.ok(r.choices.length >= 6); });
  it('fund type chosen by user', () => { const r = check('صندوق النفيعي', { category: 'MURABAHA' }); assert.equal(r.status, 'INVESTOR_PAYS'); assert.equal(r.category, 'MURABAHA'); });
  it('fund word never matches a company', () => { const r = check('صندوق الراجحي'); assert.notEqual(r.symbol, '1120'); assert.ok(!r.found); });
  it('US equity mutual fund', () => { const r = check('صندوق الأهلي للأسهم الأمريكية'); assert.equal(r.status, 'INVESTOR_PAYS'); });

  // 6) الغموض: نعرض خيارات بدل ما نختار عشوائياً
  it('ambiguous shows choices', () => { const r = check('جدوى ريت'); assert.equal(r.found, false); assert.equal(r.ambiguous, true); assert.ok(r.alternatives.length >= 2); });
  it('not found', () => assert.equal(check('كلمة لا توجد ابدا').found, false));
  it('بنك = مصرف', () => is('بنك الراجحي', '1120', 'COMPANY_PAYS'));
  it('ticker vs saudi alias shows both', () => { const r = check('stc'); assert.equal(r.ambiguous, true); assert.deepEqual(r.alternatives.map(a => a.symbol), ['7010', 'STC']); });
  it('Netflix is not a fund', () => is('Netflix', 'NFLX', 'INVESTOR_PAYS'));
  it('exact ticker beats similar name', () => is('NOW', 'NOW', 'INVESTOR_PAYS'));
  it('old ticker still works', () => is('MMC', 'MRSH', 'INVESTOR_PAYS'));
  it('S&P 600 member', () => is('Under Armour, Inc. Class A', 'UAA', 'INVESTOR_PAYS'));
  it('foreign company on tadawul', () => is('أمريكانا', '6015', 'INVESTOR_PAYS'));
  it('aramco royal order note', () => assert.match(check('ارامكو').note, /16712/));
  it('unknown saudi code', () => { const r = check('1234'); assert.equal(r.found, false); assert.match(r.message, /1234/); });
  it('weak match is suggested, not ruled', () => { const r = check('مراعيي'); assert.equal(r.found, false); });
  it('empty input', () => assert.equal(check('').found, false));
  it('search ranks exact first', () => assert.equal(search('البلاد')[0].symbol, '1140'));

  // 7) الحساب
  it('saudi invest: no zakat', () => assert.equal(assess({ symbol: '1120', units: 100, price: 100 }).zakat, 0));
  it('US: 2.5% of market value in SAR', () => assert.equal(assess({ symbol: 'AAPL', units: 10, price: 200 }).zakat, 10 * 200 * 3.75 / 40));
  it('REIT with published zakat per unit', () => assert.equal(assess({ symbol: '4340', units: 1000, price: 8, zakatPerUnit: 0.05 }).zakat, 50));
  it('REIT without it: upper bound on market value', () => { const a = assess({ symbol: '4340', units: 1000, price: 8 }); assert.equal(a.zakat, 200); assert.equal(a.needsZakatPerUnit, true); });
  it('saudi equity ETF: covered', () => assert.equal(assess({ symbol: '9400', units: 100, price: 50 }).zakat, 0));
  it('board setting overrides company pays', () => assert.equal(assess({ symbol: '1120', units: 100, price: 100 }, {}, { companyPaysForInvestShares: false }).zakat, 250));

  // الربط مع محرك نماء
  it('engine: saudi long-term share adds nothing', () => {
    const e = toEngineEntry(assess({ symbol: '1120', units: 100, price: 100 }));
    expect(calculateAssetValue({ [e.kind]: [e.entry] })).toBe(0);
  });
  it('engine: US share adds its market value in SAR', () => {
    const e = toEngineEntry(assess({ symbol: 'AAPL', units: 10, price: 200 }));
    expect(calculateAssetValue({ [e.kind]: [e.entry] })).toBe(7500);
  });
  it('engine: trader adds market value', () => {
    const e = toEngineEntry(assess({ symbol: '1120', units: 100, price: 100, intent: 'TRADE' }));
    expect(e.entry.type).toBe('TRADING');
    expect(calculateAssetValue({ [e.kind]: [e.entry] })).toBe(10000);
  });
  it('engine: saudi equity ETF adds nothing', () => {
    const e = toEngineEntry(assess({ symbol: '9400', units: 100, price: 50 }));
    expect(e.kind).toBe('investmentProducts');
    expect(calculateAssetValue({ [e.kind]: [e.entry] })).toBe(0);
  });
  it('engine: fund held for trading adds market value', () => {
    const e = toEngineEntry(assess({ symbol: '4340', units: 1000, price: 8, intent: 'TRADE' }), 'reit-1');
    expect(e.entry).toEqual({ type: 'TRADING', marketValue: 8000, id: 'reit-1' });
    expect(calculateAssetValue({ [e.kind]: [e.entry] })).toBe(8000);
  });
  it('engine: murabaha fund goes to investmentProducts', () => {
    const e = toEngineEntry(assess({ fundName: 'صندوق الإنماء للمرابحة', units: 1000, price: 12 }));
    expect(e.kind).toBe('investmentProducts');
    expect(calculateAssetValue({ [e.kind]: [e.entry] })).toBe(12000);
  });
});

// فحص شامل: كل ورقة تنوجد برمزها واسمها العربي والإنجليزي وأسمائها البديلة، وما في اسم يودّي لورقة ثانية
describe('دليل الأوراق المالية', () => {
  it('كل ورقة تنوجد، ولا اسم يودّي لورقة ثانية', () => {
    const wrong = [];
    for (const s of securities) {
      for (const q of [s.symbol, s.nameAr, s.nameEn, ...s.aliases].filter(Boolean)) {
        const r = check(q);
        if (r.found && r.symbol === s.symbol) continue;
        if (r.ambiguous && r.alternatives.some(a => a.symbol === s.symbol)) continue;
        wrong.push(`${s.symbol} ← «${q}» ⟶ ${r.found ? r.symbol : r.message}`);
      }
    }
    expect(wrong).toEqual([]);
  }, 30000);
});
