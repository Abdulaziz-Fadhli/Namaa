import { describe, expect, test } from 'vitest';
import { defaultSettings, hijri,calculateZakatableSnapshot , runEngine, traditionalCalc, evaluatePropertyZakat , validateShariaSettings , evaluateLivestockZakat  , calculateAssetValue, evaluateCropZakat } from './engine.js';
const DAY = 86400000;

function dateFromHijri(y, m, d) {
  for (let t = Date.UTC(2024, 0, 1); t <= Date.UTC(2028, 11, 31); t += DAY) {
    const date = new Date(t);
    const [yy, mm, dd] = hijri(date);
    if (yy === y && mm === m && dd === d) return date;
  }
  throw new Error(`Hijri date not found: ${y}/${m}/${d}`);
}

function key(date) {
  return date.toISOString().slice(0, 10);
}

function range(start, end, tx = {}, nisabFn = () => 5000) {
  const days = [];
  for (let t = start.getTime(); t <= end.getTime(); t += DAY) {
    const date = new Date(t);
    const x = tx[key(date)] ?? {};
    days.push({
      date,
      deposits: x.deposits ?? [],
      withdrawals: x.withdrawals ?? [],
      nisab: nisabFn(date)
    });
  }
  return days;
}

function hkey(date) {
  const [y, m, d] = hijri(date);
  return `${y}/${m}/${d}`;
}

function dueEvents(events) {
  return events.filter(e => e.type === 'DUE');
}

