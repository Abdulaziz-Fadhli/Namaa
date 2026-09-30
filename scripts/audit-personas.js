import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { runEngineDetailed } from '../src/engine/engine.js';
import { personaDays, runPersonas, markdownReport } from './run-personas.js';
const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const read = (name) => JSON.parse(readFileSync(resolve(root, name), 'utf8'));
const DAY = 86400000;
const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});
const parts = (date) => {
  const p = fmt.formatToParts(date);
  return ['year', 'month', 'day'].map((type) =>
    Number(p.find((part) => part.type === type).value),
  );
};
const key = (date) => date.toISOString().slice(0, 10);
const minor = (value) => BigInt(Math.round(value * 100));
const decimal4 = (value) => {
  const [whole, decimal = ''] = String(value).split('.');
  return BigInt(whole) * 10000n + BigInt(decimal.padEnd(4, '0'));
};
const sar = (cents) => Number(cents) / 100;
const close = (actual, expected, label) => {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > 1e-7)
    throw new Error(`${label}: ${actual} != ${expected}`);
};
const anniversaryCache = new Map();
function anniversary(start) {
  const label = key(start);
  if (anniversaryCache.has(label)) return anniversaryCache.get(label);
  const [year, month, day] = parts(start);
  let last;
  for (
    let t = start.getTime() + 340 * DAY;
    t <= start.getTime() + 370 * DAY;
    t += DAY
  ) {
    const date = new Date(t);
    const [y, m, d] = parts(date);
    if (y === year + 1 && m === month) {
      last = date;
      if (d === day) break;
    } else if (last) break;
  }
  if (!last) throw Error('Independent anniversary unresolved');
  anniversaryCache.set(label, last);
  return last;
}
function reconstruct(persona, prices) {
  const taxable = new Set(
    persona.accounts
      .filter((account) => account.zakatExempt !== true)
      .map((account) => account.accountId),
  );
  const daily = new Map();
  let opening = 0n,
    inflows = 0n,
    spending = 0n,
    purchases = 0n;
  for (const tx of persona.transactions) {
    if (!taxable.has(tx.accountId) || tx.internal) continue;
    const rows = daily.get(tx.date) ?? [];
    rows.push(tx);
    daily.set(tx.date, rows);
    if (tx.direction === 'credit') {
      if (tx.date === persona.period.start) opening += minor(tx.amount);
      else inflows += minor(tx.amount);
    } else {
      const isPurchase = persona.holdings.some(
        (holding) =>
          holding.paidFrom === tx.accountId &&
          holding.acquired === tx.date &&
          holding.cost === tx.amount,
      );
      if (isPurchase) purchases += minor(tx.amount);
      else spending += minor(tx.amount);
    }
  }
  const lots = [],
    assetLots = new Map(),
    series = [],
    events = [];
  let aboveBefore = false;
  for (
    let t = Date.parse(persona.period.start);
    t <= Date.parse(persona.period.end);
    t += DAY
  ) {
    const date = new Date(t),
      iso = key(date),
      tx = daily.get(iso) ?? [];
    for (const row of tx.filter((row) => row.direction === 'credit'))
      lots.push({
        amount: minor(row.amount),
        start: aboveBefore ? date : null,
      });
    for (const row of tx.filter((row) => row.direction === 'debit')) {
      let left = minor(row.amount);
      for (let i = lots.length - 1; i >= 0 && left > 0n; i--) {
        const take = lots[i].amount < left ? lots[i].amount : left;
        lots[i].amount -= take;
        left -= take;
      }
      if (left !== 0n) throw Error('Independent ledger overdrawn');
    }
    for (let i = lots.length - 1; i >= 0; i--)
      if (lots[i].amount === 0n) lots.splice(i, 1);
    for (const [index, holding] of persona.holdings.entries()) {
      if (
        holding.zakatExempt === true ||
        (holding.acquired && holding.acquired > iso)
      )
        continue;
      let value;
      if (holding.type === 'gold') {
        // Current personas hold 100 grams, 24k. Integer fixed-point valuation.
        if (holding.grams !== 100 || holding.karat !== 24)
          throw Error('Independent persona fixture changed');
        value = decimal4(prices[iso].gold);
      } else if (holding.type === 'stocks' && holding.intent === 'trading')
        value = minor(holding.values[iso]);
      else
        throw Error(
          'Independent auditor needs an explicit adapter for changed data',
        );
      if (assetLots.has(index)) assetLots.get(index).amount = value;
      else
        assetLots.set(index, {
          amount: value,
          start: aboveBefore ? date : null,
          kind: holding.type,
          id: `holding:${index}`,
        });
    }
    const all = [...lots, ...assetLots.values()];
    const cash = lots.reduce((sum, lot) => sum + lot.amount, 0n),
      other = [...assetLots.values()].reduce(
        (sum, lot) => sum + lot.amount,
        0n,
      ),
      total = cash + other;
    const threshold = [
      85n * decimal4(prices[iso].gold),
      595n * decimal4(prices[iso].silver),
    ].reduce((a, b) => (a < b ? a : b));
    const above = total * 100n >= threshold;
    if (!above && aboveBefore) {
      for (const lot of all) lot.start = null;
      events.push({ type: 'BREAK', date: iso });
    }
    if (above && !aboveBefore) {
      for (const lot of all) if (lot.start === null) lot.start = date;
      events.push({ type: 'START', date: iso });
    }
    if (above) {
      const matured = all.filter(
        (lot) => lot.start && anniversary(lot.start) <= date,
      );
      if (matured.length) {
        const base = matured.reduce((sum, lot) => sum + lot.amount, 0n);
        events.push({
          type: 'DUE',
          date: iso,
          base: sar(base),
          zakat: sar(base) / 40,
          assetBase: sar(
            matured
              .filter((lot) => lot.kind)
              .reduce((sum, lot) => sum + lot.amount, 0n),
          ),
        });
        for (const lot of matured) lot.start = date;
      }
    }
    aboveBefore = above;
    series.push({
      date: iso,
      total: sar(total),
      cash: sar(cash),
      other: sar(other),
      nisab: Number(threshold) / 10000,
      above,
    });
  }
  const pending = [...lots, ...assetLots.values()]
    .filter((lot) => lot.start && lot.amount > 0n)
    .map((lot) => ({ date: key(anniversary(lot.start)), amount: lot.amount }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const next = pending.length
    ? {
        date: pending[0].date,
        zakat:
          sar(
            pending
              .filter((lot) => lot.date === pending[0].date)
              .reduce((sum, lot) => sum + lot.amount, 0n),
          ) / 40,
      }
    : null;
  return {
    next,
    ledger: {
      opening: sar(opening),
      inflows: sar(inflows),
      outflows: sar(spending),
      assetPurchases: sar(purchases),
      expectedCash: sar(opening + inflows - spending - purchases),
    },
    events,
    series,
  };
}
export function auditPersonas() {
  const prices = read('src/data/prices.json'),
    raw = read('scripts/prices-raw.json'),
    reports = runPersonas(),
    output = [];
  const rawDates = Object.keys(raw).sort();
  const lastRaw = rawDates.at(-1);
  for (const name of ['ahmad', 'khalid', 'noura']) {
    const persona = read(`src/data/${name}.json`),
      independent = reconstruct(persona, prices),
      actual = runEngineDetailed(personaDays(persona, prices));
    if (actual.series.length !== independent.series.length)
      throw Error('Series length mismatch');
    for (let i = 0; i < actual.series.length; i++) {
      const want = independent.series[i],
        got = actual.series[i];
      close(got.total, want.total, `${name} daily total ${want.date}`);
      close(got.cashBalance, want.cash, `${name} cash ${want.date}`);
      close(got.nisab, want.nisab, `${name} nisab ${want.date}`);
      if (got.above !== want.above) throw Error('Nisab status mismatch');
    }
    if (actual.events.length !== independent.events.length)
      throw Error('Event count mismatch');
    for (let i = 0; i < actual.events.length; i++) {
      const want = independent.events[i],
        got = actual.events[i];
      if (got.type !== want.type || key(got.date) !== want.date)
        throw Error('Event date/type mismatch');
      if (want.type === 'DUE') {
        close(got.base, want.base, `${name} due base`);
        close(got.zakat, want.zakat, `${name} zakat`);
        close(got.otherAssetsBase, want.assetBase, `${name} asset due value`);
      }
    }
    const report = reports.find((report) => report.persona === name);
    close(
      report.endSnapshot.cashBalance,
      independent.ledger.expectedCash,
      'Cash reconciliation',
    );
    const ramadan = independent.series.find((row) => {
      const [y, m, d] = parts(new Date(row.date));
      return y === 1447 && m === 9 && d === 1;
    });
    const due = independent.events.filter((event) => event.type === 'DUE');
    const valueAtDue = due.map((event) => {
      const row = independent.series.find((row) => row.date === event.date);
      return {
        ...event,
        cashBase: event.base - event.assetBase,
        traditional: row.total >= row.nisab ? row.total / 40 : 0,
        difference: row.total / 40 - event.zakat,
      };
    });
    if (independent.next) {
      if (report.nextDue?.date !== independent.next.date)
        throw Error('Independent next due date mismatch');
      close(
        report.nextDue.expectedZakat,
        independent.next.zakat,
        'Independent projected zakat',
      );
    } else if (report.nextDue) throw Error('Unexpected next due');
    const reportedRamadan = report.ramadan.find((row) => row.year === 1447);
    close(reportedRamadan.totalSnapshot, ramadan.total, 'Ramadan base');
    close(
      reportedRamadan.traditionalAllAssets,
      ramadan.total / 40,
      'Ramadan zakat',
    );
    const total = due.reduce((sum, event) => sum + event.zakat, 0);
    close(report.totalZakatDue, total, 'Total zakat');
    output.push({
      persona: name,
      daysVerified: actual.series.length,
      ledger: independent.ledger,
      crossings: independent.events.filter((event) => event.type !== 'DUE'),
      due: valueAtDue,
      totalZakat: total,
      ramadan: {
        date: ramadan.date,
        cash: ramadan.cash,
        other: ramadan.other,
        total: ramadan.total,
        nisab: ramadan.nisab,
        zakat: ramadan.total / 40,
        namaaDueToDate: due
          .filter((event) => event.date <= ramadan.date)
          .reduce((sum, event) => sum + event.zakat, 0),
      },
      end: independent.series.at(-1),
      nextDue: report.nextDue,
      assumptions: report.limitations,
    });
  }
  if (
    markdownReport(reports).replace(/\r\n/g, '\n') !==
    readFileSync(
      resolve(root, 'docs/tuesday-persona-results.md'),
      'utf8',
    ).replace(/\r\n/g, '\n')
  )
    throw Error('Saved persona report is not reproducible');
  return {
    baseline: '5b6505112a6f3b8cdf57c0e5904f824ee9fcc441',
    method:
      'Independent BigInt cents ledger, fixed-point metals, direct source JSON and independent Intl calendar anniversary search; no engine helpers in expected-value reconstruction.',
    rawPriceLastDate: lastRaw,
    pricePeriodEnd: Object.keys(prices).sort().at(-1),
    carriedPastRaw: Object.keys(prices).filter((date) => date > lastRaw).length,
    personas: output,
  };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = auditPersonas();
  if (process.argv[2])
    writeFileSync(resolve(process.argv[2]), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
