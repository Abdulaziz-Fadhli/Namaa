import { expect, test } from 'vitest';
import {
  classifyReferenceAsset,
  runReferenceEngine,
  validateReferencePolicy,
} from './reference-policy.js';
import { calculateAssetValue } from './engine.js';
const first = '2025-04-01',
  due = '2026-03-22',
  DAY = 86400000;
const quote = { gold: 300, silver: 4 };
const cash = (id = 'cash', value = 10000, acquired = first) => ({
  id,
  kind: 'CASH',
  value,
  acquired,
});
const goods = (value = 10000) => ({
  id: 'shop',
  kind: 'TRADE_GOODS',
  value,
  intent: 'TRADING',
  acquired: first,
});
function request(assetForDay = () => [cash()], end = first, policy = {}) {
  const days = [],
    prices = {};
  for (let t = Date.parse(first); t <= Date.parse(end); t += DAY) {
    const date = new Date(t).toISOString().slice(0, 10);
    days.push({ date, assets: assetForDay(date) });
    prices[date] = { ...quote };
  }
  return { days, prices, asOfDate: end, shariaPolicy: policy };
}
test('PDF p12/15 exact standalone gold boundaries do not use the cheaper silver nisab', () => {
  for (const grams of [84.999, 85, 85.001]) {
    const r = runReferenceEngine(
      request(
        () => [
          {
            id: 'g',
            kind: 'GOLD',
            grams,
            karat: 24,
            purpose: 'INVESTMENT',
            acquired: first,
          },
        ],
        due,
      ),
    );
    expect(r.nisab.appliedValue).toBe(25500);
    expect(r.zakatDue).toBeCloseTo(grams < 85 ? 0 : (grams * 300) / 40, 7);
  }
});
test('PDF p12/15 standalone silver exact boundaries', () => {
  for (const grams of [594.999, 595, 595.001]) {
    const r = runReferenceEngine(
      request(
        () => [
          {
            id: 's',
            kind: 'SILVER',
            grams,
            purity: 1000,
            purpose: 'INVESTMENT',
            acquired: first,
          },
        ],
        due,
      ),
    );
    expect(r.zakatDue).toBeCloseTo(grams < 595 ? 0 : (grams * 4) / 40, 7);
  }
});
test.each([0, 2379.99, 2380, 2380.01])('PDF p18 cash boundary %s', (value) => {
  const r = runReferenceEngine(request(() => [cash('cash', value)], due));
  expect(r.zakatDue).toBe(value >= 2380 ? value / 40 : 0);
});
test('PDF p18/21 combined cash/trade wealth reaches nisab once', () => {
  const r = runReferenceEngine(
    request(() => [cash('cash', 2000), { ...goods(380) }], due),
  );
  expect(r.zakatableWealth).toBe(2380);
  expect(r.zakatDue).toBe(59.5);
});
test.each(['GOLD', 'SILVER'])(
  'PDF p16 use and lending jewelry excluded for %s',
  (kind) => {
    for (const purpose of ['PERSONAL_USE', 'LENDING']) {
      const a = {
        id: 'metal',
        kind,
        acquired: first,
        purpose,
        grams: 1000,
        ...(kind === 'GOLD' ? { karat: 24 } : { purity: 1000 }),
      };
      const r = runReferenceEngine(request(() => [a], due));
      expect(r.zakatableWealth).toBe(0);
      expect(r.zakatDue).toBe(0);
      expect(r.assetBreakdown[0].included).toBe(false);
    }
  },
);
test.each(['SALE', 'TRADING', 'SAVED_FOR_SALE', 'RENTAL', 'INVESTMENT'])(
  'PDF p16 other gold purpose %s remains eligible',
  (purpose) => {
    const a = {
      id: 'metal',
      kind: 'GOLD',
      acquired: first,
      purpose,
      grams: 100,
      karat: 21,
    };
    const r = runReferenceEngine(request(() => [a], due));
    expect(r.zakatableWealth).toBe(26250);
    expect(r.zakatDue).toBe(656.25);
  },
);
test('S01 legacy metal valuation also excludes lending and personal silver', () => {
  expect(
    calculateAssetValue({
      gold: [{ grams: 100, pricePerGram: 300, purpose: 'LENDING' }],
      silver: [{ grams: 1000, pricePerGram: 4, purpose: 'PERSONAL_USE' }],
    }),
  ).toBe(0);
});
test('PDF p15/22 due-day repricing preserves ownership', () => {
  const q = request(
    () => [
      {
        id: 'g',
        kind: 'GOLD',
        grams: 100,
        karat: 24,
        purpose: 'INVESTMENT',
        acquired: first,
      },
    ],
    due,
  );
  q.prices[due].gold = 400;
  const r = runReferenceEngine(q);
  expect(r.zakatDue).toBe(1000);
  expect(r.assetBreakdown[0].acquired).toBe(first);
});
test('PDF p14/19 salaries remain independent; annual advance is separately labelled without pretending payment', () => {
  const later = '2025-05-01';
  const input = request(
    (d) => [cash(), ...(d >= later ? [cash('salary', 1000, later)] : [])],
    due,
    { newMoneyMode: 'ANNUAL_ADVANCE' },
  );
  const r = runReferenceEngine(input);
  expect(r.zakatDue).toBe(250);
  expect(r.advanceSuggested).toBe(25);
  expect(r.events.at(-1).base).toBe(10000);
  expect(r.paymentRecorded).toBe(false);
  expect(r.assetBreakdown.find((a) => a.id === 'salary').hawlStart).toBe(later);
  const precise = runReferenceEngine({
    ...input,
    shariaPolicy: { newMoneyMode: 'INDEPENDENT_HAWL' },
  });
  expect(precise.zakatDue).toBe(250);
  expect(precise.advanceSuggested).toBe(0);
});
test('PDF p14 distributed trade profit follows the original capital hawl', () => {
  const r = runReferenceEngine(
    request(
      (d) => [
        goods(),
        ...(d >= '2025-05-01'
          ? [
              {
                ...cash('profit', 1000, '2025-05-01'),
                ...(d === '2025-05-01'
                  ? { hawlSource: { type: 'TRADE_PROFIT', sourceId: 'shop' } }
                  : {}),
              },
            ]
          : []),
      ],
      due,
    ),
  );
  expect(r.zakatDue).toBe(275);
  expect(r.events.filter((e) => e.type === 'DUE')).toHaveLength(1);
});
test('PDF p21 cash to trade and back preserves one hawl and one base', () => {
  const r = runReferenceEngine(
    request(
      (d) =>
        d < '2025-05-01'
          ? [{ ...cash(), tradeCapital: true }]
          : d < '2025-06-01'
            ? [
                {
                  ...goods(),
                  id: 'trade',
                  acquired: '2025-05-01',
                  ...(d === '2025-05-01'
                    ? {
                        hawlSource: {
                          type: 'TRADE_CONVERSION',
                          sourceId: 'cash',
                          transferredValue: 10000,
                        },
                      }
                    : {}),
                },
              ]
            : [
                {
                  ...cash('proceeds', 10000, '2025-06-01'),
                  tradeCapital: true,
                  ...(d === '2025-06-01'
                    ? {
                        hawlSource: {
                          type: 'TRADE_CONVERSION',
                          sourceId: 'trade',
                          transferredValue: 10000,
                        },
                      }
                    : {}),
                },
              ],
      due,
    ),
  );
  expect(r.zakatDue).toBe(250);
  expect(r.events.filter((e) => e.type === 'DUE')).toHaveLength(1);
});
test.each(['SOLVENT_NON_DELAYING', 'DOUBTFUL'])(
  'PDF p19/20 receivable %s and recovery distinguish inherited from new hawl',
  (recovery) => {
    const recovered = '2025-05-01';
    const r = runReferenceEngine(
      request(
        (d) => [
          cash(),
          ...(d < recovered
            ? [
                {
                  id: 'loan',
                  kind: 'RECEIVABLE',
                  value: 2000,
                  recovery,
                  acquired: first,
                },
              ]
            : [
                {
                  ...cash('received', 2000, recovered),
                  ...(d === recovered
                    ? {
                        hawlSource: {
                          type: 'DEBT_RECOVERY',
                          sourceId: 'loan',
                          transferredValue: 2000,
                        },
                      }
                    : {}),
                },
              ]),
        ],
        due,
      ),
    );
    expect(r.zakatDue).toBe(recovery === 'DOUBTFUL' ? 250 : 300);
  },
);
test('PDF p20 debts owed by user do not reduce wealth or due', () => {
  const r = runReferenceEngine({
    ...request(undefined, due),
    liabilities: [{ id: 'owed', amount: 2000 }],
  });
  expect(r.zakatableWealth).toBe(10000);
  expect(r.zakatDue).toBe(250);
  expect(r.explanationsArabic.join(' ')).toContain('لا يخصم');
});
test('PDF p23 Saudi investment company discharge requires evidence; trading cannot exploit it', () => {
  const a = {
    id: 'stock',
    kind: 'STOCK',
    intent: 'INVESTMENT',
    acquired: first,
    companyZakatPaid: true,
    companyEvidence: {
      jurisdiction: 'SA',
      source: 'company annual disclosure',
    },
  };
  const r = runReferenceEngine(request(() => [a]));
  expect(r.assetBreakdown[0].included).toBe(false);
  expect(() =>
    runReferenceEngine(request(() => [{ ...a, intent: 'TRADING' }])),
  ).toThrow();
  expect(() =>
    runReferenceEngine(request(() => [{ ...a, companyEvidence: undefined }])),
  ).toThrow();
});
test.each(['STOCK', 'FUND', 'DEBT_INSTRUMENT'])(
  'PDF p22–25 investment %s uses disclosed value; zero is known, unavailable is not',
  (kind) => {
    const a = {
      id: 'i',
      kind,
      intent: 'INVESTMENT',
      acquired: first,
      zakatableValue: 0,
    };
    expect(runReferenceEngine(request(() => [a])).zakatableWealth).toBe(0);
    expect(() =>
      runReferenceEngine(request(() => [{ ...a, zakatableValue: undefined }])),
    ).toThrow();
    expect(
      runReferenceEngine(request(() => [{ ...a, zakatableValue: 2500 }], due))
        .zakatDue,
    ).toBe(62.5);
  },
);
test.each(['USE', 'RENTAL', 'TRADING'])(
  'PDF p24 property intent %s',
  (intent) => {
    const a = {
      id: 'p',
      kind: 'PROPERTY',
      intent,
      acquired: first,
      ...(intent === 'TRADING' ? { value: 10000 } : {}),
    };
    const r = runReferenceEngine(request(() => [a, cash('rent', 3000)], due));
    expect(r.zakatableWealth).toBe(intent === 'TRADING' ? 13000 : 3000);
  },
);
test('new non-trade gold purchase does not inherit the existing cash hawl', () => {
  const bought = '2025-05-01';
  const r = runReferenceEngine(
    request(
      (d) => [
        cash(),
        ...(d >= bought
          ? [
              {
                id: 'g',
                kind: 'GOLD',
                grams: 100,
                karat: 24,
                purpose: 'INVESTMENT',
                acquired: bought,
              },
            ]
          : []),
      ],
      due,
    ),
  );
  expect(r.zakatDue).toBe(250);
  expect(r.assetBreakdown.find((a) => a.id === 'g').hawlStart).toBe(bought);
});
test('drop below nisab and return reset all surviving hawls', () => {
  const r = runReferenceEngine(
    request(
      (d) => [
        cash('a', d === first ? 3000 : 1000),
        ...(d === '2025-04-03' ? [cash('b', 2000, '2025-04-03')] : []),
      ],
      '2025-04-03',
    ),
  );
  // Cash additions must be represented by new independent lot identities.
  expect(r.events.map((e) => e.type)).toEqual(['START', 'BREAK', 'START']);
  expect(r.hawlStart).toBe('2025-04-03');
});
test.each([null, NaN, Infinity, -1, '1000', undefined, 1e13])(
  'malformed monetary value %s fails explicitly',
  (value) => {
    expect(() =>
      runReferenceEngine(request(() => [{ ...cash('a'), value }])),
    ).toThrow();
  },
);
test.each([
  { nisabBasis: 'GOLD' },
  { deductDebts: true },
  { jewelryTreatment: 'INCLUDE' },
  { spendOrder: 'FIFO' },
  { newMoneyMode: 'EASY' },
  null,
])(
  'fixed or unsupported settings cannot be disguised as reference options',
  (policy) => expect(() => validateReferencePolicy(policy)).toThrow(),
);
test.each([
  { zakatExempt: true },
  { zakatable: false },
  { purpose: 'LENDING' },
  { intent: 'TRADING' },
])('generic exemptions and conflicting cash facts rejected', (extra) =>
  expect(() =>
    runReferenceEngine(request(() => [{ ...cash(), ...extra }])),
  ).toThrow(),
);
test('missing metal purposes, zero/invalid prices, unknown kinds and duplicate IDs fail safely', () => {
  for (const kind of ['GOLD', 'UNKNOWN'])
    expect(() =>
      runReferenceEngine(request(() => [{ id: 'a', kind, acquired: first }])),
    ).toThrow();
  for (const gold of [0, -1, null, NaN, Infinity, '300']) {
    const q = request();
    q.prices[first].gold = gold;
    expect(() => runReferenceEngine(q)).toThrow();
  }
  expect(() => runReferenceEngine(request(() => [cash(), cash()]))).toThrow();
});
test('invalid/future dates, missing arrays, missing prices, empty history and gaps fail safely', () => {
  for (const acquired of ['2025-02-30', '2026-01-01', null, undefined])
    expect(() =>
      runReferenceEngine(request(() => [{ ...cash(), acquired }])),
    ).toThrow();
  for (const extra of [
    { days: null },
    { days: [] },
    { days: undefined },
    { prices: {} },
    { asOfDate: '2024-01-01' },
  ])
    expect(() => runReferenceEngine({ ...request(), ...extra })).toThrow();
  const q = request(undefined, '2025-04-03');
  q.days.splice(1, 1);
  expect(() => runReferenceEngine(q)).toThrow();
});
test('unknown lineage, nontrade parent, duplicated source and conversion mismatch fail', () => {
  for (const type of ['TRADE_PROFIT', 'TRADE_CONVERSION', 'TYPO']) {
    const q = request(
      (d) =>
        d === first
          ? [cash()]
          : [
              {
                ...cash('b', 10000, '2025-04-02'),
                hawlSource: { sourceId: 'cash', type, transferredValue: 10000 },
              },
            ],
      '2025-04-02',
    );
    expect(() => runReferenceEngine(q)).toThrow();
  }
});
test('historical ownership is disclosed without inventing a historical completed hawl', () => {
  const r = runReferenceEngine(
    request(() => [cash('opening', 10000, '2024-01-01')]),
  );
  expect(r.status).toBe('NEEDS_HISTORY_REVIEW');
  expect(r.zakatDue).toBe(0);
  expect(r.warnings).toHaveLength(1);
});
test('stable input, stable outputs, JSON-safe UI contract and correct non-start explanation', () => {
  const input = request(() => [cash('zero', 0)]);
  const before = JSON.stringify(input);
  const r = runReferenceEngine(input);
  expect(JSON.stringify(input)).toBe(before);
  expect(runReferenceEngine(input)).toEqual(r);
  expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  expect(r.explanationsArabic.join(' ')).toContain('لم يبدأ');
  expect(
    classifyReferenceAsset({ ...cash(), kind: 'CASH' }, quote).source,
  ).toContain('ص18');
});

