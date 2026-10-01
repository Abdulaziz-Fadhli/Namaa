// الأصول: الحسابات المرتبطة، والأصول خارج البنوك، ونافذة إضافة أصل بسبعة أنواع.
// قيمة كل أصل في الوعاء من المحرك (calculateAssetValue)، والأسهم من src/securities، والمواشي والمحاصيل من zatca.js.
import { useMemo, useState } from 'react';
import {
  Banknote, Building2, Check, ChartCandlestick, ChevronLeft, Gem, House, Landmark, PawPrint, Plus, RefreshCw, Search,
  ShieldCheck, WalletCards, Wheat,
} from 'lucide-react';
import { Btn, Card, Icon, Modal, NumberInput, Pill, Seg, Select, TextInput } from '../kit.jsx';
import { go } from '../nav.js';
import { Shell } from '../Shell.jsx';
import { parseNum, useStore, zakatableOf } from '../../figma/model.js';
import { gregText, hijriText, money, num } from '../../figma/format.js';
import { saudiSymbol, timeOf, useLiveFeed, useLivePrices } from '../../figma/live.js';
import { resolveHawlDueDate } from '../../engine/engine.js';
import {
  CROP_KINDS, CROP_UNITS, GRAZING, IRRIGATION, LIVESTOCK_PURPOSES, LIVESTOCK_TYPES, ZATCA, assessCrop, assessLivestock,
} from '../../engine/zatca.js';
import { assess, check, toEngineEntry } from '../../securities/securities.js';
import { ACCOUNTS, daysFrom, plain, sar } from '../data.js';
import ahmad from '../../data/ahmad.json';

const ICON = { gold: Gem, silver: Gem, stock: ChartCandlestick, fund: ChartCandlestick, cash: Banknote, property: House, livestock: PawPrint, crop: Wheat };
const TABS = [
  ['gold', 'ذهب'], ['silver', 'فضة'], ['security', 'أسهم وصناديق'], ['cash', 'نقد'], ['property', 'عقار للبيع'], ['livestock', 'مواشي'], ['crop', 'محاصيل'],
];
const ADD_ROWS = [
  ['gold', 'ذهب وفضة', 'بالجرام والعيار · سعر مباشر', Gem],
  ['security', 'أسهم وصناديق أمريكية', 'بالرمز · سعر مباشر', ChartCandlestick],
  ['cash', 'نقد', 'مبالغ خارج البنوك', Banknote],
  ['property', 'عقار للبيع', 'بقيمته السوقية اليوم', House],
  ['livestock', 'مواشي', 'إبل، بقر، غنم · بالرؤوس', PawPrint],
  ['crop', 'محاصيل زراعية', 'حبوب وتمور · عند الحصاد', Wheat],
];

// يوم تمام الحول من تاريخ التملك (نفس دالة المحرك)
const hawlOf = (iso, today) => {
  const d = resolveHawlDueDate(new Date(`${iso}T00:00:00Z`)).toISOString().slice(0, 10);
  return { date: d, inDays: daysFrom(today, d) };
};
const hawlText = (iso, today) => {
  const h = hawlOf(iso, today);
  return h.inDays <= 0 ? `${hijriText(h.date)} · حال حوله` : `${hijriText(h.date)} · بعد ${h.inDays} يومًا`;
};

function DateInput({ label, value, onChange, max }) {
  return (
    <div className="w-field">
      <label>{label}</label>
      <span className="w-input">
        <input type="date" value={value} max={max} aria-label={label} onChange={e => e.target.value && onChange(e.target.value)} />
        <span className="unit">{value ? hijriText(value) : ''}</span>
      </span>
    </div>
  );
}

function Summary({ rows }) {
  return (
    <div className="w-soft">
      {rows.filter(Boolean).map(([k, v], i) => (
        <div key={k} className="w-line" style={i ? { borderTop: '1px solid var(--line)' } : undefined}><span>{k}</span><span>{v}</span></div>
      ))}
    </div>
  );
}