describe('Namaa hawl engine - Monday validation cases', () => {
  test('Case 1: basic hawl', () => {
    const start = dateFromHijri(1447, 1, 1);
    const end = dateFromHijri(1448, 1, 1);
    const days = range(start, end, { [key(start)]: { deposits: [20000] } });
    const events = runEngine(days, defaultSettings);
    expect(events[0].type).toBe('START');
    expect(hkey(events[0].date)).toBe('1447/1/1');
    const due = dueEvents(events);
    expect(due).toHaveLength(1);
    expect(hkey(due[0].date)).toBe('1448/1/1');
    expect(due[0].base).toBe(20000);
    expect(due[0].zakat).toBe(500);
  });

  test('Case 2: hawl starts when nisab is reached', () => {
    const d1 = dateFromHijri(1447, 1, 1);
    const d2 = dateFromHijri(1447, 3, 1);
    const end = dateFromHijri(1448, 3, 1);
    const days = range(d1, end, {
      [key(d1)]: { deposits: [3000] },
      [key(d2)]: { deposits: [7000] }
    });
    const events = runEngine(days, defaultSettings);
    expect(events[0].type).toBe('START');
    expect(hkey(events[0].date)).toBe('1447/3/1');
    const due = dueEvents(events)[0];
    expect(hkey(due.date)).toBe('1448/3/1');
    expect(due.base).toBe(10000);
    expect(due.zakat).toBe(250);
  });

  test('Case 3: hawl breaks below nisab and restarts', () => {
    const d1 = dateFromHijri(1447, 1, 1);
    const wd = dateFromHijri(1447, 6, 1);
    const dep = dateFromHijri(1447, 8, 1);
    const end = dateFromHijri(1448, 8, 1);
    const days = range(d1, end, {
      [key(d1)]: { deposits: [10000] },
      [key(wd)]: { withdrawals: [7000] },
      [key(dep)]: { deposits: [5000] }
    });
    const events = runEngine(days, defaultSettings);
    expect(events.map(e => e.type).slice(0, 3)).toEqual(['START', 'BREAK', 'START']);
    expect(hkey(events[1].date)).toBe('1447/6/1');
    expect(hkey(events[2].date)).toBe('1447/8/1');
    const due = dueEvents(events)[0];
    expect(hkey(due.date)).toBe('1448/8/1');
    expect(due.base).toBe(8000);
    expect(due.zakat).toBe(200);
  });

test('Case 4A: INDEPENDENT_HAWL keeps separate due dates', () => {
  const d1 = dateFromHijri(1447, 1, 1);
  const d2 = dateFromHijri(1447, 4, 1);
  const end = dateFromHijri(1448, 4, 1);

  const days = range(d1, end, {
    [key(d1)]: { deposits: [10000] },
    [key(d2)]: { deposits: [4000] }
  });

  const due = dueEvents(
    runEngine(days, {
      ...defaultSettings,
      acquiredMoneyMode: 'INDEPENDENT_HAWL'
    })
  );

  expect(due.map(e => [hkey(e.date), e.base, e.zakat])).toEqual([
    ['1448/1/1', 10000, 250],
    ['1448/4/1', 4000, 100]
  ]);
});

test('Case 4B: ANNUAL_ADVANCE pays all with the first due lot', () => {
  const d1 = dateFromHijri(1447, 1, 1);
  const d2 = dateFromHijri(1447, 4, 1);
  const end = dateFromHijri(1448, 4, 1);

  const days = range(d1, end, {
    [key(d1)]: { deposits: [10000] },
    [key(d2)]: { deposits: [4000] }
  });

  const due = dueEvents(
    runEngine(days, {
      ...defaultSettings,
      acquiredMoneyMode: 'ANNUAL_ADVANCE'
    })
  );

  expect(due).toHaveLength(1);
  expect(hkey(due[0].date)).toBe('1448/1/1');
  expect(due[0].base).toBe(14000);
  expect(due[0].zakat).toBe(350);
});

  test('Case 5 LIFO: spending consumes newest lot first', () => {
    const d1 = dateFromHijri(1447, 1, 1);
    const d2 = dateFromHijri(1447, 4, 1);
    const wd = dateFromHijri(1447, 6, 1);
    const end = dateFromHijri(1448, 4, 1);
    const days = range(d1, end, {
      [key(d1)]: { deposits: [10000] },
      [key(d2)]: { deposits: [4000] },
      [key(wd)]: { withdrawals: [3000] }
    });
    const due = dueEvents(runEngine(days, { ...defaultSettings, spendOrder: 'LIFO' }));
    expect(due.map(e => [hkey(e.date), e.base, e.zakat])).toEqual([
      ['1448/1/1', 10000, 250],
      ['1448/4/1', 1000, 25]
    ]);
  });

  test('Case 5 FIFO: spending consumes oldest lot first', () => {
    const d1 = dateFromHijri(1447, 1, 1);
    const d2 = dateFromHijri(1447, 4, 1);
    const wd = dateFromHijri(1447, 6, 1);
    const end = dateFromHijri(1448, 4, 1);
    const days = range(d1, end, {
      [key(d1)]: { deposits: [10000] },
      [key(d2)]: { deposits: [4000] },
      [key(wd)]: { withdrawals: [3000] }
    });
    const due = dueEvents(runEngine(days, { ...defaultSettings, spendOrder: 'FIFO' }));
    expect(due.map(e => [hkey(e.date), e.base, e.zakat])).toEqual([
      ['1448/1/1', 7000, 175],
      ['1448/4/1', 4000, 100]
    ]);
  });

  test('Case 6: hawl starts because daily nisab falls', () => {
    const d1 = dateFromHijri(1447, 1, 1);
    const threshold = dateFromHijri(1447, 5, 10);
    const end = dateFromHijri(1448, 5, 10);
    const days = range(
      d1,
      end,
      { [key(d1)]: { deposits: [4000] } },
      date => date < threshold ? 4165 : 3867.5
    );
    const events = runEngine(days, defaultSettings);
    expect(events[0].type).toBe('START');
    expect(hkey(events[0].date)).toBe('1447/5/10');
    const due = dueEvents(events)[0];
    expect(hkey(due.date)).toBe('1448/5/10');
    expect(due.base).toBe(4000);
    expect(due.zakat).toBe(100);
  });

  test('Traditional baseline: returns total/40 only at or above nisab', () => {
    expect(traditionalCalc(20000, 5000)).toBe(500);
    expect(traditionalCalc(4000, 5000)).toBe(0);
  });
});

// Additional robustness tests added after Monday review.
import { isHawlComplete, nisabFor, ramadanCalc, runEngineDetailed } from './engine.js';

