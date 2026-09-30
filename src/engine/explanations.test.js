import { expect, test } from 'vitest';
import { runEngineDetailed, defaultSettings } from './engine.js';
const money = (value) =>
  new Intl.NumberFormat('ar-SA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
test('Arabic START and BREAK explain actual balance and nisab without changing fields', () => {
  const start = new Date('2025-04-01T00:00:00Z');
  const end = new Date('2025-04-02T00:00:00Z');
  const result = runEngineDetailed([
    { date: start, deposits: [12345.67], nisab: 5000 },
    { date: end, withdrawals: [10000], nisab: 5000 },
  ]);
  expect(
    result.events.map(({ explanation, ...event }) => {
      expect(explanation).toMatch(/[\u0600-\u06ff]/);
      return event;
    }),
  ).toEqual([
    { type: 'START', date: start },
    { type: 'BREAK', date: end },
  ]);
  expect(result.events[0].explanation).toContain(money(12345.67));
  expect(result.events[1].explanation).toContain(money(2345.67));
  for (const event of result.events)
    expect(event.explanation).toContain(money(5000));
});
test.each(['INDEPENDENT_HAWL', 'ANNUAL_ADVANCE'])(
  'DUE explanation uses actual values for %s',
  (acquiredMoneyMode) => {
    const result = runEngineDetailed(
      [
        {
          date: new Date('2025-04-01T00:00:00Z'),
          deposits: [12345.67],
          nisab: 5000,
        },
        {
          date: new Date('2025-10-01T00:00:00Z'),
          deposits: [4000],
          nisab: 5000,
        },
        { date: new Date('2026-03-22T00:00:00Z'), nisab: 5000 },
      ],
      { ...defaultSettings, acquiredMoneyMode },
    );
    const event = result.events.find((event) => event.type === 'DUE');
    expect(event).toBeDefined();
    expect(event.base).toBeCloseTo(
      acquiredMoneyMode === 'ANNUAL_ADVANCE' ? 16345.67 : 12345.67,
    );
    expect(event.zakat).toBe(event.base / 40);
    expect(event.explanation).toContain(money(event.base));
    expect(event.explanation).toContain(money(event.zakat));
    expect(event.explanation.includes('تعجيل')).toBe(
      acquiredMoneyMode === 'ANNUAL_ADVANCE',
    );
  },
);