test.each([null, undefined, 0, -1, 25, '21', NaN, Infinity])(
  'invalid gold karat %s is rejected by reference contract',
  (karat) => {
    expect(() =>
      runReferenceEngine(
        request(() => [
          {
            id: 'g',
            kind: 'GOLD',
            grams: 100,
            karat,
            purpose: 'INVESTMENT',
            acquired: first,
          },
        ]),
      ),
    ).toThrow();
  },
);
test('generic UI settings are not reference policies; JSON object contracts and flags are strict', () => {
  for (const v of [null, undefined, [], false])
    expect(() => runReferenceEngine(v)).toThrow();
  expect(() => runReferenceEngine({ ...request(), persona: {} })).toThrow();
  expect(() =>
    runReferenceEngine(request(() => [{ ...cash(), tradeCapital: 'false' }])),
  ).toThrow();
  expect(() =>
    runReferenceEngine({
      ...request(),
      liabilities: [
        { id: 'a', amount: 100 },
        { id: 'a', amount: 100 },
      ],
    }),
  ).toThrow();
  expect(() =>
    runReferenceEngine(
      request(() => [
        {
          id: 'p',
          kind: 'PROPERTY',
          intent: 'USE',
          value: NaN,
          acquired: first,
        },
      ]),
    ),
  ).toThrow();
});
test('purpose typos cannot accidentally charge/exempt legacy metals', () => {
  expect(() =>
    calculateAssetValue({
      gold: [{ grams: 100, pricePerGram: 300, purpose: 'TYPO' }],
    }),
  ).toThrow();
  expect(() =>
    calculateAssetValue({
      silver: [{ grams: 1000, pricePerGram: 4, purpose: 'TYPO' }],
    }),
  ).toThrow();
});
test('known trade stock/fund market values include exactly once and cannot inherit old hawl without provenance', () => {
  const r = runReferenceEngine(
    request(
      () => [
        {
          id: 's',
          kind: 'STOCK',
          intent: 'TRADING',
          value: 10000,
          acquired: first,
        },
        {
          id: 'f',
          kind: 'FUND',
          intent: 'TRADING',
          value: 2000,
          acquired: first,
        },
      ],
      due,
    ),
  );
  expect(r.zakatableWealth).toBe(12000);
  expect(r.zakatDue).toBe(300);
  const bad = request(
    (d) =>
      d === first
        ? [cash()]
        : [cash(), { ...cash('backdate'), acquired: first }],
    '2025-04-02',
  );
  expect(() => runReferenceEngine(bad)).toThrow();
});

