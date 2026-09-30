import { describe, expect, test } from 'vitest';
import {
  calculateAssetValue,
  calculateZakatableSnapshot,
  defaultSettings,
  evaluateCropZakat,
  evaluateLivestockZakat,
  evaluatePropertyZakat,
  hijri,
  isHawlComplete,
  MAX_MONETARY_VALUE,
  nisabFor,
  ramadanCalc,
  runEngineDetailed,
  traditionalCalc,
  validateShariaSettings,
} from './engine.js';
const start = new Date('2025-04-01T00:00:00Z');
const next = new Date('2025-04-02T00:00:00Z');
const before = new Date('2026-03-21T00:00:00Z');
const anniversary = new Date('2026-03-22T00:00:00Z');
const after = new Date('2026-03-23T00:00:00Z');
const gold = (fields) => ({
  id: 'gold',
  kind: 'gold',
  acquired: start,
  grams: 100,
  karat: 24,
  pricePerGram: 300,
  ...fields,
});
const events = (input) => runEngineDetailed(input).events;
const cashDay = (date, deposits = [], withdrawals = [], nisab = 5000) => ({
  date,
  deposits,
  withdrawals,
  nisab,
});
const invalid = [-1, NaN, Infinity, '100', null, undefined];

// B01–B11 regressions and independent requirement boundaries.
describe('Final audit: valuation and safe numeric boundaries', () => {
  test.each([undefined, null, -1, NaN, Infinity, '1000'])(
    'B01 rejects missing/invalid trading property value %s',
    (marketValue) => {
      expect(() =>
        evaluatePropertyZakat({ intent: 'TRADING', marketValue }),
      ).toThrow();
      expect(() =>
        calculateAssetValue({
          properties: [{ intent: 'TRADING', marketValue }],
        }),
      ).toThrow();
    },
  );
  test('zero-valued trading property is known zero; own-use and rental property are excluded', () => {
    expect(
      evaluatePropertyZakat({ intent: 'TRADING', marketValue: 0 })
        .zakatablePropertyValue,
    ).toBe(0);
    expect(
      calculateAssetValue({
        properties: [
          { intent: 'USE', marketValue: 999000 },
          { intent: 'RENTAL', marketValue: 888000, rentalIncome: 10000 },
        ],
      }),
    ).toBe(0);
    expect(() =>
      evaluatePropertyZakat({ intent: 'unknown', marketValue: 10000 }),
    ).toThrow();
  });
  test.each(['false', 0, 1, null, {}])(
    'B02 never interprets invalid exemption flag %j as boolean',
    (zakatExempt) => {
      expect(() =>
        calculateAssetValue({
          stocks: [{ type: 'TRADING', marketValue: 20000, zakatExempt }],
        }),
      ).toThrow('boolean');
    },
  );
  test.each(['false', null, 0, 1])(
    'B02 rejects invalid manual zakatable flag %j',
    (zakatable) => {
      expect(() =>
        calculateAssetValue({ manualAssets: [{ value: 10000, zakatable }] }),
      ).toThrow('boolean');
    },
  );
  test.each([0, -1, 25, '21', null, NaN, Infinity])(
    'B03 rejects invalid karat %s',
    (karat) => {
      expect(() =>
        calculateAssetValue({
          gold: [{ grams: 10, karat, pricePerGram: 300 }],
        }),
      ).toThrow();
    },
  );
  test.each([0, -1, 1001, '925', null, NaN, Infinity])(
    'B03 rejects invalid silver fineness %s',
    (purity) => {
      expect(() =>
        calculateAssetValue({
          silver: [{ grams: 100, purity, pricePerGram: 4 }],
        }),
      ).toThrow();
    },
  );
  test.each([
    [24, 3000],
    [22, 2750],
    [21, 2625],
    [18, 2250],
    [14, 1750],
  ])('gold %sk is valued by pure-gold equivalent', (karat, value) => {
    expect(
      calculateAssetValue({ gold: [{ grams: 10, karat, pricePerGram: 300 }] }),
    ).toBeCloseTo(value);
  });
  test.each([
    [999, 399.6],
    [925, 370],
    [800, 320],
  ])('silver fineness %s uses weight and purity', (purity, value) => {
    expect(
      calculateAssetValue({
        silver: [{ grams: 100, purity, pricePerGram: 4 }],
      }),
    ).toBeCloseTo(value);
  });
  test.each(invalid)('rejects invalid required metal grams %s', (grams) => {
    expect(() =>
      calculateAssetValue({ gold: [{ grams, pricePerGram: 300 }] }),
    ).toThrow();
    expect(() =>
      calculateAssetValue({ silver: [{ grams, pricePerGram: 4 }] }),
    ).toThrow();
  });
  test.each(invalid)(
    'rejects invalid required metal price %s',
    (pricePerGram) => {
      expect(() =>
        calculateAssetValue({ gold: [{ grams: 10, pricePerGram }] }),
      ).toThrow();
      expect(() =>
        calculateAssetValue({ silver: [{ grams: 100, pricePerGram }] }),
      ).toThrow();
    },
  );
  test.each(invalid)(
    'rejects invalid trading market value %s',
    (marketValue) => {
      for (const category of ['stocks', 'investmentProducts'])
        expect(() =>
          calculateAssetValue({
            [category]: [{ type: 'TRADING', marketValue }],
          }),
        ).toThrow();
    },
  );
  test.each(invalid)(
    'rejects invalid or unavailable long-term disclosed value %s',
    (zakatableValue) => {
      for (const category of ['stocks', 'investmentProducts'])
        expect(() =>
          calculateAssetValue({
            [category]: [
              { type: 'LONG_TERM', marketValue: 50000, zakatableValue },
            ],
          }),
        ).toThrow();
    },
  );
  test('disclosed zero is distinct from unavailable; mixed exempt/taxable assets reconcile once', () => {
    expect(
      calculateAssetValue({
        stocks: [{ type: 'LONG_TERM', zakatableValue: 0 }],
        investmentProducts: [{ type: 'LONG_TERM', zakatableValue: 0 }],
      }),
    ).toBe(0);
    expect(
      calculateZakatableSnapshot({
        cashBalance: 1000,
        stocks: [
          { type: 'TRADING', marketValue: 2000 },
          { type: 'TRADING', marketValue: 20000, zakatExempt: true },
        ],
        investmentProducts: [
          { type: 'LONG_TERM', zakatableValue: 3000 },
          { type: 'TRADING', marketValue: 9000, zakatExempt: true },
        ],
        properties: [
          { intent: 'TRADING', marketValue: 4000 },
          { intent: 'USE', marketValue: 70000 },
        ],
        manualAssets: [{ value: 5000, zakatable: false }],
      }),
    ).toEqual({ cashBalance: 1000, otherAssets: 9000, total: 10000 });
  });
  test('B05 rejects multiplication, sum overflow and values outside precision contract', () => {
    expect(() =>
      calculateAssetValue({ gold: [{ grams: 1e308, pricePerGram: 1e308 }] }),
    ).toThrow();
    expect(() =>
      calculateZakatableSnapshot({
        cashBalance: MAX_MONETARY_VALUE,
        stocks: [{ type: 'TRADING', marketValue: 1 }],
      }),
    ).toThrow('range');
    expect(() =>
      runEngineDetailed([
        cashDay(start, [MAX_MONETARY_VALUE, MAX_MONETARY_VALUE]),
      ]),
    ).toThrow('range');
    expect(() => runEngineDetailed([cashDay(start, [1e308])])).toThrow('range');
    expect(traditionalCalc(1e10, 5000)).toBe(250000000);
  });
  test('B05 rejects sub-cent flows instead of silently losing money', () => {
    expect(() =>
      runEngineDetailed([cashDay(start, [0.001], [0.001], 1)]),
    ).toThrow('two decimal');
    expect(() => runEngineDetailed([cashDay(start, [1], [0.001], 1)])).toThrow(
      'two decimal',
    );
    expect(
      runEngineDetailed([cashDay(start, [0.1, 0.2], [0.3], 1)]).lots,
    ).toEqual([]);
  });
  test('B06 duplicate static asset identities/references cannot double the base', () => {
    const property = { id: 'same', intent: 'TRADING', marketValue: 10000 };
    expect(() =>
      calculateAssetValue({ properties: [property, { ...property }] }),
    ).toThrow('duplicate');
    expect(() =>
      calculateAssetValue({ properties: [property, property] }),
    ).toThrow('duplicate');
  });
  test.each([null, [], 'data', 3])(
    'malformed top-level value data %j is rejected',
    (data) => {
      expect(() => calculateZakatableSnapshot(data)).toThrow();
    },
  );
  test.each([{}, null, 2, 'array'])(
    'malformed asset array %j is rejected',
    (gold) => {
      expect(() => calculateAssetValue({ gold })).toThrow('array');
    },
  );
});

