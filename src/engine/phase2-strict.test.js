import { describe, expect, test } from 'vitest';
import { runEngineDetailed, runEngine, defaultSettings, calculateZakatableSnapshot, calculateAssetValue, isHawlComplete, nisabFor } from './engine.js';

const strict = { validationMode: 'strict' };
const date = new Date('2025-04-01T00:00:00Z');
const day = { date, nisab: 5000, prices: { gold: 300, silver: 4 }, openingBalanceKnown: true, deposits: [10000], withdrawals: [] };

describe('Phase 2 core: G ownership/history; strict compatibility', () => {
  test('a late first appearance does not backfill unobserved ownership history', () => {
    const days = history(d => d.getUTCDate() < 3 ? [] : [{ id: 'late', kind: 'cash', acquired: date, value: 10000 }], '2025-04-03');
    expect(runEngineDetailed(days, strict)).toMatchObject({ status: 'UNKNOWN', actualDue: null });
  });
  test('purpose cannot change unnoticed while an exempt lot is absent from tracked lots', () => {
    const days = history(d => [metal('gold', { purpose: d.getUTCDate() === 1 ? 'PERSONAL_USE' : 'INVESTMENT' })], '2025-04-02');
    expect(() => runEngineDetailed(days, strict)).toThrow(/characteristics/);
  });
  test('optional strict settings use a deterministic canonical policy', () => {
    const result = runEngineDetailed([day], strict);
    expect(result.status).toBe('ZERO');
    expect(result.policyApplied.acquiredMoneyMode).toBe('INDEPENDENT_HAWL');
    expect(result.paymentRecorded).toBe(false);
    expect(result.actualDue).toBe(0);
  });
  test('optional mode alone works for both modes and the nisab helper', () => {
    expect(nisabFor({ gold: 300, silver: 4 }, strict)).toBe(2380);
    expect(runEngineDetailed([day], { validationMode: 'legacy' }).events).toEqual(runEngineDetailed([day]).events);
  });
  test('missing opening cash history is UNKNOWN, never zero or payable', () => {
    const result = runEngineDetailed([{ date, nisab: 5000 }], strict);
    expect(result.status).toBe('UNKNOWN');
    expect(result.actualDue).toBeNull();
    expect(result.events.some(e => e.type === 'DUE')).toBe(false);
    expect(runEngine([{ date, nisab: 5000 }], strict)[0].status).toBe('UNKNOWN');
    expect(runEngineDetailed([{ date, nisab: 5000 }]).series[0].total).toBe(0);
  });
  test('a historical gap cannot establish uninterrupted nisab', () => {
    const result = runEngineDetailed([day, { ...day, date: new Date('2025-04-03T00:00:00Z'), deposits: [] }], strict);
    expect(result.status).toBe('UNKNOWN');
    expect(result.issues[0].reasonCode).toBe('NEEDS_HISTORY_REVIEW');
  });
  test('missing snapshot cash differs explicitly from a known zero', () => {
    expect(calculateZakatableSnapshot({}).total).toBe(0);
    expect(calculateZakatableSnapshot({}, strict)).toMatchObject({ status: 'UNKNOWN', total: null });
    expect(calculateZakatableSnapshot({ cashBalance: 0 }, strict)).toMatchObject({ status: 'ZERO', total: 0 });
  });
  test('mutation of legacy defaults does not change implicit strict policy', () => {
    const old = defaultSettings.acquiredMoneyMode;
    try {
      defaultSettings.acquiredMoneyMode = 'ANNUAL_ADVANCE';
      expect(runEngineDetailed([day], strict).policyApplied.acquiredMoneyMode).toBe('INDEPENDENT_HAWL');
    } finally { defaultSettings.acquiredMoneyMode = old; }
  });
  test('a bare explicit nisab does not replace missing price facts in strict cash', () => {
    const { prices: _prices, ...missingPrices } = day;
    expect(runEngineDetailed([missingPrices], strict)).toMatchObject({ status: 'UNKNOWN', actualDue: null });
    expect(_prices.gold).toBe(300);
  });
});