// ---------- نماذج الإضافة: كل نموذج يرجع {asset, rows, ok} ----------
function MetalForm({ metal, today, frame }) {
  const { metals, loading } = useLivePrices();
  const gold = metal === 'gold';
  const [grams, setGrams] = useState(gold ? '50' : '600');
  const [karat, setKarat] = useState(21);
  const [purity, setPurity] = useState(999);
  const [purpose, setPurpose] = useState('INVESTMENT');
  const [acquired, setAcquired] = useState('2026-01-01');
  const g = parseNum(grams);
  const ok = g > 0;
  const price = gold ? metals.goldPerGram : metals.silverPerGram;
  const engine = gold ? { gold: [{ grams: ok ? g : 0, karat, pricePerGram: price, purpose }] } : { silver: [{ grams: ok ? g : 0, purity, pricePerGram: price, purpose }] };
  const value = zakatableOf({ engine });
  const market = ok ? g * price * (gold ? karat / 24 : purity / 1000) : 0;
  const jewelry = purpose === 'PERSONAL_USE' || purpose === 'LENDING';
  const live = metals.source !== 'fallback';
  const meta = ({
    ok,
    cta: 'إضافة إلى الوعاء',
    asset: {
      kind: metal, engine, value, acquired,
      live: gold ? { metal: 'gold', grams: g, karat, purpose } : { metal: 'silver', grams: g, purity, purpose },
      title: `${jewelry ? 'حلي ' : ''}${gold ? `ذهب عيار ${karat}` : `فضة ${purity}`} · ${num(g)} غ`,
      short: `${num(g)} غ ${gold ? 'ذهب' : 'فضة'}`,
      detail: jewelry ? 'حلي للاستعمال · لا يدخل الوعاء' : `يكمل حوله ${hijriText(hawlOf(acquired, today).date)}`,
    },
    toast: jewelry ? `أضفنا ${gold ? 'ذهبًا' : 'فضة'} (${num(g)} غ). الحلي المعدّ للاستعمال لا زكاة فيه، فلا يدخل الوعاء.`
      : `أضفنا ${gold ? `ذهب عيار ${karat}` : `فضة ${purity}`} (${num(g)} غ) إلى وعائك. يكمل حوله في ${hijriText(hawlOf(acquired, today).date)}، ونذكّرك قبلها.`,
  });
  return frame(meta, (
    <>
      <div className="w-grid2">
        <NumberInput label="الوزن بالجرام" value={grams} onChange={setGrams} unit="غ" warn={!ok} help={ok ? undefined : 'أدخل وزنًا أكبر من صفر'} />
        {gold
          ? <Select label="العيار" value={karat} onChange={v => setKarat(Number(v))} options={[24, 22, 21, 18].map(k => ({ value: k, label: `عيار ${k}` }))} />
          : <Select label="النقاوة" value={purity} onChange={v => setPurity(Number(v))} options={[999, 925, 900, 800].map(p => ({ value: p, label: p === 999 ? '999 (خالصة)' : p === 925 ? '925 (استرليني)' : String(p) }))} />}
      </div>
      <Select label="الغرض" value={purpose} onChange={setPurpose} help="الحلي المعدّ للاستعمال أو الإعارة لا زكاة فيه (دليل الهيئة §3.1.2)"
        options={[
          { value: 'INVESTMENT', label: 'ادخار أو استثمار (سبائك، جنيهات)' },
          { value: 'TRADING', label: 'للتجارة أو البيع' },
          { value: 'PERSONAL_USE', label: 'حلي ألبسه' },
          { value: 'LENDING', label: 'حلي أعيره لغيري' },
        ]} />
      <DateInput label="تاريخ التملك" value={acquired} onChange={setAcquired} max={today} />
      <Summary rows={[
        [`سعر جرام ${gold ? 'الذهب عيار 24' : 'الفضة الخالصة'}`, <span key="p" className="row" style={{ gap: 6 }}>{loading ? '…' : sar(price)}{live && <Pill tone="ok">مباشر</Pill>}</span>],
        [`القيمة الآن (${num(ok ? g : 0)} غ${gold ? ` × ${karat}/24` : ''})`, sar(market)],
        jewelry ? ['يدخل الوعاء', sar(0)] : ['يكمل حوله', hawlText(acquired, today)],
        ['الزكاة عند الوجوب (2.5٪)', sar(value / 40)],
      ]} />
    </>
  ));
}

