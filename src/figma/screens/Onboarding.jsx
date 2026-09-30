// شاشات البداية في فيجما: بداية نماء ← ربط الحسابات (← اختيار بنك، تاريخ آخر زكاة) ← مزامنة الحسابات
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, Bell, Building2, CalendarCheck, Check, ChevronDown, Eye, Landmark, Link2Off, LockKeyhole,
  Plus, RefreshCw, Search, ShieldCheck,
} from 'lucide-react';
import { AmountCard, Button, Frame, Ico, InfoRow, Note, Screen, Segmented } from '../ui.jsx';
import { ACCOUNT_TYPE, bankName, useStore } from '../model.js';
import {
  GREG_MONTHS, HIJRI_MONTHS, gregText, hijriMonthLength, hijriParts, hijriText, hijriToIso, isoOf, money,
} from '../format.js';
import logo from '../../assets/namaa-logo.png';


export function Start({ go }) {
  const { setMode } = useStore();
  return (
    <Frame theme="dark" gradient label="بداية نماء">
      <div className="nm-start">
        <div className="nm-start-promise">
          <img className="nm-start-logo" src={logo} alt="نماء namaa" width="144" height="108" />
          <div className="nm-start-copy">
            <h1>ثروتك تنمو، وزكاتك في وقتها</h1>
            <p>نجمع الصورة المالية ونحسب الاستحقاق بدقة، من دون تحريك أموالك.</p>
          </div>
          <div className="nm-trust">
            <div><Ico as={Link2Off} size={20} /><span>إلغاء مرن</span></div>
            <div><Ico as={ShieldCheck} size={20} /><span>حماية مصرفية</span></div>
            <div><Ico as={Eye} size={20} /><span>قراءة فقط</span></div>
          </div>
        </div>
        <div className="nm-start-cta">
          <Button variant="primary" icon={ArrowLeft} onClick={() => { setMode('story'); go('link'); }}>ابدأ</Button>
          <Button icon={RefreshCw} onClick={() => { setMode('live'); go('link'); }}>تجربة مباشرة بأسعار السوق الآن</Button>
          <p>بياناتك مشفّرة ولا نملك صلاحية التحويل</p>
        </div>
      </div>
    </Frame>
  );
}

export function Link({ go, back }) {
  const { view, pendingBanks, remembers, setRemembers, lastZakat } = useStore();
  const accounts = view.accounts.filter(a => !a.exempt);
  const [selected, setSelected] = useState(accounts[0]?.id);
  return (
    <Screen title="اربط حساباتك" desc="نقرأ الأرصدة والحركات المصرّح بها لنحسب الموعد بدقة." onBack={back}
      cta={<Button variant="primary" icon={ArrowLeft} onClick={() => go('sync')}>متابعة</Button>}>
      {accounts.map((a, i) => (
        <InfoRow key={a.id} icon={i === 0 ? Landmark : Building2} title={bankName(a.bank)}
          detail={`${ACCOUNT_TYPE[a.type]} • ${i === 0 ? 'متصل الآن' : 'محدّث اليوم'}`}
          value={money(a.balance)} selected={selected === a.id} onClick={() => setSelected(a.id)} />
      ))}
      {pendingBanks.map(b => (
        <InfoRow key={b} icon={Building2} title={b} detail="بانتظار موافقة البنك" />
      ))}
      <Button icon={Plus} onClick={() => go('bank')}>إضافة بنك</Button>
      <div className="nm-field" style={{ gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, lineHeight: '27px' }}>هل تتذكر تاريخ آخر زكاة؟</span>
        <Segmented label="هل تتذكر تاريخ آخر زكاة؟" value={remembers}
          options={[{ value: 'yes', label: 'أعرف التاريخ' }, { value: 'no', label: 'لا أتذكر' }]}
          onChange={v => { setRemembers(v); if (v === 'yes') go('lastzakat'); }} />
        {remembers === 'yes' && lastZakat && (
          <span className="nm-help">آخر زكاة: {hijriText(lastZakat.iso)} ({gregText(lastZakat.iso)})</span>
        )}
        {remembers === 'no' && (
          <span className="nm-help">لا بأس، نبدأ الحول من أول يوم بلغ فيه مالك النصاب في سجل الحسابات.</span>
        )}
      </div>
      <Note icon={LockKeyhole}>موافقة قراءة فقط لمدة 12 شهرًا، ويمكن إلغاؤها في أي وقت.</Note>
    </Screen>
  );
}

