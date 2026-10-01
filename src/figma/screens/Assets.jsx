// الأصول خارج البنوك وشاشات إضافتها، وتفاصيل الأصول. القيم تُحسب بـ calculateAssetValue من المحرك،
// والأسهم والصناديق بحكم «هل يزكي؟» من src/securities.
import { useState } from 'react';
import {
  ArrowLeft, BadgeDollarSign, Banknote, Building2, Calendar, ChartCandlestick, CircleMinus, Clock3, Coins, Gem,
  House, Info, Landmark, Plus, RefreshCw, Scale,
} from 'lucide-react';
import { AmountCard, Button, Ico, InfoRow, Note, Screen, Segmented } from '../ui.jsx';
import { DateField, NumberField, SelectField, TextField } from '../fields.jsx';
import { bankName, parseNum, useStore, zakatableOf } from '../model.js';
import { gregText, hijriToIso, money, num } from '../format.js';
import { timeOf, useLivePrices } from '../live.js';

const KINDS = {
  metals: ['gold', 'silver'],
  security: ['stock', 'fund'],
  cash: ['cash'],
  property: ['property'],
};

function AssetCard({ icon, title, detail, added, onClick }) {
  return (
    <button className={`nm-asset${added ? ' added' : ''}`} onClick={onClick}>
      <span className="nm-asset-head">
        <Ico as={icon} size={22} />
        <span className="nm-tag">{added ? 'مضاف' : 'إضافة'}</span>
      </span>
      <span className="nm-asset-name">
        <strong>{title}</strong>
        <span>{detail}</span>
      </span>
    </button>
  );
}

export function OffBank({ go, back }) {
  const { assets } = useStore();
  const { metals, loading } = useLivePrices();
  const liveNote = loading ? 'نحدّث أسعار السوق…'
    : metals.source !== 'fallback' ? `أسعار الذهب والفضة والأسهم الأمريكية مباشرة من السوق${timeOf(metals.at) ? ` • ${timeOf(metals.at)}` : ''}.`
      : `أسعار الذهب والفضة محفوظة بتاريخ ${gregText(metals.at)}.`;
  const of = key => assets.filter(a => KINDS[key].includes(a.kind));
  const summary = (key, empty) => {
    const list = of(key);
    if (!list.length) return empty;
    return list.length === 1 ? list[0].short : `${list.length} أصول • ${money(list.reduce((s, a) => s + a.value, 0))}`;
  };
  return (
    <Screen theme="dark" title="أصولك الأخرى" desc="أضف ما تملكه خارج الحسابات ليكتمل الوعاء." onBack={back}
      cta={<Button variant="primary" icon={ArrowLeft} onClick={() => go('home')}>حفظ ومتابعة</Button>}>
      <div className="nm-grid">
        <AssetCard icon={ChartCandlestick} title="أسهم وصناديق" detail={summary('security', 'محفظة خارجية')} added={of('security').length > 0} onClick={() => go('security')} />
        <AssetCard icon={Gem} title="ذهب وفضة" detail={summary('metals', 'بالوزن والعيار')} added={of('metals').length > 0} onClick={() => go('metals')} />
        <AssetCard icon={House} title="عقار" detail={summary('property', 'معد للبيع')} added={of('property').length > 0} onClick={() => go('property')} />
        <AssetCard icon={Banknote} title="نقد" detail={summary('cash', 'خارج البنوك')} added={of('cash').length > 0} onClick={() => go('cash')} />
      </div>
      <Note icon={RefreshCw}>{liveNote}</Note>
    </Screen>
  );
}

const GOLD_KARATS = [24, 22, 21, 18];
const SILVER_PURITY = [999, 925, 900, 800];

