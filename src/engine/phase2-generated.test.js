import { describe, expect, test } from 'vitest';
import { calculateAssetValue, calculateZakatableSnapshot, evaluateLivestockZakat, runEngineDetailed, evaluateCropZakat } from './engine.js';
const STRICT = { validationMode: 'strict' };
const DATE = new Date('2025-04-01T00:00:00Z');
const END = new Date('2026-03-22T00:00:00Z');
const SEED = 0x4e414d41;
function rng() {
  let state = SEED;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}
function finiteTree(value) {
  if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
  else if (Array.isArray(value)) value.forEach(finiteTree);
  else if (value && typeof value === 'object' && !(value instanceof Date)) Object.values(value).forEach(finiteTree);
}
function scenario(index, work) {
  try { work(); } catch (error) { throw new Error(`seed=${SEED} scenario=${index}: ${error.message}`, { cause: error }); }
}
const canonical = alternatives => alternatives.map(items => items.map(a => `${a.animal}:${a.count}`).sort().join(',')).sort();

// Independent table oracle. The first ranges are literal source rows. Larger
// counts enumerate every pair, checking the covered heads rather than using
// production division helpers. No engine function constructs an expectation.
function herdOracle(type, n) {
  if (type === 'sheep' || type === 'goats') {
    const count = n < 40 ? 0 : n < 121 ? 1 : n < 201 ? 2 : n < 400 ? 3 : Math.trunc(n / 100);
    return count ? [`${type === 'goats' ? 'GOAT' : 'SHEEP'}:${count}`] : [];
  }
  if (type === 'camels' && n <= 120) {
    const rows = [[0,4,null,0],[5,9,'SHEEP_OR_GOAT',1],[10,14,'SHEEP_OR_GOAT',2],[15,19,'SHEEP_OR_GOAT',3],[20,24,'SHEEP_OR_GOAT',4],[25,35,'BINT_MAKHAD',1],[36,45,'BINT_LABUN',1],[46,60,'HIQQA',1],[61,75,'JADHAA',1],[76,90,'BINT_LABUN',2],[91,120,'HIQQA',2]];
    const row = rows.find(([lo,hi]) => n >= lo && n <= hi);
    return row[2] ? [`${row[2]}:${row[3]}`] : [];
  }
  if (type === 'cattle' && n < 60) return n < 30 ? [] : [n < 40 ? 'TABI:1' : 'MUSINNA:1'];
  const sizeA = type === 'camels' ? 40 : 30, sizeB = type === 'camels' ? 50 : 40;
  const animalA = type === 'camels' ? 'BINT_LABUN' : 'TABI', animalB = type === 'camels' ? 'HIQQA' : 'MUSINNA';
  const expected = [];
  for (let a = 0; a <= n / sizeA; a++) for (let b = 0; b <= n / sizeB; b++) {
    const covered = a * sizeA + b * sizeB;
    if (covered <= n && n - covered < 10) expected.push([...(a ? [`${animalA}:${a}`] : []), ...(b ? [`${animalB}:${b}`] : [])].sort().join(','));
  }
  return expected.sort();
}

describe('L05/L17 independent oracle: 8,004 herd cases', () => {
  test.each(['camels', 'cattle', 'sheep', 'goats'])('%s: every count 0–2000', type => {
    for (let count = 0; count <= 2000; count++) scenario(`${type}/${count}`, () => {
      const r = evaluateLivestockZakat({ type, count, purpose: 'PRODUCTION', grazing: 'ALL_YEAR', acquired: DATE, asOf: END, countChange: 'STABLE' }, STRICT);
      expect(canonical(r.alternatives)).toEqual(herdOracle(type, count));
      expect(r.selectedAlternative).toBeNull();
      finiteTree(r);
    });
  });
});

