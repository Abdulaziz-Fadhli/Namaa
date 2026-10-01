import { describe, expect, test } from 'vitest';
import {
  calculateAssetValue,
  calculateZakatableSnapshot,
  defaultSettings,
  nisabFor,
  runEngineDetailed,
} from './engine.js';
import { runReferenceEngine } from './reference-policy.js';

// Characterization, not a policy endorsement. Differences are asserted as-is.
// No production adapter is used: equivalent facts are expressed in both APIs.
const START = '2025-04-01';
const DUE = '2026-03-22';
const LATER = '2025-05-01';
const DAY = 86400000;
const PRICE = { gold: 300, silver: 4 };
const utc = (s) => new Date(`${s}T00:00:00Z`);
const cash = (id = 'cash', value = 10000, acquired = START) =>
  ({ id, kind: 'CASH', value, acquired });
const gold = (grams = 100, acquired = START) =>
  ({ id: 'gold', kind: 'GOLD', grams, karat: 24, purpose: 'INVESTMENT', acquired });
const silver = (grams = 1000) =>
  ({ id: 'silver', kind: 'SILVER', grams, purity: 1000, purpose: 'INVESTMENT', acquired: START });
const goods = (id = 'shop', value = 10000, acquired = START) =>
  ({ id, kind: 'TRADE_GOODS', intent: 'TRADING', value, acquired });

// Deliberately limited test-fixture conversion. It does not carry hawlSource or
// validate company evidence: those are capabilities under comparison.
function legacyAsset(a) {
  const base = { id: a.id, acquired: utc(a.acquired) };
  switch (a.kind) {
    case 'CASH': return { ...base, kind: 'cash', value: a.value };
    case 'GOLD': return { ...base, kind: 'gold', grams: a.grams, karat: a.karat, purpose: a.purpose, pricePerGram: PRICE.gold };
    case 'SILVER': return { ...base, kind: 'silver', grams: a.grams, purity: a.purity, purpose: a.purpose, pricePerGram: PRICE.silver };
    case 'TRADE_GOODS': return { ...base, kind: 'investmentProducts', type: 'TRADING', marketValue: a.value };
    case 'STOCK': return {
      ...base, kind: 'stocks', type: a.intent === 'TRADING' ? 'TRADING' : 'LONG_TERM',
      marketValue: a.value, zakatableValue: a.zakatableValue,
      ...(a.companyZakatPaid ? { zakatExempt: true } : {}),
    };
    default: throw new Error(`Unsupported comparison fixture ${a.kind}`);
  }
}
function history(assets = () => [cash()], end = DUE) {
  const days = [], prices = {};
  for (let t = utc(START).getTime(); t <= utc(end).getTime(); t += DAY) {
    const date = new Date(t).toISOString().slice(0, 10);
    days.push({ date, assets: assets(date) });
    prices[date] = { ...PRICE };
  }
  return { days, prices, asOfDate: end };
}
function legacy(q, settings = defaultSettings, basis = 'MIN') {
  return runEngineDetailed(q.days.map((row) => ({
    date: utc(row.date),
    nisab: nisabFor(q.prices[row.date], { ...defaultSettings, nisabBasis: basis }),
    assets: row.assets.map(legacyAsset),
  })), settings);
}
const dues = (r) => r.events.filter((e) => e.type === 'DUE');
const dueTotal = (r) => dues(r).reduce((sum, e) => sum + e.zakat, 0);
function expectSame(q) {
  const old = legacy(q), ref = runReferenceEngine(q);
  expect(ref.zakatableWealth).toBeCloseTo(old.series.at(-1).total, 8);
  expect(ref.zakatDue).toBeCloseTo(dueTotal(old), 8);
  expect(ref.events.map((e) => ({ type: e.type, date: e.date, base: e.base, zakat: e.zakat })))
    .toEqual(old.events.map((e) => ({ type: e.type, date: e.date.toISOString().slice(0, 10), base: e.base, zakat: e.zakat })));
  expect(ref.nextDueDate).toBe(old.nextDue?.dueDate.toISOString().slice(0, 10) ?? null);
  expect(ref.projectedNextZakat).toBeCloseTo(old.nextDue?.zakat ?? 0, 8);
  return { old, ref };
}

