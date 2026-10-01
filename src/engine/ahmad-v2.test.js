// قبول أحمد v2 حسب وثيقة «ثلاث شخصيات» (الصفحات 6–7 و14): الأرقام المرجعية تخرج من المحرك نفسه.
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { AHMAD_V2, ahmadV2 } from './ahmad-v2.js';
import { buildView } from './view.js';

const read = n => JSON.parse(readFileSync(new URL(`../data/${n}.json`, import.meta.url), 'utf8'));
const v1 = read('ahmad');
const prices = read('prices');
const persona = ahmadV2(v1);
const view = buildView(persona, prices);

describe('أحمد v2: النسخة التاريخية المعتمدة', () => {
  test('544 يومًا و529 حركة و17 زوج تحويل داخلي', () => {
    expect(view.series.length).toBeGreaterThan(0);
    const days = (new Date('2026-09-26') - new Date('2025-04-01')) / 86400000 + 1;
    expect(days).toBe(544);
    const cash = persona.transactions.filter(t => t.accountId !== 'A3');
    expect(cash.length + persona.holdings.length).toBe(529);
    expect(persona.transactions.filter(t => t.internal).length / 2).toBe(17);
  });
  test('سبعة أحداث مجموعها 765.95، أولها الصندوق 250 + نقد 27.975', () => {
    expect(view.dues.map(d => [d.date, d.base])).toEqual([
      ['2026-03-22', 11119], ['2026-04-17', 2247], ['2026-05-16', 1262], ['2026-06-17', 3051],
      ['2026-07-16', 2974], ['2026-08-17', 3110], ['2026-09-16', 6875],
    ]);
    expect(view.totalDueInPeriod).toBe(AHMAD_V2.reference.totalDueInPeriod);
  });
  test('آخر يوم: نقد 57,282 + حصة الصندوق 10,000، والنصاب 4,613.21', () => {
    expect(view.today).toBe('2026-09-26');
    expect(view.bankTotal).toBe(57282);
    expect(view.total).toBe(67282);
    expect(view.nisab).toBeCloseTo(4613.2135, 2);
  });
  test('لا وجوب في آخر يوم، والقادم 165.35 في 2026-10-03 توقّع لا استحقاق', () => {
    expect(view.due).toBeNull();
    expect(view.nextDue).toMatchObject({ date: '2026-10-03', zakat: 165.35 });
  });
  test('الصندوق يُعرض صندوقًا لا منتجًا معفى', () => {
    const a3 = view.accounts.find(a => a.id === 'A3');
    expect(a3).toMatchObject({ fund: true, exempt: false, balance: 20000 });
  });
});
