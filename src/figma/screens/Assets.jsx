// الأصول خارج البنوك وشاشات إضافتها، وتفاصيل الأصول. القيم تُحسب بـ calculateAssetValue من المحرك،
// والأسهم والصناديق بحكم «هل يزكي؟» من src/securities.
import { useState } from 'react';
import {
  ArrowLeft, BadgeDollarSign, Banknote, BookOpen, Building2, Calendar, ChartCandlestick, CircleMinus, Clock3, Coins,
  Droplets, Gem, Hash, House, Info, Landmark, PawPrint, Plus, RefreshCw, Scale, Sprout, Tag, Wheat,
} from 'lucide-react';
import { AmountCard, Button, Ico, InfoRow, Note, Screen, Segmented } from '../ui.jsx';
import { DateField, NumberField, SelectField, TextField } from '../fields.jsx';
import { bankName, parseNum, useStore, zakatableOf } from '../model.js';
import { gregText, hijriText, hijriToIso, money, num } from '../format.js';
import { timeOf, useLivePrices } from '../live.js';
import {
  CROP_KINDS, CROP_UNITS, GRAZING, IRRIGATION, LIVESTOCK_PURPOSES, LIVESTOCK_TYPES, ZATCA, assessCrop, assessLivestock,
} from '../../engine/zatca.js';

const KINDS = {
  metals: ['gold', 'silver'],
  security: ['stock', 'fund'],
  cash: ['cash'],
  property: ['property'],
  livestock: ['livestock'],
  crop: ['crop'],
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

// المواشي والمحاصيل زكاتها عينية (رؤوس أو كيلوغرامات)، فملخصها بالعدد لا بالريال
const agriSummary = (list, empty) => (!list.length ? empty : list.length === 1 ? list[0].short : `${list.length} أصول`);

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
        <AssetCard icon={PawPrint} title="مواشي" detail={agriSummary(of('livestock'), 'إبل، بقر، غنم')} added={of('livestock').length > 0} onClick={() => go('livestock')} />
        <AssetCard icon={Wheat} title="محاصيل زراعية" detail={agriSummary(of('crop'), 'حبوب وتمور')} added={of('crop').length > 0} onClick={() => go('crops')} />
      </div>
      <Note icon={RefreshCw}>{liveNote}</Note>
    </Screen>
  );
}

const GOLD_KARATS = [24, 22, 21, 18];
// الغرض: سبائك وادخار تُزكّى، والحلي المستعمل أو المعدّ للإعارة معفى (jewelryTreatment: EXCLUDE_PERSONAL_USE في المحرك)
const PURPOSES = [
  { value: 'INVESTMENT', label: 'ادخار أو استثمار (سبائك، جنيهات)', short: 'ادخار' },
  { value: 'PERSONAL_USE', label: 'حلي ألبسه', short: 'الحلي المستعمل' },
  { value: 'LENDING', label: 'حلي أعيره لغيري', short: 'الحلي المعدّ للإعارة' },
];
const SILVER_PURITY = [999, 925, 900, 800];