export function Metals({ back }) {
  const { view, addAsset } = useStore();
  const [metal, setMetal] = useState('gold');
  const [grams, setGrams] = useState('25');
  const [karat, setKarat] = useState(24);
  const [purity, setPurity] = useState(999);
  const [acquired, setAcquired] = useState(hijriToIso(1446, 8, 12));
  const g = parseNum(grams);
  const ok = g > 0;
  const gold = metal === 'gold';
  const { metals, loading } = useLivePrices();
  const isLive = metals.source !== 'fallback';
  const price = gold ? metals.goldPerGram : metals.silverPerGram;
  const engine = gold
    ? { gold: [{ grams: ok ? g : 0, karat, pricePerGram: price }] }
    : { silver: [{ grams: ok ? g : 0, purity, pricePerGram: price }] };
  const value = zakatableOf({ engine });
  const unitPrice = gold ? (price * karat) / 24 : (price * purity) / 1000;
  const add = () => {
    addAsset({
      kind: metal, engine, value, acquired,
      // للوضع المباشر: يعاد تقييمه مع كل تحديث لسعر المعدن
      live: gold ? { metal: 'gold', grams: g, karat } : { metal: 'silver', grams: g, purity },
      title: gold ? `ذهب ${karat} قيراط` : `فضة ${purity}`,
      short: `${num(g)} غرام ${gold ? 'ذهب' : 'فضة'}`,
      detail: `${num(g)} غرام • ${isLive ? 'سعر السوق الآن' : `سعر ${gregText(metals.at)}`}`,
    });
    back();
  };
  return (
    <Screen title="ذهب أو فضة" desc="أدخل الوزن والعيار، وسنستخدم آخر سعر متاح." onBack={back}
      cta={<Button variant="primary" icon={Plus} disabled={!ok} onClick={add}>إضافة الأصل</Button>}>
      <Segmented label="نوع المعدن" value={metal} onChange={v => { setMetal(v); setGrams(v === 'gold' ? '25' : '600'); }}
        options={[{ value: 'gold', label: 'ذهب' }, { value: 'silver', label: 'فضة' }]} />
      <NumberField icon={Scale} label="الوزن" value={grams} onChange={setGrams} unit="غرام" active
        help="أدخل رقمًا أكبر من صفر" warn={!ok} />
      {gold
        ? <SelectField icon={Gem} label="العيار" value={karat} onChange={v => setKarat(Number(v))}
          options={GOLD_KARATS.map(k => ({ value: k, label: `${k} قيراط` }))} />
        : <SelectField icon={Gem} label="النقاوة" value={purity} onChange={v => setPurity(Number(v))}
          options={SILVER_PURITY.map(p => ({ value: p, label: p === 999 ? '999 (خالصة)' : p === 925 ? '925 (استرليني)' : String(p) }))} />}
      <DateField icon={Calendar} label="تاريخ التملك" value={acquired} onChange={setAcquired} max={view.today} />
      <AmountCard label="القيمة وفق آخر سعر" amount={money(value)}
        detail={`${num(ok ? g : 0)} غ × ${money(unitPrice, { decimals: 2 })}`} />
      <Note icon={Clock3}>
        {loading ? 'نجلب سعر السوق الآن…'
          : isLive ? `سعر السوق المباشر لغرام ${gold ? 'الذهب عيار 24' : 'الفضة الخالصة'}: ${money(price, { decimals: 2 })}${timeOf(metals.at) ? ` • آخر تحديث ${timeOf(metals.at)}` : ''}.`
          : `آخر سعر محفوظ لغرام ${gold ? 'الذهب عيار 24' : 'الفضة الخالصة'} (${gregText(metals.at)}): ${money(price, { decimals: 2 })}.`}
      </Note>
    </Screen>
  );
}