function SecurityForm({ today, frame }) {
  const [q, setQ] = useState('AAPL');
  const [units, setUnits] = useState('10');
  const [price, setPrice] = useState('');
  const [touched, setTouched] = useState(false);
  const [intent, setIntent] = useState('INVEST');
  const [acquired, setAcquired] = useState('2026-07-29');
  const r = useMemo(() => (q.trim() ? check(q, { intent }) : null), [q, intent]);
  const found = r?.found;
  const saudiCompany = found && r.type === 'COMPANY' && (r.market === 'TASI' || r.market === 'NOMU') && intent === 'INVEST';
  const sym = saudiCompany ? null : saudiSymbol(r);
  const saudiLive = useLivePrices(sym ? [sym] : []);
  const us = found && r.market === 'US';
  const usSym = us && r.symbol ? r.symbol : null;
  const usFeed = useLiveFeed({ enabled: Boolean(usSym), us: usSym ? [usSym] : [], delayMs: 500 });
  const quote = sym ? saudiLive.quotes[sym] : usSym ? usFeed.quotes[usSym] : null;
  const shown = !touched && quote ? String(quote.price) : price;
  const u = parseNum(units), p = parseNum(shown);
  const isCompany = found && r.type === 'COMPANY';
  const a = found && u > 0 && (saudiCompany || p > 0)
    ? assess({ symbol: r.symbol || undefined, fundName: r.symbol ? undefined : r.name, category: r.symbol ? undefined : r.category, units: u, price: saudiCompany ? 0 : p, intent })
    : null;
  const e = a && toEngineEntry(a);
  const engine = e ? { [e.kind]: [e.entry] } : {};
  const value = e ? zakatableOf({ engine }) : 0;
  const meta = ({
    ok: Boolean(a),
    cta: 'إضافة إلى الوعاء',
    asset: a && {
      kind: isCompany ? 'stock' : 'fund', engine, value, market: a.value, acquired,
      live: usSym ? { symbol: usSym, price: p } : null,
      title: `${r.name}${r.symbol ? ` · ${r.symbol}` : ''}`,
      short: `${num(u)} ${isCompany ? 'سهم' : 'وحدة'} · ${r.name}`,
      detail: `${num(u)} ${isCompany ? 'سهم' : 'وحدة'} · ${a.zakatable ? `يكمل حوله ${hijriText(hawlOf(acquired, today).date)}` : 'الشركة تزكي عنه'}`,
    },
    toast: a && (a.zakatable ? `أضفنا ${num(u)} ${isCompany ? 'سهم' : 'وحدة'} من ${r.name} (${sar(value)}) إلى وعائك.` : `أضفنا ${r.name}. الشركة تدفع زكاتها لهيئة الزكاة، فلا يدخل وعاءك.`),
  });
  return frame(meta, (
    <>
      <TextInput label="السهم أو الصندوق" value={q} icon={Search} placeholder="مثال: AAPL أو 1120 أو صندوق مرابحة"
        onChange={v => { setQ(v); setTouched(false); setPrice(''); }} help={r && !found ? r.message : undefined} />
      {r && !found && r.alternatives?.length > 0 && (
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {r.alternatives.slice(0, 5).map(x => <button key={x.symbol ?? x.name} className="w-pill" style={{ height: 28 }} onClick={() => setQ(x.symbol ?? x.name)}>{x.name} · {x.symbol}</button>)}
        </div>
      )}
      {found && (
        <div className="w-card" style={{ padding: 16 }}>
          <div className="w-list-row" style={{ padding: 0 }}>
            <span className="w-ico"><Icon as={ChartCandlestick} /></span>
            <span className="grow">
              <span className="t" style={{ display: 'block' }}>{r.nameEn && r.market === 'US' ? r.nameEn : r.name}{r.symbol ? ` · ${r.symbol}` : ''}</span>
              <span className="d">{r.type === 'COMPANY' ? 'شركة' : 'صندوق'} · {r.marketAr}</span>
            </span>
            {quote && !touched && <span className="b7">{us ? `$${num(quote.price, { decimals: 2 })}` : sar(quote.price)}</span>}
          </div>
          <div className="w-banner" style={{ background: a?.zakatable === false || saudiCompany ? 'var(--ok-bg)' : 'var(--warn-bg)', marginTop: 12, alignItems: 'flex-start' }}>
            <Pill tone={saudiCompany ? 'ok' : 'warn'}>{saudiCompany ? 'يزكي' : 'الزكاة عليك'}</Pill>
            <span className="t12">{r.detail}</span>
          </div>
        </div>
      )}
      <div className="w-grid2">
        <NumberInput label={isCompany ? 'عدد الأسهم' : 'عدد الوحدات'} value={units} onChange={setUnits} />
        <div className="w-field">
          <label>نيتك منه</label>
          <Seg block value={intent} onChange={v => { setIntent(v); setTouched(false); }} options={[{ value: 'INVEST', label: 'استثمار طويل' }, { value: 'TRADE', label: 'متاجرة' }]} />
        </div>
      </div>
      {!saudiCompany && found && (
        <NumberInput label="سعر الوحدة" value={shown} unit={us ? '$' : 'ر.س'} onChange={v => { setPrice(v); setTouched(true); }}
          help={quote && !touched ? `سعر السوق${timeOf(quote.at) ? ` · ${timeOf(quote.at)}` : ''}${us ? ' · يُحوّل بسعر 3.75' : ''}` : 'أدخل السعر إن لم يظهر تلقائيًا'} />
      )}
      <DateInput label="تاريخ الشراء" value={acquired} onChange={setAcquired} max={today} />
      <Summary rows={[
        ['القيمة الآن', a ? sar(a.value) : '—'],
        ['يدخل الوعاء', sar(value)],
        a?.zakatable ? ['يكمل حوله', hawlText(acquired, today)] : null,
        ['الزكاة عند الوجوب (2.5٪)', sar(value / 40)],
      ]} />
    </>
  ));
}

