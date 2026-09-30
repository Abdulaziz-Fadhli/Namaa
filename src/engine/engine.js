const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  timeZone: 'UTC',
});

export function hijri(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime()))
    throw new TypeError('date must be a valid Date');
  const p = fmt.formatToParts(date);
  const g = (t) => +p.find((x) => x.type === t).value;
  return [g('year'), g('month'), g('day')];
}

// A hawl completes on the same Hijri date in the following year.
// If that month has no matching day (e.g. start on day 30 and next year's month has 29 days),
// the last day of that Hijri month is treated as the anniversary.
export function isHawlComplete(start, today) {
  const [sy, sm, sd] = hijri(start);
  const [cy, cm, cd] = hijri(today);
  const ty = sy + 1;
  if (cy !== ty) return cy > ty;
  if (cm !== sm) return cm > sm;
  if (cd >= sd) return true;

  const tomorrow = new Date(today.getTime() + 86400000);
  const [ny, nm] = hijri(tomorrow);
  return ny === cy && nm !== cm; // today is the last day of the target Hijri month
}
function resolveHawlDueDate(start) {
  const [sy, sm, sd] = hijri(start);
  const targetYear = sy + 1;

  let candidate = null;

  for (
    let t = start.getTime();
    t <= start.getTime() + 370 * 86400000;
    t += 86400000
  ) {
    const date = new Date(t);
    const [y, m, data] = hijri(date);

    if (y === targetYear && m === sm) {
      candidate = date;

      if (data === sd) {
        return date;
      }
    }

    if (candidate && (y > targetYear || (y === targetYear && m > sm))) {
      break;
    }
  }

  return candidate;
}
const sum = (lots) => lots.reduce((s, l) => s + l.amount, 0);
const cloneLots = (lots) => lots.map((l) => ({ ...l }));

function assertFiniteNonNegative(value, label) {
  if (!Number.isFinite(value) || value < 0)
    throw new RangeError(`${label} must be a finite non-negative number`);
}

function consume(lots, amount, order) {
  assertFiniteNonNegative(amount, 'withdrawal');

  const roundMoney = (value) =>
    Math.round((value + Number.EPSILON) * 100) / 100;

  amount = roundMoney(amount);
  const available = roundMoney(sum(lots));

  if (amount > available) {
    throw new RangeError(
      `withdrawal ${amount} exceeds available balance ${available}`,
    );
  }

  const list = order === 'FIFO' ? lots : [...lots].reverse();

  for (const l of list) {
    const take = Math.min(roundMoney(l.amount), amount);

    l.amount = roundMoney(l.amount - take);
    amount = roundMoney(amount - take);

    if (amount <= 0) break;
  }

  for (let i = lots.length - 1; i >= 0; i--) {
    if (roundMoney(lots[i].amount) <= 0) {
      lots.splice(i, 1);
    }
  }
}

