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
    const [y, m, day] = hijri(date);

    if (y === targetYear && m === sm) {
      candidate = date;

      if (day === sd) {
        return date;
      }
    }

    if (candidate && (y > targetYear || (y === targetYear && m > sm))) {
      break;
    }
  }

  if (!candidate)
    throw new RangeError(
      'hawl due date is outside the supported calendar range',
    );
  return candidate;
}
const sum = (lots) => {
  const total = lots.reduce((value, lot) => value + lot.amount, 0);
  assertMonetaryValue(total, 'lot total');
  return total;
};
const cloneLots = (lots) => lots.map((l) => ({ ...l }));

function assertFiniteNonNegative(value, label) {
  if (!Number.isFinite(value) || value < 0)
    throw new RangeError(`${label} must be a finite non-negative number`);
}

// Keep cent rounding reliable with JavaScript numbers. This is a technical
// supported range, not a nisab or a jurisprudential threshold.
export const MAX_MONETARY_VALUE = 1e12;

function assertMonetaryValue(value, label) {
  assertFiniteNonNegative(value, label);
  if (value > MAX_MONETARY_VALUE)
    throw new RangeError(`${label} exceeds supported monetary range`);
}

export function validateCashAmount(value) {
  assertMonetaryValue(value, 'cash amount');
  const rounded = Math.round(value * 100) / 100;
  if (Math.abs(value - rounded) > Number.EPSILON * Math.max(1, value)) {
    throw new RangeError('cash amount must have at most two decimal places');
  }
  return rounded;
}

function assertRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError(`${label} must be an object`);
}

function optionalArray(value, label) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  return value;
}

export function validateAssetFlags(asset) {
  assertRecord(asset, 'asset');
  for (const key of ['zakatExempt', 'zakatable']) {
    if (asset[key] !== undefined && typeof asset[key] !== 'boolean')
      throw new TypeError(`${key} must be boolean`);
  }
}

function assertDailyDate(date, label) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime()))
    throw new TypeError(`${label} must be a valid Date`);
  if (
    date.getUTCHours() ||
    date.getUTCMinutes() ||
    date.getUTCSeconds() ||
    date.getUTCMilliseconds()
  ) {
    throw new TypeError(`${label} must be a UTC midnight calendar date`);
  }
}

export class IncompleteAssetDataError extends Error {
  constructor(label) {
    super(
      `${label}: القيمة الزكوية غير متاحة؛ لا يمكن إكمال الحساب أو اعتبار الأصل معفى`,
    );
    this.name = 'IncompleteAssetDataError';
  }
}

function assertInvestmentType(asset, label) {
  if (!['TRADING', 'LONG_TERM'].includes(asset.type)) {
    throw new TypeError(`unsupported ${label} type`);
  }
  if (asset.type === 'LONG_TERM' && asset.zakatableValue == null) {
    throw new IncompleteAssetDataError(label);
  }
}

