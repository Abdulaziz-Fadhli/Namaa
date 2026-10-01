import { describe, test, expect } from 'vitest';
import ahmad from '../data/ahmad.json';
import prices from '../data/prices.json';
import { prepareStrictAccountDays } from './strict-data-adapter.js';
import { runEngineDetailed } from './engine.js';

const real = () => prepareStrictAccountDays(ahmad, prices);
function freeze(value) {
  if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); }
  return value;
}
describe('Strict account adapter: current Ahmad data without invented facts', () => {
  test('551 consecutive UTC days and every saved daily price', () => {
    const { days } = real();
    expect(days).toHaveLength(551);
    expect(days[0].date.toISOString()).toBe('2025-04-01T00:00:00.000Z');
    expect(days.at(-1).date.toISOString()).toBe('2026-10-03T00:00:00.000Z');
    days.forEach((d, i) => {
      expect(d.prices).toEqual(prices[d.date.toISOString().slice(0, 10)]);
      if (i) expect(+d.date - +days[i - 1].date).toBe(86400000);
    });
  });
  test('all 537 records preserved exactly once, including pending A3', () => {
    const result = real();
    expect(result.records).toHaveLength(537);
    expect(new Set(result.records.map(r => r.sourceIndex)).size).toBe(537);
    expect(result.records.map(r => r.source)).toEqual(ahmad.transactions);
    expect(result.records.every(r => r.disposition)).toBe(true);
    expect(result.summary.observedExternal + result.summary.internalRecords + result.summary.pendingRecords).toBe(537);
  });
  test('external deposits and withdrawals match source per date and direction', () => {
    const result = real();
    for (const day of result.days) for (const [field, direction] of [['deposits', 'credit'], ['withdrawals', 'debit']]) {
      const expected = ahmad.transactions.filter(t => t.date === day.date.toISOString().slice(0, 10) && !t.internal && t.accountId !== 'A3' && t.direction === direction).map(t => t.amount);
      if (expected.length) expect(day[field]).toEqual(expected);
      else expect(Object.hasOwn(day, field)).toBe(false);
    }
  });
  test('36 internal records become 18 linked neutral transfers, no double count', () => {
    const result = real();
    expect(result.transfers).toHaveLength(18);
    expect(result.summary.internalRecords).toBe(36);
    for (const transfer of result.transfers) {
      expect(transfer.from).toBe('A1'); expect(transfer.to).toBe('A2');
      const [debit, credit] = transfer.sourceIndices.map(i => result.records[i].source);
      expect(debit.direction).toBe('debit'); expect(credit.direction).toBe('credit');
      expect(debit.amount).toBe(credit.amount); expect(debit.counterparty).toBe(credit.accountId);
    }
  });
  test('no absent day or direction is fabricated as a known empty array', () => {
    const { days } = real();
    expect(days.at(-1).deposits).toBeUndefined(); expect(days.at(-1).withdrawals).toBeUndefined();
    expect(days.every(d => !Object.hasOwn(d, 'openingBalanceKnown') && !Object.hasOwn(d, 'cashBalance'))).toBe(true);
  });
  test('opening amounts are only observations; A3 exemption is never accepted', () => {
    const result = real();
    expect(result.days[0].deposits).toEqual([2000]);
    const a3 = result.records.filter(r => r.source.accountId === 'A3');
    expect(a3.length).toBeGreaterThan(0);
    expect(a3.every(r => r.disposition === 'PENDING_ACCOUNT_TREATMENT')).toBe(true);
    expect(result.issues).toContainEqual(expect.objectContaining({ reasonCode: 'ACCOUNT_TREATMENT_NOT_ESTABLISHED', facts: expect.arrayContaining(['A3']) }));
    expect(result.readyForCalculation).toBe(false);
  });
  test('real Strict execution is UNKNOWN, not a calculated partial zero', () => {
    const prepared = real();
    const result = runEngineDetailed(prepared.days, { validationMode: 'strict' });
    expect(result.status).toBe('UNKNOWN'); expect(result.reasonCode).toBe('NEEDS_HISTORY_REVIEW');
    expect(result.actualDue).toBeNull(); expect(result.series).toEqual([]);
    expect(result.facts).toEqual(['openingBalanceKnown', 'deposits', 'withdrawals']);
  });
  test('frozen inputs work and returned values have no mutable source aliases', () => {
    const a = freeze(structuredClone(ahmad)), p = freeze(structuredClone(prices));
    const result = prepareStrictAccountDays(a, p);
    result.days[0].prices.gold = 1; result.records[0].source.amount = 1;
    expect(a).toEqual(ahmad); expect(p).toEqual(prices);
  });
  test('missing price is retained as missing, never carried forward', () => {
    const p = structuredClone(prices); delete p['2025-04-02'];
    const result = prepareStrictAccountDays(ahmad, p);
    expect(result.days[1].prices).toBeUndefined();
    expect(result.issues.some(i => i.reasonCode === 'MISSING_PRICE')).toBe(true);
  });
  test('exemption evidence removal cannot turn A3 into ordinary cash', () => {
    const a = structuredClone(ahmad); delete a.accounts[2].zakatExempt;
    expect(prepareStrictAccountDays(a, prices).records.filter(r => r.source.accountId === 'A3').every(r => r.disposition === 'PENDING_ACCOUNT_TREATMENT')).toBe(true);
  });
  test('unpaired transfer is rejected rather than silently dropped', () => {
    const a = structuredClone(ahmad); a.transactions.splice(a.transactions.findIndex(t => t.internal), 1);
    expect(() => prepareStrictAccountDays(a, prices)).toThrow(/Unpaired/);
  });
  test('transfer into unresolved account remains pending and outside flows', () => {
    const a = structuredClone(ahmad); a.accounts[1].zakatExempt = true;
    const result = prepareStrictAccountDays(a, prices);
    expect(result.transfers.every(t => t.disposition === 'PENDING_TRANSFER_TREATMENT')).toBe(true);
    expect(result.issues.some(i => i.reasonCode === 'TRANSFER_ACROSS_UNRESOLVED_ACCOUNT')).toBe(true);
  });
  test.each(['date', 'amount', 'accountId', 'direction'])('rejects malformed transaction %s', field => {
    const a = structuredClone(ahmad);
    a.transactions[0][field] = { date: '2025-02-30', amount: NaN, accountId: 'missing', direction: 'other' }[field];
    expect(() => prepareStrictAccountDays(a, prices)).toThrow();
  });
  test('unsupported holdings are not silently lost', () => {
    const a = structuredClone(ahmad); a.holdings.push({ id: 'gold' });
    expect(() => prepareStrictAccountDays(a, prices)).toThrow(/outside/);
  });
});
