import { auditPersonas } from './audit-personas.js';
import { expect, test } from 'vitest';
import { comparePersona, personaDays } from './run-personas.js';
const prices = { '2025-04-01': { gold: 300, silver: 4 } };
const base = {
  persona: 'audit',
  name: 'تدقيق',
  period: { start: '2025-04-01', end: '2025-04-01' },
  accounts: [],
  transactions: [],
  holdings: [],
  manual: [],
};
const property = {
  id: 'same',
  type: 'property',
  acquired: '2025-04-01',
  intent: 'trading',
  marketValue: 10000,
};
test('B06 same asset across bank/manual sources cannot count twice', () => {
  expect(() =>
    comparePersona(
      { ...base, holdings: [property], manual: [{ ...property }] },
      prices,
    ),
  ).toThrow('across sources');
});
test('B06 ambiguous duplicate holdings without IDs require distinct lot identities', () => {
  const { id, ...record } = property;
  expect(id).toBe('same');
  expect(() =>
    personaDays({ ...base, holdings: [record, { ...record }] }, prices),
  ).toThrow('duplicate asset record');
  const report = comparePersona(
    {
      ...base,
      holdings: [
        { ...record, id: 'purchase-1' },
        { ...record, id: 'purchase-2' },
      ],
    },
    prices,
  );
  expect(report.endSnapshot.total).toBe(20000);
});
test('B06 duplicate account and transaction identities are rejected', () => {
  const account = { accountId: 'A' };
  expect(() =>
    personaDays({ ...base, accounts: [account, { ...account }] }, prices),
  ).toThrow('account id');
  const tx = {
    accountId: 'A',
    date: '2025-04-01',
    direction: 'credit',
    amount: 10000,
  };
  expect(() =>
    personaDays(
      { ...base, accounts: [account], transactions: [tx, { ...tx }] },
      prices,
    ),
  ).toThrow('duplicate transaction');
  expect(() =>
    personaDays(
      {
        ...base,
        accounts: [account],
        transactions: [
          { ...tx, id: 'same' },
          { ...tx, id: 'same' },
        ],
      },
      prices,
    ),
  ).toThrow('transaction id');
});
test('B06 incomplete internal transfers are rejected instead of silently ignored', () => {
  expect(() =>
    personaDays(
      {
        ...base,
        accounts: [{ accountId: 'A' }, { accountId: 'B' }],
        transactions: [
          {
            accountId: 'A',
            counterparty: 'B',
            date: '2025-04-01',
            amount: 1000,
            direction: 'debit',
            internal: true,
          },
        ],
      },
      prices,
    ),
  ).toThrow('matching credit and debit');
});
test('B11 missing optional arrays normalize safely without mutating caller', () => {
  const persona = {
    name: base.name,
    persona: base.persona,
    period: base.period,
  };
  const report = comparePersona(persona, prices);
  expect(report.endSnapshot.total).toBe(0);
  expect(report.nextDue).toBeNull();
  expect(persona).not.toHaveProperty('accounts');
});
test.each([null, {}, 'array', 5])(
  'B11 malformed optional arrays %j are rejected',
  (holdings) => {
    expect(() => personaDays({ ...base, holdings }, prices)).toThrow('array');
  },
);
test.each([
  { start: '2025-04-02', end: '2025-04-01' },
  { start: '2025-02-30', end: '2025-04-01' },
  {},
  null,
])('B11 invalid or inverted period %j is rejected', (period) => {
  expect(() => personaDays({ ...base, period }, prices)).toThrow();
});
test.each([-1, NaN, Infinity, '1000', undefined, 0.001])(
  'B11 invalid excluded transaction %s cannot corrupt displayed reconciliation',
  (amount) => {
    expect(() =>
      comparePersona(
        {
          ...base,
          accounts: [{ accountId: 'E', zakatExempt: true }],
          transactions: [
            { accountId: 'E', date: '2025-04-01', direction: 'credit', amount },
          ],
        },
        prices,
      ),
    ).toThrow();
  },
);
test('B02 invalid account flags and transaction booleans are rejected before exclusion', () => {
  expect(() =>
    personaDays(
      { ...base, accounts: [{ accountId: 'A', zakatExempt: 'false' }] },
      prices,
    ),
  ).toThrow('boolean');
  expect(() =>
    personaDays(
      {
        ...base,
        accounts: [{ accountId: 'A' }],
        transactions: [
          {
            accountId: 'A',
            date: '2025-04-01',
            direction: 'credit',
            amount: 10000,
            internal: 'false',
          },
        ],
      },
      prices,
    ),
  ).toThrow('boolean');
});
test('manual zakatable:false is excluded without requiring hawl dates for an exempt asset', () => {
  expect(
    comparePersona(
      { ...base, manual: [{ type: 'cash', value: 10000, zakatable: false }] },
      prices,
    ).endSnapshot.total,
  ).toBe(0);
});
test('missing daily prices fail; repeated declared stale/fixed prices remain deterministic and explicit', () => {
  expect(() => personaDays(base, {})).toThrow('Missing prices');
  const persona = {
    ...base,
    period: { start: '2025-04-01', end: '2025-04-02' },
    holdings: [{ type: 'gold', acquired: '2025-04-01', grams: 100, karat: 24 }],
  };
  const carried = { ...prices, '2025-04-02': prices['2025-04-01'] };
  const first = comparePersona(persona, carried),
    second = comparePersona(persona, carried);
  expect(first).toEqual(second);
  expect(first.endSnapshot.otherAssets).toBe(30000);
});
test('invalid acquisition date, unknown type and unsupported currency fail explicitly', () => {
  expect(() =>
    personaDays(
      { ...base, holdings: [{ ...property, acquired: '2025-02-30' }] },
      prices,
    ),
  ).toThrow('Invalid date');
  expect(() =>
    personaDays({ ...base, holdings: [{ ...property, type: 'gems' }] }, prices),
  ).toThrow('Unsupported holding');
  expect(() =>
    personaDays(
      { ...base, accounts: [{ accountId: 'A', currency: 'USD' }] },
      prices,
    ),
  ).toThrow('SAR');
});

test('all 1653 persona days, every event, Ramadan and future due match an independent integer ledger', () => {
  const audit = auditPersonas();
  expect(audit.personas.map((row) => row.daysVerified)).toEqual([
    551, 551, 551,
  ]);
  expect(audit.personas.map((row) => row.ledger.expectedCash)).toEqual([
    66323, 146486, 44268,
  ]);
  expect(audit.carriedPastRaw).toBe(7);
});
