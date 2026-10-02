// شخصيتا الموقع: كل شخصية تشتغل على المحرك ببياناتها وتاريخها، وحساب خالد K4 لا يُعفى من اسمه.
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { PERSONA_DATA, khalidWith } from './persona-data.js';
import { buildView } from '../engine/view.js';

const prices = JSON.parse(readFileSync(new URL('../data/prices.json', import.meta.url), 'utf8'));
const run = (p, data = PERSONA_DATA[p].data) => buildView(data, prices, undefined, { today: PERSONA_DATA[p].asOf });

describe('شخصيتا الموقع', () => {
  test('خالد: يوم العرض، وK4 خارج الحساب حتى تُراجع حقائقه', () => {
    const v = run('khalid');
    expect(v.today).toBe('2026-10-03');
    expect(v.accounts.find(a => a.id === 'K4')).toMatchObject({ exempt: true, balance: 50000 });
    expect(v.total).toBeCloseTo(238897.83, 2);
  });
  test('خالد: تأكيد K4 حسابًا نقديًا يدخله الوعاء، وصندوقًا يدخله بحصته الزكوية', () => {
    const base = run('khalid').total;
    expect(run('khalid', khalidWith({ type: 'cash' })).total).toBeCloseTo(base + 50000, 2);
    expect(run('khalid', khalidWith({ type: 'fund', zakatableValue: 30000 })).total).toBeCloseTo(base + 30000, 2);
  });
  test('نورة: حساب واحد بدون أصول', () => {
    const v = run('noura');
    expect(v.accounts).toHaveLength(1);
    expect(v.dues).toHaveLength(0);
  });
});
