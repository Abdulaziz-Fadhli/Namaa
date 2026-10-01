// سجل الزكاة، وإخراج الزكاة (الجهة ← المراجعة ← رمز التحقق)، والإيصال. المبالغ من أحداث المحرك (DUE).
import { useState } from 'react';
import {
  ArrowLeft, BellRing, Building2, CalendarClock, CalendarPlus, Check, CheckCheck, ChevronLeft, CircleCheck, Copy, Download,
  HandHeart, History as HistoryIcon, Info, Landmark, LockKeyhole, Plus, Receipt, Share2, ShieldCheck, WalletCards,
} from 'lucide-react';
import { Btn, Card, Icon, Modal, Option, Otp, Pill, Seg, Steps, TextInput } from '../kit.jsx';
import { go } from '../nav.js';
import { Shell } from '../Shell.jsx';
import { useStore } from '../../figma/model.js';
import { gregText, hijriText, hijriToIso } from '../../figma/format.js';
import { ACCOUNTS, bothDates, hijriFromParts, plain, sar } from '../data.js';

// ---------- سجل الزكاة ----------
export function History({ path }) {
  const { view, payment } = useStore();
  const [year, setYear] = useState(view.todayHijri[0]);
  const [detail, setDetail] = useState(null);
  const today = view.today;
  const upcoming = view.upcoming[0];
  const todayDue = view.due;
  const past = view.dues.filter(d => d.date !== today);
  const byYear = y => view.dues.filter(d => d.hijri[0] === y);
  const sumOf = list => list.reduce((s, d) => s + d.zakat, 0);
  const years = [...new Set([view.todayHijri[0], ...view.dues.map(d => d.hijri[0]), view.start?.hijri[0]].filter(Boolean))].sort((a, b) => b - a);
  const rows = [
    ...(year === view.todayHijri[0] && upcoming ? [{ kind: 'next', ...upcoming }] : []),
    ...(year === view.todayHijri[0] && todayDue ? [{ kind: 'today', ...todayDue }] : []),
    ...past.filter(d => d.hijri[0] === year).reverse().map(d => ({ kind: 'past', ...d })),
  ];
  const yearDues = byYear(year);
  const exportCsv = () => {
    const lines = [['التاريخ الهجري', 'التاريخ الميلادي', 'المبلغ الذي أكمل حولًا', 'الزكاة', 'النصاب يومها'],
      ...view.dues.map(d => [hijriFromParts(d.hijri), d.date, d.base, d.zakat, d.nisab])];
    const blob = new Blob([`${String.fromCharCode(0xFEFF)}${lines.map(l => l.join(',')).join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `سجل-زكاة-نماء-${today}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const start = view.start;
  return (
    <Shell path={path} title="سجل الزكاة" desc="كل مرة اكتمل فيها حول مبلغ في حساباتك">
      <div className="w-kpis">
        <div className="w-kpi">
          <span className="row t12 sub"><Icon as={CalendarClock} size={15} />الوجوب القادم</span>
          <strong>{sar(upcoming?.zakat ?? 0)}</strong>
          <span className="t11 muted">{upcoming ? `${hijriFromParts(upcoming.hijri)} · بعد ${upcoming.inDays} يومًا` : '—'}</span>
        </div>
        <div className="w-kpi">
          <span className="row t12 sub"><Icon as={Receipt} size={15} />زكاة {view.todayHijri[0]}هـ حتى اليوم</span>
          <strong>{sar(sumOf(byYear(view.todayHijri[0])))}</strong>
          <span className="t11 muted">{byYear(view.todayHijri[0]).length} مرات · آخرها {todayDue ? 'اليوم' : hijriFromParts(byYear(view.todayHijri[0]).at(-1)?.hijri ?? view.todayHijri)}</span>
        </div>
        <div className="w-kpi">
          <span className="row t12 sub"><Icon as={HistoryIcon} size={15} />زكاة {view.todayHijri[0] - 1}هـ</span>
          <strong>{sar(sumOf(byYear(view.todayHijri[0] - 1)))}</strong>
          <span className="t11 muted">{byYear(view.todayHijri[0] - 1).map(d => `${d.hijri[2]} ${hijriFromParts(d.hijri).split(' ').slice(1, -1).join(' ')}`).join(' و') || '—'}</span>
        </div>
        <div className="w-kpi">
          <span className="row t12 sub"><Icon as={CalendarPlus} size={15} />بدأ التتبع</span>
          <strong>{start ? hijriFromParts(start.hijri) : '—'}</strong>
          <span className="t11 muted">{start ? `الوعاء ${plain(start.total)} ر.س · النصاب ${plain(start.nisab)}` : ''}</span>
        </div>
      </div>

      <Card flush title={`السنة الهجرية ${year}`} desc={`${rows.length} سجلات · المبالغ بالريال السعودي`}
        action={<div className="row">
          <Seg value={year} onChange={setYear} options={years.map(y => ({ value: y, label: `${y}هـ` }))} label="السنة" />
          <Btn className="sm w-hide-m" icon={Download} onClick={exportCsv}>تصدير CSV</Btn>
        </div>}>
        <div className="w-table-wrap" style={{ marginTop: 16 }}>
          <table className="w-table">
            <thead><tr><th>التاريخ الهجري</th><th className="w-hide-m">التاريخ الميلادي</th><th className="w-hide-m">المبلغ الذي أكمل حولًا</th><th>الزكاة</th><th>الحالة</th><th /></tr></thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={6} className="sub">
                  {start && start.hijri[0] === year ? `بدأ تتبع الحول في ${hijriFromParts(start.hijri)} حين بلغ الوعاء النصاب، ولم يكتمل حول أي مبلغ في هذه السنة.` : 'لا توجد سجلات في هذه السنة.'}
                </td></tr>
              )}
              {rows.map(r => (
                <tr key={`${r.kind}-${r.date}`} className={r.kind === 'today' && !payment ? 'hl' : ''}>
                  <td>
                    <span className="row">
                      <span className={`w-ico sub-m${r.kind === 'today' ? ' warn' : r.kind === 'next' ? ' sel' : ''}`}>
                        <Icon as={r.kind === 'next' ? CalendarClock : r.kind === 'today' ? Receipt : CircleCheck} />
                      </span>
                      <span>
                        <span className="b7" style={{ display: 'block', whiteSpace: 'nowrap' }}>{hijriFromParts(r.hijri)}</span>
                        <span className="t11 sub sub-m">{r.kind === 'next' ? 'متوقعة إذا بقي رصيدك كما هو' : 'اكتمل الحول في هذا اليوم'}</span>
                      </span>
                    </span>
                  </td>
                  <td className="w-hide-m sub">{gregText(r.date)}</td>
                  <td className="w-hide-m sub">{sar(r.base)}</td>
                  <td className="b7" style={{ whiteSpace: 'nowrap' }}>{sar(r.zakat)}</td>
                  <td>{r.kind === 'next' ? <Pill tone="info">متوقعة</Pill> : r.kind === 'today' ? (payment ? <Pill tone="ok">أُخرجت</Pill> : <Pill tone="warn">مستحقة اليوم</Pill>) : <Pill>وجبت</Pill>}</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
                    {r.kind === 'today' && !payment
                      ? <Btn variant="primary" className="sm" onClick={() => go('/app/payout')}>إخراج</Btn>
                      : r.kind === 'today'
                        ? <button className="t12 b6 row" onClick={() => go('/app/receipt')}>الإيصال <Icon as={ChevronLeft} size={14} /></button>
                        : <button className="t12 b6 row" onClick={() => setDetail(r)}>{r.kind === 'next' ? 'تذكير' : 'التفاصيل'} <Icon as={ChevronLeft} size={14} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="between" style={{ padding: '14px 24px', borderTop: '1px solid var(--line)', flexWrap: 'wrap' }}>
          <span className="w-note"><Icon as={Info} size={14} />المبالغ السابقة محسوبة من كشف حساباتك منذ آخر زكاة سجّلتها.</span>
          <span className="b7 t13">المجموع: {sar(sumOf(yearDues))} على {sar(yearDues.reduce((s, d) => s + d.base, 0))}</span>
        </div>
      </Card>

      {detail && (
        <Modal size="sm" title={detail.kind === 'next' ? `الوجوب القادم · ${hijriFromParts(detail.hijri)}` : `زكاة ${hijriFromParts(detail.hijri)}`}
          desc={gregText(detail.date)} onClose={() => setDetail(null)}
          foot={<Btn variant="primary" onClick={() => setDetail(null)}>{detail.kind === 'next' ? 'ذكّرني قبلها بثلاثة أيام' : 'تم'}</Btn>}>
          <div className="w-soft">
            <div className="w-line"><span>المبلغ الذي أكمل حولًا</span><span>{sar(detail.base)}</span></div>
            <div className="w-line" style={{ borderTop: '1px solid var(--line)' }}><span>الزكاة (2.5٪)</span><span>{sar(detail.zakat)}</span></div>
            {detail.nisab ? <div className="w-line" style={{ borderTop: '1px solid var(--line)' }}><span>النصاب يومها</span><span>{sar(detail.nisab)}</span></div> : null}
            {detail.total ? <div className="w-line" style={{ borderTop: '1px solid var(--line)' }}><span>الوعاء يومها</span><span>{sar(detail.total)}</span></div> : null}
          </div>
          <p className="t13 sub">{detail.kind === 'next'
            ? `إذا بقي رصيدك فوق النصاب، يكمل حول ${plain(detail.base)} ر.س في هذا اليوم وتجب فيه ${plain(detail.zakat)} ر.س.`
            : detail.explanation}</p>
          {detail.kind === 'past' && <Btn onClick={() => go('/app/payout')}>إخراجها الآن</Btn>}
        </Modal>
      )}
    </Shell>
  );
}

// ---------- إخراج الزكاة ----------
const CHANNEL_UI = {
  charity: { title: 'جمعية خيرية مرخّصة', desc: 'حساب الزكاة · 0451 ••••', icon: HandHeart, to: 'جمعية خيرية مرخّصة · 0451 ••••', bank: 'مصرف الإنماء' },
  fund: { title: 'صندوق زكاة موثوق', desc: 'تحويل مباشر · فوري', icon: ShieldCheck, to: 'صندوق زكاة موثوق', bank: 'تحويل مباشر' },
  beneficiary: { title: 'حساب مستفيد', desc: 'بالآيبان · الرسوم حسب البنك', icon: WalletCards, to: 'حساب مستفيد', bank: 'حسب الآيبان' },
  self: { title: 'سأخرجها بنفسي', desc: 'تسجّل الإخراج دون تحويل', icon: CheckCheck, to: 'إخراج يدوي', bank: '—' },
};

function NewBeneficiary({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [iban, setIban] = useState('SA');
  const clean = iban.replace(/\s/g, '').toUpperCase();
  const ok = name.trim().length > 2 && /^SA\d{22}$/.test(clean);
  return (
    <Modal size="sm" title="مستفيد جديد" desc="نتحقق من اسم صاحب الحساب قبل التحويل" onClose={onClose}
      foot={<><Btn onClick={onClose}>إلغاء</Btn><Btn variant="primary" disabled={!ok} onClick={() => onSave({ name: name.trim(), iban: clean })}>حفظ المستفيد</Btn></>}>
      <TextInput label="اسم المستفيد" value={name} onChange={setName} placeholder="كما في البنك" />
      <TextInput label="رقم الآيبان" value={iban} onChange={setIban} dir="ltr" placeholder="SA00 0000 0000 0000 0000 0000"
        help={clean.length > 2 && !/^SA\d{22}$/.test(clean) ? 'الآيبان السعودي يبدأ بـ SA ويتبعه 22 رقمًا' : 'تأكد أن المستفيد من مصارف الزكاة الثمانية'} warn={clean.length > 2 && !/^SA\d{22}$/.test(clean)} />
    </Modal>
  );
}

export function Payout({ path }) {
  const { view, due, channel, setChannel, fromAccount, setFromAccount, pay, payment } = useStore();
  const [otp, setOtp] = useState(null);
  const [newBen, setNewBen] = useState(false);
  const [ben, setBen] = useState(null);
  const accounts = view.accounts.filter(a => !a.exempt);
  const from = accounts.find(a => a.id === fromAccount) ?? accounts[0];
  const ch = CHANNEL_UI[channel] ?? CHANNEL_UI.charity;
  const enough = from.balance >= due.zakat;
  if (payment) {
    return (
      <Shell path={path} title="إخراج الزكاة" desc="أخرجت زكاة اليوم">
        <Card><div className="col" style={{ gap: 12, alignItems: 'flex-start' }}>
          <p>أخرجت {sar(payment.amount)} اليوم، والوجوب القادم بعد {view.nextDue?.inDays ?? '—'} يومًا.</p>
          <Btn variant="primary" onClick={() => go('/app/receipt')}>عرض الإيصال</Btn>
        </div></Card>
      </Shell>
    );
  }
  if (!due.today) {
    return (
      <Shell path={path} title="إخراج الزكاة" desc="لا زكاة واجبة اليوم">
        <Card><p className="sub">الوجوب القادم {view.nextDue ? `في ${hijriFromParts(view.nextDue.hijri)}: ${sar(view.nextDue.zakat)}` : 'غير محدد'}. يمكنك تعجيل الزكاة لسنتين كما في دليل الهيئة (§5).</p></Card>
      </Shell>
    );
  }
  const confirm = () => { pay(); setOtp(null); go('/app/receipt'); };
  return (
    <Shell path={path} title="إخراج الزكاة" desc={`الخطوة ${otp != null ? 3 : 2} من 3 · ${otp != null ? 'أكّد التحويل برمز التحقق' : 'راجع التفاصيل قبل التحويل'}`}>
      <div className="w-hide-m"><Steps items={['اختيار الجهة', 'المراجعة', 'رمز التحقق']} current={otp != null ? 2 : 1} /></div>
      <div className="w-cols c-wide">
        <div className="col" style={{ gap: 24 }}>
          <Card title="من حساب" desc="الرصيد المتاح يكفي للتحويل">
            <div className="col" style={{ gap: 10 }}>
              {accounts.map(a => (
                <Option key={a.id} selected={from.id === a.id} onClick={() => setFromAccount(a.id)} icon={a.id === 'A1' ? Landmark : Building2}
                  title={`${ACCOUNTS[a.id].bank} · ${ACCOUNTS[a.id].kind}`} desc={`${ACCOUNTS[a.id].mask} ••••`}
                  trailing={<span style={{ textAlign: 'left' }}><span className="b7" style={{ display: 'block' }}>{sar(a.balance)}</span><span className="t11 sub">الرصيد المتاح</span></span>} />
              ))}
            </div>
          </Card>
          <Card title="إلى" desc="اختر الجهة التي تصلها زكاتك" action={<Btn variant="ghost" icon={Plus} onClick={() => setNewBen(true)}>مستفيد جديد</Btn>}>
            <div className="w-grid2 stack-xs">
              {Object.entries(CHANNEL_UI).map(([k, c]) => (
                <Option key={k} selected={channel === k} onClick={() => setChannel(k)} icon={c.icon} title={k === 'beneficiary' && ben ? ben.name : c.title}
                  desc={k === 'beneficiary' && ben ? `${ben.iban.slice(0, 4)} •••• ${ben.iban.slice(-4)}` : c.desc} />
              ))}
            </div>
            {channel !== 'self' && (
              <div className="w-soft" style={{ marginTop: 16 }}>
                <div className="w-line"><span className="b7" style={{ color: 'var(--ink)' }}>تفاصيل المستفيد</span><Pill tone="ok">تم التحقق</Pill></div>
                <div className="w-line" style={{ borderTop: '1px solid var(--line)' }}><span>الاسم</span><span>{channel === 'beneficiary' && ben ? ben.name : `${ch.title} · حساب الزكاة`}</span></div>
                <div className="w-line" style={{ borderTop: '1px solid var(--line)' }}><span>البنك المستلم</span><span>{ch.bank}</span></div>
              </div>
            )}
          </Card>
        </div>
        <Card title="المبلغ">
          <div className="w-amount md"><strong>{plain(due.zakat)}</strong><span>ر.س</span></div>
          <p className="t12 sub" style={{ marginBottom: 16 }}>زكاة مال · {hijriText(view.today)} · على {plain(due.base)} ر.س</p>
          <div className="w-soft" style={{ marginBottom: 20 }}>
            <div className="w-line"><span>نوع التحويل</span><span>{channel === 'self' ? 'تسجيل فقط' : 'تحويل محلي فوري'}</span></div>
            <div className="w-line" style={{ borderTop: '1px solid var(--line)' }}><span>الرسوم</span><span className="green">{sar(0)}</span></div>
            <div className="w-line" style={{ borderTop: '1px solid var(--line)' }}><span>الغرض</span><span>زكاة</span></div>
            <div className="w-line" style={{ borderTop: '1px solid var(--line)' }}><span>تاريخ التنفيذ</span><span>{gregText(view.today)}</span></div>
          </div>
          {!enough && <p className="w-help warn" style={{ marginBottom: 12 }}>رصيد هذا الحساب أقل من مبلغ الزكاة، اختر حسابًا آخر.</p>}
          {channel !== 'self' && <p className="w-note" style={{ marginBottom: 12 }}><Icon as={LockKeyhole} size={14} />سنرسل رمز تحقق إلى جوالك المنتهي بـ 47 لإتمام التحويل.</p>}
          <div className="col" style={{ gap: 10 }}>
            <Btn variant="primary" className="lg" disabled={!enough} onClick={() => (channel === 'self' ? confirm() : setOtp(''))}>
              {channel === 'self' ? 'تسجيل الإخراج' : 'متابعة لرمز التحقق'}
            </Btn>
            <Btn onClick={() => go('/app')}>رجوع</Btn>
          </div>
        </Card>
      </div>

      {otp != null && (
        <Modal size="sm" onClose={() => setOtp(null)}
          foot={<Btn variant="primary" className="lg" disabled={otp.length < 6} onClick={confirm}>تأكيد التحويل</Btn>}>
          <div className="col" style={{ alignItems: 'center', gap: 10, textAlign: 'center', paddingTop: 12 }}>
            <span className="w-ico sel" style={{ width: 52, height: 52, borderRadius: 99 }}><Icon as={LockKeyhole} size={22} /></span>
            <h2 className="b7" style={{ fontSize: 20 }}>أدخل رمز التحقق</h2>
            <p className="t13 sub">أرسلنا رمزًا من 6 أرقام برسالة نصية إلى جوالك المنتهي بـ 47</p>
          </div>
          <Otp value={otp} onChange={setOtp} />
          <div className="w-soft">
            <div className="w-line"><span>تحويل زكاة</span><span>{sar(due.zakat)}</span></div>
            <div className="w-line t12" style={{ borderTop: '1px solid var(--line)' }}><span>من {ACCOUNTS[from.id].short} {ACCOUNTS[from.id].kind} · {ACCOUNTS[from.id].mask} ••••</span><span>{ch.to}</span></div>
          </div>
          <p className="t12 sub" style={{ textAlign: 'center' }}>نسخة العرض: أي 6 أرقام تكفي.</p>
        </Modal>
      )}
      {newBen && <NewBeneficiary onClose={() => setNewBen(false)} onSave={b => { setBen(b); setChannel('beneficiary'); setNewBen(false); }} />}
    </Shell>
  );
}

// ---------- الإيصال ----------
// «20:09» ← «8:09 م»
const time12 = t => { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'ص' : 'م'}`; };
export function ReceiptPage({ path }) {
  const { view, payment } = useStore();
  const [copied, setCopied] = useState(false);
  if (!payment) {
    return (
      <Shell path={path} title="إيصال الإخراج">
        <Card><div className="col" style={{ gap: 12, alignItems: 'flex-start' }}><p className="sub">لا يوجد إخراج مسجّل اليوم.</p><Btn variant="primary" onClick={() => go('/app/payout')}>إخراج الزكاة</Btn></div></Card>
      </Shell>
    );
  }
  const ch = CHANNEL_UI[payment.channel] ?? CHANNEL_UI.charity;
  const acc = ACCOUNTS[payment.fromAccount] ?? ACCOUNTS.A1;
  const [y, m, d] = view.todayHijri;
  const nextHawl = hijriToIso(y + 1, m, d);
  const share = async () => {
    const text = `إيصال إخراج زكاة من نماء: ${sar(payment.amount)} · ${payment.ref}`;
    try { if (navigator.share) await navigator.share({ title: 'إيصال نماء', text }); else { await navigator.clipboard.writeText(text); setCopied(true); } } catch { /* أغلق المشاركة */ }
  };
  return (
    <Shell path={path} title="إيصال الإخراج"
      crumb={<><button onClick={() => go('/app/payout')}>إخراج الزكاة</button><Icon as={ChevronLeft} size={12} /><span className="ltr">{payment.ref}</span></>}>
      <div className="w-cols c-wide">
        <Card flush>
          <div className="col" style={{ alignItems: 'center', gap: 6, padding: '28px 24px 24px', borderBottom: '1px solid var(--line)' }}>
            <span className="w-ico ok" style={{ width: 52, height: 52, borderRadius: 99 }}><Icon as={Check} size={24} /></span>
            <h2 className="b7" style={{ fontSize: 20 }}>{payment.channel === 'self' ? 'سجّلنا إخراج الزكاة' : 'تم إخراج الزكاة'}</h2>
            <p className="t13 sub">تقبّل الله منك</p>
            <div className="w-amount md"><strong>{plain(payment.amount)}</strong><span>ر.س</span></div>
          </div>
          <div style={{ padding: '4px 24px' }} className="w-divide">
            <div className="w-line"><span>الرقم المرجعي</span><span className="row ltr" style={{ gap: 6 }}><button onClick={() => { navigator.clipboard?.writeText(payment.ref); setCopied(true); }} aria-label="نسخ"><Icon as={Copy} size={14} /></button>{payment.ref}</span></div>
            <div className="w-line"><span>التاريخ والوقت</span><span>{gregText(payment.date)} · {time12(payment.time)}</span></div>
            <div className="w-line"><span>من حساب</span><span>{acc.short} {acc.kind} · {acc.mask} ••••</span></div>
            <div className="w-line"><span>إلى</span><span>{ch.to}</span></div>
            <div className="w-line"><span>الغرض</span><span>زكاة مال {y}هـ</span></div>
            <div className="w-line"><span>الرسوم</span><span>{sar(0)}</span></div>
            <div className="w-line"><span>الحالة</span><span><Pill tone="ok">مكتملة</Pill></span></div>
          </div>
          <div className="row" style={{ gap: 12, padding: 20, background: 'var(--soft)' }}>
            <Btn variant="primary" className="grow" icon={Download} onClick={() => window.print()}>تنزيل الإيصال PDF</Btn>
            <Btn className="grow" icon={Share2} onClick={share}>{copied ? 'نُسخ' : 'مشاركة'}</Btn>
          </div>
        </Card>
        <Card title="ما التالي" desc="حدّثنا حساباتك بعد الإخراج">
          <div className="w-divide">
            <div className="w-list-row"><span className="w-ico ok"><Icon as={CalendarPlus} /></span><span className="grow"><span className="t" style={{ display: 'block' }}>بدأ حول جديد</span><span className="d">لمبلغ {plain(payment.base)} ر.س من اليوم، ويكتمل في {nextHawl ? hijriText(nextHawl) : ''}</span></span></div>
            {view.nextDue && <div className="w-list-row"><span className="w-ico sel"><Icon as={CalendarClock} /></span><span className="grow"><span className="t" style={{ display: 'block' }}>الوجوب القادم بعد {view.nextDue.inDays} يومًا</span><span className="d">{hijriFromParts(view.nextDue.hijri)} · {sar(view.nextDue.zakat)}</span></span></div>}
            <div className="w-list-row"><span className="w-ico"><Icon as={BellRing} /></span><span className="grow"><span className="t" style={{ display: 'block' }}>نذكّرك قبلها</span><span className="d">تنبيه قبل 3 أيام، وآخر يوم الوجوب.</span></span></div>
            <div className="w-list-row"><span className="w-ico"><Icon as={HistoryIcon} /></span><span className="grow"><span className="t" style={{ display: 'block' }}>سُجّلت في سجل الزكاة</span><span className="d">تظهر في سجل {y}هـ مع هذا الإيصال.</span></span></div>
          </div>
          <Btn className="block" icon={ArrowLeft} onClick={() => go('/app')} style={{ marginTop: 16 }}>العودة إلى الرئيسية</Btn>
        </Card>
      </div>
      <p className="t11 muted">{bothDates(payment.date)} · صادر من نماء للتوثيق الشخصي.</p>
    </Shell>
  );
}