test('UI totals reconcile cash and other assets; event kinds use the reference contract', () => {
  const r = runReferenceEngine(
    request(
      () => [
        cash(),
        {
          id: 'g',
          kind: 'GOLD',
          grams: 100,
          karat: 24,
          purpose: 'INVESTMENT',
          acquired: first,
        },
      ],
      due,
    ),
  );
  expect(r.series.at(-1).cashBalance).toBe(10000);
  expect(r.series.at(-1).otherAssets).toBe(30000);
  expect(r.events.at(-1).cashBase).toBe(10000);
  expect(r.events.at(-1).otherAssetsBase).toBe(30000);
  expect(r.events.at(-1).assets.map((a) => a.kind)).toEqual(['CASH', 'GOLD']);
});

test('excluded property keeps a known market value; unknown company value is null, never a fabricated zero', () => {
  const property = {
    id: 'p',
    kind: 'PROPERTY',
    intent: 'USE',
    value: 50000,
    acquired: first,
  };
  const stock = {
    id: 's',
    kind: 'STOCK',
    intent: 'INVESTMENT',
    acquired: first,
    companyZakatPaid: true,
    companyEvidence: { jurisdiction: 'SA', source: 'verified disclosure' },
  };
  const r = runReferenceEngine(request(() => [property, stock]));
  expect(r.zakatableWealth).toBe(0);
  expect(r.assetBreakdown[0].value).toBe(50000);
  expect(r.assetBreakdown[1].value).toBe(null);
});

