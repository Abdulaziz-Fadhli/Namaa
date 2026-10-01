/**
 * Read-only preparation of the current account-transaction schema.
 * No tax calculation, UI imports, opening-history inference or exemption decision.
 * `days` is a PARTIAL ledger, not an approved calculation input. Missing facts
 * deliberately remain absent. Consumers must preserve `issues` alongside the
 * engine result; the engine reports its first missing fact, not this whole audit.
 */
import { validateCashAmount } from './engine.js';

const DAY = 86400000;
function dateOf(text) {
  if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text))
    throw new TypeError('Expected YYYY-MM-DD');
  const date = new Date(`${text}T00:00:00Z`);
  if (!Number.isFinite(+date) || date.toISOString().slice(0, 10) !== text)
    throw new TypeError('Invalid calendar date');
  return date;
}
function list(value, name) {
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an explicit array`);
  return value;
}
const issue = (reasonCode, facts) => ({ status: 'UNKNOWN', reasonCode, facts });

export function prepareStrictAccountDays(persona, prices) {
  if (!persona || !prices || typeof prices !== 'object' || Array.isArray(prices))
    throw new TypeError('Persona and dated prices are required');
  const start = dateOf(persona.period?.start), end = dateOf(persona.period?.end);
  if (end < start || (end - start) / DAY > 36600) throw new RangeError('Invalid period');
  // This adapter intentionally does not reinterpret the other asset schemas.
  for (const key of ['holdings', 'manual'])
    if (list(persona[key], key).length) throw new TypeError(`${key} conversion is outside this account-only adapter`);
  const accounts = new Map();
  for (const account of list(persona.accounts, 'accounts')) {
    if (!account || typeof account.accountId !== 'string' || !account.accountId.trim() || accounts.has(account.accountId))
      throw new TypeError('Invalid or duplicate account identity');
    if (account.currency !== 'SAR') throw new TypeError('Explicit SAR currency required');
    if (account.zakatExempt != null && typeof account.zakatExempt !== 'boolean') throw new TypeError('Invalid exemption flag');
    accounts.set(account.accountId, account);
  }
  if (!accounts.size) throw new TypeError('At least one account required');
  const needsReview = account => !['current', 'savings'].includes(account.type) || account.zakatExempt === true;
  const issues = [
    issue('OPENING_HISTORY_NOT_ESTABLISHED', [...accounts.keys()]),
    issue('BANK_HISTORY_COMPLETENESS_NOT_ESTABLISHED', [persona.period.start, persona.period.end]),
  ];
  for (const account of accounts.values()) if (needsReview(account))
    issues.push(issue('ACCOUNT_TREATMENT_NOT_ESTABLISHED', [account.accountId, 'product classification and exemption evidence']));

  const days = [], byDate = new Map();
  for (let time = +start; time <= +end; time += DAY) {
    const date = new Date(time), key = date.toISOString().slice(0, 10), sourcePrice = prices[key];
    const day = { date };
    if (sourcePrice != null) {
      day.prices = {};
      for (const metal of ['gold', 'silver']) {
        if (sourcePrice[metal] == null) { issues.push(issue('MISSING_PRICE', [key, metal])); continue; }
        if (typeof sourcePrice[metal] !== 'number' || !Number.isFinite(sourcePrice[metal]) || sourcePrice[metal] <= 0)
          throw new RangeError('Price must be a positive finite number');
        day.prices[metal] = sourcePrice[metal];
      }
    } else issues.push(issue('MISSING_PRICE', [key, 'gold', 'silver']));
    days.push(day); byDate.set(key, day);
  }

  const records = [], transferGroups = new Map(), seenIds = new Set();
  for (const [sourceIndex, tx] of list(persona.transactions, 'transactions').entries()) {
    if (!tx || typeof tx !== 'object') throw new TypeError('Invalid transaction');
    dateOf(tx.date);
    if (!byDate.has(tx.date)) throw new RangeError('Transaction outside period');
    const account = accounts.get(tx.accountId);
    if (!account) throw new TypeError('Unknown transaction account');
    validateCashAmount(tx.amount);
    if (!['credit', 'debit'].includes(tx.direction)) throw new TypeError('Invalid direction');
    if (tx.internal != null && typeof tx.internal !== 'boolean') throw new TypeError('Invalid internal flag');
    if (tx.id != null) {
      if (typeof tx.id !== 'string' || !tx.id.trim() || seenIds.has(tx.id)) throw new TypeError('Invalid or duplicate transaction id');
      seenIds.add(tx.id);
    }
    const record = { sourceIndex, source: structuredClone(tx), disposition: null };
    records.push(record);
    if (tx.internal === true) {
      if (!accounts.has(tx.counterparty) || tx.counterparty === tx.accountId) throw new TypeError('Invalid transfer counterparty');
      const from = tx.direction === 'debit' ? tx.accountId : tx.counterparty;
      const to = tx.direction === 'credit' ? tx.accountId : tx.counterparty;
      const key = JSON.stringify([tx.date, from, to, tx.amount]);
      if (!transferGroups.has(key)) transferGroups.set(key, { date: tx.date, from, to, amount: tx.amount, debit: [], credit: [] });
      transferGroups.get(key)[tx.direction].push(record);
      continue;
    }
    if (needsReview(account)) {
      record.disposition = 'PENDING_ACCOUNT_TREATMENT';
    } else {
      // Observed credits, including any described as opening amounts, are not
      // certified new acquisitions. No openingBalanceKnown is ever supplied.
      record.disposition = 'OBSERVED_EXTERNAL_FLOW';
      const field = tx.direction === 'credit' ? 'deposits' : 'withdrawals';
      const day = byDate.get(tx.date);
      (day[field] ??= []).push(tx.amount);
    }
  }
  const transfers = [];
  for (const group of transferGroups.values()) {
    if (group.debit.length !== group.credit.length) throw new TypeError('Unpaired internal transfer');
    const boundary = needsReview(accounts.get(group.from)) || needsReview(accounts.get(group.to));
    for (let i = 0; i < group.debit.length; i++) {
      const fromRecord = group.debit[i], toRecord = group.credit[i];
      const disposition = boundary ? 'PENDING_TRANSFER_TREATMENT' : 'INTERNAL_TRANSFER';
      fromRecord.disposition = disposition; toRecord.disposition = disposition;
      transfers.push({ date: group.date, from: group.from, to: group.to, amount: group.amount,
        sourceIndices: [fromRecord.sourceIndex, toRecord.sourceIndex], disposition });
    }
    if (boundary) issues.push(issue('TRANSFER_ACROSS_UNRESOLVED_ACCOUNT', [group.from, group.to, group.date]));
  }
  // Source indices preserve otherwise identical records without inventing IDs
  // or silently deduplicating legitimate repeated transactions.
  return { status: 'UNKNOWN', readyForCalculation: false, ledgerCompleteness: 'OBSERVED_ONLY',
    days, issues, records, transfers,
    summary: { days: days.length, sourceTransactions: persona.transactions.length,
      accountedTransactions: records.length, observedExternal: records.filter(r => r.disposition === 'OBSERVED_EXTERNAL_FLOW').length,
      internalRecords: records.filter(r => r.disposition === 'INTERNAL_TRANSFER').length,
      pendingRecords: records.filter(r => r.disposition.startsWith('PENDING_')).length } };
}
