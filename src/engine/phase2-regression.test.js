import { expect, test } from 'vitest';
import { runEngineDetailed } from './engine.js';

// G: ownership/hawl facts must not be changed through a returned lot.
test('returned cash dates do not expose caller-owned dates', () => {
  const date = new Date('2025-04-01T00:00:00Z');
  const result = runEngineDetailed([{ date, nisab: 5000, deposits: [10000] }]);
  result.lots[0].depositDate.setUTCFullYear(2030);
  expect(date.toISOString()).toBe('2025-04-01T00:00:00.000Z');
});

test('returned asset dates do not expose caller acquisition facts', () => {
  const date = new Date('2025-04-01T00:00:00Z');
  const acquired = new Date(date);
  const result = runEngineDetailed([{
    date, nisab: 5000,
    assets: [{ id: 'cash', kind: 'cash', acquired, value: 10000 }],
  }]);
  result.assetLots[0].depositDate.setUTCFullYear(2030);
  expect(acquired.toISOString()).toBe('2025-04-01T00:00:00.000Z');
});

test('event, series and nextDue dates cannot mutate caller history', () => {
  const date = new Date('2025-04-01T00:00:00Z');
  const result = runEngineDetailed([{ date, nisab: 5000, deposits: [10000] }]);
  result.series[0].date.setUTCFullYear(2030);
  result.events[0].date.setUTCFullYear(2031);
  result.nextDue.start.setUTCFullYear(2032);
  expect(date.toISOString()).toBe('2025-04-01T00:00:00.000Z');
});