function CashForm({ today, frame }) {
  const [amount, setAmount] = useState('5,000');
  const [currency, setCurrency] = useState('SAR');
  const [where, setWhere] = useState('نقد في المنزل');
  const [acquired, setAcquired] = useState('2026-02-18');
  const n = parseNum(amount);
  const ok = n > 0;
  const sarValue = ok ? (currency === 'USD' ? n * 3.75 : n) : 0;
  const engine = { manualAssets: [{ value: sarValue }] };
  const value = zakatableOf({ engine });
  const meta = ({
    ok, cta: 'إضافة إلى الوعاء',
    asset: { kind: 'cash', engine, value, acquired, title: where.trim() || 'نقد خارج البنوك', short: sar(value), detail: `يكمل حوله ${hijriText(hawlOf(acquired, today).date)}` },
    toast: `أضفنا ${sar(value)} نقدًا إلى وعائك. يكمل حوله في ${hijriText(hawlOf(acquired, today).date)}، ونذكّرك قبلها.`,
  });
  return frame(meta, (
    <>
      <div className="w-grid2">
        <NumberInput label="المبلغ" value={amount} onChange={setAmount} warn={!ok} help={ok ? undefined : 'أدخل مبلغًا أكبر من صفر'} />
        <Select label="العملة" value={currency} onChange={setCurrency} options={[{ value: 'SAR', label: 'ريال سعودي' }, { value: 'USD', label: 'دولار أمريكي' }]} />
      </div>
      <TextInput label="أين المبلغ؟" value={where} onChange={setWhere} help="أي مبلغ خارج حساباتك المرتبطة: نقد، محفظة رقمية، دَين مرجو السداد" />
      <DateInput label="من متى وهو عندك؟" value={acquired} onChange={setAcquired} max={today} />
      <Summary rows={[['يدخل الوعاء', sar(value)], ['يكمل حوله', hawlText(acquired, today)], ['الزكاة عند الوجوب (2.5٪)', sar(value / 40)]]} />
    </>
  ));
}

function PropertyForm({ today, frame }) {
  const [intent, setIntent] = useState('TRADING');
  const [type, setType] = useState('أرض سكنية · 600 م²');
  const [city, setCity] = useState('الرياض · حي النرجس');
  const [amount, setAmount] = useState('850,000');
  const [acquired, setAcquired] = useState('2026-01-29');
  const n = parseNum(amount);
  const ok = n > 0 && type.trim();
  const engine = { properties: [{ intent, marketValue: n > 0 ? n : 0 }] };
  const value = zakatableOf({ engine });
  const meta = ({
    ok, cta: 'إضافة إلى الوعاء',
    asset: { kind: 'property', engine, value, acquired, title: type.trim(), short: type.trim(),
      detail: intent === 'TRADING' ? `معد للبيع · يكمل حوله ${hijriText(hawlOf(acquired, today).date)}` : intent === 'RENTAL' ? 'للإيجار · يُزكّى الإيجار فقط' : 'للسكن · لا زكاة فيه' },
    toast: intent === 'TRADING' ? `أضفنا ${type.trim()} بقيمة ${sar(value)} إلى وعائك.` : `أضفنا ${type.trim()}. ${intent === 'RENTAL' ? 'لا زكاة في قيمته، والإيجار المقبوض يدخل نقدك.' : 'عقار السكن لا زكاة فيه.'}`,
  });
  return frame(meta, (
    <>
      <div className="w-field">
        <label>الغرض من العقار</label>
        <Seg block value={intent} onChange={setIntent} options={[{ value: 'TRADING', label: 'للبيع' }, { value: 'RENTAL', label: 'للإيجار' }, { value: 'USE', label: 'للسكن' }]} />
      </div>
      <div className="w-grid2">
        <TextInput label="نوع العقار" value={type} onChange={setType} />
        <TextInput label="المدينة" value={city} onChange={setCity} />
      </div>
      <div className="w-grid2">
        <NumberInput label="القيمة السوقية اليوم" value={amount} onChange={setAmount} unit="ر.س" />
        <DateInput label="من متى نويت بيعه؟" value={acquired} onChange={setAcquired} max={today} />
      </div>
      <Summary rows={[
        ['يدخل الوعاء بقيمته السوقية', sar(value)],
        intent === 'TRADING' ? ['يكمل حوله', hawlText(acquired, today)] : null,
        ['الزكاة عند الوجوب (2.5٪)', sar(value / 40)],
      ]} />
      <p className="w-note"><span>المعدّ للسكن لا زكاة فيه، والمؤجَّر تُزكّى أجرته المقبوضة إذا بقيت حولًا (دليل الهيئة §3.8).</span></p>
    </>
  ));
}