export function calculateAssetValue(data) {
  let total = 0;

  // Gold
  for (const gold of data.gold ?? []) {
    assertFiniteNonNegative(gold.grams, 'gold grams');
    assertFiniteNonNegative(gold.pricePerGram, 'gold price per gram');

    // Used/personal jewelry is excluded.
    // Other gold is included in the zakat base.
    if (gold.purpose !== 'PERSONAL_USE') {
      const purity = gold.karat == null ? 1 : gold.karat / 24;
      assertFiniteNonNegative(purity, 'gold purity');

      total += gold.grams * purity * gold.pricePerGram;
    }
  }

  // Silver
  for (const silver of data.silver ?? []) {
    assertFiniteNonNegative(silver.grams, 'silver grams');
    assertFiniteNonNegative(silver.pricePerGram, 'silver price per gram');

    // Purity is expressed as 999, 925, 800, etc.
    const purity = silver.purity == null ? 1 : silver.purity / 1000;
    assertFiniteNonNegative(purity, 'silver purity');

    total += silver.grams * purity * silver.pricePerGram;
  }
  // Stocks
  for (const stock of data.stocks ?? []) {
    assertFiniteNonNegative(stock.marketValue, 'stock market value');

    // Trading shares are treated as trade goods.
    if (stock.type === 'TRADING') {
      total += stock.marketValue;
    }

    // For long-term investments, only a supplied zakatable value
    // is included. We do not invent that value automatically.
    if (stock.type === 'LONG_TERM' && stock.zakatableValue != null) {
      assertFiniteNonNegative(stock.zakatableValue, 'stock zakatable value');
      total += stock.zakatableValue;
    }
  }

  // Investment products
  for (const product of data.investmentProducts ?? []) {
    // Products held for trading are treated like trade goods:
    // use the full current market value.
    if (product.type === 'TRADING') {
      assertFiniteNonNegative(product.marketValue, 'product market value');
      total += product.marketValue;
      continue;
    }

    // Long-term investment products use the zakatable value
    // disclosed or calculated from the fund/company information.
    if (product.type === 'LONG_TERM' && product.zakatableValue != null) {
      assertFiniteNonNegative(
        product.zakatableValue,
        'product zakatable value',
      );
      total += product.zakatableValue;
    }

    // If a long-term product has no known zakatable value,
    // Namaa does not invent a default value or automatically treat it as exempt.
  }
  // Properties
  for (const property of data.properties ?? []) {
    const result = evaluatePropertyZakat(property);

    // Only property held for trading contributes
    // its market value directly to the zakatable asset base.
    total += result.zakatablePropertyValue;
  }
  // Manually entered zakatable assets
  for (const asset of data.manualAssets ?? []) {
    assertFiniteNonNegative(asset.value, 'manual asset value');

    if (asset.zakatable !== false) {
      total += asset.value;
    }
  }

  return total;
}

export function calculateZakatableSnapshot(data) {
  const cashBalance = data.cashBalance ?? 0;

  assertFiniteNonNegative(cashBalance, 'cash balance');

  const otherAssets = calculateAssetValue(data);

  return {
    cashBalance,
    otherAssets,
    total: cashBalance + otherAssets,
  };
}

export const defaultSettings = {
  // Nisab for cash and trade goods:
  // use the lower value between gold and silver nisab.
  nisabBasis: 'MIN',

  // Fixed reference weights from the approved guide.
  goldGrams: 85,
  silverGrams: 595,

  // Operational spending order for lots.
  spendOrder: 'LIFO',

  // Personal-use jewelry is excluded.
  jewelryTreatment: 'EXCLUDE_PERSONAL_USE',

  // Stocks / investment products.
  stockTreatment: 'BY_INTENT',
  fundTreatment: 'BY_INTENT',

  // Property treatment depends on user intent:
  // USE, RENTAL, or TRADING.
  propertyTreatment: 'BY_INTENT',

  // Newly acquired money:
  // independent hawl by default.
  acquiredMoneyMode: 'INDEPENDENT_HAWL',

  // According to the approved guide,
  // debts owed by the user are not deducted from the zakat base.
  deductDebts: false,
};