describe('A) SAME_BEHAVIOR', () => {
  test.each([84.999, 85, 85.001])('standalone gold %sg agrees when the caller supplies the gold nisab', (grams) => {
    const q = history(() => [gold(grams)]);
    const old = legacy(q, defaultSettings, 'GOLD'), ref = runReferenceEngine(q);
    expect(ref.zakatDue).toBeCloseTo(dueTotal(old), 8);
    expect(ref.nisab.appliedValue).toBe(old.series.at(-1).nisab);
    expect(ref.zakatDue).toBeCloseTo(grams < 85 ? 0 : grams * 300 / 40, 8);
  });
  test.each([594.999, 595, 595.001])('standalone silver %sg agrees at current prices', (grams) => {
    const { ref } = expectSame(history(() => [silver(grams)]));
    expect(ref.zakatDue).toBeCloseTo(grams < 595 ? 0 : grams * 4 / 40, 8);
  });
  test.each([2379.99, 2380, 2380.01])('cash boundary %s', (value) => {
    const { ref } = expectSame(history(() => [cash('cash', value)]));
    expect(ref.zakatDue).toBe(value < 2380 ? 0 : value / 40);
  });
  test.each([
    ['cash plus trade', () => [cash('cash', 2000), goods('shop', 380)], 2380],
    ['cash plus gold', () => [cash('cash', 1000), gold(10)], 4000],
    ['gold plus silver', () => [gold(10), silver(100)], 3400],
  ])('mixed inventory: %s', (_name, assets, total) => {
    const { ref } = expectSame(history(assets));
    expect(ref.nisab.basis).toBe('LOWER_OF_GOLD_SILVER');
    expect(ref.zakatableWealth).toBe(total);
  });
  test('nisab break resets surviving lots and return starts a new hawl', () => {
    const { old, ref } = expectSame(history((d) => [
      cash('first', d === START ? 3000 : 1000),
      ...(d >= '2025-04-03' ? [cash('new', 2000, '2025-04-03')] : []),
    ], '2025-04-04'));
    expect(ref.events.map((e) => e.type)).toEqual(['START', 'BREAK', 'START']);
    expect(ref.hawlStart).toBe('2025-04-03');
    expect(old.assetLots.every((a) => a.start.getTime() === utc('2025-04-03').getTime())).toBe(true);
  });
  test('new salary remains independent without an economic lineage', () => {
    const { ref } = expectSame(history((d) => [cash(), ...(d >= LATER ? [cash('salary', 1000, LATER)] : [])]));
    expect(ref.zakatDue).toBe(250);
    expect(ref.assetBreakdown.find((a) => a.id === 'salary').hawlStart).toBe(LATER);
  });
  test('trading shares use full market value', () => {
    const { ref } = expectSame(history(() => [{ id: 'share', kind: 'STOCK', intent: 'TRADING', value: 10000, acquired: START }]));
    expect(ref.zakatDue).toBe(250);
  });
  test('investment shares use supplied zakatable value instead of market value', () => {
    const { ref } = expectSame(history(() => [{ id: 'share', kind: 'STOCK', intent: 'INVESTMENT', value: 50000, zakatableValue: 10000, acquired: START }]));
    expect(ref.zakatableWealth).toBe(10000);
    expect(ref.zakatDue).toBe(250);
  });
  test('documented Saudi company payment and explicit legacy exemption both exclude the investment share', () => {
    const { ref } = expectSame(history(() => [{ id: 'share', kind: 'STOCK', intent: 'INVESTMENT', value: 10000, acquired: START,
      companyZakatPaid: true, companyEvidence: { jurisdiction: 'SA', source: 'declared company disclosure' } }]));
    expect(ref.zakatableWealth).toBe(0);
    expect(ref.assetBreakdown[0].included).toBe(false);
  });
  test.each(['GOLD', 'SILVER'])('personal and lending %s are already excluded in both current implementations', (kind) => {
    for (const purpose of ['PERSONAL_USE', 'LENDING']) {
      const { ref } = expectSame(history(() => [{ ...(kind === 'GOLD' ? gold() : silver()), purpose }]));
      expect(ref.zakatableWealth).toBe(0);
    }
  });
  test.each([undefined, null, NaN])('unknown investment value %s is rejected, not treated as zero', (zakatableValue) => {
    const q = history(() => [{ id: 's', kind: 'STOCK', intent: 'INVESTMENT', acquired: START, zakatableValue }], START);
    expect(() => legacy(q)).toThrow();
    expect(() => runReferenceEngine(q)).toThrow();
  });
  test('a disclosed investment value of zero remains known zero in both', () => {
    const { ref } = expectSame(history(() => [{ id: 's', kind: 'STOCK', intent: 'INVESTMENT', acquired: START, zakatableValue: 0 }]));
    expect(ref.zakatDue).toBe(0);
  });
  test('missing cash value is rejected in both daily asset contracts', () => {
    const q = history(() => [{ ...cash(), value: undefined }], START);
    expect(() => legacy(q)).toThrow();
    expect(() => runReferenceEngine(q)).toThrow();
  });
  test('missing acquisition and missing observation dates are rejected in both daily contracts', () => {
    for (const field of ['acquired', 'date']) {
      const q = history(undefined, START);
      const oldDays = [{ date: utc(START), nisab: 2380, assets: [legacyAsset(cash())] }];
      if (field === 'acquired') { delete q.days[0].assets[0].acquired; delete oldDays[0].assets[0].acquired; }
      else { delete q.days[0].date; delete oldDays[0].date; }
      expect(() => runEngineDetailed(oldDays)).toThrow();
      expect(() => runReferenceEngine(q)).toThrow();
    }
  });
});