const BANKS = [
  'البنك الأهلي السعودي', 'البنك العربي الوطني', 'مصرف الراجحي', 'بنك الرياض', 'البنك السعودي الفرنسي',
  'البنك السعودي الأول', 'بنك البلاد', 'بنك الجزيرة', 'مصرف الإنماء', 'بنك الخليج الدولي',
];
const normBank = s => s.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/(^|\s)ال/g, '$1').replace(/\s+/g, ' ').trim();

export function Bank({ back }) {
  const { view, addBank, pendingBanks } = useStore();
  const [q, setQ] = useState('');
  const linked = new Set(view.accounts.map(a => bankName(a.bank)));
  const results = useMemo(() => {
    const n = normBank(q);
    return BANKS.filter(b => !n || normBank(b).includes(n)).slice(0, n ? 3 : 2);
  }, [q]);
  const [picked, setPicked] = useState(null);
  const current = results.includes(picked) ? picked : results.find(b => !linked.has(b)) ?? null;
  const status = b => (linked.has(b) ? 'مرتبط بالفعل' : pendingBanks.includes(b) ? 'بانتظار موافقتك' : 'متاح للربط');
  return (
    <Screen title="اختر بنكًا" desc="ابحث باسم البنك ثم اختر الحساب الذي تريد ربطه." onBack={back}
      cta={<Button variant="primary" icon={Plus} disabled={!current || linked.has(current)}
        onClick={() => { addBank(current); back(); }}>إضافة البنك</Button>}>
      <div className="nm-field">
        <label className="nm-field-box active">
          <Ico as={Search} />
          <span className="nm-field-label">بحث</span>
          <input className="nm-field-input" value={q} placeholder="اسم البنك" maxLength={40} aria-label="بحث باسم البنك"
            onChange={e => setQ(e.target.value)} />
        </label>
        <span className="nm-help">{results.length === 0 ? 'لا توجد نتائج' : results.length === 1 ? 'نتيجة واحدة متاحة' : results.length === 2 ? 'نتيجتان متاحتان' : `${results.length} نتائج متاحة`}</span>
      </div>
      {results.map(b => (
        <InfoRow key={b} icon={b === current ? Landmark : Building2} title={b}
          detail={`خدمات مصرفية مفتوحة • ${status(b)}`} selected={b === current}
          onClick={linked.has(b) ? undefined : () => setPicked(b)} />
      ))}
      <Note icon={ShieldCheck}>سيطلب البنك موافقتك قبل مشاركة أي بيانات.</Note>
      <div className="nm-hint">
        <span className="nm-hint-title">لم تجد بنكك؟</span>
        <span className="nm-hint-detail">جرّب الاسم المختصر أو حدّث النتائج.</span>
      </div>
    </Screen>
  );
}

const arDigits = n => Number(n).toLocaleString('ar-EG', { useGrouping: false });