export function validateShariaSettings(settings) {
  if (!settings || typeof settings !== 'object') {
    throw new TypeError('settings must be an object');
  }

  const allowedNisabBasis = ['MIN'];
  const allowedSpendOrders = ['FIFO', 'LIFO'];
  const allowedJewelryTreatment = ['EXCLUDE_PERSONAL_USE'];
  const allowedStockTreatment = ['BY_INTENT'];
  const allowedFundTreatment = ['BY_INTENT'];
  const allowedPropertyTreatment = ['BY_INTENT'];
  const allowedAcquiredMoneyMode = ['INDEPENDENT_HAWL', 'ANNUAL_ADVANCE'];

  if (!allowedNisabBasis.includes(settings.nisabBasis)) {
    throw new TypeError('unsupported nisab basis');
  }

  if (!allowedSpendOrders.includes(settings.spendOrder)) {
    throw new TypeError('unsupported spend order');
  }

  if (!allowedJewelryTreatment.includes(settings.jewelryTreatment)) {
    throw new TypeError('unsupported jewelry treatment');
  }

  if (!allowedStockTreatment.includes(settings.stockTreatment)) {
    throw new TypeError('unsupported stock treatment');
  }

  if (!allowedFundTreatment.includes(settings.fundTreatment)) {
    throw new TypeError('unsupported fund treatment');
  }

  if (!allowedPropertyTreatment.includes(settings.propertyTreatment)) {
    throw new TypeError('unsupported property treatment');
  }

  if (!allowedAcquiredMoneyMode.includes(settings.acquiredMoneyMode)) {
    throw new TypeError('unsupported acquired money mode');
  }

  if (settings.deductDebts !== false) {
    throw new TypeError('deductDebts must be false under the approved guide');
  }

  return true;
}

export const CROP_NISAB_KG = 612;

export function evaluateCropZakat(crop) {
  if (!crop || typeof crop !== 'object') {
    throw new TypeError('crop must be an object');
  }

  assertFiniteNonNegative(crop.kg, 'crop kilograms');

  const eligible = crop.kg >= CROP_NISAB_KG;

  return {
    kind: crop.kind ?? null,
    kg: crop.kg,
    nisabKg: CROP_NISAB_KG,
    eligible,
    requiresHawl: false,
    dueAtHarvest: eligible,
  };
}

export const LIVESTOCK_NISAB = {
  camels: 5,
  cattle: 30,
  sheep: 40,
};

export function evaluateLivestockZakat(livestock) {
  if (!livestock || typeof livestock !== 'object') {
    throw new TypeError('livestock must be an object');
  }

  const { type, count } = livestock;

  if (!(type in LIVESTOCK_NISAB)) {
    throw new TypeError('unsupported livestock type');
  }

  assertFiniteNonNegative(count, 'livestock count');

  const nisab = LIVESTOCK_NISAB[type];
  const eligible = count >= nisab;

  return {
    type,
    count,
    nisab,
    eligible,
    requiresHawl: true,
  };
}

export function evaluatePropertyZakat(property) {
  if (!property || typeof property !== 'object') {
    throw new TypeError('property must be an object');
  }

  const { intent, marketValue = 0, rentalIncome = 0 } = property;

  if (!['USE', 'RENTAL', 'TRADING'].includes(intent)) {
    throw new TypeError('unsupported property intent');
  }

  assertFiniteNonNegative(marketValue, 'property market value');
  assertFiniteNonNegative(rentalIncome, 'property rental income');

  if (intent === 'USE') {
    return {
      intent,
      zakatablePropertyValue: 0,
      rentalIncome,
      treatment: 'EXEMPT_PROPERTY_ASSET',
    };
  }

  if (intent === 'RENTAL') {
    return {
      intent,
      zakatablePropertyValue: 0,
      rentalIncome,
      treatment: 'RENTAL_INCOME_AS_CASH',
    };
  }

  return {
    intent,
    zakatablePropertyValue: marketValue,
    rentalIncome,
    treatment: 'TRADE_GOODS',
  };
}

function validateDay(day) {
  if (!day || !(day.date instanceof Date) || Number.isNaN(day.date.getTime()))
    throw new TypeError('each day must contain a valid date');
  assertFiniteNonNegative(day.nisab, 'nisab');
  for (const deposit of day.deposits ?? []) assertFiniteNonNegative(deposit, 'deposit');
  for (const withdrawal of day.withdrawals ?? []) assertFiniteNonNegative(withdrawal, 'withdrawal');
}

