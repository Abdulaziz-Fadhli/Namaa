import { describe, expect, test } from 'vitest';
import {
  calculateAssetValue,
  calculateZakatableSnapshot,
  defaultSettings,
  hijri,
  IncompleteAssetDataError,
  runEngineDetailed,
  validateShariaSettings,
} from './engine.js';
const start = new Date('2025-04-01T00:00:00Z');
const dueDate = new Date('2026-03-22T00:00:00Z');
const DAY = 86400000;
function daysUntil(end, assetsAt, transactions = {}, nisabAt = () => 5000) {
  const days = [];
  for (let t = start.getTime(); t <= end.getTime(); t += DAY) {
    const date = new Date(t);
    const key = date.toISOString().slice(0, 10);
    days.push({
      date,
      nisab: nisabAt(date),
      assets: assetsAt(date),
      ...transactions[key],
    });
  }
  return days;
}
const gold = (overrides) => ({
  id: 'gold-lot',
  kind: 'gold',
  acquired: start,
  grams: 100,
  karat: 24,
  pricePerGram: 300,
  ...overrides,
});
const due = (result) => result.events.filter((event) => event.type === 'DUE');

describe('Dated asset hawl', () => {
  test('gold is revalued at maturity without turning price changes into deposits', () => {
    const result = runEngineDetailed(
      daysUntil(dueDate, (date) => [
        gold({ pricePerGram: date >= dueDate ? 400 : 300 }),
      ]),
    );
    expect(due(result)).toHaveLength(1);
    expect(due(result)[0]).toMatchObject({
      date: dueDate,
      base: 40000,
      zakat: 1000,
      cashBase: 0,
      otherAssetsBase: 40000,
    });
    expect(result.lots).toEqual([]);
    expect(result.assetLots).toHaveLength(1);
    expect(result.assetLots[0].depositDate).toEqual(start);
    expect(result.assetLots[0].start).toEqual(dueDate);
    expect(result.series.at(-1)).toMatchObject({
      total: 40000,
      cashBalance: 0,
      otherAssets: 40000,
    });
  });
  test.each([
    ['silver', { grams: 2000, purity: 925, pricePerGram: 4 }, 7400],
    ['stocks', { type: 'TRADING', marketValue: 18000 }, 18000],
    [
      'stocks',
      { type: 'LONG_TERM', marketValue: 90000, zakatableValue: 7000 },
      7000,
    ],
    ['investmentProducts', { type: 'TRADING', marketValue: 24000 }, 24000],
    ['investmentProducts', { type: 'LONG_TERM', zakatableValue: 8000 }, 8000],
    ['properties', { intent: 'TRADING', marketValue: 120000 }, 120000],
    ['cash', { value: 11000 }, 11000],
  ])(
    '%s asset participates with its approved zakatable value',
    (kind, fields, base) => {
      const result = runEngineDetailed(
        daysUntil(dueDate, () => [
          { id: 'asset', kind, acquired: start, ...fields },
        ]),
      );
      expect(due(result)).toHaveLength(1);
      expect(due(result)[0].base).toBe(base);
      expect(due(result)[0].zakat).toBe(base / 40);
    },
  );
  test('combined assets reach nisab before bank cash alone; bank spending does not consume gold', () => {
    const result = runEngineDetailed(
      daysUntil(dueDate, () => [gold({ grams: 10 })], {
        '2025-04-01': { deposits: [4000] },
        '2025-04-02': { withdrawals: [1000] },
      }),
    );
    expect(result.events[0]).toMatchObject({ type: 'START', date: start });
    expect(due(result)[0]).toMatchObject({
      base: 6000,
      zakat: 150,
      cashBase: 3000,
      otherAssetsBase: 3000,
    });
    expect(() =>
      runEngineDetailed([
        { date: start, nisab: 5000, assets: [gold()], withdrawals: [1] },
      ]),
    ).toThrow('exceeds available balance');
  });
  test('assets acquired after the first lot mature independently', () => {
    const acquired = new Date('2025-10-01T00:00:00Z');
    const result = runEngineDetailed(
      daysUntil(dueDate, (date) => [
        gold(),
        ...(date >= acquired
          ? [{ id: 'new', kind: 'cash', acquired, value: 4000 }]
          : []),
      ]),
    );
    expect(due(result)[0].base).toBe(30000);
    expect(result.nextDue.start).toEqual(acquired);
    expect(result.nextDue.zakat).toBe(100);
  });
  test('annual advance includes newer assets and resets their next hawl', () => {
    const acquired = new Date('2025-10-01T00:00:00Z');
    const result = runEngineDetailed(
      daysUntil(dueDate, (date) => [
        gold(),
        ...(date >= acquired
          ? [{ id: 'new', kind: 'cash', acquired, value: 4000 }]
          : []),
      ]),
      { ...defaultSettings, acquiredMoneyMode: 'ANNUAL_ADVANCE' },
    );
    expect(due(result)[0].base).toBe(34000);
    expect(due(result)[0].zakat).toBe(850);
    expect(
      result.assetLots.every(
        (lot) => lot.start.getTime() === dueDate.getTime(),
      ),
    ).toBe(true);
    expect(due(result)[0].explanation).toContain('تعجيل');
  });
  test('price-driven break restarts asset hawls without losing acquisition date', () => {
    const dip = new Date('2025-05-01T00:00:00Z');
    const restart = new Date('2025-06-01T00:00:00Z');
    const result = runEngineDetailed(
      daysUntil(dueDate, (date) => [
        gold({ pricePerGram: date >= dip && date < restart ? 40 : 300 }),
      ]),
    );
    expect(result.events.map((event) => event.type)).toEqual([
      'START',
      'BREAK',
      'START',
    ]);
    expect(result.assetLots[0].depositDate).toEqual(start);
    expect(result.assetLots[0].start).toEqual(restart);
    expect(result.nextDue.zakat).toBe(750);
  });
  test('below-nisab purchase starts only when combined value reaches nisab', () => {
    const crossing = new Date('2025-05-01T00:00:00Z');
    const result = runEngineDetailed(
      daysUntil(crossing, (date) => [
        gold({ grams: 10, pricePerGram: date >= crossing ? 600 : 300 }),
      ]),
    );
    expect(result.events).toHaveLength(1);
    expect(result.events[0].date).toEqual(crossing);
    expect(result.assetLots[0].depositDate).toEqual(start);
    expect(result.assetLots[0].start).toEqual(crossing);
  });
  test('sold asset disappears; sale proceeds must be an explicit cash deposit', () => {
    const sale = new Date('2025-05-01T00:00:00Z');
    const result = runEngineDetailed(
      daysUntil(dueDate, (date) => (date < sale ? [gold()] : []), {
        '2025-05-01': { deposits: [35000] },
      }),
    );
    expect(due(result)).toHaveLength(0);
    expect(result.assetLots).toEqual([]);
    expect(result.lots[0].depositDate).toEqual(sale);
    expect(result.series.at(-1).total).toBe(35000);
  });
  test('opening assets with earlier acquisition do not invent historical hawl coverage', () => {
    const originalDate = new Date('2024-01-01T00:00:00Z');
    const result = runEngineDetailed([
      { date: start, nisab: 5000, assets: [gold({ acquired: originalDate })] },
    ]);
    expect(due(result)).toHaveLength(0);
    expect(result.assetLots[0]).toMatchObject({
      depositDate: originalDate,
      start,
      observedDate: start,
    });
  });
  test('month-end asset anniversary is resolved using Umm al-Qura', () => {
    let day30, lastDay;
    for (let t = Date.UTC(2024, 7, 1); t <= Date.UTC(2025, 8, 1); t += DAY) {
      const date = new Date(t);
      const [y, m, d] = hijri(date);
      if (y === 1446 && m === 2 && d === 30) day30 = date;
      if (y === 1447 && m === 2 && d === 29) lastDay = date;
    }
    const result = runEngineDetailed([
      { date: day30, nisab: 5000, assets: [gold({ acquired: day30 })] },
    ]);
    expect(result.nextDue.dueDate).toEqual(lastDay);
  });
  test.each([
    gold({ purpose: 'PERSONAL_USE' }),
    gold({ zakatExempt: true }),
    {
      id: 'home',
      kind: 'properties',
      acquired: start,
      intent: 'USE',
      marketValue: 500000,
    },
    {
      id: 'rental',
      kind: 'properties',
      acquired: start,
      intent: 'RENTAL',
      marketValue: 500000,
      rentalIncome: 20000,
    },
  ])('exempt asset does not create monetary hawl: $id', (asset) => {
    const result = runEngineDetailed(daysUntil(dueDate, () => [asset]));
    expect(result.events).toEqual([]);
    expect(result.series.at(-1).total).toBe(0);
  });
});

