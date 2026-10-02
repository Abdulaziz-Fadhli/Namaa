import { describe, expect, it } from 'vitest';
import { nextHijriYear, ramadanOnOrAfter, ramadanPlan } from './zakatday.js';
import { hijriParts } from './format.js';

describe('يوم الزكاة في رمضان (دليل الهيئة §4.2 و§5)', () => {
  it('أول رمضان بعد اليوم', () => {
    const r = ramadanOnOrAfter('2026-10-03');
    expect(hijriParts(r)).toMatchObject({ m: 9, d: 1 });
    expect(r > '2026-10-03').toBe(true);
  });

  it('رمضان قبل الموعد: تعجيل لا تأخير', () => {
    const p = ramadanPlan('2026-10-03', '2027-03-11');
    expect(p.kind).toBe('ADVANCE');
    expect(p.ramadan < p.due).toBe(true);
    expect(p.daysEarly).toBeGreaterThan(0);
  });

  it('رمضان بعد الموعد: لا يجوز التأخير إليه، تُخرج في موعدها ثم تُعجّل السنة التالية', () => {
    const p = ramadanPlan('2026-10-03', '2027-01-10');
    expect(p.kind).toBe('PAY_THEN_ADVANCE');
    expect(p.ramadan > p.due).toBe(true);
    expect(p.following).toBe(nextHijriYear('2027-01-10'));
    expect(p.ramadan < p.following).toBe(true);
  });

  it('تجب آخر شعبان: يجوز تأخيرها اليسير إلى أول رمضان', () => {
    const r = ramadanOnOrAfter('2026-10-03');
    const lateShaban = new Date(new Date(`${r}T00:00:00Z`) - 3 * 86400000).toISOString().slice(0, 10);
    expect(ramadanPlan('2026-10-03', lateShaban).kind).toBe('SMALL_DELAY');
  });

  it('التعجيل يشترط ملك النصاب (§5)', () => {
    expect(ramadanPlan('2026-10-03', '2027-03-11', { ownsNisab: false }).kind).toBe('NO_NISAB');
  });
});