// Future-facing detailed result for UI integration. Monday's runEngine remains backward compatible.
export function runEngineDetailed(days, settings = defaultSettings) {
  validateShariaSettings(settings);
  const lots = [],
    events = [],
    series = [];
  let wasAbove = false;

  for (const day of days) {
    validateDay(day);
    for (const deposit of day.deposits ?? [])
      lots.push({
        amount: deposit,
        depositDate: day.date,
        start: wasAbove ? day.date : null,
      });
    for (const withdrawal of day.withdrawals ?? []) consume(lots, withdrawal, settings.spendOrder);

    const total = sum(lots),
      above = total >= day.nisab;
    if (!above && wasAbove) {
      lots.forEach((lot) => (lot.start = null));
      events.push({ type: 'BREAK', date: day.date });
    }
    if (above && !wasAbove) {
      lots.forEach((lot) => (lot.start ??= day.date));
      events.push({ type: 'START', date: day.date });
    }
    wasAbove = above;

    if (above) {
      const due = lots.filter(
        (lot) => lot.start && isHawlComplete(lot.start, day.date),
      );
      if (due.length) {
        const annualAdvance = settings.acquiredMoneyMode === 'ANNUAL_ADVANCE';

        const base = annualAdvance ? total : sum(due);

        events.push({
          type: 'DUE',
          date: day.date,
          base,
          zakat: base / 40,
        });

        (annualAdvance ? lots : due).forEach((lot) => (lot.start = day.date));
      }
    }
    series.push({ date: day.date, total, nisab: day.nisab, above });
  }

  const futureLots = lots
    .filter((lot) => lot.start)
    .map((lot) => ({
      ...lot,
      // Hijri anniversary used to select the earliest due lot.
      startHijri: hijri(lot.start),
    }));
  const nextDue = futureLots.length
    ? futureLots.reduce((best, lot) => {
        const h = lot.startHijri;
        const key = (h[0] + 1) * 10000 + h[1] * 100 + h[2];
        return !best || key < best.key
          ? { key, start: lot.start, targetHijri: [h[0] + 1, h[1], h[2]] }
          : best;
      }, null)
    : null;
  if (nextDue) {
    nextDue.dueDate = resolveHawlDueDate(nextDue.start);
    nextDue.targetHijri = hijri(nextDue.dueDate);

    const dueLots = lots.filter(
      (lot) => lot.start && lot.start.getTime() === nextDue.start.getTime(),
    );

    const expectedBase =
      settings.acquiredMoneyMode === 'ANNUAL_ADVANCE'
        ? sum(lots)
        : sum(dueLots);

    nextDue.zakat = expectedBase / 40;
  }

  return {
    events,
    series,
    lots: cloneLots(lots),
    nextDue: nextDue && {
      start: nextDue.start,
      targetHijri: nextDue.targetHijri,
      dueDate: nextDue.dueDate,
      zakat: nextDue.zakat,
    },
  };
}

export function runEngine(days, settings = defaultSettings) {
  return runEngineDetailed(days, settings).events;
}

export const nisabFor = (p, s = defaultSettings) => {
  assertFiniteNonNegative(p?.gold, 'gold price');
  assertFiniteNonNegative(p?.silver, 'silver price');
  const g = s.goldGrams * p.gold,
    v = s.silverGrams * p.silver;
  return s.nisabBasis === 'GOLD'
    ? g
    : s.nisabBasis === 'SILVER'
      ? v
      : Math.min(g, v);
};

export function traditionalCalc(total, nisab) {
  assertFiniteNonNegative(total, 'total');
  assertFiniteNonNegative(nisab, 'nisab');
  return total >= nisab ? total / 40 : 0;
}

// Appendix B-5 comparison helper: use the balance on 1 Ramadan of the requested Hijri year.
export function ramadanCalc(series, year) {
  const row = series.find((x) => {
    const [y, m, d] = hijri(x.date);
    return y === year && m === 9 && d === 1;
  });
  if (!row) throw new Error(`1 Ramadan ${year} is not present in series`);
  return {
    date: row.date,
    base: row.total,
    zakat: traditionalCalc(row.total, row.nisab),
  };
}
