// تحويل بيانات الشخصية (حسابات، عمليات، أصول) إلى أيام يقرأها المحرك.
// ملف نقي بدون node:fs، فيشتغل في المتصفح وفي السكربتات معًا.
// (منقول كما هو من scripts/run-personas.js حتى يقدر التطبيق يشغّل المحرك مباشرة.)
import {
  defaultSettings,
  nisabFor,
  validateAssetFlags,
  validateCashAmount,
} from './engine.js';

export const iso = (date) => date.toISOString().slice(0, 10);
export const dateOf = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new TypeError('Dates must use YYYY-MM-DD');
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || iso(date) !== value)
    throw new TypeError(`Invalid date: ${value}`);
  return date;
};

const arrayOrEmpty = (value, label) => {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  return value;
};
const recordKey = (record) =>
  JSON.stringify(
    Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, record[key]]),
    ),
  );
export function normalizePersona(persona) {
  if (!persona || typeof persona !== 'object' || Array.isArray(persona))
    throw new TypeError('persona must be an object');
  for (const key of ['name', 'persona'])
    if (typeof persona[key] !== 'string' || !persona[key])
      throw new TypeError(`${key} must be a non-empty string`);
  if (!persona.period || typeof persona.period !== 'object')
    throw new TypeError('persona requires a period');
  if (dateOf(persona.period.start) > dateOf(persona.period.end))
    throw new RangeError('period end must not precede start');
  const normalized = { ...persona };
  for (const key of ['accounts', 'transactions', 'holdings', 'manual'])
    normalized[key] = arrayOrEmpty(persona[key], key);
  const accountIds = new Set();
  for (const account of normalized.accounts) {
    validateAssetFlags(account);
    if (
      typeof account.accountId !== 'string' ||
      !account.accountId ||
      accountIds.has(account.accountId)
    )
      throw new TypeError('invalid or duplicate account id');
    if (account.currency !== undefined && account.currency !== 'SAR')
      throw new TypeError('only SAR account amounts are supported');
    accountIds.add(account.accountId);
  }
  const ids = new Set(),
    records = new Set();
  for (const asset of [...normalized.holdings, ...normalized.manual]) {
    validateAssetFlags(asset);
    if (asset.id !== undefined) {
      if (typeof asset.id !== 'string' || !asset.id || ids.has(asset.id))
        throw new TypeError('duplicate or invalid asset id across sources');
      ids.add(asset.id);
    } else {
      const signature = recordKey(asset);
      if (records.has(signature))
        throw new TypeError('duplicate asset record without distinct lot ids');
      records.add(signature);
    }
  }
  return normalized;
}

// Adapt the saved account/holding schema to a daily cash ledger and complete
// asset inventory. Internal bank transfers never create new acquisition lots.
function holdingAt(holding, id, key, prices, periodStart, requireDate) {
  const kind = {
    gold: 'gold',
    silver: 'silver',
    stocks: 'stocks',
    fund: 'investmentProducts',
    investmentProducts: 'investmentProducts',
    property: 'properties',
    cash: 'cash',
  }[holding.type];
  if (!kind) throw new TypeError(`Unsupported holding schema: ${holding.type}`);
  const acquired =
    holding.acquired !== undefined ? holding.acquired : holding.date;
  if (acquired !== undefined) dateOf(acquired);
  if (holding.disposed !== undefined) dateOf(holding.disposed);
  if (holding.zakatExempt || (kind === 'cash' && holding.zakatable === false))
    return null;
  if (!acquired && requireDate)
    throw new TypeError('Manual assets require an acquisition date');
  // Opening holdings without earlier history are explicitly reported as such.
  const observedAcquired = dateOf(acquired ?? periodStart);
  if (observedAcquired > dateOf(key)) return null;
  if (holding.disposed && dateOf(holding.disposed) <= dateOf(key)) return null;
  const asset = { ...holding, id, kind, acquired: observedAcquired };
  if (kind === 'gold' || kind === 'silver') {
    asset.pricePerGram = prices[key][kind];
  }
  if (kind === 'stocks' || kind === 'investmentProducts') {
    asset.type = holding.intent?.toUpperCase();
    asset.marketValue = holding.values
      ? holding.values[key]
      : holding.marketValue;
    asset.zakatableValue = holding.zakatableValues
      ? holding.zakatableValues[key]
      : holding.zakatableValue;
  }
  if (kind === 'properties') {
    asset.intent = holding.intent?.toUpperCase();
    asset.marketValue = holding.values
      ? holding.values[key]
      : holding.marketValue;
    if (asset.intent === 'TRADING' && asset.marketValue == null)
      throw new Error(`Missing property value: ${key}`);
  }
  if (kind === 'cash')
    asset.value = holding.values ? holding.values[key] : holding.value;
  return asset;
}