export function Cash({ back }) {
  const { view, addAsset } = useStore();
  const [amount, setAmount] = useState('2,500');
  const [currency, setCurrency] = useState('SAR');
  const [acquired, setAcquired] = useState(hijriToIso(1447, 1, 20));
  const n = parseNum(amount);
  const ok = n > 0;
  const sar = ok ? (currency === 'USD' ? n * 3.75 : n) : 0;
  const engine = { manualAssets: [{ value: sar }] };
  const value = zakatableOf({ engine });
  return (
    <Screen title="نقد خارج البنوك" desc="أدخل المبلغ والعملة وتاريخ بدء التملك." onBack={back}
      cta={<Button variant="primary" icon={Plus} disabled={!ok}
        onClick={() => { addAsset({ kind: 'cash', engine, value, acquired, title: 'نقد خارج البنوك', short: money(value), detail: 'تم التحقق يدويًا' }); back(); }}>إضافة الأصل</Button>}>
      <NumberField icon={Banknote} label="المبلغ" value={amount} onChange={setAmount} active warn={!ok} help={ok ? undefined : 'أدخل رقمًا أكبر من صفر'} />
      <SelectField icon={Coins} label="العملة" value={currency} onChange={setCurrency}
        options={[{ value: 'SAR', label: 'ريال سعودي • ر.س' }, { value: 'USD', label: 'دولار أمريكي • $' }]} />
      <DateField icon={Calendar} label="تاريخ التملك" value={acquired} onChange={setAcquired} max={view.today} />
      <AmountCard label="القيمة المضافة للوعاء" amount={money(value)} detail={currency === 'USD' ? `${num(n)} $ × 3.75` : undefined} />
      <Note icon={Info}>يمكنك تعديل القيمة لاحقًا من تفاصيل الأصول.</Note>
    </Screen>
  );
}

export function Property({ back }) {
  const { view, addAsset } = useStore();
  const [name, setName] = useState('أرض النرجس التجارية');
  const [amount, setAmount] = useState('120,000');
  const [acquired, setAcquired] = useState(hijriToIso(1447, 3, 5));
  const n = parseNum(amount);
  const ok = n > 0 && name.trim();
  const engine = { properties: [{ intent: 'TRADING', marketValue: n > 0 ? n : 0 }] };
  const value = zakatableOf({ engine });
  return (
    <Screen theme="dark" title="عقار معد للبيع" desc="يشمل الاحتساب العقار التجاري المعد للبيع فقط." onBack={back}
      cta={<Button variant="primary" icon={Plus} disabled={!ok}
        onClick={() => { addAsset({ kind: 'property', engine, value, acquired, title: name.trim(), short: name.trim(), detail: 'عقار معد للبيع • بالقيمة الحالية' }); back(); }}>إضافة الأصل</Button>}>
      <TextField icon={House} label="اسم العقار" value={name} onChange={setName} active />
      <NumberField icon={BadgeDollarSign} label="القيمة الحالية" value={amount} onChange={setAmount} unit="ر.س" />
      <DateField icon={Calendar} label="تاريخ التملك" value={acquired} onChange={setAcquired} max={view.today} />
      <Note icon={CircleMinus}>العقار المعد للسكن أو الاستخدام الشخصي لا يدخل في الوعاء.</Note>
      <AmountCard theme="dark" label="القيمة المدرجة" amount={money(value)} />
    </Screen>
  );
}

const ACCOUNT_TITLE = { current: 'الحساب الجاري', savings: 'حساب الادخار', investment: 'الحساب الاستثماري' };
const ASSET_ICON = { gold: Gem, silver: Gem, stock: ChartCandlestick, fund: ChartCandlestick, cash: Banknote, property: House };
const ASSET_SCREEN = { gold: 'metals', silver: 'metals', stock: 'security', fund: 'security', cash: 'cash', property: 'property' };

export function Details({ go, back }) {
  const { view, assets, vault } = useStore();
  return (
    <Screen theme="dark" title="الأصول والحسابات" desc="مصدر كل قيمة وحالتها في مكان واحد." onBack={back}
      cta={<Button variant="primary" icon={Plus} onClick={() => go('offbank')}>إضافة أصل</Button>}>
      <AmountCard theme="dark" label="إجمالي الوعاء" amount={money(vault)} />
      {view.accounts.map((a, i) => (
        <InfoRow key={a.id} icon={i === 0 ? Landmark : Building2} onClick={() => go('link')}
          title={a.exempt ? a.product : ACCOUNT_TITLE[a.type]}
          detail={a.exempt ? `${bankName(a.bank)} • معفى من الزكاة، لا يدخل الوعاء` : `${bankName(a.bank)} • متصل`}
          value={money(a.balance)} />
      ))}
      {assets.map(a => (
        <InfoRow key={a.id} icon={ASSET_ICON[a.kind]} title={a.title} detail={a.detail} value={money(a.value)}
          onClick={() => go(ASSET_SCREEN[a.kind])} />
      ))}
    </Screen>
  );
}