describe('G financial/property invariants: seed printed on any failure', () => {
  test('10,000 valid financial valuations against arithmetic oracle', () => {
    const random = rng();
    for (let i = 0; i < 10000; i++) scenario(i, () => {
      const amount = Math.floor(random() * 10000000) / 100;
      const kind = i % 4;
      const price = 1 + Math.floor(random() * 400);
      const quantity = 1 + Math.floor(random() * 10000);
      const fine = kind === 0 ? [12,18,21,22,24][i % 5] : [800,925,999,1000][i % 4];
      const data = kind === 0 ? { gold: [{ acquired: DATE, grams: quantity, karat: fine, purpose: 'INVESTMENT', pricePerGram: price }] }
        : kind === 1 ? { silver: [{ acquired: DATE, grams: quantity, purity: fine, purpose: 'INVESTMENT', pricePerGram: price }] }
        : kind === 2 ? { stocks: [{ acquired: DATE, type: 'TRADING', marketValue: amount }] }
        : { investmentProducts: [{ acquired: DATE, type: 'LONG_TERM', zakatableValue: amount }] };
      const before = JSON.stringify(data);
      const r = calculateAssetValue(data, STRICT);
      const expected = kind < 2 ? quantity * (fine / (kind === 0 ? 24 : 1000)) * price : amount;
      expect(r.value).toBeCloseTo(expected, 7);
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(calculateAssetValue(data, STRICT)).toEqual(r);
      const withMetadata = structuredClone(data);
      Object.values(withMetadata)[0][0].displayLabel = 'irrelevant';
      expect(calculateAssetValue(withMetadata, STRICT)).toEqual(r);
      expect(JSON.stringify(data)).toBe(before);
      finiteTree(r);
    });
  });
  test('2,000 multi-asset valuations do not double count or mutate inputs', () => {
    const random = rng();
    for (let i = 0; i < 2000; i++) scenario(i, () => {
      const cash = Math.floor(random() * 10000000) / 100;
      const shares = Math.floor(random() * 1000000) / 100;
      const grams = Math.floor(random() * 1000);
      const data = { cashBalance: cash, gold: [{ id: 'gold', acquired: DATE, grams, karat: 18, purpose: 'INVESTMENT', pricePerGram: 300 }], stocks: [{ id: 'stock', acquired: DATE, type: 'TRADING', marketValue: shares }] };
      const before = JSON.stringify(data);
      const result = calculateZakatableSnapshot(data, STRICT);
      expect(result.total).toBeCloseTo(cash + grams * 0.75 * 300 + shares, 7);
      expect(calculateZakatableSnapshot(data, STRICT)).toEqual(result);
      expect(JSON.stringify(data)).toBe(before);
      finiteTree(result);
    });
  });
  test('2,000 invalid/missing cases cannot become exempt or a financial zero', () => {
    const random = rng();
    for (let i = 0; i < 2000; i++) scenario(i, () => {
      const asset = { acquired: DATE, grams: 1 + Math.floor(random() * 200), karat: 24, purpose: 'INVESTMENT', pricePerGram: 300 };
      if (i % 5 === 0) {
        delete asset[['acquired', 'grams', 'karat', 'purpose', 'pricePerGram'][Math.floor(random() * 5)]];
        expect(calculateAssetValue({ gold: [asset] }, STRICT)).toMatchObject({ status: 'UNKNOWN', value: null });
      } else if (i % 5 === 1) {
        asset.grams = [-1, NaN, Infinity, -Infinity][i % 4];
        expect(() => calculateAssetValue({ gold: [asset] }, STRICT)).toThrow();
      } else if (i % 5 === 2) {
        expect(() => calculateAssetValue({ gold: [{ ...asset, id: 'duplicate' }, { ...asset, id: 'duplicate' }] }, STRICT)).toThrow(/duplicate/);
      } else if (i % 5 === 3) {
        expect(() => calculateAssetValue({ investmentProducts: [{ acquired: DATE, type: 'LONG_TERM', fundZakatableBase: 20000, ownershipShare: 0.1, zakatableValue: 1000 }] }, STRICT)).toThrow(/reconcile/);
      } else {
        expect(() => calculateAssetValue({ gold: [{ ...asset, acquired: new Date(NaN) }] }, STRICT)).toThrow(/date/);
      }
    });
  });
  test('100 complete-year multi-asset histories agree with independent due arithmetic', () => {
    const random = rng();
    for (let i = 0; i < 100; i++) scenario(i, () => {
      const initial = 10000 + Math.floor(random() * 10000), newer = 1000 + Math.floor(random() * 3000);
      const days = [];
      const later = new Date('2025-10-01T00:00:00Z');
      for (let t = +DATE; t <= +END; t += 86400000) {
        const date = new Date(t);
        days.push({ date, prices: { gold: 300, silver: 4 }, assets: [{ id: 'capital', kind: 'cash', acquired: DATE, value: initial }, ...(date >= later ? [{ id: 'new', kind: 'stocks', type: 'TRADING', acquired: later, marketValue: newer }] : [])] });
      }
      const before = JSON.stringify(days);
      const result = runEngineDetailed(days, { ...STRICT, acquiredMoneyMode: 'ANNUAL_ADVANCE' });
      expect(result.actualDue).toBe(initial / 40);
      expect(result.suggestedAdvance).toBe(newer / 40);
      expect(result.paymentRecorded).toBe(false);
      expect(result.policyApplied.acquiredMoneyMode).toBe('ANNUAL_ADVANCE');
      expect(JSON.stringify(days)).toBe(before);
      finiteTree(result);
    });
  }, 20000);
  test('C03–C10 volume boundaries and unsupported rates', () => {
    for (const q of [899.999, 900, 900.001]) {
      const input = { classification: 'GRAIN', quantity: q, unit: 'L', measurementState: 'CLEANED_GRAIN', ownedAtObligation: true, obligationReached: true, irrigation: 'WITHOUT_COST' };
      expect(evaluateCropZakat(input, STRICT).dueQuantity).toBe(q < 900 ? 0 : q * 0.1);
      expect(evaluateCropZakat({ ...input, irrigation: 'MIXED' }, STRICT)).toMatchObject({ status: 'UNRESOLVED', dueQuantity: null });
    }
  });
});