test.each([null, undefined, 0, -1, 1001, '925', NaN, Infinity])(
  'silver purity %s must be a valid stated fineness',
  (purity) => {
    expect(() =>
      runReferenceEngine(
        request(() => [
          {
            id: 's',
            kind: 'SILVER',
            grams: 1000,
            purity,
            purpose: 'INVESTMENT',
            acquired: first,
          },
        ]),
      ),
    ).toThrow();
  },
);

test.each([null, undefined, -1, '1000', NaN, Infinity, 1e13])(
  'investment zakatable value %s is not invented/coerced',
  (zakatableValue) => {
    expect(() =>
      runReferenceEngine(
        request(() => [
          {
            id: 's',
            kind: 'STOCK',
            intent: 'INVESTMENT',
            zakatableValue,
            acquired: first,
          },
        ]),
      ),
    ).toThrow();
  },
);

test('multiple independent salaries preserve their dates and do not become all due with the first capital', () => {
  const r = runReferenceEngine(
    request(
      (d) => [
        cash(),
        ...(d >= '2025-05-01' ? [cash('s1', 1000, '2025-05-01')] : []),
        ...(d >= '2025-06-01' ? [cash('s2', 2000, '2025-06-01')] : []),
      ],
      due,
    ),
  );
  expect(r.zakatDue).toBe(250);
  expect(r.assetBreakdown.map((a) => a.acquired)).toEqual([
    first,
    '2025-05-01',
    '2025-06-01',
  ]);
});