describe('Final audit: settings and non-monetary scope', () => {
  test.each([
    'nisabBasis',
    'spendOrder',
    'jewelryTreatment',
    'stockTreatment',
    'fundTreatment',
    'propertyTreatment',
    'acquiredMoneyMode',
  ])('B04 rejects invalid enum in %s', (field) => {
    for (const value of ['TYPO', null, 0, false, undefined])
      expect(() =>
        validateShariaSettings({ ...defaultSettings, [field]: value }),
      ).toThrow();
  });
  test.each([null, [], 'settings', 2, {}])(
    'B04 rejects malformed settings %j',
    (settings) => {
      expect(() => runEngineDetailed([], settings)).toThrow();
    },
  );
  test('B04 extra ignored rules and invalid standalone nisab settings fail explicitly', () => {
    expect(() =>
      validateShariaSettings({ ...defaultSettings, calendar: 'GREGORIAN' }),
    ).toThrow('unsupported setting');
    expect(() =>
      nisabFor(
        { gold: 300, silver: 4 },
        { ...defaultSettings, nisabBasis: 'TYPO' },
      ),
    ).toThrow();
    expect(() =>
      nisabFor(
        { gold: 300, silver: 4 },
        { ...defaultSettings, silverGrams: NaN },
      ),
    ).toThrow();
    for (const value of [0, -1, NaN, Infinity, '300', null, undefined])
      expect(() => nisabFor({ gold: value, silver: 4 })).toThrow();
    expect(() => runEngineDetailed([cashDay(start, [], [], 0)])).toThrow(
      'positive',
    );
    expect(() =>
      validateShariaSettings({ ...defaultSettings, deductDebts: true }),
    ).toThrow();
  });
  test('B10 livestock keys must be declared and counts must be integral', () => {
    for (const type of [
      'toString',
      '__proto__',
      'constructor',
      undefined,
      null,
    ])
      expect(() => evaluateLivestockZakat({ type, count: 40 })).toThrow();
    for (const count of [-1, 30.5, NaN, Infinity, '30'])
      expect(() => evaluateLivestockZakat({ type: 'cattle', count })).toThrow();
    for (const [type, count] of [
      ['camels', 5],
      ['cattle', 30],
      ['sheep', 40],
    ]) {
      expect(evaluateLivestockZakat({ type, count }).eligible).toBe(true);
      expect(evaluateLivestockZakat({ type, count: count - 1 }).eligible).toBe(
        false,
      );
    }
    expect(evaluateCropZakat({ kg: 611 }).eligible).toBe(false);
    expect(evaluateCropZakat({ kg: 612 })).toMatchObject({
      eligible: true,
      requiresHawl: false,
      dueAtHarvest: true,
    });
  });
});