describe('Additional robustness checks', () => {
  test('nisabFor supports MIN, GOLD and SILVER', () => {
    const prices = { gold: 300, silver: 4 };
    expect(nisabFor(prices, { ...defaultSettings, nisabBasis: 'GOLD' })).toBe(25500);
    expect(nisabFor(prices, { ...defaultSettings, nisabBasis: 'SILVER' })).toBe(2380);
    expect(nisabFor(prices, { ...defaultSettings, nisabBasis: 'MIN' })).toBe(2380);
  });

  test('isHawlComplete works independently', () => {
    const start = dateFromHijri(1447, 2, 10);
    expect(isHawlComplete(start, dateFromHijri(1448, 2, 9))).toBe(false);
    expect(isHawlComplete(start, dateFromHijri(1448, 2, 10))).toBe(true);
  });

  test('month-end hawl completes on the last day when day 30 does not exist next year', () => {
    let candidate = null;
    for (let m = 1; m <= 12; m++) {
      try {
        const start = dateFromHijri(1445, m, 30);
        try { dateFromHijri(1446, m, 30); } catch { candidate = { start, m }; break; }
      } catch {}
    }
    expect(candidate).not.toBeNull();
    let last = null;
    for (let d = 29; d >= 1; d--) {
      try { last = dateFromHijri(1446, candidate.m, d); break; } catch {}
    }
    expect(isHawlComplete(candidate.start, last)).toBe(true);
  });

  test('runEngineDetailed exposes events, series, lots and nextDue', () => {
    const start = dateFromHijri(1447, 1, 1);
    const days = range(start, start, { [key(start)]: { deposits: [10000] } });
    const result = runEngineDetailed(days, defaultSettings);
    expect(result.events[0].type).toBe('START');
    expect(result.series).toHaveLength(1);
    expect(result.lots).toHaveLength(1);
    expect(result.nextDue.targetHijri).toEqual([1448, 1, 1]);
  });

  test('ramadanCalc uses the balance on 1 Ramadan', () => {
    const ramadan = dateFromHijri(1447, 9, 1);
    const series = [{ date: ramadan, total: 20000, nisab: 5000 }];
    const r = ramadanCalc(series, 1447);
    expect(r.base).toBe(20000);
    expect(r.zakat).toBe(500);
  });

  test('missing nisab is rejected instead of failing silently', () => {
    const date = dateFromHijri(1447, 1, 1);
    expect(() => runEngine([{ date, deposits: [1000], withdrawals: [] }], defaultSettings)).toThrow(/nisab/);
  });

  test('withdrawal above available balance is rejected', () => {
    const date = dateFromHijri(1447, 1, 1);
    expect(() => runEngine([{ date, deposits: [1000], withdrawals: [5000], nisab: 5000 }], defaultSettings)).toThrow(/exceeds available balance/);
  });


  test('nextDue resolves Hijri day 30 to the last valid day of the target month', () => {
    const start = dateFromHijri(1446, 2, 30);

    const days = range(start, start, {
      [key(start)]: {
        deposits: [10000]
      }
    });

    const result = runEngineDetailed(days, defaultSettings);

    expect(result.nextDue).not.toBeNull();
    expect(result.nextDue.targetHijri[0]).toBe(1447);
    expect(result.nextDue.targetHijri[1]).toBe(2);
    expect(result.nextDue.dueDate).toBeInstanceOf(Date);

    const [year, month, day] = hijri(result.nextDue.dueDate);

    expect(year).toBe(1447);
    expect(month).toBe(2);
    expect(day).toBeLessThanOrEqual(30);
  });
  test('lot keeps its original depositDate when hawl starts later', () => {
  const january = dateFromHijri(1447, 1, 1);
  const march = dateFromHijri(1447, 3, 1);

  const days = range(january, march, {
    [key(january)]: {
      deposits: [2000],
      nisab: 5000
    },
    [key(march)]: {
      deposits: [4000],
      nisab: 5000
    }
  });

  const result = runEngineDetailed(days, defaultSettings);

  expect(result.lots).toHaveLength(2);

  expect(result.lots[0].depositDate).toEqual(january);
  expect(result.lots[0].start).toEqual(march);

  expect(result.lots[1].depositDate).toEqual(march);
  expect(result.lots[1].start).toEqual(march);
});
test('nextDue includes expected zakat amount', () => {
  const start = dateFromHijri(1446, 5, 1);

  const days = range(start, start, {
    [key(start)]: {
      deposits: [10000],
      nisab: 5000
    }
  });

  const result = runEngineDetailed(days, defaultSettings);

  expect(result.nextDue).not.toBeNull();
  expect(result.nextDue.dueDate).toBeInstanceOf(Date);
  expect(result.nextDue.zakat).toBe(250);
});

test('decimal amounts do not cause floating point withdrawal errors', () => {
  const day1 = new Date(Date.UTC(2026, 0, 1));
  const day2 = new Date(Date.UTC(2026, 0, 2));
  const day3 = new Date(Date.UTC(2026, 0, 3));

  const days = range(day1, day3, {
    [key(day1)]: {
      deposits: [0.3],
      nisab: 1
    },
    [key(day2)]: {
      withdrawals: [0.1],
      nisab: 1
    },
    [key(day3)]: {
      withdrawals: [0.2],
      nisab: 1
    }
  });

  const result = runEngineDetailed(days, defaultSettings);

  expect(result.lots).toHaveLength(0);
});

describe('Asset value calculation', () => {
  test('calculates zakatable assets correctly', () => {
    const data = {
      gold: [
        {
          grams: 10,
          karat: 24,
          pricePerGram: 300,
          purpose: 'INVESTMENT'
        },
        {
          grams: 5,
          karat: 24,
          pricePerGram: 300,
          purpose: 'PERSONAL_USE'
        }
      ],

      silver: [
        {
          grams: 100,
          pricePerGram: 4
        }
      ],

      stocks: [
        {
          type: 'TRADING',
          marketValue: 2000
        }
      ],

     investmentProducts: [
  {
    type: 'LONG_TERM',
    zakatableValue: 1000
  }
],

      manualAssets: [
        {
          value: 500,
          zakatable: true
        }
      ]
    };

    const result = calculateAssetValue(data);

    expect(result).toBe(6900);
  });

  test('uses dynamic input values instead of hardcoded amounts', () => {
  const data = {
    stocks: [
      {
        type: 'TRADING',
        marketValue: 13789.37
      }
    ],

    investmentProducts: [
      {
        type: 'LONG_TERM',
        zakatableValue: 4321.65
      }
    ]
  };

  const result = calculateAssetValue(data);

  expect(result).toBeCloseTo(18111.02, 2);
});

 describe('Crop zakat evaluation', () => {
  test('crop below 612 kg is not eligible', () => {
    const result = evaluateCropZakat({
      kind: 'قمح',
      kg: 611
    });

    expect(result.eligible).toBe(false);
    expect(result.requiresHawl).toBe(false);
    expect(result.dueAtHarvest).toBe(false);
  });

  test('crop at 612 kg reaches nisab and is due at harvest', () => {
    const result = evaluateCropZakat({
      kind: 'تمر',
      kg: 612
    });

    expect(result.eligible).toBe(true);
    expect(result.requiresHawl).toBe(false);
    expect(result.dueAtHarvest).toBe(true);
    expect(result.nisabKg).toBe(612);
  });

  describe('Livestock zakat evaluation', () => {
  test('camels below nisab are not eligible', () => {
    const result = evaluateLivestockZakat({
      type: 'camels',
      count: 4
    });

    expect(result.eligible).toBe(false);
    expect(result.nisab).toBe(5);
    expect(result.requiresHawl).toBe(true);
  });

  test('cattle at nisab are eligible', () => {
    const result = evaluateLivestockZakat({
      type: 'cattle',
      count: 30
    });

    expect(result.eligible).toBe(true);
    expect(result.nisab).toBe(30);
    expect(result.requiresHawl).toBe(true);
  });

  test('sheep at nisab are eligible', () => {
    const result = evaluateLivestockZakat({
      type: 'sheep',
      count: 40
    });

    expect(result.eligible).toBe(true);
    expect(result.nisab).toBe(40);
    expect(result.requiresHawl).toBe(true);
  });
});


});

});

});describe('Sharia settings validation', () => {
  test('default sharia settings are valid', () => {
    expect(validateShariaSettings(defaultSettings)).toBe(true);
  });

  test('rejects debt deduction under the approved guide', () => {
    expect(() =>
      validateShariaSettings({
        ...defaultSettings,
        deductDebts: true
      })
    ).toThrow();
  });

  test('accepts independent hawl for acquired money', () => {
    expect(
      validateShariaSettings({
        ...defaultSettings,
        acquiredMoneyMode: 'INDEPENDENT_HAWL'
      })
    ).toBe(true);
  });

  test('accepts annual advance for acquired money', () => {
    expect(
      validateShariaSettings({
        ...defaultSettings,
        acquiredMoneyMode: 'ANNUAL_ADVANCE'
      })
    ).toBe(true);
  });
});describe('Property zakat evaluation', () => {
  test('personal-use property is not zakatable', () => {
    const result = evaluatePropertyZakat({
      intent: 'USE',
      marketValue: 500000
    });

    expect(result.zakatablePropertyValue).toBe(0);
    expect(result.treatment).toBe('EXEMPT_PROPERTY_ASSET');
  });

  test('rental property excludes the property asset itself', () => {
    const result = evaluatePropertyZakat({
      intent: 'RENTAL',
      marketValue: 500000,
      rentalIncome: 30000
    });

    expect(result.zakatablePropertyValue).toBe(0);
    expect(result.rentalIncome).toBe(30000);
    expect(result.treatment).toBe('RENTAL_INCOME_AS_CASH');
  });

  test('trading property uses market value', () => {
    const result = evaluatePropertyZakat({
      intent: 'TRADING',
      marketValue: 500000
    });

    expect(result.zakatablePropertyValue).toBe(500000);
    expect(result.treatment).toBe('TRADE_GOODS');
  });
});


