// بطاقة «أسهم وصناديق»: يكتب المستخدم اسم السهم أو الصندوق أو رمزه، فنقول له هل «يزكي» أو الزكاة عليه.
// المنطق كله في src/securities/securities.js (بدون خادم)، والتحويل لمدخل المحرك بـ toEngineEntry.
import { useMemo, useState } from 'react';
import { check, assess } from '../securities/securities.js';

const num = v => Number(String(v).replace(/[^\d.]/g, '')) || 0;
const fmt = n => Math.round(n).toLocaleString('en-US');
const NOTE = { fontSize: 12, lineHeight: 1.6, color: 'var(--muted)' };

function Verdict({ r, estimate }) {
  const ok = r.paysZakat;
  const color = ok ? 'var(--green)' : 'var(--gold)';
  return (
    <div role="status" className="col" style={{
      gap: 6, borderRadius: 12, padding: '12px 14px',
      background: ok ? 'rgba(76,195,138,0.10)' : 'rgba(232,196,106,0.12)',
    }}>
      <div className="row" style={{ justifyContent: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ background: color, color: 'var(--bg)', borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>{r.badge}</span>
        <span className="bold">{r.name}</span>
        <span className="small muted">{[r.symbol, r.marketAr].filter(Boolean).join(' · ')}</span>
      </div>
      <span className="bold" style={{ color: ok ? '#9BE3BF' : '#F3D98F', fontSize: 14 }}>{r.headline}</span>
      <span style={{ fontSize: 13, lineHeight: 1.7, color: '#DCE5EB' }}>{r.detail}</span>
      {estimate && (
        <span style={{ fontSize: 13, lineHeight: 1.7 }}>
          القيمة {fmt(estimate.value)} ريال · <span className="bold">الزكاة عليك {fmt(estimate.zakat)} ريال</span>
          {estimate.note && <span style={{ display: 'block', ...NOTE }}>{estimate.note}</span>}
        </span>
      )}
      {r.note && <span style={NOTE}>{r.note}</span>}
    </div>
  );
}

function Choice({ onClick, children }) {
  return (
    <button onClick={onClick} className="btn outline small" style={{ height: 36, fontSize: 13, borderWidth: 1 }}>{children}</button>
  );
}

export default function StockZakatCheck() {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState(null);        // رمز اختاره المستخدم من الاقتراحات أو الخيارات
  const [category, setCategory] = useState(null);    // نوع صندوق غير مدرج اختاره المستخدم
  const [intent, setIntent] = useState('INVEST');
  const [units, setUnits] = useState('');
  const [price, setPrice] = useState('');

  const query = picked || q;
  const result = useMemo(() => (query.trim() ? check(query, { intent, category: category || undefined }) : null), [query, intent, category]);

  const estimate = useMemo(() => {
    if (!result?.found || !(num(units) > 0 && num(price) > 0)) return null;
    const a = assess({ symbol: result.symbol || undefined, fundName: result.symbol ? undefined : result.name,
      category: result.symbol ? undefined : result.category, units: num(units), price: num(price), intent });
    if (!a) return null;
    return { value: a.value, zakat: a.zakat,
      note: !a.zakatable ? 'لا زكاة عليك في أصل هذه الورقة.'
        : a.needsZakatPerUnit ? 'هذا الحد الأعلى على القيمة السوقية؛ زكاتك الفعلية غالباً أقل، واطلب «زكاة الوحدة» من مدير الصندوق.'
        : result.market === 'US' ? 'السعر بالدولار، حوّلناه بـ 3.75.' : null };
  }, [result, units, price, intent]);

  const choose = symbol => { setPicked(symbol); setQ(symbol); setCategory(null); };

  return (
    <div className="card col" style={{ gap: 12 }}>
      <div className="row" style={{ alignItems: 'baseline' }}>
        <span className="bold" style={{ fontSize: 16 }}>أسهم وصناديق</span>
        <span className="small muted">هل يزكي؟</span>
      </div>

      <label className="field-label">اسم السهم أو الصندوق أو رمزه
        <input className="input" value={q} maxLength={80} placeholder="مثال: الراجحي، 2222، AAPL، الراجحي ريت"
          onChange={e => { setQ(e.target.value); setPicked(null); setCategory(null); }} />
      </label>

      <label className="field-label">نيتك
        <select className="input" value={intent} onChange={e => setIntent(e.target.value)}>
          <option value="INVEST">مستثمر (أحتفظ بها)</option>
          <option value="TRADE">مضارب (أشتري لأبيع)</option>
        </select>
      </label>
      <div className="grid2">
        <label className="field-label">العدد (اختياري)
          <input className="input" inputMode="decimal" value={units} onChange={e => setUnits(e.target.value)} placeholder="مثال: 100" />
        </label>
        <label className="field-label">السعر (اختياري)
          <input className="input" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} placeholder="سعر الوحدة" />
        </label>
      </div>

      {result && (result.found
        ? <>
            <Verdict r={result} estimate={estimate} />
            {result.alternatives?.length > 0 && (
              <span style={NOTE}>تقصد غيره؟ {result.alternatives.slice(0, 3).map((a, i) => (
                <span key={a.symbol}>{i > 0 && ' · '}<a href="#" style={{ textDecoration: 'underline' }} onClick={e => { e.preventDefault(); choose(a.symbol); }}>{a.name}</a></span>
              ))}</span>
            )}
          </>
        : (q.trim().length >= 2 || picked) && (
          <div className="col" style={{ gap: 8 }}>
            <span style={{ fontSize: 13, lineHeight: 1.7 }}>{result.message}</span>
            {result.alternatives?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {result.alternatives.map(a => <Choice key={a.symbol} onClick={() => choose(a.symbol)}>{a.name} · {a.symbol} · {a.marketAr}</Choice>)}
              </div>
            )}
            {result.choices && (
              <>
                {result.choicesMessage && <span style={{ fontSize: 13 }}>{result.choicesMessage}</span>}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {result.choices.map(c => <Choice key={c.category} onClick={() => setCategory(c.category)}>{c.label}</Choice>)}
                </div>
              </>
            )}
          </div>
        ))}

      <span style={NOTE}>الشركات السعودية تدفع الزكاة عن مساهميها، والصناديق والأسهم الأمريكية زكاتها عليك. للاسترشاد وليس فتوى.</span>
    </div>
  );
}