const metal = (kind, patch = {}) => ({ id: kind, kind, acquired: date, purpose: 'INVESTMENT', grams: kind === 'gold' ? 85 : 595, ...(kind === 'gold' ? { karat: 24, pricePerGram: 300 } : { purity: 1000, pricePerGram: 4 }), ...patch });
const history = (getAssets, end = '2026-03-22') => {
  const rows = [];
  for (let t = +date; t <= +new Date(`${end}T00:00:00Z`); t += 86400000) {
    const d = new Date(t);
    rows.push({ date: d, prices: { gold: 300, silver: 4 }, nisab: 2380, assets: getAssets(d) });
  }
  return rows;
};
describe('G metals, stocks, funds: explicit facts / shared valuation core', () => {
  test('personal-use metal needs purpose but not an invented market price', () => {
    const a = metal('gold', { purpose: 'PERSONAL_USE' }); delete a.pricePerGram;
    expect(calculateAssetValue({ gold: [a] }, strict)).toMatchObject({ status: 'EXEMPT', value: 0 });
  });
  test('a disclosed fund base times explicit ownership share is supported', () => {
    expect(calculateAssetValue({ investmentProducts: [{ acquired: date, type: 'LONG_TERM', fundZakatableBase: 20000, ownershipShare: 0.1 }] }, strict)).toMatchObject({ status: 'CALCULATED', value: 2000 });
  });
  test('conflicting disclosed fund bases and ownership shares are rejected', () => {
    expect(() => calculateAssetValue({ investmentProducts: [{ acquired: date, type: 'LONG_TERM', fundZakatableBase: 20000, ownershipShare: 0.1, zakatableValue: 1000 }] }, strict)).toThrow(/reconcile/);
  });
  test('a derived fund value cannot hide NaN or an invalid ownership percentage', () => {
    const a = { acquired: date, type: 'LONG_TERM', fundZakatableBase: 20000, ownershipShare: 0.1, zakatableValue: NaN };
    expect(() => calculateAssetValue({ investmentProducts: [a] }, strict)).toThrow();
    expect(() => calculateAssetValue({ investmentProducts: [{ acquired: date, type: 'LONG_TERM', ownershipShare: 2, zakatableValue: 1000 }] }, strict)).toThrow();
  });
  test.each(['gold', 'silver'])('%s cannot infer purpose or purity', kind => {
    const a = metal(kind); delete a.purpose;
    expect(calculateAssetValue({ [kind]: [a] })).toBeGreaterThan(0);
    expect(calculateAssetValue({ [kind]: [a] }, strict)).toMatchObject({ status: 'UNKNOWN', value: null });
    a.purpose = 'INVESTMENT'; delete a[kind === 'gold' ? 'karat' : 'purity'];
    expect(calculateAssetValue({ [kind]: [a] }, strict).status).toBe('UNKNOWN');
  });
  test.each(['gold', 'silver'])('%s has its own pure-metal threshold', kind => {
    for (const delta of [-0.001, 0, 0.001]) {
      const a = metal(kind, { grams: (kind === 'gold' ? 85 : 595) + delta });
      const result = runEngineDetailed(history(() => [a]), strict);
      expect(result.actualDue).toBeCloseTo(delta < 0 ? 0 : calculateAssetValue({ [kind]: [a] }) / 40);
    }
  });
  test('silver threshold does not follow reversed gold/silver price ordering', () => {
    const rows = history(() => [metal('silver', { grams: 594, pricePerGram: 1000 })]);
    rows.forEach(row => { row.prices = { gold: 1, silver: 1000 }; });
    const r = runEngineDetailed(rows, strict);
    expect(r.actualDue).toBe(0);
    expect(r.policyApplied.appliedNisabBasis).toBe('SILVER');
    expect(r.series.at(-1).nisab).toBe(595000);
  });
  test('gold karat boundary is measured as pure gold', () => {
    const rows = history(() => [metal('gold', { grams: 170, karat: 12 })]);
    expect(runEngineDetailed(rows, strict).actualDue).toBe(637.5);
  });
  test('proved company-paid holding is exempt without inventing a base', () => {
    const a = { id: 'paid', kind: 'stocks', acquired: date, type: 'LONG_TERM', zakatExempt: true, companyZakatPaid: true, companyEvidence: { jurisdiction: 'SA', source: 'company-disclosure', coversHolding: true } };
    expect(calculateAssetValue({ stocks: [a] }, strict)).toMatchObject({ status: 'EXEMPT', value: 0 });
    expect(runEngineDetailed(history(() => [a]), strict).status).toBe('EXEMPT');
  });
  test('company payment cannot silently exempt a trading holding', () => {
    const a = { acquired: date, type: 'TRADING', marketValue: 10000, zakatExempt: true, companyZakatPaid: true, companyEvidence: { jurisdiction: 'SA', source: 'company-disclosure', coversHolding: true } };
    expect(calculateAssetValue({ stocks: [a] }, strict)).toMatchObject({ status: 'UNRESOLVED', value: null });
  });
  test('excluded property and zero cash do not change the single gold basis', () => {
    const r = runEngineDetailed(history(() => [metal('gold', { grams: 84 }), { id: 'zero', kind: 'cash', acquired: date, value: 0 }, { id: 'home', kind: 'properties', acquired: date, intent: 'USE' }]), strict);
    expect(r.actualDue).toBe(0);
  });
  test('gold held for trade and gold held as investment use the mixed basis', () => {
    const r = runEngineDetailed(history(() => [metal('gold', { id: 'saved', grams: 10 }), metal('gold', { id: 'trade', grams: 1, purpose: 'TRADING' })]), strict);
    expect(r.actualDue).toBe(82.5);
    expect(r.policyApplied.appliedNisabBasis).toBe('MIN');
  });
  test('a stock exemption requires company evidence and ownership scope', () => {
    const a = { id: 's', acquired: date, type: 'LONG_TERM', zakatExempt: true };
    expect(calculateAssetValue({ stocks: [a] })).toBe(0);
    expect(calculateAssetValue({ stocks: [a] }, strict)).toMatchObject({ status: 'UNKNOWN', value: null });
  });
  test('funds never use NAV instead of a missing long-term zakatable base', () => {
    expect(calculateAssetValue({ investmentProducts: [{ id: 'f', acquired: date, type: 'LONG_TERM', marketValue: 10000 }] }, strict)).toMatchObject({ status: 'UNKNOWN', value: null });
  });
});

