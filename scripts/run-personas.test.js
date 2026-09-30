import { expect, test } from 'vitest';
import { comparePersona, personaDays, runPersonas } from './run-personas.js';
const fixture = {
  persona: 'test',
  name: 'اختبار',
  period: { start: '2025-04-01', end: '2025-04-02' },
  accounts: [
    { accountId: 'A' },
    { accountId: 'B' },
    { accountId: 'E', zakatExempt: true },
  ],
  transactions: [
    { accountId: 'A', date: '2025-04-01', amount: 10000, direction: 'credit' },
    { accountId: 'E', date: '2025-04-01', amount: 50000, direction: 'credit' },
    {
      accountId: 'A',
      counterparty: 'B',
      date: '2025-04-02',
      amount: 7000,
      direction: 'debit',
      internal: true,
    },
    {
      accountId: 'B',
      counterparty: 'A',
      date: '2025-04-02',
      amount: 7000,
      direction: 'credit',
      internal: true,
    },
    { accountId: 'A', date: '2025-04-02', amount: 2500, direction: 'debit' },
  ],
  holdings: [],
  manual: [],
};
const prices = {
  '2025-04-01': { gold: 300, silver: 4 },
  '2025-04-02': { gold: 300, silver: 4 },
};
test('internal transfers preserve original lot; exempt balances do not enter cash base', () => {
  const report = comparePersona(fixture, prices);
  expect(report.endSnapshot.cashBalance).toBe(7500);
  expect(report.nextCashDue.expectedZakat).toBe(187.5);
  expect(personaDays(fixture, prices)[1].deposits).toEqual([]);
});
test('missing Ramadan stays unavailable instead of producing zero', () => {
  const report = comparePersona(fixture, prices);
  expect(report.ramadan).toHaveLength(1);
  expect(report.ramadan[0].status).toContain('غير متاح');
  expect(report.ramadan[0].traditionalCash).toBeUndefined();
});
test('missing prices and transfers to exempt accounts fail explicitly', () => {
  expect(() => personaDays(fixture, {})).toThrow('Missing prices');
  const transaction = { ...fixture.transactions[2], counterparty: 'E' };
  expect(() =>
    personaDays({ ...fixture, transactions: [transaction] }, prices),
  ).toThrow('exempt/non-exempt');
});
test('all three personas reconcile cash ledger, recorded events and Ramadan comparison', () => {
  const reports = runPersonas();
  expect(reports.map((report) => report.persona)).toEqual([
    'ahmad',
    'khalid',
    'noura',
  ]);
  expect(reports.map((report) => report.endSnapshot.cashBalance)).toEqual([
    66323, 146486, 44268,
  ]);
  expect(reports.map((report) => report.due.length)).toEqual([7, 4, 0]);
  for (const report of reports) {
    expect(report.totalZakatDue).toBeCloseTo(
      report.due.reduce((sum, event) => sum + event.base / 40, 0),
    );
    const ramadan = report.ramadan.find((row) => row.year === 1447);
    expect(ramadan.date).toBe('2026-02-18');
    expect(ramadan.differenceCash).toBeCloseTo(
      ramadan.traditionalCash - ramadan.namaaCashDueToDate,
    );
  }
  const khalid = reports[1];
  expect(khalid.endSnapshot.otherAssets).toBeCloseTo(92411.83);
  expect(khalid.totalZakatDue).toBeCloseTo(2762.225);
  expect(khalid.due[0].assets).toEqual([
    { id: 'holding:1', kind: 'stocks', value: 36419 },
  ]);
  expect(khalid.nextDue.date).toBe('2026-12-04');
  expect(khalid.nextDue.expectedZakat).toBeCloseTo(1291.54575);
  expect(khalid.limitations.join(' ')).toContain(
    'تاريخ تملك محفظة أسهم غير مسجل',
  );
});

test('manual cash and trading property keep dated independent lots', () => {
  const persona = {
    ...fixture,
    period: { start: '2025-04-01', end: '2026-03-22' },
    accounts: [],
    transactions: [],
    holdings: [],
    manual: [
      { id: 'home-cash', type: 'cash', acquired: '2025-04-01', value: 2000 },
      {
        id: 'land',
        type: 'property',
        acquired: '2025-04-01',
        intent: 'trading',
        marketValue: 18000,
      },
    ],
  };
  const dailyPrices = Object.fromEntries(
    Array.from({ length: 356 }, (_, index) => [
      new Date(Date.UTC(2025, 3, 1) + index * 86400000)
        .toISOString()
        .slice(0, 10),
      { gold: 300, silver: 4 },
    ]),
  );
  const report = comparePersona(persona, dailyPrices);
  expect(report.totalZakatDue).toBe(500);
  expect(report.totalCashZakatDue).toBe(0);
  expect(report.due[0].assets.map((asset) => asset.id)).toEqual([
    'manual:home-cash',
    'manual:land',
  ]);
  expect(report.endSnapshot).toMatchObject({
    cashBalance: 0,
    otherAssets: 20000,
    total: 20000,
  });
});

test('manual data requires a real acquisition date and daily holdings cannot lose missing valuations', () => {
  expect(() =>
    personaDays(
      { ...fixture, manual: [{ type: 'cash', value: 5000 }] },
      prices,
    ),
  ).toThrow('acquisition date');
  expect(() =>
    personaDays(
      {
        ...fixture,
        manual: [{ type: 'cash', acquired: '2025-02-30', value: 5000 }],
      },
      prices,
    ),
  ).toThrow('Invalid date');
  const persona = {
    ...fixture,
    holdings: [
      {
        type: 'stocks',
        intent: 'trading',
        acquired: '2025-04-01',
        values: { '2025-04-01': 15000 },
      },
    ],
  };
  expect(() => comparePersona(persona, prices)).toThrow('stock market value');
});

test('unknown fund value blocks a complete persona result; an explicit zero is accepted', () => {
  const holding = {
    type: 'fund',
    intent: 'long_term',
    acquired: '2025-04-01',
    marketValue: 20000,
  };
  expect(() =>
    comparePersona({ ...fixture, holdings: [holding] }, prices),
  ).toThrow('القيمة الزكوية غير متاحة');
  const report = comparePersona(
    { ...fixture, holdings: [{ ...holding, zakatableValue: 0 }] },
    prices,
  );
  expect(report.endSnapshot.otherAssets).toBe(0);
});

test('gold purchase consumes its recorded cash cost once and contributes current value once', () => {
  const reports = runPersonas();
  const khalid = reports[1];
  expect(khalid.endSnapshot.cashBalance).toBe(146486);
  expect(khalid.endSnapshot.otherAssets).toBeCloseTo(92411.83);
  expect(khalid.endSnapshot.total).toBeCloseTo(238897.83);
  expect(khalid.exemptBalance).toBe(50000);
  expect(
    khalid.due
      .flatMap((event) => event.assets)
      .some((asset) => asset.kind === 'gold'),
  ).toBe(false);
  expect(khalid.nextDue.date).toBe('2026-12-04');
  expect(khalid.nextCashDue.date).toBe('2026-12-25');
});