describe('Cash zakat calculation', () => {
  test('25000 SAR gives 625 SAR zakat', () => {
    const amount = 25000;
    const zakat = amount / 40;

    expect(zakat).toBe(625);
  });
});
test('calculates silver value using purity', () => {
  const data = {
    silver: [
      {
        grams: 100,
        purity: 925,
        pricePerGram: 4
      }
    ]
  };

  const result = calculateAssetValue(data);

  expect(result).toBeCloseTo(370, 2);
});

describe('Stock zakat calculation', () => {
  test('trading stock uses full market value', () => {
    const data = {
      stocks: [
        {
          type: 'TRADING',
          marketValue: 20000
        }
      ]
    };

    const result = calculateAssetValue(data);

    expect(result).toBe(20000);
  });

  test('long-term stock uses zakatable value only', () => {
    const data = {
      stocks: [
        {
          type: 'LONG_TERM',
          marketValue: 50000,
          zakatableValue: 12000
        }
      ]
    };

    const result = calculateAssetValue(data);

    expect(result).toBe(12000);
  });
});

describe('Investment product zakat calculation', () => {
  test('trading investment product uses full market value', () => {
    const data = {
      investmentProducts: [
        {
          type: 'TRADING',
          marketValue: 30000
        }
      ]
    };

    const result = calculateAssetValue(data);

    expect(result).toBe(30000);
  });

  test('long-term investment product uses zakatable value only', () => {
    const data = {
      investmentProducts: [
        {
          type: 'LONG_TERM',
          marketValue: 50000,
          zakatableValue: 14000
        }
      ]
    };

    const result = calculateAssetValue(data);

    expect(result).toBe(14000);
  });
});
describe('Gold zakat calculation', () => {
  test('calculates 21 karat gold using purity', () => {
    const data = {
      gold: [
        {
          grams: 10,
          karat: 21,
          pricePerGram: 300,
          purpose: 'INVESTMENT'
        }
      ]
    };

    const result = calculateAssetValue(data);

    expect(result).toBeCloseTo(2625, 2);
  });

  test('personal-use gold is excluded', () => {
    const data = {
      gold: [
        {
          grams: 20,
          karat: 24,
          pricePerGram: 300,
          purpose: 'PERSONAL_USE'
        }
      ]
    };

    const result = calculateAssetValue(data);

    expect(result).toBe(0);
  });
});

