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
    expect(report.totalCashZakatDue).toBeCloseTo(
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
  expect(khalid.limitations.join(' ')).toContain('لا يتتبع حول الذهب والأسهم');
});