export function Metals({ back }) {
  const { view, addAsset } = useStore();
  const [metal, setMetal] = useState('gold');
  const [grams, setGrams] = useState('25');
  const [karat, setKarat] = useState(24);
  const [purity, setPurity] = useState(999);
  const [purpose, setPurpose] = useState('INVESTMENT');   // حلي الاستعمال والإعارة لا تُزكّى حسب منهجية الفريق
  const [acquired, setAcquired] = useState(hijriToIso(1446, 8, 12));
  const g = parseNum(grams);
  const ok = g > 0;
  const gold = metal === 'gold';
  const { metals, loading } = useLivePrices();
  const isLive = metals.source !== 'fallback';
  const price = gold ? metals.goldPerGram : metals.silverPerGram;
  const engine = gold
    ? { gold: [{ grams: ok ? g : 0, karat, pricePerGram: price, purpose }] }
    : { silver: [{ grams: ok ? g : 0, purity, pricePerGram: price, purpose }] };
  const value = zakatableOf({ engine });
  const jewelry = purpose !== 'INVESTMENT';
  const marketValue = ok ? g * (gold ? (price * karat) / 24 : (price * purity) / 1000) : 0;
  const unitPrice = gold ? (price * karat) / 24 : (price * purity) / 1000;
  const add = () => {
    addAsset({
      kind: metal, engine, value, acquired,
      // للوضع المباشر: يعاد تقييمه مع كل تحديث لسعر المعدن
      live: gold ? { metal: 'gold', grams: g, karat, purpose } : { metal: 'silver', grams: g, purity, purpose },
      title: `${jewelry ? 'حلي ' : ''}${gold ? `ذهب ${karat} قيراط` : `فضة ${purity}`}`,
      short: `${num(g)} غرام ${gold ? 'ذهب' : 'فضة'}${jewelry ? ' (حلي)' : ''}`,
      detail: jewelry ? `${num(g)} غرام • ${PURPOSES.find(o => o.value === purpose).short}، لا يدخل الوعاء`
        : `${num(g)} غرام • ${isLive ? 'سعر السوق الآن' : `سعر ${gregText(metals.at)}`}`,
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
      <SelectField icon={Info} label="الغرض" value={purpose} onChange={setPurpose}
        options={PURPOSES.map(o => ({ value: o.value, label: o.label }))} />
      <DateField icon={Calendar} label="تاريخ التملك" value={acquired} onChange={setAcquired} max={view.today} />
      <AmountCard label={jewelry ? 'القيمة الداخلة للوعاء' : 'القيمة وفق آخر سعر'} amount={money(value)}
        detail={jewelry
          ? `قيمته ${money(marketValue)}، لكن ${PURPOSES.find(o => o.value === purpose).short} لا يُزكّى حسب منهجية التطبيق`
          : `${num(ok ? g : 0)} غ × ${money(unitPrice, { decimals: 2 })} • زكاته ${money(value / 40, { decimals: 2 })} إذا حال عليه الحول`} />
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
const ASSET_ICON = { gold: Gem, silver: Gem, stock: ChartCandlestick, fund: ChartCandlestick, cash: Banknote, property: House, livestock: PawPrint, crop: Wheat };
const ASSET_SCREEN = { gold: 'metals', silver: 'metals', stock: 'security', fund: 'security', cash: 'cash', property: 'property', livestock: 'livestock', crop: 'crops' };

// حالة زكاة المواشي والمحاصيل في سطر الأصل (الفريضة نفسها تظهر في القيمة)
const agriStatus = r => (r.status === 'NOT_YET' ? `تجب في ${hijriText(r.dueDate)} عند تمام الحول`
  : r.status === 'DUE' ? (r.kind === 'crop' ? `${r.rateText} • تجب عند الحصاد` : 'حال عليها الحول • تُخرج من جنسها')
    : r.headline);

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
        <InfoRow key={a.id} icon={ASSET_ICON[a.kind]} title={a.title} detail={a.result ? agriStatus(a.result) : a.detail}
          value={a.result && !a.result.vaultValue ? (a.result.inKind ?? '—') : money(a.value)}
          onClick={() => go(ASSET_SCREEN[a.kind])} />
      ))}
      {assets.some(a => a.result?.inKind) && (
        <Note icon={BookOpen}>زكاة المواشي والمحاصيل تُخرج من جنسها ولا تدخل وعاء النقود. تُدفع عبر {ZATCA.channels.livestockCrops}.</Note>
      )}
    </Screen>
  );
}

// ---------- المواشي (بهيمة الأنعام) ----------
// الحكم والفريضة من assessLivestock (src/engine/zatca.js) حسب الدليل المبسط لجباية زكاة بهيمة الأنعام والحبوب والثمار
const TYPE_OPTIONS = Object.entries(LIVESTOCK_TYPES).map(([value, t]) => ({ value, label: t.label.split(' ')[0] }));