function LivestockForm({ today, frame }) {
  const [type, setType] = useState('sheep');
  const [count, setCount] = useState('120');
  const [purpose, setPurpose] = useState('BREEDING');
  const [grazing, setGrazing] = useState('GRAZING');
  const [market, setMarket] = useState('');
  const [acquired, setAcquired] = useState('2025-12-01');
  const n = parseNum(count), m = parseNum(market);
  const countOk = Number.isSafeInteger(n) && n > 0;
  const trade = purpose === 'TRADING';
  const ok = countOk && (!trade || m > 0);
  const agri = { type, count: countOk ? n : 0, purpose, grazing, acquired, ...(trade ? { marketValue: m > 0 ? m : 0 } : {}) };
  const r = assessLivestock({ ...agri, asOf: today });
  const label = LIVESTOCK_TYPES[type].label.split(' ')[0];
  const meta = ({
    ok, cta: 'إضافة الأصل',
    asset: { kind: 'livestock', agri, acquired, engine: trade ? { manualAssets: [{ value: r.vaultValue }] } : {}, value: r.vaultValue,
      title: `${num(n)} رأس ${label}`, short: `${num(n)} رأس ${label}`, detail: r.headline },
    toast: r.status === 'TRADE_GOODS' ? `أضفنا ${num(n)} رأس ${label} للتجارة بقيمة ${sar(r.vaultValue)} إلى وعائك.`
      : r.inKind ? `أضفنا ${num(n)} رأس ${label}. زكاتها ${r.inKind}${r.status === 'NOT_YET' ? ` تجب في ${hijriText(r.dueDate)}` : ' وجبت'}، وتُخرج من جنسها فلا تدخل وعاء النقود.`
        : `أضفنا ${num(n)} رأس ${label}. ${r.headline}.`,
  });
  return frame(meta, (
    <>
      <div className="w-grid2">
        <Select label="النوع" value={type} onChange={v => { setType(v); setCount(v === 'camels' ? '30' : v === 'cattle' ? '40' : '120'); }}
          options={Object.entries(LIVESTOCK_TYPES).map(([value, t]) => ({ value, label: t.label }))} />
        <NumberInput label="العدد" value={count} onChange={setCount} unit="رأس" warn={!countOk} help={countOk ? undefined : 'أدخل عددًا صحيحًا'} />
      </div>
      <div className="w-grid2">
        <Select label="الغرض" value={purpose} onChange={setPurpose} options={Object.entries(LIVESTOCK_PURPOSES).map(([value, l]) => ({ value, label: l }))} />
        {purpose === 'BREEDING'
          ? <Select label="الرعي" value={grazing} onChange={setGrazing} options={Object.entries(GRAZING).map(([value, l]) => ({ value, label: l }))} />
          : trade ? <NumberInput label="قيمتها السوقية اليوم" value={market} onChange={setMarket} unit="ر.س" warn={!(m > 0)} /> : <span />}
      </div>
      <DateInput label="من متى وهي عندك؟" value={acquired} onChange={setAcquired} max={today} />
      <Summary rows={[
        [r.status === 'TRADE_GOODS' ? 'تدخل وعاء النقود' : 'الواجب في زكاتها', r.status === 'TRADE_GOODS' ? sar(r.vaultValue) : (r.inKind ?? 'لا شيء')],
        r.dueDate ? ['يكمل حولها', r.status === 'DUE' ? `${hijriText(r.dueDate)} · حال حولها` : `${hijriText(r.dueDate)} · بعد ${r.inDays} يومًا`] : ['الحكم', r.headline],
        ['المرجع', `${r.sources[0]} · ${ZATCA.authority}`],
      ]} />
      <p className="w-note"><span>{r.reason}</span></p>
    </>
  ));
}

