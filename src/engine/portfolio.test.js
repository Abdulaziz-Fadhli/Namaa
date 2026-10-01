import { describe, expect, it } from 'vitest';
import { applyTrade, PROVIDERS, portfolioAssets, receiveNext, SCRIPTS, seedPortfolio, summarize, USD_SAR } from './portfolio.js';
import { calculateAssetValue } from './engine.js';

const near = (a, b) => expect(Math.abs(a - b)).toBeLessThan(0.01);

describe('ربط محفظة استثمار', () => {
  it('السهم السعودي للاستثمار تزكيه الشركة، والصندوق والنقد زكاتهما على المستثمر', () => {
    const s = summarize(seedPortfolio('alinma-invest', '2026-10-03'));
    const by = Object.fromEntries(s.holdings.map(h => [h.key, h]));
    expect(by['1150'].zakatable).toBe(false);
    expect(by['1150'].base).toBe(0);
    expect(by['9404'].zakatable).toBe(true);
    near(by['9404'].base, 1500 * 10.2);
    near(s.base, 1500 * 10.2 + 5000);
    near(s.value, 400 * 26.4 + 1500 * 10.2 + 300 * 25.1 + 5000);
  });

  it('الأسهم الأمريكية بالدولار تُحوّل بسعر 3.75 وتدخل الوعاء', () => {
    const s = summarize(seedPortfolio('sahm', '2026-10-03'));
    near(s.base, (40 * 178 + 5 * 470) * USD_SAR + 1800);
  });

  it('أصول المحفظة في المتجر: نفس الوعاء من المحرك، ولكل دفعة حولها', () => {
    const p = seedPortfolio('alinma-invest', '2026-10-03');
    const assets = portfolioAssets(p);
    near(assets.reduce((x, a) => x + a.value, 0), summarize(p).base);
    const merged = {};
    for (const a of assets) for (const [k, list] of Object.entries(a.engine)) merged[k] = [...(merged[k] ?? []), ...list];
    near(calculateAssetValue(merged), summarize(p).base);
    expect(assets.find(a => a.id.includes(':9404:')).acquired).toBe('2026-04-22');
  });
});

describe('العمليات تحدّث الزكاة فورًا', () => {
  it('شراء ورقة زكاتها عليك بنقد المحفظة: الوعاء لا يتغير، والحول من حول النقد', () => {
    const p = seedPortfolio('derayah', '2026-10-03');           // نقد 3,200 بحول 2026-08-01
    const { portfolio, trade } = applyTrade(p, { side: 'BUY', key: 'AAPL', units: 2, price: 240, date: '2026-10-03' });
    const lot = portfolio.lots.find(l => l.key === 'AAPL' && l.hawlFrom === '2026-08-01');
    expect(lot.units).toBeCloseTo(2, 9);
    near(portfolio.cash[0].amount, 3200 - 2 * 240 * USD_SAR);
    // سعر أبل تغيّر من 232 إلى 240 فيُعاد تقييم الـ12 القديمة أيضًا
    near(trade.impact.baseAfter - trade.impact.baseBefore, 12 * 8 * USD_SAR);
  });

  it('شراء سهم تزكيه الشركة: النقد يخرج من الوعاء', () => {
    const p = seedPortfolio('alinma-invest', '2026-10-03');
    const { trade } = applyTrade(p, { side: 'BUY', key: '1150', units: 100, price: 26.4, date: '2026-10-03' });
    near(trade.impact.baseBefore - trade.impact.baseAfter, 2640);
    near(trade.impact.valueAfter, trade.impact.valueBefore);
  });

  it('بيع ورقة زكاتها عليك: النقد يكمل حولها', () => {
    const p = seedPortfolio('alinma-invest', '2026-10-03');
    const { portfolio, trade } = applyTrade(p, { side: 'SELL', key: '9404', units: 500, price: 10.2, date: '2026-10-03' });
    expect(portfolio.cash.find(c => c.hawlFrom === '2026-04-22').amount).toBe(5100);
    near(trade.impact.baseAfter, trade.impact.baseBefore);
  });

  it('بيع سهم تزكيه الشركة: النقد مال جديد يبدأ حوله يوم البيع ويدخل الوعاء', () => {
    const p = seedPortfolio('alinma-invest', '2026-10-03');
    const { portfolio, trade } = applyTrade(p, { side: 'SELL', key: '1150', units: 400, price: 27, date: '2026-10-03' });
    expect(portfolio.cash.find(c => c.hawlFrom === '2026-10-03').amount).toBe(10800);
    expect(portfolio.lots.some(l => l.key === '1150')).toBe(false);
    near(trade.impact.baseAfter - trade.impact.baseBefore, 10800);
  });

  it('شراء بنقد من حولين: لكل جزء حوله (الأحدث أولًا)', () => {
    let p = seedPortfolio('alinma-invest', '2026-10-03');
    p = applyTrade(p, { side: 'SELL', key: '9404', units: 500, price: 10.2, date: '2026-10-03' }).portfolio;   // نقد 5,100 بحول 04-22
    const { portfolio } = applyTrade(p, { side: 'BUY', key: '9404', units: 800, price: 10, date: '2026-10-03' });   // 8,000
    const lots = portfolio.lots.filter(l => l.key === '9404');
    near(lots.find(l => l.hawlFrom === '2026-06-10').units, 500);       // 5,000 من نقد 06-10 (الأحدث)
    near(lots.find(l => l.hawlFrom === '2026-04-22').units, 1000 + 300); // 1,000 قديمة + 300 من نقد 04-22
  });

  it('يرفض شراء أكثر من النقد أو بيع أكثر من المملوك', () => {
    const p = seedPortfolio('aljazira-capital', '2026-10-03');
    expect(() => applyTrade(p, { side: 'BUY', key: '2010', units: 100, price: 70, date: '2026-10-03' })).toThrow('لا يكفي');
    expect(() => applyTrade(p, { side: 'SELL', key: '2010', units: 151, price: 70, date: '2026-10-03' })).toThrow('أكبر مما تملك');
  });
});

describe('العمليات الواردة تلقائيًا من التطبيق', () => {
  it('كل تطبيق: عملياته المجدولة تنطبق بالترتيب بدون خطأ، ثم تتوقف', () => {
    for (const { id } of PROVIDERS) {
      let p = seedPortfolio(id, '2026-10-03');
      for (let i = 0; i < SCRIPTS[id].length; i++) {
        const r = receiveNext(p, '2026-10-03', '9:00 ص');
        expect(r.trade.side).toBe(SCRIPTS[id][i][0]);
        p = r.portfolio;
      }
      expect(receiveNext(p, '2026-10-03', '9:00 ص')).toBeNull();
      expect(p.trades).toHaveLength(SCRIPTS[id].length);
    }
  });
});
