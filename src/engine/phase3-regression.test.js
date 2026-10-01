import { describe, expect, test } from 'vitest';
import { calculateAssetValue, runEngineDetailed } from './engine.js';

const strict = { validationMode: 'strict' };
const date = new Date('2025-04-01T00:00:00Z');
const prices = { gold: 300, silver: 4 };
const fund = () => ({ acquired: date, type: 'LONG_TERM', zakatableValue: 10000 });
const stock = type => ({ acquired: date, type, zakatExempt: true, companyZakatPaid: true,
  companyEvidence: { jurisdiction: 'SA', source: 'declared payment document', coversHolding: true } });
const row = patch => ({ date, prices, assets: [], ...patch });

describe('P3-01: normalization must preserve duplicate detection', () => {
  test('the same fund object cannot contribute twice in either mode', () => {
    const asset = fund();
    const data = { investmentProducts: [asset, asset] };
    expect(() => calculateAssetValue(data)).toThrow(/duplicate/);
    expect(() => calculateAssetValue(data, strict)).toThrow(/duplicate/);
  });
  test('normalization cannot hide a repeated object across categories', () => {
    const asset = fund();
    expect(() => calculateAssetValue({ stocks: [asset], investmentProducts: [asset] }, strict)).toThrow(/duplicate/);
  });
  test('distinct valid holdings remain additive without mutating their facts', () => {
    const data = { investmentProducts: [fund(), { acquired: date, type: 'LONG_TERM', fundZakatableBase: 20000, ownershipShare: 0.1 }] };
    const before = structuredClone(data);
    expect(calculateAssetValue(data, strict)).toMatchObject({ status: 'CALCULATED', value: 12000 });
    expect(data).toEqual(before);
  });
});

describe('P3-02: company evidence cannot bypass stock intent validation', () => {
  test.each(['BOGUS', '', false, 0, {}])('invalid intent %j is rejected', type => {
    expect(() => calculateAssetValue({ stocks: [stock(type)] }, strict)).toThrow(/type/);
  });
  test('missing, trading and long-term intent retain their distinct outcomes', () => {
    expect(calculateAssetValue({ stocks: [stock(undefined)] }, strict)).toMatchObject({ status: 'UNKNOWN', value: null });
    expect(calculateAssetValue({ stocks: [stock('TRADING')] }, strict)).toMatchObject({ status: 'UNRESOLVED', value: null });
    expect(calculateAssetValue({ stocks: [stock('LONG_TERM')] }, strict)).toMatchObject({ status: 'EXEMPT', value: 0 });
    expect(calculateAssetValue({ stocks: [stock('BOGUS')] })).toBe(0);
  });
});

describe('P3-03: inventory must not bypass cash history requirements', () => {
  test.each([undefined, false])('cash opening %s is incomplete even with inventory', openingBalanceKnown => {
    const input = row({ openingBalanceKnown, deposits: [10000], withdrawals: [] });
    expect(runEngineDetailed([input], strict)).toMatchObject({ status: 'UNKNOWN', reasonCode: 'NEEDS_HISTORY_REVIEW', actualDue: null, nextDue: null });
    expect(runEngineDetailed([{ ...input, nisab: 2380 }]).nextDue.zakat).toBe(250);
  });
  test.each(['deposits', 'withdrawals'])('omitted %s cannot mean zero flows', field => {
    const input = row({ openingBalanceKnown: true, deposits: [10000], withdrawals: [] });
    delete input[field];
    expect(runEngineDetailed([input], strict)).toMatchObject({ status: 'UNKNOWN', actualDue: null });
  });
  test('later cash flows require an established opening from the start', () => {
    const later = new Date('2025-04-02T00:00:00Z');
    expect(runEngineDetailed([row(), row({ date: later, deposits: [10000], withdrawals: [] })], strict))
      .toMatchObject({ status: 'UNKNOWN', reasonCode: 'NEEDS_HISTORY_REVIEW' });
  });
  test('an omitted later cash-flow day cannot silently become empty', () => {
    expect(runEngineDetailed([
      row({ openingBalanceKnown: true, deposits: [10000], withdrawals: [] }),
      row({ date: new Date('2025-04-02T00:00:00Z') }),
    ], strict)).toMatchObject({ status: 'UNKNOWN', actualDue: null });
  });
  test('complete cash history can coexist with an inventory', () => {
    const result = runEngineDetailed([row({ openingBalanceKnown: true, deposits: [10000], withdrawals: [] })], strict);
    expect(result).toMatchObject({ status: 'ZERO', actualDue: 0, nextDue: { zakat: 250 } });
    expect(result.series[0].total).toBe(10000);
  });
  test('pure dated inventory does not require a separate cash ledger', () => {
    const result = runEngineDetailed([row({ assets: [{ id: 'cash', kind: 'cash', acquired: date, value: 10000 }] })], strict);
    expect(result.series[0].total).toBe(10000);
    expect(result.nextDue.zakat).toBe(250);
  });
});