function CropForm({ frame }) {
  const [kind, setKind] = useState('DATES');
  const [quantity, setQuantity] = useState('2,000');
  const [unit, setUnit] = useState('KG');
  const [irrigation, setIrrigation] = useState('WITH_COST');
  const [price, setPrice] = useState('');
  const [harvest, setHarvest] = useState('2026-09-02');
  const q = parseNum(quantity), p = parseNum(price);
  const ok = q > 0;
  const agri = { kind, quantity: ok ? q : 0, unit, irrigation, ...(p > 0 ? { pricePerUnit: p } : {}) };
  const r = assessCrop(agri);
  const u = CROP_UNITS[unit];
  const meta = ({
    ok, cta: 'إضافة الأصل',
    asset: { kind: 'crop', agri, engine: {}, value: 0, acquired: null, title: `محصول ${CROP_KINDS[kind].label}`, short: `${num(q)} ${u.short} ${CROP_KINDS[kind].label}`, detail: r.headline },
    toast: r.status === 'DUE' ? `أضفنا محصول ${CROP_KINDS[kind].label}. زكاته ${r.inKind} (${r.rateText}) وجبت عند الحصاد، وتُدفع عبر بوابة هيئة الزكاة.` : `أضفنا محصول ${CROP_KINDS[kind].label}. ${r.headline}.`,
  });
  return frame(meta, (
    <>
      <div className="w-grid2">
        <Select label="المحصول" value={kind} onChange={setKind} options={Object.entries(CROP_KINDS).map(([value, c]) => ({ value, label: c.label }))} />
        <NumberInput label={`الكمية ${CROP_KINDS[kind].group === 'GRAIN' ? 'بعد التصفية' : 'بعد الجفاف'}`} value={quantity} onChange={setQuantity} unit={u.short} />
      </div>
      <div className="w-grid2">
        <div className="w-field">
          <label>وحدة القياس</label>
          <Seg block value={unit} onChange={setUnit} options={Object.entries(CROP_UNITS).map(([value, x]) => ({ value, label: x.short }))} />
        </div>
        <Select label="طريقة السقي" value={irrigation} onChange={setIrrigation} options={Object.entries(IRRIGATION).map(([value, x]) => ({ value, label: x.label }))} />
      </div>
      <div className="w-grid2">
        <DateInput label="وقت الحصاد" value={harvest} onChange={setHarvest} />
        <NumberInput label={`سعر ال${u.short} (اختياري)`} value={price} onChange={setPrice} unit="ر.س" />
      </div>
      <Summary rows={[
        ['النصاب (5 أوسق)', `${num(u.nisab)} ${u.short}${u.approximate ? ' تقريبًا' : ''} · ${r.status === 'BELOW_NISAB' ? 'لم يبلغه' : 'بلغه المحصول'}`],
        [r.status === 'DUE' ? `الواجب (${r.rateText})` : 'الحكم', r.status === 'DUE' ? `${r.inKind}${r.value != null ? ` · ${sar(r.value)}` : ''}` : r.headline],
        ['المرجع', `${r.sources[0]} · ${ZATCA.authority}`],
      ]} />
      <p className="w-note"><span>{r.reason}{r.note ? ` ${r.note}` : ''}</span></p>
    </>
  ));
}

function AddAsset({ tab, setTab, onClose, onAdded }) {
  const { view, addAsset } = useStore();
  const today = view.today;
  const agri = tab === 'livestock' || tab === 'crop';
  // كل نموذج يرسم حقوله داخل هذه النافذة، ويعطيها حالة الزر والأصل الجاهز للإضافة
  const frame = (meta, children) => (
    <Modal title="إضافة أصل" onClose={onClose}
      desc={agri ? (tab === 'crop' ? 'تُزكّى عند الحصاد، ولا يشترط لها حول' : 'زكاتها بالرؤوس، ويبدأ حولها من تاريخ تملكها') : 'يدخل وعاءك، ويبدأ حوله من تاريخ تملكه'}
      tabs={<div className="w-tabs" role="tablist">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}</div>}
      foot={<>
        <Btn onClick={onClose}>إلغاء</Btn>
        <Btn variant="primary" disabled={!meta.ok} onClick={() => onAdded(meta.toast, addAsset(meta.asset))}>{meta.cta}</Btn>
      </>}>
      {children}
    </Modal>
  );
  if (tab === 'gold' || tab === 'silver') return <MetalForm key={tab} metal={tab} today={today} frame={frame} />;
  if (tab === 'security') return <SecurityForm today={today} frame={frame} />;
  if (tab === 'cash') return <CashForm today={today} frame={frame} />;
  if (tab === 'property') return <PropertyForm today={today} frame={frame} />;
  if (tab === 'livestock') return <LivestockForm today={today} frame={frame} />;
  return <CropForm frame={frame} />;
}