describe('Incomplete and invalid inputs', () => {
  test.each(['stocks', 'investmentProducts'])(
    'unknown long-term %s cannot silently become zero/exempt',
    (kind) => {
      const asset = { type: 'LONG_TERM', marketValue: 20000 };
      expect(() => calculateAssetValue({ [kind]: [asset] })).toThrow(
        IncompleteAssetDataError,
      );
      expect(() => calculateZakatableSnapshot({ [kind]: [asset] })).toThrow(
        'القيمة الزكوية غير متاحة',
      );
      expect(() =>
        runEngineDetailed([
          {
            date: start,
            nisab: 5000,
            assets: [{ ...asset, kind, id: 'unknown', acquired: start }],
          },
        ]),
      ).toThrow(IncompleteAssetDataError);
      expect(
        calculateAssetValue({ [kind]: [{ ...asset, zakatExempt: true }] }),
      ).toBe(0);
      expect(
        calculateAssetValue({ [kind]: [{ ...asset, zakatableValue: 0 }] }),
      ).toBe(0);
    },
  );
  test.each([
    { goldGrams: -1 },
    { goldGrams: NaN },
    { goldGrams: Infinity },
    { goldGrams: undefined },
    { silverGrams: -1 },
    { silverGrams: NaN },
    { silverGrams: Infinity },
    { silverGrams: 600 },
  ])('rejects unsupported nisab weights %j', (patch) => {
    expect(() =>
      validateShariaSettings({ ...defaultSettings, ...patch }),
    ).toThrow('approved nisab weights');
  });
  test('complete inventories, stable IDs and ordered dates are required', () => {
    expect(() =>
      runEngineDetailed([
        { date: start, nisab: 5000, assets: [gold(), gold()] },
      ]),
    ).toThrow('duplicate asset');
    expect(() =>
      runEngineDetailed([
        { date: start, nisab: 5000, assets: [gold()] },
        { date: dueDate, nisab: 5000 },
      ]),
    ).toThrow('complete daily array');
    expect(() =>
      runEngineDetailed([
        { date: start, nisab: 5000, assets: [gold()] },
        { date: dueDate, nisab: 5000, assets: [gold({ acquired: dueDate })] },
      ]),
    ).toThrow('identity');
    expect(() =>
      runEngineDetailed([
        { date: dueDate, nisab: 5000 },
        { date: start, nisab: 5000 },
      ]),
    ).toThrow('increasing');
    expect(() =>
      runEngineDetailed([
        { date: start, nisab: 5000, assets: [gold({ acquired: null })] },
      ]),
    ).toThrow('acquisition date');
    expect(() =>
      runEngineDetailed([
        {
          date: start,
          nisab: 5000,
          assets: [{ id: 'crop', kind: 'crops', acquired: start, kg: 1000 }],
        },
      ]),
    ).toThrow('unsupported asset kind');
  });
  test('nisab rising with unchanged cash does not claim balance decreased', () => {
    const result = runEngineDetailed([
      { date: start, nisab: 5000, deposits: [6000] },
      { date: new Date('2025-04-02'), nisab: 7000 },
    ]);
    expect(result.events[1].type).toBe('BREAK');
    expect(result.events[1].explanation).toContain('دون النصاب');
    expect(result.events[1].explanation).not.toContain('انخفض الرصيد');
  });
});

test('extra gold purchases and manual cash additions cannot inherit the older lot hawl', () => {
  const next = new Date('2025-04-02T00:00:00Z');
  expect(() =>
    runEngineDetailed([
      { date: start, nisab: 5000, assets: [gold()] },
      { date: next, nisab: 5000, assets: [gold({ grams: 110 })] },
    ]),
  ).toThrow('new lot id');
  const cash = { id: 'cash', kind: 'cash', acquired: start, value: 10000 };
  expect(() =>
    runEngineDetailed([
      { date: start, nisab: 5000, assets: [cash] },
      { date: next, nisab: 5000, assets: [{ ...cash, value: 11000 }] },
    ]),
  ).toThrow('new lot id');
  const result = runEngineDetailed([
    { date: start, nisab: 5000, assets: [gold()] },
    { date: next, nisab: 5000, assets: [gold({ grams: 90 })] },
  ]);
  expect(result.assetLots[0].start).toEqual(start);
  expect(result.assetLots[0].amount).toBe(27000);
});
