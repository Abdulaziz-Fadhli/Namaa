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
// يوم تمام الحول الهجري لمبلغ بدأ حوله في start (اليوم الأخير من الشهر إن لم يوجد اليوم نفسه)
export function resolveHawlDueDate(start) {
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
// Dates are mutable objects: copying only the lot exposes ownership facts.
const cloneLots = (lots) => lots.map((lot) => Object.fromEntries(
  Object.entries(lot).map(([key, value]) => [
    key, value instanceof Date ? new Date(value.getTime()) : value,
  ]),
));

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

function validateMetalPurpose(asset) {
  if (
    asset.purpose !== undefined &&
    ![
      'PERSONAL_USE',
      'LENDING',
      'SALE',
      'TRADING',
      'SAVED_FOR_SALE',
      'RENTAL',
      'INVESTMENT',
    ].includes(asset.purpose)
  )
    throw new TypeError('unsupported metal purpose');
}

export function calculateAssetValue(data, options) {
  assertRecord(data, 'asset data');
  const strict = strictMode(options);
  // Check original identities before normalization creates fresh fund objects.
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
  if (strict) {
    data = Object.fromEntries(Object.entries(data).map(([key, value]) => [key,
      key === 'investmentProducts' && Array.isArray(value) ? value.map(normalizeStrictAsset) : value,
    ]));
    const issue = inspectStrictValuation(data);
    if (issue) return { ...issue, value: null };
  }
  let total = 0;

  // Gold
  for (const gold of data.gold ?? []) {
    validateMetalPurpose(gold);
    if (gold.zakatExempt) continue;
    assertFiniteNonNegative(gold.grams, 'gold grams');
    if (strict && ['PERSONAL_USE', 'LENDING'].includes(gold.purpose)) continue;
    assertFiniteNonNegative(gold.pricePerGram, 'gold price per gram');

    // Used/personal jewelry is excluded.
    // Other gold is included in the zakat base.
    if (!['PERSONAL_USE', 'LENDING'].includes(gold.purpose)) {
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
    validateMetalPurpose(silver);
    if (silver.zakatExempt) continue;
    assertFiniteNonNegative(silver.grams, 'silver grams');
    if (strict && ['PERSONAL_USE', 'LENDING'].includes(silver.purpose)) continue;
    assertFiniteNonNegative(silver.pricePerGram, 'silver price per gram');

    if (['PERSONAL_USE', 'LENDING'].includes(silver.purpose)) continue;
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
  const records = ['gold', 'silver', 'stocks', 'investmentProducts', 'properties', 'manualAssets'].flatMap(key => data[key] ?? []);
  const allExempt = records.length > 0 && records.every(a => a.zakatExempt || ['PERSONAL_USE', 'LENDING'].includes(a.purpose) || ['USE', 'RENTAL'].includes(a.intent));
  return strict ? { status: allExempt ? 'EXEMPT' : total > 0 ? 'CALCULATED' : 'ZERO', value: total, zakat: null } : total;
}

export function calculateZakatableSnapshot(data, options) {
  assertRecord(data, 'snapshot data');
  if (strictMode(options) && data.cashBalance == null)
    return { ...ruleResult('UNKNOWN', 'G-CASH', 'MISSING_CASH_BALANCE', ['cashBalance']), cashBalance: null, otherAssets: null, total: null };
  const cashBalance = data.cashBalance ?? 0;

  assertMonetaryValue(cashBalance, 'cash balance');

  const assets = calculateAssetValue(data, options);
  if (strictMode(options) && assets.value === null)
    return { ...assets, cashBalance, otherAssets: null, total: null };
  const otherAssets = strictMode(options) ? assets.value : assets;

  assertMonetaryValue(cashBalance + otherAssets, 'snapshot total');
  return {
    ...(strictMode(options) ? { status: cashBalance === 0 && assets.status === 'EXEMPT' ? 'EXEMPT' : cashBalance + otherAssets === 0 ? 'ZERO' : 'CALCULATED' } : {}),
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

// Capture the approved defaults once; the exported legacy object remains
// mutable only for compatibility. Strict callers never inherit hidden edits.
const canonicalSettings = Object.freeze({ ...defaultSettings });
function strictMode(options) {
  if (options?.validationMode !== undefined && !['legacy', 'strict'].includes(options.validationMode))
    throw new TypeError('validationMode must be legacy or strict');
  return options?.validationMode === 'strict';
}
function ruleResult(status, ruleId, reasonCode, facts = [], extra = {}) {
  return { status, ruleId, reasonCode, facts, message: `${ruleId}: ${reasonCode}`, zakat: null, ...extra };
}
function incompleteRun(issue, policy) {
  return { ...issue, issues: [issue], events: [{ type: 'REVIEW', ...issue }], series: [], lots: [], assetLots: [], nextDue: null, actualDue: null, suggestedAdvance: null, paymentRecorded: false, policyApplied: policy };
}

function normalizeStrictAsset(asset) {
  let normalized = { ...asset };
  if (asset.zakatableValue != null) assertMonetaryValue(asset.zakatableValue, 'declared zakatable value');
  if (asset.fundZakatableBase != null) assertMonetaryValue(asset.fundZakatableBase, 'fund zakatable base');
  if (asset.ownershipShare != null) {
    assertFiniteNonNegative(asset.ownershipShare, 'ownership share');
    if (asset.ownershipShare > 1) throw new RangeError('ownership share must not exceed 1');
  }
  if (asset.kind === 'cash' && asset.value != null) validateCashAmount(asset.value);
  if (asset.kind === 'receivable') {
    if (!['SOLVENT_NON_DELAYING', 'DOUBTFUL'].includes(asset.recovery))
      return normalized;
    normalized = { ...asset, kind: 'cash', type: asset.recovery === 'DOUBTFUL' ? 'DOUBTFUL_RECEIVABLE' : 'RECEIVABLE', ...(asset.recovery === 'DOUBTFUL' ? { value: 0 } : {}) };
  }
  if (asset.type === 'LONG_TERM' && asset.fundZakatableBase != null && asset.ownershipShare != null) {
    assertMonetaryValue(asset.fundZakatableBase, 'fund zakatable base');
    assertFiniteNonNegative(asset.ownershipShare, 'ownership share');
    if (asset.ownershipShare > 1) throw new RangeError('ownership share must not exceed 1');
    const value = asset.fundZakatableBase * asset.ownershipShare;
    if (asset.zakatableValue != null && Math.abs(asset.zakatableValue - value) > 0.005) throw new RangeError('fund zakatable bases do not reconcile');
    normalized.zakatableValue = value;
  }
  return normalized;
}

// G pp18–24: share the existing valuation formulas after validating facts.
function inspectStrictValuation(data) {
  const categories = ['gold', 'silver', 'stocks', 'investmentProducts', 'properties', 'manualAssets'];
  for (const key of Object.keys(data)) if (!categories.includes(key) && !['cashBalance', 'metadata'].includes(key)) throw new TypeError(`unsupported asset category: ${key}`);
  for (const category of ['gold', 'silver', 'stocks', 'investmentProducts', 'properties', 'manualAssets']) {
    for (const asset of optionalArray(data[category], category)) {
      validateAssetFlags(asset);
      for (const field of ['value', 'grams', 'pricePerGram', 'karat', 'purity', 'marketValue', 'zakatableValue', 'quantity'])
        if (asset[field] != null) assertMonetaryValue(asset[field], field);
      if (asset.karat != null && (asset.karat <= 0 || asset.karat > 24)) throw new RangeError('invalid gold karat');
      if (asset.purity != null && (asset.purity <= 0 || asset.purity > 1000)) throw new RangeError('invalid silver purity');
      if (asset.acquired == null) return ruleResult('UNKNOWN', 'G-OWNERSHIP', 'MISSING_ACQUISITION', ['acquired']);
      assertDailyDate(asset.acquired, 'acquisition date');
      if (asset.zakatExempt) {
        if (category === 'stocks' && asset.type === 'TRADING') return ruleResult('UNRESOLVED', 'G-STOCK', 'COMPANY_PAYMENT_DOES_NOT_ESTABLISH_TRADING_EXEMPTION', ['trading shareholder obligation versus company payment']);
        if (category === 'stocks' && asset.type == null) return ruleResult('UNKNOWN', 'G-STOCK', 'MISSING_REQUIRED_FACT', ['type']);
        if (category === 'stocks' && asset.type !== 'LONG_TERM') throw new TypeError('unsupported stock type');
        if (category !== 'stocks' || asset.companyZakatPaid !== true || asset.companyEvidence?.jurisdiction !== 'SA' || !asset.companyEvidence?.source?.trim() || asset.companyEvidence?.coversHolding !== true)
          return ruleResult('UNKNOWN', 'G-STOCK', 'MISSING_EXEMPTION_EVIDENCE', ['company payment evidence covering this holding']);
        continue;
      }
      let required;
      if (['gold', 'silver'].includes(category)) {
        required = ['purpose', 'grams', category === 'gold' ? 'karat' : 'purity'];
        if (!['PERSONAL_USE', 'LENDING'].includes(asset.purpose)) required.push('pricePerGram');
      } else if (['stocks', 'investmentProducts'].includes(category)) {
        required = ['type'];
        if (asset.type === 'TRADING') required.push('marketValue');
        if (asset.type === 'LONG_TERM') required.push('zakatableValue');
      } else if (category === 'properties') required = ['intent', ...(asset.intent === 'TRADING' ? ['marketValue'] : [])];
      else required = ['value'];
      const missing = required.filter(field => asset[field] == null);
      if (missing.length) return ruleResult('UNKNOWN', `G-${category.toUpperCase()}`, 'MISSING_REQUIRED_FACT', missing);
      if (asset.pricePerGram === 0) throw new RangeError('metal price must be positive');
      if (asset.companyZakatPaid === true)
        return ruleResult('UNKNOWN', 'G-STOCK', 'MISSING_EXEMPTION_EVIDENCE', ['explicit exemption scope']);
      if (category === 'manualAssets' && asset.zakatable === false)
        return ruleResult('UNRESOLVED', 'G-CASH', 'UNSUPPORTED_CASH_EXEMPTION', ['exemption basis']);
    }
  }
  return null;
}

function strictNisab(day, flowCash = 0, describe = false) {
  const threshold = (value, basis) => describe ? { value, basis } : value;
  const included = (day.assets ?? []).filter(a => {
    if (a.recovery === 'DOUBTFUL') return false;
    const normalized = normalizeStrictAsset(a);
    return calculateAssetValue({ [assetCategories[normalized.kind]]: [normalized] }, { validationMode: 'strict' }).value > 0;
  });
  const metals = included.filter(a => ['gold', 'silver'].includes(a.kind) && a.purpose !== 'TRADING');
  const kinds = new Set(included.map(a => a.kind));
  if (metals.length && metals.length === included.length && kinds.size === 1 && flowCash === 0) {
    const kind = metals[0].kind;
    const prices = new Set(metals.map(a => a.pricePerGram));
    if (prices.size !== 1) throw new TypeError('inconsistent pure-metal prices in snapshot');
    return threshold((kind === 'gold' ? 85 : 595) * metals[0].pricePerGram, kind.toUpperCase());
  }
  if (day.prices?.gold == null || day.prices?.silver == null)
    return ruleResult('UNKNOWN', 'G-NISAB', 'MISSING_PRICES', ['prices.gold', 'prices.silver']);
  return threshold(nisabFor(day.prices, canonicalSettings), 'MIN');
}

// G pp13–14,18–24: strict history is evidence, not a guessed opening balance.
function inspectStrictHistory(days) {
  if (!days.length) return ruleResult('UNKNOWN', 'G-HISTORY', 'NEEDS_HISTORY_REVIEW', ['days']);
  // A ledger may coexist with inventory or begin producing flows later.
  // Its opening and every daily flow list must still be explicitly known.
  const usesCashLedger = days.some(day => day && (
    !Object.hasOwn(day, 'assets') ||
    ['deposits', 'withdrawals', 'cashBalance', 'openingBalanceKnown'].some(key => Object.hasOwn(day, key))
  ));
  let previous = null;
  const retired = new Set(), active = new Set();
  let previousAssets = new Map();
  for (const day of days) {
    assertRecord(day, 'day');
    assertDailyDate(day.date, 'day date');
    if (previous && day.date <= previous) throw new TypeError('days must be in strictly increasing date order');
    if (previous && day.date - previous !== 86400000)
      return ruleResult('UNKNOWN', 'G-HISTORY', 'NEEDS_HISTORY_REVIEW', ['continuous daily history']);
    if (usesCashLedger) {
      if ((!previous && day.openingBalanceKnown !== true) || !Array.isArray(day.deposits) || !Array.isArray(day.withdrawals))
        return ruleResult('UNKNOWN', 'G-CASH', 'NEEDS_HISTORY_REVIEW', ['openingBalanceKnown', 'deposits', 'withdrawals']);
    }
    if (Object.hasOwn(day, 'assets')) {
      if (!Array.isArray(day.assets)) throw new TypeError('assets must be a complete daily array');
      const seen = new Set();
      for (const asset of day.assets) {
        assertRecord(asset, 'asset');
        if (typeof asset.id !== 'string' || !asset.id.trim()) throw new TypeError('stable asset id required');
        if (seen.has(asset.id)) throw new TypeError('duplicate asset id');
        seen.add(asset.id);
        if (retired.has(asset.id)) throw new TypeError('retired asset id cannot be reused');
        if (asset.acquired == null) return ruleResult('UNKNOWN', 'G-OWNERSHIP', 'MISSING_ACQUISITION', ['acquired']);
        assertDailyDate(asset.acquired, 'acquisition date');
        if (asset.acquired > day.date) throw new RangeError('acquisition cannot be in the future');
        if (!previousAssets.has(asset.id) && asset.acquired < day.date)
          return ruleResult('UNKNOWN', 'G-HISTORY', 'NEEDS_HISTORY_REVIEW', ['history since acquisition']);
        const old = previousAssets.get(asset.id);
        if (old && (old.acquired.getTime() !== asset.acquired.getTime() || ['kind', 'purpose', 'type', 'intent', 'karat', 'purity', 'tradeCapital', 'recovery', 'zakatExempt'].some(key => old[key] !== asset[key])))
          throw new TypeError('asset identity/characteristics changed; use a new lot id');
        if (asset.kind === 'receivable' && asset.recovery == null) return ruleResult('UNKNOWN', 'G-RECEIVABLE', 'MISSING_RECOVERY_FACT', ['recovery']);
        if (asset.kind === 'receivable' && !['SOLVENT_NON_DELAYING', 'DOUBTFUL'].includes(asset.recovery)) throw new TypeError('invalid recovery fact');
        if (asset.kind === 'receivable' && asset.value == null) return ruleResult('UNKNOWN', 'G-RECEIVABLE', 'MISSING_REQUIRED_FACT', ['value']);
        if (asset.kind === 'receivable') assertMonetaryValue(asset.value, 'receivable value');
        const normalized = normalizeStrictAsset(asset);
        if (!Object.hasOwn(assetCategories, normalized.kind)) throw new TypeError('unsupported asset kind');
        const valuation = calculateAssetValue({ [assetCategories[normalized.kind]]: [normalized] }, { validationMode: 'strict' });
        if (valuation.value === null) return valuation;
        if (['gold', 'silver'].includes(asset.kind) && valuation.value > 0 && day.prices?.[asset.kind] != null && day.prices[asset.kind] !== asset.pricePerGram)
          throw new RangeError('metal valuation price does not match the snapshot price');
        if (asset.hawlSource) validateStrictLineage(asset, day.assets, previousAssets);
      }
      for (const id of active) if (!seen.has(id)) retired.add(id);
      active.clear();
      for (const id of seen) active.add(id);
      previousAssets = new Map(day.assets.map(asset => [asset.id, asset]));
    }
    const threshold = strictNisab(day);
    if (typeof threshold !== 'number') return threshold;
    previous = day.date;
  }
  return null;
}

// G pp19–22: validate economic continuity before using the existing lot starts.
function validateStrictLineage(target, current, previous) {
  const link = target.hawlSource;
  assertRecord(link, 'hawlSource');
  const source = previous.get(link.sourceId);
  if (!source || previous.has(target.id)) throw new TypeError('lineage requires a previous source and a new target');
  const trade = asset => asset.tradeCapital === true || asset.type === 'TRADING' || asset.intent === 'TRADING';
  if (link.type === 'TRADE_PROFIT') {
    if (!trade(source) || target.kind !== 'cash' || link.transferredValue !== undefined || !current.some(a => a.id === source.id)) throw new TypeError('profit requires retained trade capital and a cash target');
    return;
  }
  if (!['TRADE_CONVERSION', 'DEBT_RECOVERY'].includes(link.type)) throw new TypeError('unsupported lineage type');
  if (link.type === 'TRADE_CONVERSION' && !trade(source) && !trade(target)) throw new TypeError('conversion requires trade goods');
  if (link.type === 'DEBT_RECOVERY' && (source.kind !== 'receivable' || target.kind !== 'cash')) throw new TypeError('recovery requires receivable to cash');
  const value = a => a.kind === 'receivable' ? a.value : calculateAssetValue({ [assetCategories[normalizeStrictAsset(a).kind]]: [normalizeStrictAsset(a)] });
  assertMonetaryValue(link.transferredValue, 'transferred value');
  const remaining = current.find(a => a.id === source.id);
  const transferred = current.filter(a => a.hawlSource?.sourceId === source.id && a.hawlSource.type !== 'TRADE_PROFIT').reduce((n, a) => n + a.hawlSource.transferredValue, 0);
  if (Math.abs(value(source) - (remaining ? value(remaining) : 0) - transferred) > 0.005 || Math.abs(value(target) - link.transferredValue) > 0.005)
    throw new RangeError('lineage values do not reconcile; duplicated or missing capital');
}

export function validateShariaSettings(settings) {
  assertRecord(settings, 'settings');
  strictMode(settings);
  if (strictMode(settings)) settings = { ...canonicalSettings, ...settings };
  for (const key of Object.keys(settings)) {
    if (key !== 'validationMode' && !Object.hasOwn(canonicalSettings, key))
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

// نصاب الحبوب والثمار خمسة أوسق: 612 كغ تقريبًا من القمح ونحوه (دليل زكاة الأفراد، هيئة الزكاة ص12)،
// وبالكيل 5 أوسق × 60 صاعًا × 3 لترات = 900 لتر (دليل بهيمة الأنعام والحبوب والثمار ص10).
export const CROP_NISAB_KG = 612;
export const CROP_NISAB_LITERS = 900;
export const CROP_NISAB_SAA = 300;
// مقدار الواجب حسب كلفة السقي: العشر بلا كلفة، ونصفه بكلفة، وثلاثة أرباعه إذا سُقي نصف السنة بهذا ونصفها بذاك.
export const CROP_RATES = Object.freeze({ WITHOUT_COST: 0.1, WITH_COST: 0.05, HALF_COST: 0.075 });

export function evaluateCropZakat(crop, options) {
  if (!crop || typeof crop !== 'object') {
    throw new TypeError('crop must be an object');
  }

  if (strictMode(options)) {
    const unknown = (rule, facts) => ruleResult('UNKNOWN', rule, 'MISSING_REQUIRED_FACT', facts, { dueQuantity: null, requiresHawl: false });
    if (crop.quantity != null) assertFiniteNonNegative(crop.quantity, 'crop quantity');
    if (crop.quantity > MAX_MONETARY_VALUE) throw new RangeError('crop quantity exceeds supported range');
    if (crop.aggregate === true) return ruleResult('UNRESOLVED', 'C11', 'NOT_RESOLVED_BY_SOURCE', ['crop aggregation'], { dueQuantity: null });
    if (crop.classification == null) return unknown('C01', ['classification']);
    const knownClasses = { WHEAT: 'GRAIN', BARLEY: 'GRAIN', DATES: 'STORABLE_FRUIT', OLIVES: 'STORABLE_FRUIT', PISTACHIOS: 'STORABLE_FRUIT', ALMONDS: 'STORABLE_FRUIT', VEGETABLES: 'NON_ZAKATABLE', ORANGES: 'NON_ZAKATABLE', BANANAS: 'NON_ZAKATABLE', APPLES: 'NON_ZAKATABLE', FIGS: 'NON_ZAKATABLE' };
    if (Object.hasOwn(knownClasses, crop.kind) && knownClasses[crop.kind] !== crop.classification) throw new TypeError('crop classification contradicts source facts');
    if (crop.classification === 'NON_ZAKATABLE') return { status: 'EXEMPT', ruleId: 'C02', zakat: 0, dueQuantity: 0, requiresHawl: false };
    if (!['GRAIN', 'STORABLE_FRUIT'].includes(crop.classification)) return ruleResult('UNRESOLVED', 'C01', 'NOT_RESOLVED_BY_SOURCE', ['crop classification'], { dueQuantity: null });
    const required = ['quantity', 'unit', 'measurementState', 'ownedAtObligation', 'obligationReached', 'irrigation'];
    const missing = required.filter(key => crop[key] == null);
    if (missing.length) return unknown('C03-C10', missing);
    for (const key of ['ownedAtObligation', 'obligationReached']) if (typeof crop[key] !== 'boolean') throw new TypeError(`${key} must be boolean`);
    if (crop.ownedAtObligation === false) return { status: 'EXEMPT', ruleId: 'C06', zakat: 0, dueQuantity: 0, requiresHawl: false };
    const state = crop.classification === 'GRAIN' ? 'CLEANED_GRAIN' : 'DRIED_FRUIT';
    if (crop.measurementState !== state) return unknown('C05', [`quantity measured as ${state}`]);
    let nisab;
    if (crop.unit === 'L') nisab = 900;
    else if (crop.unit === 'SAA') nisab = 300;
    else if (crop.unit === 'AWSUQ') nisab = 5;
    else if (crop.unit === 'KG' && crop.kind === 'WHEAT' && crop.goodWheat === true) nisab = 612;
    else return ruleResult('UNRESOLVED', 'C04', 'NOT_RESOLVED_BY_SOURCE', ['crop-specific weight conversion'], { dueQuantity: null });
    const rates = CROP_RATES;
    if (!Object.hasOwn(rates, crop.irrigation)) return ruleResult('UNRESOLVED', 'C10', 'NOT_RESOLVED_BY_SOURCE', ['irrigation outside documented categories'], { dueQuantity: null });
    const eligible = crop.quantity >= nisab;
    const dueQuantity = eligible && crop.obligationReached ? crop.quantity * rates[crop.irrigation] : 0;
    let settlementValue = null;
    if (crop.pricePerUnit != null) {
      assertMonetaryValue(crop.pricePerUnit, 'crop price per declared unit');
      if (!crop.pricePerUnit) throw new RangeError('crop price must be positive');
      settlementValue = dueQuantity * crop.pricePerUnit;
      assertMonetaryValue(settlementValue, 'crop settlement value');
    }
    return { status: dueQuantity > 0 ? 'CALCULATED' : 'ZERO', ruleId: 'C01-C10', kind: crop.kind ?? null, quantity: crop.quantity, unit: crop.unit, nisab, eligible, rate: rates[crop.irrigation], dueQuantity, settlementValue, zakat: null, requiresHawl: false, dueAtHarvest: eligible && crop.obligationReached };
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

export function evaluateLivestockZakat(livestock, options) {
  if (!livestock || typeof livestock !== 'object') {
    throw new TypeError('livestock must be an object');
  }

  if (strictMode(options)) return evaluateStrictLivestock(livestock);

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

// L05/L17, D6–9/F7–10,23. Integer obligations, never an invented cash price.
function animalObligation(animal, count) {
  const age = { BINT_MAKHAD: 1, BINT_LABUN: 2, HIQQA: 3, JADHAA: 4, TABI: 1, MUSINNA: 2 };
  return { animal, count, minAgeYears: age[animal], sex: animal === 'TABI' ? 'MALE_OR_FEMALE' : 'FEMALE' };
}
function combinations(count, firstSize, secondSize, firstAnimal, secondAnimal) {
  const target = Math.floor(count / 10) * 10;
  const alternatives = [];
  for (let second = 0; second * secondSize <= target; second++) {
    const remaining = target - second * secondSize;
    if (remaining % firstSize === 0) alternatives.push([
      ...(remaining ? [animalObligation(firstAnimal, remaining / firstSize)] : []),
      ...(second ? [animalObligation(secondAnimal, second)] : []),
    ]);
  }
  return alternatives;
}
// جدول الفريضة في بهيمة الأنعام كما في الدليل المبسط لجباية زكاة بهيمة الأنعام والحبوب والثمار
// (هيئة الزكاة والضريبة والجمارك، ص6–8). يعيد بدائل الفريضة؛ لكل بديل قائمة الحيوانات الواجبة.
export function livestockObligations(type, count) {
  if (!['camels', 'cattle', 'sheep', 'goats'].includes(type)) throw new TypeError('unsupported livestock type');
  if (!Number.isSafeInteger(count) || count < 0) throw new RangeError('livestock count must be a non-negative safe integer');
  if (type === 'sheep' || type === 'goats') {
    const due = count < 40 ? 0 : count <= 120 ? 1 : count <= 200 ? 2 : count <= 399 ? 3 : Math.floor(count / 100);
    return due ? [[{ animal: type === 'goats' ? 'GOAT' : 'SHEEP', count: due, minAgeMonths: type === 'goats' ? 12 : 6, sex: 'FEMALE', quality: 'AVERAGE_HEALTHY' }]] : [];
  }
  if (type === 'cattle') {
    if (count < 30) return [];
    if (count < 40) return [[animalObligation('TABI', 1)]];
    if (count < 60) return [[animalObligation('MUSINNA', 1)]];
    return combinations(count, 30, 40, 'TABI', 'MUSINNA');
  }
  if (count < 5) return [];
  if (count < 25) return [[{ animal: 'SHEEP_OR_GOAT', count: Math.floor(count / 5), alternatives: [{ animal: 'SHEEP', minAgeMonths: 6 }, { animal: 'GOAT', minAgeMonths: 12 }], sex: 'FEMALE', quality: 'AVERAGE_HEALTHY' }]];
  const ranges = [[35, 'BINT_MAKHAD', 1], [45, 'BINT_LABUN', 1], [60, 'HIQQA', 1], [75, 'JADHAA', 1], [90, 'BINT_LABUN', 2], [120, 'HIQQA', 2]];
  for (const [maximum, animal, number] of ranges) if (count <= maximum) return [[animalObligation(animal, number)]];
  return combinations(count, 40, 50, 'BINT_LABUN', 'HIQQA');
}

function evaluateStrictLivestock(input) {
  const type = typeof input.type === 'string' ? input.type.toLowerCase() : input.type;
  const unknown = facts => ruleResult('UNKNOWN', 'L01-L17', 'MISSING_REQUIRED_FACT', facts, { alternatives: null, obligationCount: null });
  const blocked = (id, facts) => ruleResult('BLOCKED_PENDING_REVIEW', id, 'SOURCE_REVIEW_REQUIRED', facts, { alternatives: null, obligationCount: null });
  if (type == null || input.count == null) return unknown(['type', 'count']);
  if (!['camels', 'cattle', 'sheep', 'goats'].includes(type)) throw new TypeError('unsupported livestock type');
  assertFiniteNonNegative(input.count, 'livestock count');
  if (!Number.isSafeInteger(input.count) || input.count > 1000000) throw new RangeError('livestock count outside supported integer range');
  let effectiveCount = input.count;
  if (input.lostCount != null) {
    if (!Number.isSafeInteger(input.lostCount) || input.lostCount < 0 || input.lostCount > input.count) throw new RangeError('invalid lost animal count');
    if (type !== 'camels') return ruleResult('UNRESOLVED', 'L11', 'NOT_RESOLVED_BY_SOURCE', ['loss of non-camel livestock']);
    effectiveCount -= input.lostCount;
  }
  for (const flag of ['feedingDuringGrazing', 'pastDueValuation', 'fatteningProject', 'wholeHerdEmaciated']) if (input[flag] != null && typeof input[flag] !== 'boolean') throw new TypeError(`${flag} must be boolean`);
  if (input.purpose == null) return unknown(['purpose']);
  if (input.pastDueValuation) return blocked('R04', ['valuation of a previous livestock obligation']);
  if (input.purpose === 'TRADING' && input.fatteningProject) return blocked('R03', ['purchase value versus current market value']);
  if (input.purpose === 'WORK' && ['BREEDING_STUD', 'SHEPHERD_RIDING'].includes(input.workRole)) return blocked('R05', ['working animal exception']);
  const ibnLabun = type === 'camels' && effectiveCount >= 25 && effectiveCount <= 35 && input.requestedAnimal === 'IBN_LABUN';
  const numericalNisab = type === 'camels' ? 5 : type === 'cattle' ? 30 : 40;
  const maleTabi = type === 'cattle' && livestockObligations(type, effectiveCount).some(items => items.every(a => a.animal === 'TABI'));
  if (input.requestedSex === 'MALE' && effectiveCount >= numericalNisab && !ibnLabun && !maleTabi) return blocked('R01', ['sex of required animal']);
  if (['MOST_YEAR', 'ALL_YEAR'].includes(input.grazing) && input.feedingDuringGrazing) return blocked('R02', ['feeding throughout a mostly or fully grazing year']);
  if (['PURCHASE', 'GIFT', 'INHERITANCE'].includes(input.countChange)) return blocked('R06', ['new animals and the herd hawl']);
  if (input.purpose === 'WORK') {
    if (input.workRole == null) return unknown(['workRole to exclude R05 exceptions']);
    if (!['DRAFT', 'TRANSPORT', 'RACING'].includes(input.workRole)) return ruleResult('UNRESOLVED', 'L02', 'NOT_RESOLVED_BY_SOURCE', ['workRole']);
    return { status: 'EXEMPT', ruleId: 'L02', zakat: 0, obligationCount: 0, alternatives: [] };
  }
  if (!['PRODUCTION', 'TRADING'].includes(input.purpose)) throw new TypeError('unsupported livestock purpose');
  const required = ['acquired', 'asOf', ...(input.purpose === 'PRODUCTION' ? ['grazing', 'countChange'] : ['marketValue', 'nisab', 'nisabMaintained'])];
  const missing = required.filter(key => input[key] == null);
  if (missing.length) return unknown(missing);
  assertDailyDate(input.acquired, 'livestock acquisition');
  assertDailyDate(input.asOf, 'livestock asOf');
  if (input.acquired > input.asOf) throw new RangeError('livestock acquisition in future');
  if (input.purpose === 'TRADING') {
    assertMonetaryValue(input.marketValue, 'livestock market value');
    assertMonetaryValue(input.nisab, 'livestock trade nisab');
    if (!input.nisab) throw new RangeError('nisab must be positive');
    if (input.nisabMaintained !== true) return unknown(['uninterrupted trade nisab history']);
    const zakat = isHawlComplete(input.acquired, input.asOf) ? traditionalCalc(input.marketValue, input.nisab) : 0;
    return { status: zakat ? 'CALCULATED' : 'ZERO', ruleId: 'L14', route: 'TRADE_GOODS', zakat, paymentRecorded: false };
  }
  if (input.grazing === 'FED_ALL_YEAR' || input.grazing === 'FED_MOST_YEAR') return { status: 'EXEMPT', ruleId: 'L03', zakat: 0, alternatives: [], obligationCount: 0 };
  if (!['ALL_YEAR', 'MOST_YEAR'].includes(input.grazing)) return ruleResult('UNRESOLVED', 'L03', 'NOT_RESOLVED_BY_SOURCE', ['grazing duration/category'], { alternatives: null, obligationCount: null });
  let start = input.acquired;
  if (input.countChange === 'OFFSPRING') {
    const facts = input.offspring;
    if (!facts || ['parentCount', 'offspringCount', 'parentsHawlStart'].some(key => facts[key] == null)) return unknown(['offspring lineage and parent hawl']);
    for (const key of ['parentCount', 'offspringCount']) if (!Number.isSafeInteger(facts[key]) || facts[key] < 0) throw new RangeError('invalid offspring count');
    if (facts.parentCount + facts.offspringCount !== input.count) throw new RangeError('offspring counts do not reconcile');
    if (facts.parentCount >= (type === 'camels' ? 5 : type === 'cattle' ? 30 : 40)) start = facts.parentsHawlStart;
    else { if (facts.thresholdReached == null) return unknown(['offspring thresholdReached']); start = facts.thresholdReached; }
    assertDailyDate(start, 'offspring hawl start');
    if (start > input.asOf || start < input.acquired) throw new RangeError('invalid offspring hawl chronology');
  } else if (input.countChange === 'SEPARATED_MIXTURE') {
    if (input.previousMixtureHawlEnd == null || input.individualNisabMaintained !== true) return unknown(['previousMixtureHawlEnd', 'individualNisabMaintained']);
    assertDailyDate(input.previousMixtureHawlEnd, 'previous mixture hawl end');
    if (input.previousMixtureHawlEnd < input.acquired || input.previousMixtureHawlEnd > input.asOf) throw new RangeError('invalid separated mixture chronology');
    start = input.previousMixtureHawlEnd;
  } else if (input.countChange !== 'STABLE') return ruleResult('UNRESOLVED', 'L07', 'NOT_RESOLVED_BY_SOURCE', ['count changes during hawl'], { alternatives: null });
  if (input.mixture) {
    const m = input.mixture;
    if (!Array.isArray(m.owners) || !m.owners.length || m.start == null) return unknown(['mixture owners and start']);
    const shared = ['marah', 'masrah', 'water', 'milking', 'stud', 'pastureTime', 'pasturePlace'];
    if (shared.some(key => m.shared?.[key] !== true)) return ruleResult('UNRESOLVED', 'L09', 'MIXTURE_CONDITIONS_NOT_ESTABLISHED', shared);
    let total = 0;
    const ownerIds = new Set();
    for (const owner of m.owners) {
      if (owner.eligibleOwner !== true || owner.acquired == null) return unknown(['eligible owners and individual ownership hawls']);
      if (typeof owner.id !== 'string' || ownerIds.has(owner.id)) throw new TypeError('duplicate or invalid mixture owner');
      ownerIds.add(owner.id);
      if (!Number.isSafeInteger(owner.count) || owner.count < 0) throw new RangeError('invalid mixture owner count');
      assertDailyDate(owner.acquired, 'mixture owner acquisition');
      if (!isHawlComplete(owner.acquired, input.asOf)) return ruleResult('UNRESOLVED', 'L09', 'MIXTURE_HAWL_NOT_ESTABLISHED', ['individual hawl']);
      total += owner.count;
    }
    if (total !== input.count) throw new RangeError('mixture count does not reconcile');
    assertDailyDate(m.start, 'mixture start');
    if (!isHawlComplete(m.start, input.asOf)) return ruleResult('UNRESOLVED', 'L09', 'MIXTURE_HAWL_NOT_ESTABLISHED', ['full mixture hawl']);
  }
  const alternatives = isHawlComplete(start, input.asOf) ? livestockObligations(type, effectiveCount) : [];
  const obligationCount = alternatives.length === 1 ? alternatives[0].reduce((n, a) => n + a.count, 0) : alternatives.length ? null : 0;
  let settlementValue = null;
  if (input.sheepCount != null || input.goatCount != null) {
    if (!['sheep', 'goats'].includes(type)) throw new TypeError('sheep/goat combination belongs to sheep');
    for (const key of ['sheepCount', 'goatCount']) if (!Number.isSafeInteger(input[key]) || input[key] < 0) throw new RangeError('invalid sheep/goat count');
    if (input.sheepCount + input.goatCount !== input.count) throw new RangeError('sheep/goat count does not reconcile');
    if (input.sheepCount > 0 && input.goatCount > 0 && alternatives.length) {
      if (input.sheepAverageValue == null || input.goatAverageValue == null) return unknown(['sheepAverageValue', 'goatAverageValue for proportional obligation']);
      assertMonetaryValue(input.sheepAverageValue, 'sheep average value');
      assertMonetaryValue(input.goatAverageValue, 'goat average value');
      if (!input.sheepAverageValue || !input.goatAverageValue) throw new RangeError('average livestock value must be positive');
      settlementValue = obligationCount * (input.sheepAverageValue * input.sheepCount + input.goatAverageValue * input.goatCount) / input.count;
      alternatives[0][0] = { animal: 'SHEEP_OR_GOAT', count: obligationCount, valueMustCover: settlementValue, alternatives: [{ animal: 'SHEEP', minAgeMonths: 6 }, { animal: 'GOAT', minAgeMonths: 12 }], sex: 'FEMALE', quality: 'AVERAGE_HEALTHY' };
    }
  }
  const documentedSubstitutions = type === 'camels' && effectiveCount >= 25 && effectiveCount <= 35 ? [{ replaces: 'BINT_MAKHAD', animal: 'IBN_LABUN', minAgeYears: 2, sex: 'MALE' }] : [];
  if (input.wholeHerdEmaciated === true) for (const alternative of alternatives) for (const animal of alternative) animal.quality = 'HERD_AVERAGE_EMACIATION_ALLOWED';
  return { status: alternatives.length ? 'CALCULATED' : 'ZERO', ruleId: 'L01-L17', type, count: input.count, effectiveCount, nisab: numericalNisab, requiresHawl: true, alternatives, documentedSubstitutions, obligationCount, settlementValue, requirements: { quality: 'AVERAGE_OF_HERD', freeFromDefects: true, emaciationAllowed: input.wholeHerdEmaciated === true }, selectedAlternative: null, zakat: alternatives.length ? null : 0, paymentRecorded: false };
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

function reconcileAssets(inventory, assetLots, date, wasAbove, strict = false) {
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
      (['gold', 'silver'].includes(asset.kind) &&
        ['PERSONAL_USE', 'LENDING'].includes(asset.purpose)) ||
      (asset.kind === 'properties' &&
        ['USE', 'RENTAL'].includes(asset.intent)) ||
      (asset.kind === 'cash' && asset.zakatable === false);
    const valuation = calculateAssetValue({
      [assetCategories[asset.kind]]: [asset],
    }, strict ? { validationMode: 'strict' } : undefined);
    const value = strict ? valuation.value : valuation;
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
    const treatment = asset.type ?? asset.intent ?? asset.purpose;
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
        depositDate: new Date(asset.acquired.getTime()),
        observedDate: date,
        start: wasAbove ? date : null,
      });
    }
  }
  for (const id of assetLots.keys()) if (!seen.has(id)) assetLots.delete(id);
}

export function runEngineDetailed(
  days,
  settings = defaultSettings,
  assetHawlResolver,
) {
  const strict = strictMode(settings);
  if (strict && assetHawlResolver) throw new TypeError('strict lineage must use explicit hawlSource facts, not an external resolver');
  settings = { ...(strict ? canonicalSettings : settings?.validationMode === 'legacy' ? defaultSettings : settings), ...settings };
  validateShariaSettings(settings);
  if (!Array.isArray(days)) throw new TypeError('days must be an array');
  if (strict) {
    const issue = inspectStrictHistory(days);
    if (issue) return incompleteRun(issue, Object.freeze({ ...settings }));
  }
  const lots = [],
    events = [],
    series = [];
  const assetLots = new Map();
  let assetMode = false;
  let previousDate = null;
  let wasAbove = false;

  for (const suppliedDay of days) {
    const day = { ...suppliedDay, date: suppliedDay.date instanceof Date ? new Date(suppliedDay.date.getTime()) : suppliedDay.date, ...(strict ? { nisab: strictNisab(suppliedDay), ...(suppliedDay.assets ? { assets: suppliedDay.assets.map(normalizeStrictAsset) } : {}) } : {}) };
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
    if (strict) {
      const threshold = strictNisab(suppliedDay, sum(lots), true);
      if (threshold.status) return incompleteRun(threshold, Object.freeze({ ...settings }));
      day.nisab = threshold.value;
      day.nisabBasis = threshold.basis;
      if (day.cashBalance != null && Math.abs(validateCashAmount(day.cashBalance) - sum(lots)) > 0.005) throw new RangeError('cash snapshot does not reconcile with ledger');
      if (sum(lots) > 0 && suppliedDay.assets?.some(a => a.kind === 'cash') && suppliedDay.flowsAreSeparate !== true)
        return incompleteRun(ruleResult('UNRESOLVED', 'G-CASH', 'POSSIBLE_DUPLICATE_CASH', ['flowsAreSeparate']), Object.freeze({ ...settings }));
    }

    if (Object.hasOwn(day, 'assets')) assetMode = true;
    const previousAssetLots = assetHawlResolver || strict
      ? cloneLots([...assetLots.values()])
      : null;
    if (assetMode) reconcileAssets(day.assets, assetLots, day.date, wasAbove, strict);
    if (strict) for (const asset of suppliedDay.assets ?? []) {
      if (!asset.hawlSource) continue;
      const source = previousAssetLots.find(lot => lot.id === asset.hawlSource.sourceId);
      if (source && source.treatment !== 'DOUBTFUL_RECEIVABLE' && assetLots.has(asset.id)) assetLots.get(asset.id).start = source.start && new Date(source.start);
    }
    // The reference adapter validates economic lineage before providing this
    // resolver. Legacy callers continue using the original independent lots.
    if (assetHawlResolver) {
      const starts = assetHawlResolver(day.date, previousAssetLots);
      for (const [id, start] of starts) {
        if (!assetLots.has(id))
          throw new TypeError('lineage target is missing');
        if (start !== null) {
          assertDailyDate(start, 'inherited hawl start');
          if (start > day.date)
            throw new RangeError('inherited hawl is in the future');
        }
        assetLots.get(id).start = start && new Date(start.getTime());
      }
    }
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
        const included = annualAdvance && !strict ? trackedLots : due;
        const base = sum(included);
        const event = {
          type: 'DUE',
          date: day.date,
          base,
          zakat: base / 40,
          explanation: annualAdvance && !strict
            ? `في ${explanationDate.format(day.date)}، اكتمل الحول الهجري للمبلغ المستحق، وأُدرج المال الأحدث تعجيلًا للزكاة. الوعاء ${moneyText(base)}، والزكاة ${moneyText(base / 40)} بنسبة ٢٫٥٪.`
            : `في ${explanationDate.format(day.date)}، اكتمل الحول الهجري للمبلغ المستحق البالغ ${moneyText(base)}، فوجبت زكاة قدرها ${moneyText(base / 40)} بنسبة ٢٫٥٪.`,
        };
        if (strict) Object.assign(event, {
          actualDue: base / 40,
          suggestedAdvance: annualAdvance ? sum(trackedLots.filter(lot => !due.includes(lot))) / 40 : 0,
          paymentRecorded: false,
        });
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
    if (strict) row.nisabBasis = day.nisabBasis;
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
      (settings.acquiredMoneyMode === 'ANNUAL_ADVANCE' && !strict
        ? sum(trackedLots)
        : sum(
            futureLots.filter(
              (lot) => lot.dueDate.getTime() === earliest.dueDate.getTime(),
            ),
          )) / 40,
  };
  const result = { events, series, lots: cloneLots(lots), nextDue };
  if (assetMode) result.assetLots = cloneLots([...assetLots.values()]);
  const lastAssets = strict ? days.at(-1)?.assets : null;
  const exemptPortfolio = lastAssets?.length > 0 && sum(lots) === 0 && lastAssets.every(asset => asset.recovery === 'DOUBTFUL' || calculateAssetValue({ [assetCategories[normalizeStrictAsset(asset).kind]]: [normalizeStrictAsset(asset)] }, { validationMode: 'strict' }).status === 'EXEMPT');
  if (strict) Object.assign(result, {
    status: events.some(event => event.type === 'DUE') ? 'CALCULATED' : exemptPortfolio ? 'EXEMPT' : 'ZERO',
    actualDue: events.filter(event => event.type === 'DUE').reduce((value, event) => value + event.zakat, 0),
    suggestedAdvance: events.filter(event => event.type === 'DUE').at(-1)?.suggestedAdvance ?? 0, paymentRecorded: false,
    policyApplied: Object.freeze({ ...settings, nisabBasis: 'BY_ASSET_COMPOSITION', cashNisabBasis: 'MIN', appliedNisabBasis: series.at(-1)?.nisabBasis ?? null }), issues: [],
  });
  return result;
}

export function runEngine(days, settings = defaultSettings) {
  return runEngineDetailed(days, settings).events;
}

export const nisabFor = (p, s = defaultSettings) => {
  assertRecord(p, 'prices');
  assertRecord(s, 'settings');
  if (s.validationMode) s = { ...(strictMode(s) ? canonicalSettings : defaultSettings), ...s };
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