describe('B) INTENTIONAL_POLICY_DIFFERENCE', () => {
  test('standalone 10g investment gold: default MIN starts legacy hawl, reference gold basis does not', () => {
    const q = history(() => [gold(10)]), old = legacy(q), ref = runReferenceEngine(q);
    expect(old.series.at(-1).nisab).toBe(2380);
    expect(dueTotal(old)).toBe(75);
    expect(ref.nisab.appliedValue).toBe(25500);
    expect(ref.zakatDue).toBe(0);
    expect(ref.status).toBe('BELOW_NISAB');
  });
  test('annual advance separates actual obligation, suggested advance and unrecorded payment', () => {
    const q = history((d) => [cash(), ...(d >= LATER ? [cash('salary', 1000, LATER)] : [])]);
    const old = legacy(q, { ...defaultSettings, acquiredMoneyMode: 'ANNUAL_ADVANCE' });
    const ref = runReferenceEngine({ ...q, shariaPolicy: { newMoneyMode: 'ANNUAL_ADVANCE' } });
    expect(dues(old)[0]).toMatchObject({ base: 11000, zakat: 275 });
    expect(old.assetLots.find((a) => a.id === 'salary').start).toEqual(utc(DUE));
    expect(ref.zakatDue).toBe(250);
    expect(ref.advanceSuggested).toBe(25);
    expect(ref.paymentRecorded).toBe(false);
    expect(ref.assetBreakdown.find((a) => a.id === 'salary').hawlStart).toBe(LATER);
    expect(ref.warnings.join(' ')).toContain('اقتراحًا فقط');
    // Legacy has no payment ledger either; its missing field does not prove payment.
    expect(old).not.toHaveProperty('paymentRecorded');
  });
  test('trade profit inherits capital hawl only through explicit reference provenance', () => {
    const q = history((d) => [goods(), ...(d >= LATER ? [{ ...cash('profit', 1000, LATER),
      ...(d === LATER ? { hawlSource: { type: 'TRADE_PROFIT', sourceId: 'shop' } } : {}) }] : [])]);
    expect(dueTotal(legacy(q))).toBe(250);
    expect(runReferenceEngine(q).zakatDue).toBe(275);
    const withoutLink = structuredClone(q);
    for (const row of withoutLink.days) for (const a of row.assets) delete a.hawlSource;
    expect(runReferenceEngine(withoutLink).zakatDue).toBe(250);
  });
  test('cash to trading goods and back retains capital hawl with reconciled lineage', () => {
    const returned = '2025-06-01';
    const q = history((d) => d < LATER ? [{ ...cash(), tradeCapital: true }]
      : d < returned ? [{ ...goods('trade', 10000, LATER), ...(d === LATER ? { hawlSource: { type: 'TRADE_CONVERSION', sourceId: 'cash', transferredValue: 10000 } } : {}) }]
        : [{ ...cash('returned', 10000, returned), tradeCapital: true,
          ...(d === returned ? { hawlSource: { type: 'TRADE_CONVERSION', sourceId: 'trade', transferredValue: 10000 } } : {}) }]);
    expect(dueTotal(legacy(q))).toBe(0);
    expect(runReferenceEngine(q).zakatDue).toBe(250);
    const bad = structuredClone(q);
    bad.days.find((d) => d.date === LATER).assets[0].hawlSource.transferredValue = 9999;
    expect(() => runReferenceEngine(bad)).toThrow('reconcile');
  });
  test.each(['SOLVENT_NON_DELAYING', 'DOUBTFUL'])('receivable recovery %s requires facts absent from legacy kinds', (recovery) => {
    const q = history((d) => [cash(), ...(d < LATER
      ? [{ id: 'loan', kind: 'RECEIVABLE', value: 2000, recovery, acquired: START }]
      : [{ ...cash('received', 2000, LATER), ...(d === LATER ? { hawlSource: { type: 'DEBT_RECOVERY', sourceId: 'loan', transferredValue: 2000 } } : {}) }])]);
    // Explicit chosen legacy mapping, not an assertion that it natively classifies debt:
    // solvent debt is represented as cash; doubtful debt is omitted until receipt.
    const oldQ = { ...q, days: q.days.map((row) => ({ ...row, assets: row.assets.flatMap((a) => a.kind !== 'RECEIVABLE'
      ? [a] : recovery === 'DOUBTFUL' ? [] : [cash('loan', a.value, a.acquired)]) })) };
    expect(dueTotal(legacy(oldQ))).toBe(250);
    const ref = runReferenceEngine(q);
    expect(ref.zakatDue).toBe(recovery === 'DOUBTFUL' ? 250 : 300);
    expect(ref.assetBreakdown.find((a) => a.id === 'received').hawlStart).toBe(recovery === 'DOUBTFUL' ? LATER : DUE);
    expect(() => runEngineDetailed([{ date: utc(START), nisab: 2380, assets: [{ id: 'loan', kind: 'RECEIVABLE', acquired: utc(START), value: 2000 }] }])).toThrow('unsupported asset kind');
  });
  test('company payment without evidence is accepted by legacy exemption but rejected by reference facts', () => {
    const q = history(() => [{ id: 's', kind: 'STOCK', intent: 'INVESTMENT', acquired: START, companyZakatPaid: true }], START);
    expect(legacy(q).series[0].total).toBe(0);
    expect(() => runReferenceEngine(q)).toThrow('companyEvidence');
  });
  test('trading shares cannot use company discharge in reference contract', () => {
    const q = history(() => [{ id: 's', kind: 'STOCK', intent: 'TRADING', value: 10000, acquired: START,
      companyZakatPaid: true, companyEvidence: { jurisdiction: 'SA', source: 'disclosure' } }]);
    expect(dueTotal(legacy(q))).toBe(0);
    expect(() => runReferenceEngine(q)).toThrow('trading stock cannot be exempted');
  });
  test.each(['purpose', 'karat'])('missing gold %s: permissive legacy valuation versus required reference fact', (field) => {
    const a = gold(); delete a[field];
    const q = history(() => [a], START);
    expect(legacy(q).series[0].total).toBe(30000);
    expect(() => runReferenceEngine(q)).toThrow();
  });
  test.each(['purpose', 'purity'])('missing silver %s: legacy purity default versus explicit facts', (field) => {
    const a = silver(); delete a[field];
    const q = history(() => [a], START);
    expect(legacy(q).series[0].total).toBe(4000);
    expect(() => runReferenceEngine(q)).toThrow();
  });
  test('prior ownership: both avoid fabricated historical dues, only reference reports NEEDS_HISTORY_REVIEW', () => {
    const q = history(() => [cash('opening', 10000, '2024-01-01')], START);
    const old = legacy(q), ref = runReferenceEngine(q);
    expect(dueTotal(old)).toBe(0);
    expect(old.assetLots[0].start).toEqual(utc(START));
    expect(ref.zakatDue).toBe(0);
    expect(ref.assetBreakdown[0].hawlStart).toBe(START);
    expect(ref.status).toBe('NEEDS_HISTORY_REVIEW');
    expect(ref.warnings).toHaveLength(1);
    expect(old).not.toHaveProperty('warnings');
  });
});

