// إضافة سهم أو صندوق: البحث والحكم «هل يزكي؟» من src/securities، والقيمة الداخلة للوعاء من المحرك.
// ملف مستقل يُحمَّل عند فتح الشاشة فقط، لأن دليل الأوراق المالية كبير (1614 ورقة).
import { useMemo, useState } from 'react';
import { BadgeDollarSign, Calendar, Hash, Plus, Search } from 'lucide-react';
import { AmountCard, Button, Ico, Screen, Segmented } from '../ui.jsx';
import { DateField, NumberField } from '../fields.jsx';
import { parseNum, useStore, zakatableOf } from '../model.js';
import { money, num } from '../format.js';
import { assess, check, toEngineEntry } from '../../securities/securities.js';
import { saudiSymbol, timeOf, useLivePrices } from '../live.js';

function Choices({ items, onPick }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map(it => (
        <button key={it.key} onClick={() => onPick(it)} className="nm-tag" style={{ fontSize: 11, lineHeight: '23px', padding: '4px 10px', border: '1px solid var(--nm-border)', color: 'var(--nm-text)' }}>{it.label}</button>
      ))}
    </div>
  );
}

export default function Security({ back }) {
  const { view, addAsset } = useStore();
  const [type, setType] = useState('stock');
  const [q, setQ] = useState('1120');
  const [category, setCategory] = useState(null);
  const [units, setUnits] = useState('12');
  const [price, setPrice] = useState('97.40');
  const [priceTouched, setPriceTouched] = useState(false);
  const [acquired, setAcquired] = useState('2026-01-10');
  const r = useMemo(() => (q.trim() ? check(q, { category: category ?? undefined }) : null), [q, category]);
  const found = r?.found;
  // السهم السعودي: نجيب سعره من تداول عبر خدمة الأسعار، والمستخدم يقدر يعدّله
  const sym = saudiSymbol(r);
  const live = useLivePrices(sym ? [sym] : []);
  const quote = sym ? live.quotes[sym] : null;
  const shownPrice = !priceTouched && quote ? String(quote.price) : price;
  const u = parseNum(units), p = parseNum(shownPrice);
  const isCompany = found && r.type === 'COMPANY';
  const shownType = found ? (isCompany ? 'stock' : 'fund') : type;
  const us = found && r.market === 'US';
  const a = found && u > 0 && p > 0
    ? assess({ symbol: r.symbol || undefined, fundName: r.symbol ? undefined : r.name, category: r.symbol ? undefined : r.category, units: u, price: p, intent: 'INVEST' })
    : null;
  const e = a && toEngineEntry(a);
  const engine = e ? { [e.kind]: [e.entry] } : {};
  const contribution = e ? zakatableOf({ engine }) : 0;
  const unitLabel = shownType === 'stock' ? 'سهمًا' : 'وحدة';

  let help = 'اكتب اسم السهم أو الصندوق أو رمزه';
  if (r && found) help = `${[r.name, r.marketAr].filter(Boolean).join(' • ')} • ${r.badge}`;
  else if (r && q.trim().length >= 2) help = r.message;

  const add = () => {
    addAsset({
      kind: shownType, engine, value: contribution, market: a.value, acquired,
      title: `${isCompany ? 'سهم' : 'صندوق'} ${r.name}`,
      short: `${num(u)} ${unitLabel} • ${r.name}`,
      detail: `${num(u)} ${unitLabel} • ${r.marketAr ?? 'غير مدرج'}${a.zakatable ? '' : ' • الشركة تزكي عنه'}`,
    });
    back();
  };

  return (
    <Screen theme="dark" title="سهم أو صندوق" desc="ابحث بالرمز أو الاسم ثم أدخل عدد الوحدات." onBack={back}
      cta={<Button variant="primary" icon={Plus} disabled={!a} onClick={add}>إضافة الأصل</Button>}>
      <Segmented label="نوع الورقة" value={shownType} onChange={v => { setType(v); if (found) { setQ(''); setCategory(null); } }}
        options={[{ value: 'stock', label: 'سهم' }, { value: 'fund', label: 'صندوق' }]} />
      <div className="nm-field">
        <label className="nm-field-box active">
          <Ico as={Search} />
          <span className="nm-field-label">البحث</span>
          <input className="nm-field-input" value={q} maxLength={80} aria-label="اسم السهم أو الصندوق أو رمزه"
            placeholder={shownType === 'stock' ? 'مثال: 1120 أو AAPL' : 'مثال: الراجحي ريت'}
            onChange={ev => { setQ(ev.target.value); setCategory(null); setPriceTouched(false); }} />
        </label>
        <span className="nm-help" role="status">{help}</span>
        {r && !found && r.alternatives?.length > 0 && (
          <Choices items={r.alternatives.slice(0, 4).map(x => ({ key: x.symbol, label: `${x.name} • ${x.symbol}`, symbol: x.symbol }))} onPick={x => { setQ(x.symbol); setPriceTouched(false); }} />
        )}
        {r && !found && r.choices && (
          <Choices items={r.choices.map(c => ({ key: c.category, label: c.label, category: c.category }))} onPick={c => setCategory(c.category)} />
        )}
      </div>
      <NumberField icon={Hash} label="الكمية" value={units} onChange={setUnits} unit={unitLabel} />
      <NumberField icon={BadgeDollarSign} label="سعر الوحدة" value={shownPrice} unit={us ? '$' : 'ر.س'}
        onChange={v => { setPrice(v); setPriceTouched(true); }}
        help={!sym ? (found ? 'أدخل سعر الوحدة (لا يوجد مصدر أسعار مباشر لهذه الورقة)' : undefined)
          : quote && !priceTouched ? `سعر ${r.marketAr} المباشر${live.delayedMinutes ? ` (متأخر ${live.delayedMinutes} دقيقة)` : ''}${timeOf(quote.at ?? live.fetchedAt) ? ` • ${timeOf(quote.at ?? live.fetchedAt)}` : ''}`
          : live.loading ? 'نجلب السعر من السوق…'
          : priceTouched ? 'سعر أدخلته أنت' : 'تعذّر جلب السعر المباشر، أدخله يدويًا'} />
      <DateField icon={Calendar} label="تاريخ التملك" value={acquired} onChange={setAcquired} calendar="gregorian" max={view.today} />
      <AmountCard theme="dark" label="القيمة السوقية الحالية" amount={money(a ? a.value : 0)}
        detail={a ? `${num(u)} × ${us ? `${num(p, { decimals: 2 })} $ (× 3.75)` : money(p, { decimals: 2 })} • ${a.zakatable ? `يدخل الوعاء ${money(contribution)}` : 'الشركة تزكي عنه، لا يدخل وعاءك'}` : 'أدخل الكمية والسعر'} />
    </Screen>
  );
}

