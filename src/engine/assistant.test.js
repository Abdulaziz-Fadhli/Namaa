import { describe, expect, it } from 'vitest';
import { answer, SUGGESTED } from './assistant.js';

const ctx = { nisab: 4613.21, vault: 238897.83, nextDue: { zakat: 5972.45, hijri: '3 شوال 1448هـ', greg: '11 مارس 2027' }, unpaidTotal: 4854.5,
  rent: [{ desc: 'إيجار عقار', amount: 8000, everyText: 'كل 3 أشهر', perYear: 32000 }] };

describe('مساعد الزكاة: كل جواب من دليل الهيئة برقم فقرته', () => {
  it('الأسئلة المقترحة كلها لها جواب ومرجع', () => {
    for (const q of SUGGESTED) {
      const a = answer(q, ctx);
      expect(a.miss, q).toBeFalsy();
      expect(a.cite, q).toMatch(/دليل/);
    }
  });

  it('أسئلة شخصية بأرقام المستخدم', () => {
    expect(answer('كم زكاتي ومتى؟', ctx).text).toContain('5,972.45');
    expect(answer('كم النصاب اليوم', ctx).text).toContain('4,613.21');
    expect(answer('عندي إيجار عقار، وش حكمه؟', ctx)).toMatchObject({ cite: 'دليل الهيئة §3.8' });
    expect(answer('عندي إيجار عقار، وش حكمه؟', ctx).text).toContain('32,000');
  });

  it('يميّز الأحكام المتقاربة', () => {
    expect(answer('هل في الذهب اللي ألبسه زكاة؟', ctx).cite).toBe('دليل الهيئة §3.1.2');
    expect(answer('عندي سبايك ذهب', ctx).cite).toContain('§3.1');
    expect(answer('علي قرض، ينقص من زكاتي؟', ctx).cite).toBe('دليل الهيئة §3.4');
    expect(answer('سلفت صديقي 10 آلاف', ctx).cite).toBe('دليل الهيئة §3.4');
    expect(answer('أقدر أخرج زكاتي في رمضان؟', ctx).cite).toBe('دليل الهيئة §4.2');
    expect(answer('لمن أعطي زكاتي؟', ctx).cite).toBe('دليل الهيئة §6');
    expect(answer('هل أعطيها لبناء مسجد', ctx).text).toContain('الثمانية');
    expect(answer('عندي أرض للبيع', ctx).cite).toBe('دليل الهيئة §3.8');
  });

  it('الأسهم بالاسم أو الرمز: السعودي تزكيه الشركة، والأمريكي الزكاة عليك', () => {
    expect(answer('هل أسهم الراجحي فيها زكاة؟', ctx).text).toMatch(/يزكي|تزكي/);
    expect(answer('سهم 1120', ctx).cite).toBe('دليل الهيئة §3.6');
    const us = answer('هل في AAPL زكاة', ctx);
    expect(us.text).toContain('الزكاة عليك');
    expect(answer('هل في الأسهم زكاة', ctx).cite).toBe('دليل الهيئة §3.6');
  });

  it('لا يفتي خارج الدليل', () => {
    expect(answer('كم زكاة الفطر', ctx).miss).toBe(true);
    expect(answer('بيتكوين فيه زكاة؟', ctx).miss).toBe(true);
    expect(answer('وش رأيك في الطقس', ctx).miss).toBe(true);
  });
});
