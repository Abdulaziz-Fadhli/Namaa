import { describe, expect, test } from 'vitest';
import { runEngineDetailed, calculateAssetValue, evaluateCropZakat, evaluateLivestockZakat } from './engine.js';
const strict = { validationMode: 'strict' };
const date = new Date('2025-04-01T00:00:00Z');
const prices = { gold: 300, silver: 4 };
const cash = (patch = {}) => ({ id: 'cash', kind: 'cash', acquired: date, value: 10000, ...patch });
const row = (assets = [cash()], at = date) => ({ date: at, prices, assets });

describe('G core invalid facts, identity, reconciliation and interruption', () => {
  test.each([-1, NaN, Infinity, -Infinity])('invalid money %s is rejected', value => {
    expect(() => runEngineDetailed([row([cash({ value })])], strict)).toThrow();
  });
  test.each([new Date(NaN), '2025-02-30', 'not-a-date', new Date('2025-04-01T12:00:00Z')])('invalid acquisition is rejected: %s', acquired => {
    expect(() => runEngineDetailed([row([cash({ acquired })])], strict)).toThrow();
  });
  test('future acquisition cannot silently disappear', () => {
    expect(() => runEngineDetailed([row([cash({ acquired: new Date('2025-04-02T00:00:00Z') })])], strict)).toThrow(/future/);
  });
  test('duplicate and retired IDs are rejected', () => {
    expect(() => runEngineDetailed([row([cash(), cash()])], strict)).toThrow(/duplicate/);
    expect(() => runEngineDetailed([row(), row([], new Date('2025-04-02T00:00:00Z')), row([cash()], new Date('2025-04-03T00:00:00Z'))], strict)).toThrow(/reused/);
  });
  test('cash snapshot must reconcile and cannot duplicate asset inventory', () => {
    const d = { date, prices, openingBalanceKnown: true, deposits: [10000], withdrawals: [] };
    expect(() => runEngineDetailed([{ ...d, cashBalance: 9000 }], strict)).toThrow(/reconcile/);
    expect(runEngineDetailed([{ ...d, assets: [cash()] }], strict)).toMatchObject({ status: 'UNRESOLVED', actualDue: null });
  });
  test('withdrawal above available cash is rejected', () => {
    expect(() => runEngineDetailed([{ date, prices, openingBalanceKnown: true, deposits: [1000], withdrawals: [1001] }], strict)).toThrow(/exceeds/);
  });
  test('a genuine break below nisab restarts hawl for remaining cash', () => {
    const days = [];
    for (let i = 0, t = +date; t <= +new Date('2026-06-01T00:00:00Z'); t += 86400000, i++) {
      days.push({ date: new Date(t), prices, openingBalanceKnown: true, deposits: i === 0 ? [10000] : i === 60 ? [9000] : [], withdrawals: i === 30 ? [9000] : [] });
    }
    const r = runEngineDetailed(days, strict);
    expect(r.events.filter(e => e.type === 'BREAK')).toHaveLength(1);
    expect(r.events.filter(e => e.type === 'START')).toHaveLength(2);
    expect(r.events.filter(e => e.type === 'DUE')).toHaveLength(1);
    expect(r.actualDue).toBe(250);
  });
  test('conversion cannot retain the capital and count it a second time', () => {
    const target = { id: 'goods', kind: 'investmentProducts', acquired: new Date('2025-04-02T00:00:00Z'), type: 'TRADING', marketValue: 10000, hawlSource: { sourceId: 'cash', type: 'TRADE_CONVERSION', transferredValue: 10000 } };
    expect(() => runEngineDetailed([row(), row([cash(), target], target.acquired)], strict)).toThrow(/duplicated/);
  });
  test('missing date/value/intent and invalid percentages stay distinct', () => {
    expect(calculateAssetValue({ stocks: [{ acquired: date, marketValue: 10000 }] }, strict)).toMatchObject({ status: 'UNKNOWN', value: null });
    expect(calculateAssetValue({ investmentProducts: [{ acquired: date, type: 'LONG_TERM' }] }, strict)).toMatchObject({ status: 'UNKNOWN', value: null });
    expect(() => calculateAssetValue({ investmentProducts: [{ acquired: date, type: 'LONG_TERM', fundZakatableBase: 1000, ownershipShare: 2 }] }, strict)).toThrow();
  });
  test('an unhandled asset category cannot look like an empty zero portfolio', () => {
    expect(() => calculateAssetValue({ crypto: [{ value: 10000 }] }, strict)).toThrow(/category/);
  });
});

describe('C/L numeric facts must not turn into fabricated eligibility', () => {
  test.each([-1, NaN, Infinity, 1.5])('invalid herd count %s', count => {
    expect(() => evaluateLivestockZakat({ type: 'sheep', count }, strict)).toThrow();
  });
  test.each([-1, NaN, Infinity])('invalid harvest quantity %s', quantity => {
    expect(() => evaluateCropZakat({ classification: 'GRAIN', quantity }, strict)).toThrow();
  });
  test('both mostly and fully grazing herds expose R02 when fed throughout grazing', () => {
    for (const grazing of ['MOST_YEAR', 'ALL_YEAR']) expect(evaluateLivestockZakat({ type: 'sheep', count: 40, purpose: 'PRODUCTION', grazing, feedingDuringGrazing: true }, strict)).toMatchObject({ status: 'BLOCKED_PENDING_REVIEW', ruleId: 'R02' });
  });
});
