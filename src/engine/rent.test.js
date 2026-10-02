import { describe, expect, it } from 'vitest';
import { detectIncome, detectRent } from './rent.js';
import khalid from '../data/khalid.json';
import noura from '../data/noura.json';

const tx = (date, amount, desc, extra = {}) => ({ accountId: 'A', date, amount, direction: 'credit', desc, ...extra });

describe('اكتشاف الإيجار من حركات الحساب (دليل الهيئة §3.8)', () => {
  it('خالد: إيجار عقار 8,000 كل 3 أشهر، وأرباح النشاط دخل وليست إيجارًا', () => {
    const all = detectIncome(khalid.transactions, '2026-10-03');
    const rent = all.filter(s => s.kind === 'rent');
    expect(rent).toHaveLength(1);
    expect(rent[0]).toMatchObject({ accountId: 'K2', amount: 8000, cadence: 'quarterly', count: 6, last: '2026-07-10', perYear: 32000 });
    expect(rent[0].next >= '2026-10-08' && rent[0].next <= '2026-10-10').toBe(true);
    expect(all.find(s => s.desc === 'أرباح نشاط تجاري')).toMatchObject({ kind: 'income', cadence: 'monthly', amount: 20000 });
  });

  it('نورة: الإيجار الذي تدفعه ليس دخلًا، فلا يُكتشف', () => {
    expect(detectRent(noura.transactions, '2026-10-03')).toEqual([]);
  });

  it('لا يعتبر التحويلات الداخلية ولا المبالغ المتقلبة ولا الحركات بعد اليوم', () => {
    const list = [
      tx('2026-01-01', 5000, 'تحويل من حسابي', { internal: true }), tx('2026-02-01', 5000, 'تحويل من حسابي', { internal: true }), tx('2026-03-01', 5000, 'تحويل من حسابي', { internal: true }),
      tx('2026-01-05', 1000, 'إيجار محل'), tx('2026-02-05', 3000, 'إيجار محل'), tx('2026-03-05', 900, 'إيجار محل'),
      tx('2026-01-10', 4000, 'أجرة شقة'), tx('2026-02-10', 4000, 'أجرة شقة'), tx('2026-12-10', 4000, 'أجرة شقة'),
    ];
    expect(detectIncome(list, '2026-06-01')).toEqual([]);
  });

  it('يطبّع الكتابة: «ايجار» و«إيجار» و«أُجرة» كلها إيجار', () => {
    const list = ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01'].map(d => tx(d, 2500, 'أُجرة الشقة'));
    expect(detectRent(list, '2026-05-01')[0]).toMatchObject({ cadence: 'monthly', perYear: 30000 });
  });
});