describe('B) INTENTIONAL_POLICY_DIFFERENCE: silver price ordering', () => {
  test('silver-only policy difference is masked when silver happens to be the cheaper metal', () => {
    const q = history(() => [silver(594)]);
    for (const d of q.days) q.prices[d.date] = { gold: 1, silver: 4 };
    const old = runEngineDetailed(q.days.map((row) => ({
      date: utc(row.date), nisab: nisabFor(q.prices[row.date]), assets: row.assets.map(legacyAsset),
    })));
    const ref = runReferenceEngine(q);
    expect(old.series.at(-1).nisab).toBe(85);
    expect(dueTotal(old)).toBe(59.4);
    expect(ref.nisab.appliedValue).toBe(2380);
    expect(ref.zakatDue).toBe(0);
    // Synthetic positive prices expose the selection rule; not a market forecast.
  });
});

describe('C) POSSIBLE_BUG_OR_DUPLICATION', () => {
  test('removed lot identity can be reused in legacy but is prohibited by the reference history contract', () => {
    const q = history((d) => d === '2025-04-02' ? [] : [cash('same', 10000, d)], '2025-04-03');
    expect(legacy(q).series.at(-1).total).toBe(10000);
    expect(() => runReferenceEngine(q)).toThrow('cannot be reused');
  });
  test('NEEDS_HISTORY_REVIEW does not suppress later observed obligations', () => {
    const q = history(() => [cash('opening', 10000, '2024-01-01')]);
    const { old, ref } = expectSame(q);
    expect(dueTotal(old)).toBe(250);
    expect(ref.status).toBe('NEEDS_HISTORY_REVIEW');
    expect(ref.zakatDue).toBe(250);
    expect(ref.paymentRecorded).toBe(false);
  });
  test('company evidence is structurally checked, not independently verified', () => {
    const q = history(() => [{ id: 's', kind: 'STOCK', intent: 'INVESTMENT', acquired: START,
      companyZakatPaid: true, companyEvidence: { jurisdiction: 'SA', source: 'unverified user assertion' } }], START);
    const { ref } = expectSame(q);
    expect(ref.assetBreakdown[0]).toMatchObject({ included: false, value: null, zakatableValue: 0 });
  });
  test('duplicated empty-data contracts: snapshot defaults absent cash to zero; reference refuses absent history', () => {
    expect(calculateZakatableSnapshot({})).toEqual({ cashBalance: 0, otherAssets: 0, total: 0 });
    expect(runEngineDetailed([]).events).toEqual([]);
    expect(() => runReferenceEngine({ days: [], prices: {}, asOfDate: START })).toThrow('observed history');
  });
  test('gap in observations can hide a nisab break: legacy accepts increasing sparse dates, reference rejects it', () => {
    const q = history(); q.days = [q.days[0], q.days.at(-1)];
    expect(dueTotal(legacy(q))).toBe(250);
    expect(() => runReferenceEngine(q)).toThrow('continuous');
  });
  test('missing snapshot cash is distinct from missing explicit manual value', () => {
    expect(calculateZakatableSnapshot({}).cashBalance).toBe(0);
    expect(() => calculateAssetValue({ manualAssets: [{}] })).toThrow('manual asset value');
    expect(() => runReferenceEngine(history(() => [{ ...cash(), value: undefined }], START))).toThrow();
  });
  test('payment absence and result shape are not a numerical disagreement', () => {
    const { old, ref } = expectSame(history());
    expect(old.events[0].date).toBeInstanceOf(Date);
    expect(ref.events[0].date).toBe(START);
    expect(typeof old.series[0].nisab).toBe('number');
    expect(ref.nisab).toMatchObject({ appliedValue: 2380 });
    expect(ref.paymentRecorded).toBe(false);
    expect(JSON.parse(JSON.stringify(ref))).toEqual(ref);
  });
  test('cash represented as inventory is classified as otherAssets by raw legacy output but cash by reference output', () => {
    const { old, ref } = expectSame(history());
    expect(old.series.at(-1)).toMatchObject({ cashBalance: 0, otherAssets: 10000 });
    expect(ref.series.at(-1)).toMatchObject({ cashBalance: 10000, otherAssets: 0 });
    expect(dues(old)[0]).toMatchObject({ cashBase: 0, otherAssetsBase: 10000 });
    expect(dues(ref)[0]).toMatchObject({ cashBase: 10000, otherAssetsBase: 0 });
  });
  test('reference claim of independent obligations currently depends on mutable legacy defaults', () => {
    const original = defaultSettings.acquiredMoneyMode;
    try {
      // Test-local mutation restored synchronously; no production or file changes.
      defaultSettings.acquiredMoneyMode = 'ANNUAL_ADVANCE';
      const q = history((d) => [cash(), ...(d >= LATER ? [cash('salary', 1000, LATER)] : [])]);
      const ref = runReferenceEngine(q);
      expect(ref.policyApplied.newMoneyMode).toBe('INDEPENDENT_HAWL');
      expect(ref.zakatDue).toBe(275);
      expect(ref.advanceSuggested).toBe(0);
    } finally { defaultSettings.acquiredMoneyMode = original; }
    expect(defaultSettings.acquiredMoneyMode).toBe(original);
  });
});
