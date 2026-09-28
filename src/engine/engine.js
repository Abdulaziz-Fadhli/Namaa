const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
  year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC'
});

export function hijri(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new TypeError('date must be a valid Date');
  const p = fmt.formatToParts(date);
  const g = t => +p.find(x => x.type === t).value;
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

const sum = lots => lots.reduce((s, l) => s + l.amount, 0);
const cloneLots = lots => lots.map(l => ({ ...l }));

function assertFiniteNonNegative(value, label) {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${label} must be a finite non-negative number`);
}

function consume(lots, amount, order) {
  assertFiniteNonNegative(amount, 'withdrawal');
  const available = sum(lots);
  if (amount > available) throw new RangeError(`withdrawal ${amount} exceeds available balance ${available}`);
  const list = order === 'FIFO' ? lots : [...lots].reverse();
  for (const l of list) {
    const take = Math.min(l.amount, amount);
    l.amount -= take; amount -= take;
    if (amount <= 0) break;
  }
  for (let i = lots.length - 1; i >= 0; i--) if (lots[i].amount <= 0) lots.splice(i, 1);
}

export const defaultSettings = {
  nisabBasis: 'MIN', goldGrams: 85, silverGrams: 595,
  mode: 'PRECISE', spendOrder: 'LIFO', jewelry: true,
  stocksLongTerm: 'EXCLUDE', deductDebts: false
};

function validateDay(d) {
  if (!d || !(d.date instanceof Date) || Number.isNaN(d.date.getTime())) throw new TypeError('each day must contain a valid date');
  assertFiniteNonNegative(d.nisab, 'nisab');
  for (const x of (d.deposits ?? [])) assertFiniteNonNegative(x, 'deposit');
  for (const y of (d.withdrawals ?? [])) assertFiniteNonNegative(y, 'withdrawal');
}

// Future-facing detailed result for UI integration. Monday's runEngine remains backward compatible.
export function runEngineDetailed(days, settings = defaultSettings) {
  const lots = [], events = [], series = [];
  let wasAbove = false;

  for (const d of days) {
    validateDay(d);
    for (const x of (d.deposits ?? [])) lots.push({ amount: x, start: wasAbove ? d.date : null });
    for (const y of (d.withdrawals ?? [])) consume(lots, y, settings.spendOrder);

    const total = sum(lots), above = total >= d.nisab;
    if (!above && wasAbove) {
      lots.forEach(l => (l.start = null));
      events.push({ type: 'BREAK', date: d.date });
    }
    if (above && !wasAbove) {
      lots.forEach(l => (l.start ??= d.date));
      events.push({ type: 'START', date: d.date });
    }
    wasAbove = above;

    if (above) {
      const due = lots.filter(l => l.start && isHawlComplete(l.start, d.date));
      if (due.length) {
        const base = settings.mode === 'EASY' ? total : sum(due);
        events.push({ type: 'DUE', date: d.date, base, zakat: base / 40 });
        (settings.mode === 'EASY' ? lots : due).forEach(l => (l.start = d.date));
      }
    }
    series.push({ date: d.date, total, nisab: d.nisab, above });
  }

  const futureLots = lots.filter(l => l.start).map(l => ({
    ...l,
    // Exact due date is intentionally left for the UI/date helper to resolve from Umm al-Qura.
    startHijri: hijri(l.start)
  }));
  const nextDue = futureLots.length ? futureLots.reduce((best, l) => {
    const h = l.startHijri;
    const key = (h[0] + 1) * 10000 + h[1] * 100 + h[2];
    return !best || key < best.key ? { key, start: l.start, targetHijri: [h[0] + 1, h[1], h[2]] } : best;
  }, null) : null;

  return { events, series, lots: cloneLots(lots), nextDue: nextDue && { start: nextDue.start, targetHijri: nextDue.targetHijri } };
}

export function runEngine(days, settings = defaultSettings) {
  return runEngineDetailed(days, settings).events;
}

export const nisabFor = (p, s = defaultSettings) => {
  assertFiniteNonNegative(p?.gold, 'gold price');
  assertFiniteNonNegative(p?.silver, 'silver price');
  const g = s.goldGrams * p.gold, v = s.silverGrams * p.silver;
  return s.nisabBasis === 'GOLD' ? g : s.nisabBasis === 'SILVER' ? v : Math.min(g, v);
};

export function traditionalCalc(total, nisab) {
  assertFiniteNonNegative(total, 'total');
  assertFiniteNonNegative(nisab, 'nisab');
  return total >= nisab ? total / 40 : 0;
}

// Appendix B-5 comparison helper: use the balance on 1 Ramadan of the requested Hijri year.
export function ramadanCalc(series, year) {
  const row = series.find(x => {
    const [y, m, d] = hijri(x.date);
    return y === year && m === 9 && d === 1;
  });
  if (!row) throw new Error(`1 Ramadan ${year} is not present in series`);
  return { date: row.date, base: row.total, zakat: traditionalCalc(row.total, row.nisab) };
}
