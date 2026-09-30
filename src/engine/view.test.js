// الوضع المباشر: المحرك يشتغل على تاريخ اليوم الحقيقي وسعر السوق الآن.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildView, liveInputs } from './view.js';

const read = n => JSON.parse(readFileSync(new URL(`../data/${n}.json`, import.meta.url), 'utf8'));
const ahmad = read('ahmad');
const prices = read('prices');
const LIVE = { goldPerGram: 505.1927, silverPerGram: 7.3733 }; // سعر السوق يوم 30 سبتمبر 2026

describe('buildView live mode', () => {
  it('without options it is the story mode (demo day, saved prices)', () => {
    const v = buildView(ahmad, prices);
    expect(v.today).toBe('2026-10-03');
    expect(v.due.zakat).toBe(165.35);
  });

  it('uses the real date and the live price for today\'s nisab', () => {
    const v = buildView(ahmad, prices, undefined, { today: '2026-09-30', live: LIVE });
    expect(v.today).toBe('2026-09-30');
    expect(v.prices).toEqual({ date: '2026-09-30', goldPerGram: LIVE.goldPerGram, silverPerGram: LIVE.silverPerGram });
    expect(v.nisab).toBeCloseTo(595 * LIVE.silverPerGram, 1); // الفضة أقل من الذهب
    expect(v.nisab).not.toBeCloseTo(buildView(ahmad, prices).nisab, 0);
  });

  it('ignores transactions after today, and has no due today on 30 September', () => {
    const v = buildView(ahmad, prices, undefined, { today: '2026-09-30', live: LIVE });
    expect(v.accounts.every(a => a.lastActivity <= '2026-09-30')).toBe(true);
    expect(v.due).toBeNull();                 // الشاشات لازم تتحمل هذي الحالة
    expect(v.nextDue.date).toBe('2026-10-03'); // وجوب المكافأة بعد 3 أيام
    expect(v.nextDue.inDays).toBe(3);
  });

  it('works for every persona', () => {
    for (const name of ['ahmad', 'khalid', 'noura']) {
      const v = buildView(read(name), prices, undefined, { today: '2026-09-30', live: LIVE });
      expect(v.today).toBe('2026-09-30');
      expect(v.total).toBeGreaterThan(0);
    }
  });

  it('carries the last known price forward past the saved prices', () => {
    const { prices: filled, persona } = liveInputs({ ...ahmad, period: { ...ahmad.period, end: '2026-10-10' } }, prices, { today: '2026-10-10' });
    expect(filled['2026-10-10']).toEqual(prices['2026-10-03']);
    expect(persona.period.end).toBe('2026-10-10');
  });

  it('does not change its inputs', () => {
    const before = JSON.stringify(ahmad.period) + ahmad.transactions.length + prices['2026-09-30'].silver;
    buildView(ahmad, prices, undefined, { today: '2026-09-30', live: LIVE });
    expect(JSON.stringify(ahmad.period) + ahmad.transactions.length + prices['2026-09-30'].silver).toBe(before);
  });

  it('rejects a date before the persona starts', () => {
    expect(() => liveInputs(ahmad, prices, { today: '2020-01-01' })).toThrow(RangeError);
  });
});
