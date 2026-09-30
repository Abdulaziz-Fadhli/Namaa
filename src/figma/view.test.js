// شاشات فيجما تعرض أرقام المحرك: نتأكد أن ahmad-view.json مطابق لمخرجات المحرك الحالية،
// وأن التنسيق والتحويل بين التقويمين والقيم الداخلة للوعاء صحيحة.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildView } from '../../scripts/build-view.js';
import { calculateAssetValue, isHawlComplete } from '../engine/engine.js';
import { assess, toEngineEntry } from '../securities/securities.js';
import { gregText, hijriText, hijriToIso, money } from './format.js';
import { parseNum } from './model.js';
import view from '../data/ahmad-view.json';

const read = n => JSON.parse(readFileSync(new URL(`../data/${n}.json`, import.meta.url), 'utf8'));

describe('ahmad-view.json', () => {
  it('matches a fresh engine run (run `npm run view` after changing the engine or data)', () => {
    expect(buildView(read('ahmad'), read('prices'))).toEqual(view);
  });
  it('carries the numbers the Figma screens show', () => {
    expect(view.total).toBe(66323);
    expect(view.due).toMatchObject({ date: '2026-10-03', base: 6614, zakat: 165.35 });
    expect(view.nextDue).toMatchObject({ date: '2026-10-16', inDays: 13, zakat: 19.4 });
    expect(Math.round(view.nisab)).toBe(4613);
    expect(view.exemptBalance).toBe(20000);
    expect(view.accounts.filter(a => !a.exempt).reduce((s, a) => s + a.balance, 0)).toBe(view.bankTotal);
    expect(view.series.at(-1)).toMatchObject({ date: view.today, total: view.total });
  });
});

describe('format', () => {
  it('formats money like Figma', () => {
    expect(money(165.35)).toBe('165.35 ر.س');
    expect(money(66323)).toBe('66,323 ر.س');
    expect(money(19.4)).toBe('19.40 ر.س');
  });
  it('converts between Hijri and Gregorian with the engine calendar', () => {
    expect(hijriToIso(1447, 9, 1)).toBe('2026-02-18'); // 1 رمضان 1447 = 18 فبراير 2026 (شاشة تاريخ آخر زكاة)
    expect(hijriText('2026-10-03')).toBe('22 ربيع الآخر 1448هـ');
    expect(gregText('2026-10-03')).toBe('3 أكتوبر 2026');
  });
  it('reads Arabic digits and separators', () => {
    expect(parseNum('٢٬٥٠٠')).toBe(2500);
    expect(parseNum('120,000')).toBe(120000);
    expect(Number.isNaN(parseNum('12a'))).toBe(true);
  });
});

describe('assets added in the prototype', () => {
  it('values metals, cash and trading property through the engine', () => {
    expect(calculateAssetValue({ gold: [{ grams: 25, karat: 21, pricePerGram: 400 }] })).toBe(8750);
    expect(calculateAssetValue({ silver: [{ grams: 600, purity: 999, pricePerGram: 4 }] })).toBeCloseTo(2397.6);
    expect(calculateAssetValue({ manualAssets: [{ value: 2500 }] })).toBe(2500);
    expect(calculateAssetValue({ properties: [{ intent: 'TRADING', marketValue: 120000 }] })).toBe(120000);
  });
  it('adds nothing for a Saudi company share held to invest, and the market value for a US share', () => {
    const rajhi = toEngineEntry(assess({ symbol: '1120', units: 12, price: 97.4 }));
    const aapl = toEngineEntry(assess({ symbol: 'AAPL', units: 12, price: 97.4 }));
    expect(calculateAssetValue({ [rajhi.kind]: [rajhi.entry] })).toBe(0);
    expect(calculateAssetValue({ [aapl.kind]: [aapl.entry] })).toBeCloseTo(12 * 97.4 * 3.75);
  });
  it('treats an asset owned for a full Hijri year as due today', () => {
    const today = new Date(`${view.today}T00:00:00Z`);
    expect(isHawlComplete(new Date(`${hijriToIso(1446, 8, 12)}T00:00:00Z`), today)).toBe(true);
    expect(isHawlComplete(new Date('2026-01-10T00:00:00Z'), today)).toBe(false);
  });
});