export function Assets({ path }) {
  const { view, vault, assets, otherAssets, removeAsset } = useStore();
  const [tab, setTab] = useState(null);
  const [toast, setToast] = useState(null);
  const included = view.accounts.filter(a => !a.exempt);
  const colors = ['var(--primary)', '#9DB3C4', 'var(--gold)'];
  const parts = [...included.map(a => ({ label: ACCOUNTS[a.id].bank, v: a.balance })), { label: 'أصول خارج البنوك', v: otherAssets }];
  return (
    <Shell path={path} title="الأصول" desc="كل ما يدخل وعاءك الزكوي، من البنوك وخارجها">
      {toast && (
        <div className="w-toast" role="status">
          <Icon as={Check} className="green" />
          <span>{toast.text}</span>
          <Btn variant="ghost" onClick={() => { removeAsset(toast.id); setToast(null); }}>تراجع</Btn>
        </div>
      )}
      <Card>
        <div className="between" style={{ alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
          <div>
            <span className="t12 sub">إجمالي الوعاء الزكوي</span>
            <div className="w-amount md"><strong>{plain(vault)}</strong><span>ر.س</span></div>
          </div>
          <div className="row">
            <Btn variant="primary" icon={Plus} onClick={() => setTab('gold')}>إضافة أصل</Btn>
            <Btn onClick={() => go('/app/link')}>ربط حساب بنكي</Btn>
          </div>
        </div>
        <div className="w-progress" aria-hidden="true">
          {parts.map((p, i) => p.v > 0 && <i key={p.label} style={{ width: `${(p.v / vault) * 100}%`, background: colors[i] }} />)}
        </div>
        <div className="w-legend" style={{ marginTop: 12 }}>
          {parts.map((p, i) => (
            <span key={p.label}><i style={{ background: colors[i] }} />{p.label} <b className="num" style={{ color: 'var(--ink)' }}>{sar(p.v)}</b> · {vault ? Math.round((p.v / vault) * 1000) / 10 : 0}٪</span>
          ))}
        </div>
      </Card>

      <div className="w-cols c-assets">
        <Card flush title="الحسابات المرتبطة" desc={`${included.length === 2 ? 'حسابان' : `${included.length} حسابات`} · عبر الخدمات المصرفية المفتوحة`}
          action={<Btn className="sm" icon={RefreshCw}>مزامنة الآن</Btn>}>
          <div className="w-table-wrap" style={{ marginTop: 16 }}>
            <table className="w-table">
              <thead><tr><th>الحساب</th><th className="w-hide-m">آخر مزامنة</th><th>يدخل الوعاء</th><th style={{ textAlign: 'left' }}>الرصيد</th></tr></thead>
              <tbody>
                {view.accounts.map(a => (
                  <tr key={a.id} className={a.exempt ? 'dim' : ''} style={{ cursor: 'pointer' }} onClick={() => go(`/app/account/${a.id}`)}>
                    <td>
                      <span className="row">
                        <span className="w-ico"><Icon as={a.id === 'A1' ? Landmark : a.exempt ? WalletCards : Building2} /></span>
                        <span>
                          <span className="b6" style={{ display: 'block', color: 'var(--ink)' }}>{a.exempt ? `محفظة ${a.product}` : ACCOUNTS[a.id].bank}</span>
                          <span className="t11 sub">{a.exempt ? 'منتج استثماري · مصرف الإنماء' : `حساب ${ACCOUNTS[a.id].kind} · ${ACCOUNTS[a.id].mask} ••••`}</span>
                        </span>
                      </span>
                    </td>
                    <td className="w-hide-m t12 sub">اليوم {ACCOUNTS[a.id].synced}</td>
                    <td>{a.exempt ? <Pill>معفى</Pill> : <Pill tone="ok">نعم</Pill>}</td>
                    <td className="b7" style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>{sar(a.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="row b6 t13" style={{ padding: '16px 24px' }} onClick={() => go('/app/link')}><Icon as={Plus} size={16} />ربط حساب من بنك آخر</button>
          <p className="w-note" style={{ background: 'var(--soft)', padding: '12px 24px' }}>
            <Icon as={ShieldCheck} size={15} className="green" />
            <span>نقرأ الأرصدة والحركات فقط، ولا نستطيع التحويل من حساباتك إلا بتأكيدك في كل مرة.</span>
          </p>
        </Card>

        <Card title="أصول خارج البنوك" desc="تُضاف يدويًا ويُحسب حول كل أصل من تاريخ تملكه">
          <div className="col" style={{ gap: 8 }}>
            {assets.map(a => (
              <div key={a.id} className="w-list-row" style={{ background: 'var(--warn-soft)', border: '1px solid #F3E2B8', borderRadius: 12, padding: '12px 14px' }}>
                <span className="w-ico warn"><Icon as={ICON[a.kind] ?? Gem} /></span>
                <span className="grow">
                  <span className="t" style={{ display: 'block' }}>{a.title}</span>
                  <span className="d">{a.result ? (a.result.status === 'NOT_YET' ? `تجب في ${hijriText(a.result.dueDate)}` : a.result.status === 'DUE' ? 'وجبت · تُخرج من جنسها' : a.result.headline) : a.detail}</span>
                </span>
                <span className="v">{a.result && !a.result.vaultValue ? (a.result.inKind ?? '—') : sar(a.value)}</span>
              </div>
            ))}
            {ADD_ROWS.map(([k, t, d, ic]) => (
              <button key={k} className="w-list-row" style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px', width: '100%' }} onClick={() => setTab(k)}>
                <span className="w-ico"><Icon as={ic} /></span>
                <span className="grow" style={{ textAlign: 'start' }}>
                  <span className="t" style={{ display: 'block' }}>{t}</span>
                  <span className="d">{d}</span>
                </span>
                <Icon as={Plus} />
              </button>
            ))}
          </div>
          {assets.some(a => a.result?.inKind) && (
            <p className="w-note" style={{ marginTop: 12 }}><span>زكاة المواشي والمحاصيل تُخرج من جنسها ولا تدخل وعاء النقود، وتُدفع عبر {ZATCA.channels.livestockCrops}.</span></p>
          )}
        </Card>
      </div>

      {tab && <AddAsset tab={tab} setTab={setTab} onClose={() => setTab(null)}
        onAdded={(text, id) => { setTab(null); setToast({ text, id }); }} />}
    </Shell>
  );
}

export function Account({ path }) {
  const { view } = useStore();
  const id = path.split('/').pop();
  const a = view.accounts.find(x => x.id === id) ?? view.accounts[0];
  const meta = ACCOUNTS[a.id];
  const txs = ahmad.transactions.filter(t => t.accountId === a.id && t.date <= view.today).slice(-40).reverse();
  return (
    <Shell path="/app/assets" title={a.exempt ? `محفظة ${a.product}` : `${meta.bank} · ${meta.kind}`}
      crumb={<><button onClick={() => go('/app/assets')}>الأصول</button><Icon as={ChevronLeft} size={12} /><span>{meta.mask} ••••</span></>}>
      <div className="w-kpis">
        <div className="w-kpi"><span className="t12 sub">الرصيد</span><strong>{sar(a.balance)}</strong></div>
        <div className="w-kpi"><span className="t12 sub">يدخل الوعاء</span><strong>{a.exempt ? 'لا · معفى' : 'نعم'}</strong></div>
        <div className="w-kpi"><span className="t12 sub">آخر حركة</span><strong>{a.lastActivity ? hijriText(a.lastActivity) : '—'}</strong></div>
        <div className="w-kpi"><span className="t12 sub">آخر مزامنة</span><strong>اليوم {meta.synced}</strong></div>
      </div>
      <Card flush title="آخر الحركات" desc="من الخدمات المصرفية المفتوحة · قراءة فقط">
        <div className="w-table-wrap" style={{ marginTop: 16 }}>
          <table className="w-table">
            <thead><tr><th>التاريخ</th><th>الوصف</th><th style={{ textAlign: 'left' }}>المبلغ</th></tr></thead>
            <tbody>
              {txs.map((t, i) => (
                <tr key={i}>
                  <td className="t12"><span className="b6" style={{ display: 'block' }}>{hijriText(t.date)}</span><span className="sub">{gregText(t.date)}</span></td>
                  <td>{t.desc}</td>
                  <td className="b7" style={{ textAlign: 'left', whiteSpace: 'nowrap', color: t.direction === 'credit' ? 'var(--ok)' : undefined }}>
                    {t.direction === 'credit' ? '+' : '−'}{money(t.amount, { decimals: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </Shell>
  );
}