test('trading property is included in total asset value', () => {
  const data = {
    properties: [
      {
        intent: 'TRADING',
        marketValue: 600000
      }
    ]
  };

  const result = calculateAssetValue(data);

  expect(result).toBe(600000);
});

test('personal-use property is excluded from total asset value', () => {
  const data = {
    properties: [
      {
        intent: 'USE',
        marketValue: 600000
      }
    ]
  };

  const result = calculateAssetValue(data);

  expect(result).toBe(0);
});

describe('Zakatable snapshot calculation', () => {
  test('combines cash and all supported monetary assets correctly', () => {
    const data = {
      cashBalance: 20000,

      gold: [
        {
          grams: 10,
          karat: 24,
          pricePerGram: 300,
          purpose: 'INVESTMENT'
        }
      ],

      silver: [
        {
          grams: 100,
          purity: 925,
          pricePerGram: 4
        }
      ],

      stocks: [
        {
          type: 'TRADING',
          marketValue: 5000
        }
      ],

      investmentProducts: [
        {
          type: 'LONG_TERM',
          zakatableValue: 2000
        }
      ],

      properties: [
        {
          intent: 'TRADING',
          marketValue: 100000
        }
      ]
    };

    const result = calculateZakatableSnapshot(data);

    expect(result.cashBalance).toBe(20000);
    expect(result.otherAssets).toBeCloseTo(110370, 2);
    expect(result.total).toBeCloseTo(130370, 2);
  });
});