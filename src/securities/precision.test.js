import { describe, expect, it } from 'vitest';
import { assess } from './securities.js';

describe('دقة أكثر للمستثمر (دليل الهيئة §3.6 و§3.9)', () => {
  it('سهم أمريكي للاستثمار: بنسبة الموجودات الزكوية إن أُدخلت', () => {
    const a = assess({ symbol: 'AAPL', units: 10, price: 200, intent: 'INVEST', zakatableRatio: 0.3 });
    expect(a.calcMethod).toBe('ZAKATABLE_ASSETS');
    expect(a.base).toBeCloseTo(a.value * 0.3, 6);
  });

  it('المضارب يزكي القيمة السوقية ولو أدخل نسبة', () => {
    const a = assess({ symbol: 'AAPL', units: 10, price: 200, intent: 'TRADE', zakatableRatio: 0.3 });
    expect(a.base).toBeCloseTo(a.value, 6);
  });

  it('صندوق مرابحة للاستثمار: زكاة الوحدة المعلنة × الوحدات', () => {
    const a = assess({ fundName: 'صندوق مرابحة', units: 1000, price: 10, intent: 'INVEST', zakatPerUnit: 0.2 });
    expect(a.calcMethod).toBe('FUND_BASE');
    expect(a.zakat).toBeCloseTo(200, 6);
  });
});