function consume(lots, amount, order) {
  amount = validateCashAmount(amount);

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
  assertRecord(data, 'asset data');
  const ids = new Set();
  const references = new Set();
  for (const category of [
    'gold',
    'silver',
    'stocks',
    'investmentProducts',
    'properties',
    'manualAssets',
  ]) {
    for (const asset of optionalArray(data[category], category)) {
      validateAssetFlags(asset);
      if (asset.id !== undefined && (typeof asset.id !== 'string' || !asset.id))
        throw new TypeError('asset id must be a non-empty string');
      if (references.has(asset) || (asset.id != null && ids.has(asset.id)))
        throw new TypeError('duplicate asset record');
      references.add(asset);
      if (asset.id != null) ids.add(asset.id);
    }
  }
  let total = 0;

  // Gold
  for (const gold of data.gold ?? []) {
    if (gold.zakatExempt) continue;
    assertFiniteNonNegative(gold.grams, 'gold grams');
    assertFiniteNonNegative(gold.pricePerGram, 'gold price per gram');

    // Used/personal jewelry is excluded.
    // Other gold is included in the zakat base.
    if (gold.purpose !== 'PERSONAL_USE') {
      const karat = gold.karat === undefined ? 24 : gold.karat;
      assertFiniteNonNegative(karat, 'gold karat');
      if (karat === 0) throw new RangeError('gold karat must be positive');
      const purity = karat / 24;
      assertFiniteNonNegative(purity, 'gold purity');
      if (purity > 1) throw new RangeError('gold karat must not exceed 24');

      total += gold.grams * purity * gold.pricePerGram;
    }
  }

  // Silver
  for (const silver of data.silver ?? []) {
    if (silver.zakatExempt) continue;
    assertFiniteNonNegative(silver.grams, 'silver grams');
    assertFiniteNonNegative(silver.pricePerGram, 'silver price per gram');

    // Purity is expressed as 999, 925, 800, etc.
    const fineness = silver.purity === undefined ? 1000 : silver.purity;
    assertFiniteNonNegative(fineness, 'silver fineness');
    if (fineness === 0) throw new RangeError('silver purity must be positive');
    const purity = fineness / 1000;
    assertFiniteNonNegative(purity, 'silver purity');
    if (purity > 1) throw new RangeError('silver purity must not exceed 1000');

    total += silver.grams * purity * silver.pricePerGram;
  }
  // Stocks
  for (const stock of data.stocks ?? []) {
    if (stock.zakatExempt) continue;
    assertInvestmentType(stock, 'stock');

    // Trading shares are treated as trade goods.
    if (stock.type === 'TRADING') {
      assertFiniteNonNegative(stock.marketValue, 'stock market value');
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
    if (product.zakatExempt) continue;
    assertInvestmentType(product, 'investment product');
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
  }
  // Properties
  for (const property of data.properties ?? []) {
    if (property.zakatExempt) continue;
    const result = evaluatePropertyZakat(property);

    // Only property held for trading contributes
    // its market value directly to the zakatable asset base.
    total += result.zakatablePropertyValue;
  }
  // Manually entered zakatable assets
  for (const asset of data.manualAssets ?? []) {
    if (asset.zakatExempt) continue;
    assertFiniteNonNegative(asset.value, 'manual asset value');

    if (asset.zakatable !== false) {
      total += asset.value;
    }
  }

  assertMonetaryValue(total, 'asset total');
  return total;
}

export function calculateZakatableSnapshot(data) {
  assertRecord(data, 'snapshot data');
  const cashBalance = data.cashBalance ?? 0;

  assertMonetaryValue(cashBalance, 'cash balance');

  const otherAssets = calculateAssetValue(data);

  assertMonetaryValue(cashBalance + otherAssets, 'snapshot total');
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
  assertRecord(settings, 'settings');
  for (const key of Object.keys(settings)) {
    if (!Object.hasOwn(defaultSettings, key))
      throw new TypeError(`unsupported setting: ${key}`);
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

  // This implementation supports the approved weights only.
  // Equality also rejects missing, negative, non-numeric and non-finite values.
  if (settings.goldGrams !== 85 || settings.silverGrams !== 595) {
    throw new RangeError(
      'approved nisab weights must be 85g gold and 595g silver',
    );
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

  if (!Object.hasOwn(LIVESTOCK_NISAB, type)) {
    throw new TypeError('unsupported livestock type');
  }

  assertFiniteNonNegative(count, 'livestock count');
  if (!Number.isSafeInteger(count))
    throw new RangeError('livestock count must be a safe integer');

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
  if (intent === 'TRADING' && property.marketValue == null)
    throw new IncompleteAssetDataError('trading property market value');

  assertMonetaryValue(marketValue, 'property market value');
  assertMonetaryValue(rentalIncome, 'property rental income');

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
  assertDailyDate(day.date, 'day date');
  assertMonetaryValue(day.nisab, 'nisab');
  if (day.nisab === 0) throw new RangeError('nisab must be positive');
  for (const deposit of optionalArray(day.deposits, 'deposits'))
    validateCashAmount(deposit);
  for (const withdrawal of optionalArray(day.withdrawals, 'withdrawals'))
    validateCashAmount(withdrawal);
}

const explanationMoney = new Intl.NumberFormat('ar-SA', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const explanationDate = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
  dateStyle: 'long',
  timeZone: 'UTC',
});
const moneyText = (amount) => `${explanationMoney.format(amount)} ريال`;

// Each day supplies a complete inventory of dated assets. Values are current
// valuations, never synthetic cash deposits. Cash withdrawals consume cash only.
const assetCategories = {
  gold: 'gold',
  silver: 'silver',
  stocks: 'stocks',
  investmentProducts: 'investmentProducts',
  properties: 'properties',
  cash: 'manualAssets',
};

function reconcileAssets(inventory, assetLots, date, wasAbove) {
  if (!Array.isArray(inventory))
    throw new TypeError('assets must be a complete daily array');
  const seen = new Set();
  for (const asset of inventory) {
    validateAssetFlags(asset);
    if (!asset || typeof asset.id !== 'string' || !asset.id) {
      throw new TypeError('each asset requires a stable non-empty id');
    }
    if (seen.has(asset.id))
      throw new TypeError(`duplicate asset id: ${asset.id}`);
    seen.add(asset.id);
    if (!Object.hasOwn(assetCategories, asset.kind))
      throw new TypeError('unsupported asset kind');
    if (
      !(asset.acquired instanceof Date) ||
      Number.isNaN(asset.acquired.getTime())
    ) {
      throw new TypeError('each asset requires a valid acquisition date');
    }
    assertDailyDate(asset.acquired, 'acquisition date');
    const previous = assetLots.get(asset.id);
    if (
      previous &&
      (previous.kind !== asset.kind ||
        previous.depositDate.getTime() !== asset.acquired.getTime())
    ) {
      throw new TypeError(
        'asset identity and acquisition date cannot change; use a new lot id',
      );
    }
    if (asset.acquired > date) {
      assetLots.delete(asset.id);
      continue;
    }
    const exempt =
      asset.zakatExempt ||
      (asset.kind === 'gold' && asset.purpose === 'PERSONAL_USE') ||
      (asset.kind === 'properties' &&
        ['USE', 'RENTAL'].includes(asset.intent)) ||
      (asset.kind === 'cash' && asset.zakatable === false);
    const value = calculateAssetValue({
      [assetCategories[asset.kind]]: [asset],
    });
    if (exempt) {
      assetLots.delete(asset.id);
      continue;
    }
    const quantity = ['gold', 'silver'].includes(asset.kind)
      ? asset.grams
      : asset.quantity;
    const fineness =
      asset.kind === 'gold'
        ? asset.karat === undefined
          ? 24
          : asset.karat
        : asset.kind === 'silver'
          ? asset.purity === undefined
            ? 1000
            : asset.purity
          : undefined;
    const treatment = asset.type ?? asset.intent;
    if (quantity !== undefined)
      assertFiniteNonNegative(quantity, 'asset quantity');
    if (previous) {
      if (
        previous.fineness !== fineness ||
        previous.treatment !== treatment ||
        (previous.quantity === undefined) !== (quantity === undefined)
      ) {
        throw new TypeError(
          'asset lot characteristics cannot change; use a new lot id',
        );
      }
      if (
        (quantity != null &&
          previous.quantity != null &&
          quantity > previous.quantity) ||
        (asset.kind === 'cash' && value > previous.amount)
      ) {
        throw new TypeError(
          'new purchases or cash additions require a new lot id and acquisition date',
        );
      }
      previous.amount = value;
      previous.quantity = quantity;
    } else {
      assetLots.set(asset.id, {
        id: asset.id,
        kind: asset.kind,
        amount: value,
        quantity,
        fineness,
        treatment,
        depositDate: asset.acquired,
        observedDate: date,
        start: wasAbove ? date : null,
      });
    }
  }
  for (const id of assetLots.keys()) if (!seen.has(id)) assetLots.delete(id);
}

export function runEngineDetailed(days, settings = defaultSettings) {
  validateShariaSettings(settings);
  if (!Array.isArray(days)) throw new TypeError('days must be an array');
  const lots = [],
    events = [],
    series = [];
  const assetLots = new Map();
  let assetMode = false;
  let previousDate = null;
  let wasAbove = false;

  for (const day of days) {
    validateDay(day);
    if (previousDate && day.date <= previousDate)
      throw new TypeError('days must be in strictly increasing date order');
    previousDate = day.date;
    for (const deposit of day.deposits ?? []) {
      if (deposit === 0) continue;
      lots.push({
        amount: validateCashAmount(deposit),
        depositDate: day.date,
        start: wasAbove ? day.date : null,
      });
    }
    for (const withdrawal of day.withdrawals ?? [])
      consume(lots, withdrawal, settings.spendOrder);

    if (Object.hasOwn(day, 'assets')) assetMode = true;
    if (assetMode) reconcileAssets(day.assets, assetLots, day.date, wasAbove);
    const currentAssets = [...assetLots.values()];
    const trackedLots = [...lots, ...currentAssets];
    const cashBalance = sum(lots),
      otherAssets = sum(currentAssets);
    const total = cashBalance + otherAssets,
      above = total >= day.nisab;
    assertMonetaryValue(total, 'daily total');
    if (!above && wasAbove) {
      trackedLots.forEach((lot) => (lot.start = null));
      events.push({
        type: 'BREAK',
        date: day.date,
        explanation: `في ${explanationDate.format(day.date)}، أصبح الوعاء البالغ ${moneyText(total)} دون النصاب البالغ ${moneyText(day.nisab)}، فانقطع الحول. يبدأ حول جديد عند بلوغ النصاب مجددًا.`,
      });
    }
    if (above && !wasAbove) {
      trackedLots.forEach((lot) => (lot.start ??= day.date));
      events.push({
        type: 'START',
        date: day.date,
        explanation: `في ${explanationDate.format(day.date)}، بلغ الوعاء ${moneyText(total)}، وبلغ النصاب البالغ ${moneyText(day.nisab)}، فبدأ تتبع الحول الهجري.`,
      });
    }
    wasAbove = above;

    if (above) {
      const due = trackedLots.filter(
        (lot) => lot.start && isHawlComplete(lot.start, day.date),
      );
      if (due.length) {
        const annualAdvance = settings.acquiredMoneyMode === 'ANNUAL_ADVANCE';
        const included = annualAdvance ? trackedLots : due;
        const base = sum(included);
        const event = {
          type: 'DUE',
          date: day.date,
          base,
          zakat: base / 40,
          explanation: annualAdvance
            ? `في ${explanationDate.format(day.date)}، اكتمل الحول الهجري للمبلغ المستحق، وأُدرج المال الأحدث تعجيلًا للزكاة. الوعاء ${moneyText(base)}، والزكاة ${moneyText(base / 40)} بنسبة ٢٫٥٪.`
            : `في ${explanationDate.format(day.date)}، اكتمل الحول الهجري للمبلغ المستحق البالغ ${moneyText(base)}، فوجبت زكاة قدرها ${moneyText(base / 40)} بنسبة ٢٫٥٪.`,
        };
        if (assetMode) {
          event.assets = included
            .filter((lot) => lot.id)
            .map((lot) => ({ id: lot.id, kind: lot.kind, value: lot.amount }));
          event.otherAssetsBase = event.assets.reduce(
            (value, asset) => value + asset.value,
            0,
          );
          event.cashBase = base - event.otherAssetsBase;
        }
        // No payable obligation exists when all matured lots are worth zero.
        if (base > 0) events.push(event);
        included.forEach((lot) => (lot.start = day.date));
      }
    }
    const row = { date: day.date, total, nisab: day.nisab, above };
    if (assetMode) Object.assign(row, { cashBalance, otherAssets });
    series.push(row);
  }

  const trackedLots = [...lots, ...assetLots.values()];
  const futureLots = trackedLots
    .filter((lot) => lot.start && lot.amount > 0)
    .map((lot) => ({
      ...lot,
      dueDate: resolveHawlDueDate(lot.start),
    }));
  const earliest = futureLots.reduce(
    (best, lot) => (!best || lot.dueDate < best.dueDate ? lot : best),
    null,
  );
  const nextDue = earliest && {
    start: earliest.start,
    targetHijri: hijri(earliest.dueDate),
    dueDate: earliest.dueDate,
    zakat:
      (settings.acquiredMoneyMode === 'ANNUAL_ADVANCE'
        ? sum(trackedLots)
        : sum(
            futureLots.filter(
              (lot) => lot.dueDate.getTime() === earliest.dueDate.getTime(),
            ),
          )) / 40,
  };
  const result = { events, series, lots: cloneLots(lots), nextDue };
  if (assetMode) result.assetLots = cloneLots([...assetLots.values()]);
  return result;
}

export function runEngine(days, settings = defaultSettings) {
  return runEngineDetailed(days, settings).events;
}

export const nisabFor = (p, s = defaultSettings) => {
  assertRecord(p, 'prices');
  assertRecord(s, 'settings');
  if (!['MIN', 'GOLD', 'SILVER'].includes(s.nisabBasis))
    throw new TypeError('unsupported nisab basis');
  // GOLD/SILVER remain supported for reference-price comparisons only.
  // The full project engine is restricted to the approved MIN basis.
  validateShariaSettings({ ...s, nisabBasis: 'MIN' });
  assertFiniteNonNegative(p?.gold, 'gold price');
  assertFiniteNonNegative(p?.silver, 'silver price');
  if (p.gold === 0 || p.silver === 0)
    throw new RangeError('nisab prices must be positive');
  const g = s.goldGrams * p.gold,
    v = s.silverGrams * p.silver;
  const nisab =
    s.nisabBasis === 'GOLD'
      ? g
      : s.nisabBasis === 'SILVER'
        ? v
        : Math.min(g, v);
  assertMonetaryValue(nisab, 'nisab');
  return nisab;
};

export function traditionalCalc(total, nisab) {
  assertMonetaryValue(total, 'total');
  assertMonetaryValue(nisab, 'nisab');
  if (nisab === 0) throw new RangeError('nisab must be positive');
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