function DatePart({ label, value, display, options, onChange }) {
  return (
    <label className="nm-row" style={{ flex: 1, height: 104, flexDirection: 'column', justifyContent: 'center', gap: 7, padding: 0, position: 'relative' }}>
      <span className="nm-row-detail">{label}</span>
      <span style={{ fontSize: 18, fontWeight: 600, lineHeight: '38px' }}>{display}</span>
      <Ico as={ChevronDown} size={13} />
      <select className="nm-field-overlay" value={value} aria-label={label} onChange={e => onChange(Number(e.target.value))}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function LastZakat({ back }) {
  const { view, lastZakat, setLastZakat, setRemembers } = useStore();
  const [calendar, setCalendar] = useState(lastZakat?.calendar ?? 'hijri');
  const [iso, setIso] = useState(lastZakat?.iso ?? hijriToIso(1447, 9, 1));
  const h = hijriParts(iso);
  const g = new Date(`${iso}T00:00:00Z`);
  const future = iso > view.today;
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

  const setHijri = (y, m, d) => setIso(hijriToIso(y, m, Math.min(d, hijriMonthLength(y, m))) ?? iso);
  const setGreg = (y, m, d) => {
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    setIso(isoOf(new Date(Date.UTC(y, m, Math.min(d, last)))));
  };
  const parts = calendar === 'hijri'
    ? [
      { label: 'السنة', value: h.y, display: arDigits(h.y), options: range(1440, view.todayHijri[0]).map(v => ({ value: v, label: `${v}هـ` })), set: v => setHijri(v, h.m, h.d) },
      { label: 'الشهر', value: h.m, display: HIJRI_MONTHS[h.m - 1], options: HIJRI_MONTHS.map((l, i) => ({ value: i + 1, label: l })), set: v => setHijri(h.y, v, h.d) },
      { label: 'اليوم', value: h.d, display: arDigits(h.d), options: range(1, hijriMonthLength(h.y, h.m)).map(v => ({ value: v, label: String(v) })), set: v => setHijri(h.y, h.m, v) },
    ]
    : [
      { label: 'السنة', value: g.getUTCFullYear(), display: arDigits(g.getUTCFullYear()), options: range(2019, Number(view.today.slice(0, 4))).map(v => ({ value: v, label: String(v) })), set: v => setGreg(v, g.getUTCMonth(), g.getUTCDate()) },
      { label: 'الشهر', value: g.getUTCMonth(), display: GREG_MONTHS[g.getUTCMonth()], options: GREG_MONTHS.map((l, i) => ({ value: i, label: l })), set: v => setGreg(g.getUTCFullYear(), v, g.getUTCDate()) },
      { label: 'اليوم', value: g.getUTCDate(), display: arDigits(g.getUTCDate()), options: range(1, new Date(Date.UTC(g.getUTCFullYear(), g.getUTCMonth() + 1, 0)).getUTCDate()).map(v => ({ value: v, label: String(v) })), set: v => setGreg(g.getUTCFullYear(), g.getUTCMonth(), v) },
    ];

  return (
    <Screen theme="dark" title="متى أخرجت زكاتك؟" desc="هذا التاريخ يساعدنا على بدء الحول من موضعه الصحيح." onBack={back}
      cta={<Button variant="primary" icon={Check} disabled={future}
        onClick={() => { setLastZakat({ calendar, iso }); setRemembers('yes'); back(); }}>حفظ</Button>}>
      <Segmented label="نوع التقويم" value={calendar} onChange={setCalendar}
        options={[{ value: 'hijri', label: 'هجري' }, { value: 'gregorian', label: 'ميلادي' }]} />
      <div style={{ display: 'flex', gap: 8 }}>
        {parts.map(p => <DatePart key={p.label} {...p} onChange={p.set} />)}
      </div>
      <AmountCard theme="dark" label={calendar === 'hijri' ? 'يقابله ميلاديًا' : 'يقابله هجريًا'}
        amount={calendar === 'hijri' ? gregText(iso) : hijriText(iso)} />
      <Note icon={CalendarCheck}>{future ? 'هذا التاريخ بعد اليوم، اختر تاريخًا سابقًا.' : 'يمكن تعديل التاريخ لاحقًا من الإعدادات.'}</Note>
    </Screen>
  );
}

export function Sync({ go, back }) {
  const { view } = useStore();
  const [progress, setProgress] = useState(82);
  useEffect(() => {
    if (progress >= 100) return;
    const t = setTimeout(() => setProgress(p => Math.min(100, p + 3)), 120);
    return () => clearTimeout(t);
  }, [progress]);
  const done = progress >= 100;
  const count = view.accounts.length;
  return (
    <Screen title="نرتّب صورتك المالية" desc="تمت قراءة الحسابات، ونعالج الآن آخر أسعار السوق." onBack={back}
      cta={<Button variant="primary" icon={ArrowLeft} onClick={() => go('offbank')}>متابعة</Button>}>
      <InfoRow icon={ShieldCheck} title="التحقق من الموافقة" detail="اكتمل بأمان" />
      <InfoRow icon={Landmark} title="قراءة الحسابات" detail={`اكتمل • ${count === 2 ? 'حسابان' : `${count} حسابات`}`} />
      <InfoRow icon={RefreshCw} title="مزامنة أسعار السوق" selected={!done}
        detail={done ? `اكتمل • أسعار ${gregText(view.prices.date)}` : 'قيد المعالجة'} />
      <div className="nm-field" style={{ gap: 8 }}>
        <div role="progressbar" dir="ltr" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="تقدم المزامنة"
          style={{ height: 8, borderRadius: 999, background: 'var(--nm-track)', overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', borderRadius: 999, background: 'var(--nm-primary)', transition: 'width .12s linear' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, lineHeight: '23px' }}>
          <span style={{ color: 'var(--nm-muted)' }}>{done ? 'اكتملت المزامنة' : 'بضع ثوانٍ متبقية'}</span>
          <span style={{ fontWeight: 700 }}>{progress}%</span>
        </div>
      </div>
      <Note icon={Bell}>يمكنك مغادرة الشاشة؛ سنرسل إشعارًا عند اكتمال المزامنة.</Note>
    </Screen>
  );
}