test('raw transactions are rejected; upstream must provide deduplicated factual lots, not silently ignored records', () => {
  expect(() =>
    runReferenceEngine({
      ...request(),
      transactions: [{ id: 'same' }, { id: 'same' }],
    }),
  ).toThrow('unsupported field');
});

test('changing asset intent cannot preserve a stale hawl under one id', () => {
  const r = request(
    (d) => [
      {
        id: 'p',
        kind: 'PROPERTY',
        intent: d === first ? 'USE' : 'TRADING',
        value: 10000,
        acquired: first,
      },
    ],
    '2025-04-02',
  );
  expect(() => runReferenceEngine(r)).toThrow('facts cannot change');
});

test('zero cash does not change a standalone metal into a lower cash-nisab case', () => {
  const r = runReferenceEngine(
    request(
      () => [
        cash('empty', 0),
        {
          id: 'g',
          kind: 'GOLD',
          grams: 84.999,
          karat: 24,
          purpose: 'INVESTMENT',
          acquired: first,
        },
      ],
      due,
    ),
  );
  expect(r.nisab.basis).toBe('PURE_GOLD_85G');
  expect(r.zakatDue).toBe(0);
});

test('Date/class/prototype objects cannot masquerade as an empty default Sharia policy', () => {
  for (const policy of [
    new Date(),
    new Map(),
    Object.create({ newMoneyMode: 'ANNUAL_ADVANCE' }),
  ])
    expect(() => validateReferencePolicy(policy)).toThrow();
});