export function personaDays(persona, prices, settings = defaultSettings) {
  persona = normalizePersona(persona);
  const accounts = new Map(
    persona.accounts.map((account) => [account.accountId, account]),
  );
  const byDate = new Map();
  const transactionIds = new Set(),
    transactionRecords = new Set(),
    transfers = new Map();
  for (const transaction of persona.transactions) {
    if (
      !transaction ||
      typeof transaction !== 'object' ||
      Array.isArray(transaction)
    )
      throw new TypeError('transaction must be an object');
    dateOf(transaction.date);
    validateCashAmount(transaction.amount);
    if (!['credit', 'debit'].includes(transaction.direction))
      throw new Error('Unknown transaction direction');
    if (
      transaction.internal !== undefined &&
      typeof transaction.internal !== 'boolean'
    )
      throw new TypeError('internal must be boolean');
    if (
      transaction.date < persona.period.start ||
      transaction.date > persona.period.end
    )
      throw new Error('Transaction outside period');
    if (transaction.id !== undefined) {
      if (
        typeof transaction.id !== 'string' ||
        !transaction.id ||
        transactionIds.has(transaction.id)
      )
        throw new TypeError('duplicate or invalid transaction id');
      transactionIds.add(transaction.id);
    } else {
      const signature = recordKey(transaction);
      if (transactionRecords.has(signature))
        throw new TypeError(
          'duplicate transaction record without distinct ids',
        );
      transactionRecords.add(signature);
    }
    const account = accounts.get(transaction.accountId);
    if (!account) throw new Error(`Unknown account: ${transaction.accountId}`);
    if (transaction.internal) {
      const counterparty = accounts.get(transaction.counterparty);
      if (
        !counterparty ||
        Boolean(account.zakatExempt) !== Boolean(counterparty.zakatExempt)
      ) {
        throw new Error(
          'Transfers across exempt/non-exempt accounts require an explicit adapter',
        );
      }
      const from =
        transaction.direction === 'debit'
          ? transaction.accountId
          : transaction.counterparty;
      const to =
        transaction.direction === 'credit'
          ? transaction.accountId
          : transaction.counterparty;
      const transferKey = JSON.stringify([
        transaction.date,
        from,
        to,
        transaction.amount,
      ]);
      transfers.set(
        transferKey,
        (transfers.get(transferKey) ?? 0) +
          (transaction.direction === 'credit' ? 1 : -1),
      );
      continue;
    }
    if (account.zakatExempt) continue;
    if (!['credit', 'debit'].includes(transaction.direction))
      throw new Error('Unknown transaction direction');
    if (
      transaction.date < persona.period.start ||
      transaction.date > persona.period.end
    )
      throw new Error('Transaction outside period');
    const day = byDate.get(transaction.date) ?? {
      deposits: [],
      withdrawals: [],
    };
    day[transaction.direction === 'credit' ? 'deposits' : 'withdrawals'].push(
      transaction.amount,
    );
    byDate.set(transaction.date, day);
  }
  if ([...transfers.values()].some((balance) => balance !== 0))
    throw new TypeError(
      'internal transfer must contain matching credit and debit records',
    );
  const inputs = [
    ...persona.holdings.map((holding, index) => ({
      holding,
      id: `holding:${holding.id ?? index}`,
      requireDate: false,
    })),
    ...persona.manual.map((holding, index) => ({
      holding,
      id: `manual:${holding.id ?? index}`,
      requireDate: true,
    })),
  ];
  const days = [];
  const end = dateOf(persona.period.end);
  for (
    let date = dateOf(persona.period.start);
    date <= end;
    date = new Date(date.getTime() + 86400000)
  ) {
    const key = iso(date);
    if (!prices[key]) throw new Error(`Missing prices: ${key}`);
    const assets = inputs
      .map(({ holding, id, requireDate }) =>
        holdingAt(holding, id, key, prices, persona.period.start, requireDate),
      )
      .filter(Boolean);
    days.push({
      date,
      ...byDate.get(key),
      nisab: nisabFor(prices[key], settings),
      assets,
    });
  }
  return days;
}