export function Livestock({ back }) {
  const { view, addAsset } = useStore();
  const [type, setType] = useState('sheep');
  const [count, setCount] = useState('120');
  const [purpose, setPurpose] = useState('BREEDING');
  const [grazing, setGrazing] = useState('GRAZING');
  const [market, setMarket] = useState('');
  const [acquired, setAcquired] = useState(hijriToIso(1446, 10, 1));
  const n = parseNum(count);
  const m = parseNum(market);
  const countOk = Number.isSafeInteger(n) && n > 0;
  const trade = purpose === 'TRADING';
  const ok = countOk && (!trade || m > 0);
  const agri = { type, count: countOk ? n : 0, purpose, grazing, acquired, ...(trade ? { marketValue: m > 0 ? m : 0 } : {}) };
  const r = assessLivestock({ ...agri, asOf: view.today });
  const label = LIVESTOCK_TYPES[type].label.split(' ')[0];
  const add = () => {
    addAsset({
      kind: 'livestock', agri, acquired,
      engine: trade ? { manualAssets: [{ value: r.vaultValue }] } : {},
      value: r.vaultValue,
      title: `${num(n)} رأس ${label}`,
      short: `${num(n)} رأس ${label}`,
      detail: r.headline,
    });
    back();
  };
  return (
    <Screen title="مواشي" desc="إبل أو بقر أو غنم تملكها، وسنحسب زكاتها بالرؤوس." onBack={back}
      cta={<Button variant="primary" icon={Plus} disabled={!ok} onClick={add}>إضافة الأصل</Button>}>
      <Segmented label="النوع" value={type} onChange={v => { setType(v); setCount(v === 'camels' ? '30' : v === 'cattle' ? '40' : '120'); }}
        options={TYPE_OPTIONS} />
      <NumberField icon={Hash} label="العدد" value={count} onChange={setCount} unit="رأس" active
        warn={!countOk} help={countOk ? undefined : 'أدخل عددًا صحيحًا أكبر من صفر'} />
      <SelectField icon={Info} label="الغرض" value={purpose} onChange={setPurpose}
        options={Object.entries(LIVESTOCK_PURPOSES).map(([value, label]) => ({ value, label }))} />
      {purpose === 'BREEDING' && (
        <SelectField icon={Sprout} label="الرعي" value={grazing} onChange={setGrazing}
          options={Object.entries(GRAZING).map(([value, label]) => ({ value, label }))} />
      )}
      {trade && (
        <NumberField icon={BadgeDollarSign} label="قيمتها السوقية اليوم" value={market} onChange={setMarket} unit="ر.س"
          warn={!(m > 0)} help={m > 0 ? undefined : 'أدخل قيمتها بسعر السوق'} />
      )}
      <DateField icon={Calendar} label="بداية الحول (تاريخ التملك)" value={acquired} onChange={setAcquired} max={view.today} />
      <AmountCard label={r.status === 'TRADE_GOODS' ? 'تدخل وعاء النقود' : 'الواجب في زكاتها'}
        amount={r.status === 'TRADE_GOODS' ? money(r.vaultValue) : (r.inKind ?? 'لا شيء')}
        detail={r.status === 'NOT_YET' ? `تجب في ${hijriText(r.dueDate)} عند تمام الحول` : r.status === 'DUE' ? 'حال عليها الحول، فتجب الآن' : r.headline} />
      <Note icon={BookOpen}>{r.reason} المصدر: {r.sources[0]}، {ZATCA.authority}.</Note>
    </Screen>
  );
}

// ---------- المحاصيل الزراعية (الحبوب والثمار) ----------
export function Crops({ back }) {
  const { addAsset } = useStore();
  const [kind, setKind] = useState('DATES');
  const [quantity, setQuantity] = useState('2,000');
  const [unit, setUnit] = useState('KG');
  const [irrigation, setIrrigation] = useState('WITH_COST');
  const [price, setPrice] = useState('');
  const q = parseNum(quantity);
  const p = parseNum(price);
  const ok = q > 0;
  const agri = { kind, quantity: ok ? q : 0, unit, irrigation, ...(p > 0 ? { pricePerUnit: p } : {}) };
  const r = assessCrop(agri);
  const u = CROP_UNITS[unit];
  const add = () => {
    addAsset({
      kind: 'crop', agri, engine: {}, value: 0, acquired: null,
      title: `محصول ${CROP_KINDS[kind].label}`,
      short: `${num(q)} ${u.short} ${CROP_KINDS[kind].label}`,
      detail: r.headline,
    });
    back();
  };
  return (
    <Screen title="محاصيل زراعية" desc="الحبوب والثمار تُزكّى عند الحصاد، ولا يشترط لها حول." onBack={back}
      cta={<Button variant="primary" icon={Plus} disabled={!ok} onClick={add}>إضافة الأصل</Button>}>
      <SelectField icon={Wheat} label="المحصول" value={kind} onChange={setKind}
        options={Object.entries(CROP_KINDS).map(([value, c]) => ({ value, label: c.label }))} />
      <Segmented label="وحدة القياس" value={unit} onChange={setUnit}
        options={Object.entries(CROP_UNITS).map(([value, x]) => ({ value, label: x.short }))} />
      <NumberField icon={Scale} label={`الكمية ${CROP_KINDS[kind].group === 'GRAIN' ? 'بعد التصفية' : 'بعد الجفاف'}`} value={quantity}
        onChange={setQuantity} unit={u.short} active warn={!ok} help={ok ? undefined : 'أدخل رقمًا أكبر من صفر'} />
      <SelectField icon={Droplets} label="طريقة السقي" value={irrigation} onChange={setIrrigation}
        options={Object.entries(IRRIGATION).map(([value, x]) => ({ value, label: x.label }))} />
      <NumberField icon={Tag} label={`سعر ال${u.short} (اختياري)`} value={price} onChange={setPrice} unit="ر.س" />
      <AmountCard label="الواجب في زكاته" amount={r.status === 'DUE' ? r.inKind : 'لا شيء'}
        detail={r.status === 'DUE'
          ? `${r.rateText}${r.value != null ? ` • قيمته ${money(r.value, { decimals: 2 })}` : ''}`
          : r.headline} />
      <Note icon={BookOpen}>{r.reason}{r.note ? ` ${r.note}` : ''} المصدر: {r.sources[0]}، {ZATCA.authority}.</Note>
    </Screen>
  );
}