describe('Final audit: calendar, lot integrity, events and invariants', () => {
  test('empty dataset and zero wealth produce no payable obligation', () => {
    expect(runEngineDetailed([])).toEqual({
      events: [],
      series: [],
      lots: [],
      nextDue: null,
    });
    expect(events([cashDay(start, [0])])).toEqual([]);
  });
  test.each([
    [4999, false],
    [5000, true],
    [5001, true],
  ])('nisab boundary %s', (amount, eligible) => {
    expect(runEngineDetailed([cashDay(start, [amount])]).series[0].above).toBe(
      eligible,
    );
  });
  test('multiple crossings and same-day flows are calculated after all daily flows', () => {
    const input = [
      cashDay(start, [5000]),
      cashDay(next, [], [1]),
      cashDay(new Date('2025-04-03'), [2]),
      cashDay(new Date('2025-04-04'), [], [2]),
      cashDay(new Date('2025-04-05'), [1]),
    ];
    expect(events(input).map((event) => event.type)).toEqual([
      'START',
      'BREAK',
      'START',
      'BREAK',
      'START',
    ]);
    expect(events([cashDay(start, [10000], [6000])])).toEqual([]);
  });
  test('one day before/exact/after hawl emits one obligation using due-day price', () => {
    const result = runEngineDetailed([
      { date: start, nisab: 5000, assets: [gold()] },
      { date: before, nisab: 5000, assets: [gold({ pricePerGram: 350 })] },
      { date: anniversary, nisab: 5000, assets: [gold({ pricePerGram: 400 })] },
      { date: after, nisab: 5000, assets: [gold({ pricePerGram: 450 })] },
    ]);
    const due = result.events.filter((event) => event.type === 'DUE');
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({
      date: anniversary,
      base: 40000,
      zakat: 1000,
    });
    expect(result.assetLots[0].depositDate).toEqual(start);
    expect(result.assetLots[0].quantity).toBe(100);
    expect(isHawlComplete(start, before)).toBe(false);
    expect(isHawlComplete(start, anniversary)).toBe(true);
    expect(isHawlComplete(start, after)).toBe(true);
  });
  test('B07 supplied quantity cannot disappear then bypass addition protection', () => {
    const asset = {
      id: 'share',
      kind: 'stocks',
      acquired: start,
      type: 'TRADING',
      quantity: 10,
      marketValue: 10000,
    };
    const { quantity, ...missing } = asset;
    expect(quantity).toBe(10);
    expect(() =>
      runEngineDetailed([
        { date: start, nisab: 5000, assets: [asset] },
        { date: next, nisab: 5000, assets: [missing] },
      ]),
    ).toThrow('characteristics');
  });
  test('B07 purity or investment treatment cannot be replaced within an older lot', () => {
    expect(() =>
      runEngineDetailed([
        { date: start, nisab: 5000, assets: [gold({ karat: 18 })] },
        { date: next, nisab: 5000, assets: [gold()] },
      ]),
    ).toThrow('characteristics');
    const asset = {
      id: 'share',
      kind: 'stocks',
      acquired: start,
      type: 'TRADING',
      marketValue: 10000,
    };
    expect(() =>
      runEngineDetailed([
        { date: start, nisab: 5000, assets: [asset] },
        {
          date: next,
          nisab: 5000,
          assets: [{ ...asset, type: 'LONG_TERM', zakatableValue: 5000 }],
        },
      ]),
    ).toThrow('characteristics');
  });
  test('B08 UTC midnight is required; duplicate daily observations are rejected', () => {
    expect(() =>
      runEngineDetailed([
        cashDay(start, [10000]),
        cashDay(new Date('2025-04-01T12:00:00Z')),
      ]),
    ).toThrow('UTC midnight');
    expect(() =>
      runEngineDetailed([cashDay(start, [10000]), cashDay(start)]),
    ).toThrow('increasing');
    expect(() =>
      runEngineDetailed([
        {
          date: start,
          nisab: 5000,
          assets: [gold({ acquired: new Date('2025-04-01T12:00:00Z') })],
        },
      ]),
    ).toThrow('UTC midnight');
    expect(hijri(new Date('2025-04-01T00:00:00Z'))).toEqual([1446, 10, 3]);
  });
  test('B09 zero-valued old lot does not emit a fictional DUE or hide a newer positive nextDue', () => {
    const zero = {
      id: 'zero',
      kind: 'stocks',
      acquired: start,
      type: 'TRADING',
      marketValue: 0,
    };
    const newer = { id: 'new', kind: 'cash', acquired: next, value: 6000 };
    const result = runEngineDetailed([
      { ...cashDay(start, [10000]), assets: [zero] },
      { ...cashDay(next, [], [10000]), assets: [zero, newer] },
      { date: anniversary, nisab: 5000, assets: [zero, newer] },
    ]);
    expect(result.events.filter((event) => event.type === 'DUE')).toEqual([]);
    expect(result.nextDue).toMatchObject({ dueDate: after, zakat: 150 });
  });
  test('multiple assets on the same day enter the base once; order does not change the result', () => {
    const asset = { id: 'cash', kind: 'cash', acquired: start, value: 5000 };
    const build = (assets) => [
      { date: start, nisab: 5000, assets },
      { date: anniversary, nisab: 5000, assets },
    ];
    for (const inventory of [
      [gold(), asset],
      [asset, gold()],
    ])
      expect(events(build(inventory)).at(-1)).toMatchObject({
        base: 35000,
        zakat: 875,
      });
  });
  test('inputs are immutable and repeated execution deterministic; text matches actual numbers', () => {
    const input = [
      cashDay(start, [10000]),
      cashDay(next, [], [6000]),
      cashDay(new Date('2025-04-03'), [2000]),
    ];
    for (const row of input) {
      Object.freeze(row.deposits);
      Object.freeze(row.withdrawals);
      Object.freeze(row);
    }
    Object.freeze(input);
    const first = runEngineDetailed(input),
      second = runEngineDetailed(input);
    expect(second).toEqual(first);
    expect(first.events.map((event) => event.type)).toEqual([
      'START',
      'BREAK',
      'START',
    ]);
    const money = new Intl.NumberFormat('ar-SA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    for (let i = 0; i < first.events.length; i++) {
      const event = first.events[i];
      expect(event.explanation).toContain(money.format(first.series[i].total));
      expect(event.explanation).not.toMatch(
        /undefined|NaN|null|\[object Object\]/,
      );
      expect(event.explanation).toContain(money.format(5000));
      if (event.type === 'BREAK')
        expect(event.explanation).toContain('فانقطع الحول');
      else expect(event.explanation).not.toContain('فانقطع الحول');
    }
  });
  test('missing Ramadan is explicit and does not create a fake zero comparison', () => {
    expect(() =>
      ramadanCalc([{ date: start, total: 10000, nisab: 5000 }], 1447),
    ).toThrow('not present');
  });
  test('seeded flow invariants agree with an integer-cent ledger under FIFO and LIFO', () => {
    for (const spendOrder of ['FIFO', 'LIFO']) {
      let balance = 0,
        seed = 173;
      const input = [];
      for (let day = 0; day < 120; day++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const deposit = seed % 70000;
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const withdrawal = Math.min(balance + deposit, seed % 50000);
        balance += deposit - withdrawal;
        input.push(
          cashDay(
            new Date(start.getTime() + day * 86400000),
            [deposit / 100],
            [withdrawal / 100],
            100,
          ),
        );
      }
      const result = runEngineDetailed(input, {
        ...defaultSettings,
        spendOrder,
      });
      expect(result.series.at(-1).total).toBeCloseTo(balance / 100, 7);
      expect(
        result.series.every(
          (row) => Number.isFinite(row.total) && row.total >= 0,
        ),
      ).toBe(true);
      expect(
        result.events.every(
          (event, index) =>
            index === 0 || event.date >= result.events[index - 1].date,
        ),
      ).toBe(true);
      expect(
        result.events
          .filter((event) => event.type === 'DUE')
          .every((event) => event.zakat > 0 && Number.isFinite(event.base)),
      ).toBe(true);
    }
  });
});