describe('G pp19–22: receivables, profit and economic lineage', () => {
  test('recovery of doubtful debt starts a new hawl after collection', () => {
    const collected = new Date('2026-03-01T00:00:00Z');
    const r = runEngineDetailed(history(d => [{ id: 'anchor', kind: 'cash', acquired: date, value: 10000 }, ...(d < collected ? [{ id: 'debt', kind: 'receivable', acquired: date, value: 10000, recovery: 'DOUBTFUL' }] : [{ id: 'received', kind: 'cash', acquired: collected, value: 10000, ...(d.getTime() === collected.getTime() ? { hawlSource: { type: 'DEBT_RECOVERY', sourceId: 'debt', transferredValue: 10000 } } : {}) }])]), strict);
    expect(r.actualDue).toBe(250);
    expect(r.assetLots.find(a => a.id === 'received').start).toEqual(collected);
  });
  test('recoverable debt matures, doubtful debt is explicitly excluded', () => {
    for (const recovery of ['SOLVENT_NON_DELAYING', 'DOUBTFUL']) {
      const r = runEngineDetailed(history(() => [{ id: 'debt', kind: 'receivable', acquired: date, value: 10000, recovery }]), strict);
      expect(r.actualDue).toBe(recovery === 'DOUBTFUL' ? 0 : 250);
    }
  });
  test('trade profit inherits capital hawl without being a new independent purchase', () => {
    const later = new Date('2026-03-01T00:00:00Z');
    const r = runEngineDetailed(history(d => [{ id: 'capital', kind: 'cash', acquired: date, value: 10000, tradeCapital: true }, ...(d >= later ? [{ id: 'profit', kind: 'cash', acquired: later, value: 1000, ...(d.getTime() === later.getTime() ? { hawlSource: { type: 'TRADE_PROFIT', sourceId: 'capital' } } : {}) }] : [])]), strict);
    expect(r.actualDue).toBe(275);
  });
  test('cash to trade goods retains hawl and cannot double count transferred capital', () => {
    const later = new Date('2025-10-01T00:00:00Z');
    const r = runEngineDetailed(history(d => d < later ? [{ id: 'cash', kind: 'cash', acquired: date, value: 10000 }] : [{ id: 'goods', kind: 'investmentProducts', type: 'TRADING', acquired: later, marketValue: 10000, ...(d.getTime() === later.getTime() ? { hawlSource: { type: 'TRADE_CONVERSION', sourceId: 'cash', transferredValue: 10000 } } : {}) }]), strict);
    expect(r.actualDue).toBe(250);
  });
});

describe('G pp14,19: advance is a proposal, not payment or forced renewal', () => {
  test('strict actual due separates new money; legacy remains unchanged', () => {
    const later = new Date('2025-10-01T00:00:00Z');
    const days = history(d => [{ id: 'old', kind: 'cash', acquired: date, value: 10000 }, ...(d >= later ? [{ id: 'new', kind: 'cash', acquired: later, value: 4000 }] : [])]);
    const result = runEngineDetailed(days, { ...strict, acquiredMoneyMode: 'ANNUAL_ADVANCE' });
    expect(result.actualDue).toBe(250);
    expect(result.suggestedAdvance).toBe(100);
    expect(result.paymentRecorded).toBe(false);
    expect(result.assetLots.find(a => a.id === 'new').start).toEqual(later);
    expect(runEngineDetailed(days, { ...defaultSettings, acquiredMoneyMode: 'ANNUAL_ADVANCE' }).events.find(e => e.type === 'DUE').zakat).toBe(350);
    expect(isHawlComplete(date, days.at(-1).date)).toBe(true);
  });
});
