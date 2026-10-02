// سجل الزكاة، وإخراج الزكاة (الجهة ← المراجعة ← التأكيد)، والإيصال. المبالغ من أحداث المحرك (DUE).
import { useState } from 'react';
import {
  ArrowLeft, BellRing, Building2, CalendarClock, CalendarPlus, Check, CheckCheck, ChevronLeft, Copy, Download,
  HandHeart, History as HistoryIcon, Info, Landmark, Plus, Share2, WalletCards,
} from 'lucide-react';
import { Btn, Card, Icon, Modal, Option, Pill, Seg, Select, TextInput } from '../kit.jsx';
import { go } from '../nav.js';
import { Shell } from '../Shell.jsx';
import { useStore } from '../../figma/model.js';
import { PastDue, RecordTabs } from './Home.jsx';
import { gregText, hijriText, hijriToIso } from '../../figma/format.js';
import { ACCOUNTS, accountInfo, bothDates, daysFrom, hijriFromParts, plain, sar, days } from '../data.js';

// ---------- سجل الزكاة ----------
export function History({ path }) {
  const { view, payment, personaMode, selfPaid, unpaidDues } = useStore();
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
    <Shell path={path} title="السجل" desc={`من ${gregText(start?.date ?? today)} إلى ${gregText(today)}`}>
      <RecordTabs tab="table" />
      <Card flush title={`${year}هـ`}
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
                      <span>
                        <span className="b7" style={{ display: 'block', whiteSpace: 'nowrap' }}>{hijriFromParts(r.hijri)}</span>
                        {r.kind === 'next' && <span className="t11 muted sub-m">إذا بقي رصيدك كما هو</span>}
                      </span>
                    </span>
                  </td>
                  <td className="w-hide-m sub">{gregText(r.date)}</td>
                  <td className="w-hide-m sub">{sar(r.base)}</td>
                  <td className="b7" style={{ whiteSpace: 'nowrap' }}>{sar(r.zakat)}</td>
                  <td>{r.kind === 'next' ? <Pill>توقّع</Pill> : r.kind === 'today' ? (payment ? <Pill tone="ok">أُخرجت</Pill> : <Pill tone="warn">مستحقة اليوم</Pill>) : (selfPaid[r.date] ? <Pill tone="ok">{selfPaid[r.date].receipt ? 'أُخرجت' : 'سجّلت سدادها'}</Pill> : <span className="sub t12">لم يُسجَّل سدادها</span>)}</td>
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
          <span className="w-note"><Icon as={Info} size={14} />{personaMode ? (unpaidDues.length ? `محسوبة من كشف الحسابات · ${unpaidDues.length === 1 ? 'وجوب واحد' : `${unpaidDues.length} وجوبات`} بلا سداد مسجل. افتح التفاصيل لتسجيله.` : 'محسوبة من كشف الحسابات · سُجّل سداد كل ما وجب.') : 'المبالغ السابقة محسوبة من كشف حساباتك منذ آخر زكاة سجّلتها.'}</span>
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
          {detail.kind === 'past' && <PastDue d={detail} />}
        </Modal>
      )}
    </Shell>
  );
}

// ---------- إخراج الزكاة ----------
// نماء لا يحتفظ بالمال ولا ينقله: التحويل من بنكك بموافقتك في تطبيق البنك، أو عبر منصة «زكاتي» من هيئة الزكاة.
// الجهات كلها داخل مصارف الزكاة الثمانية (دليل الهيئة §6)، والنية شرط (§4)، والتوكيل جائز (§4.1).
const RECIPIENTS = ['الفقراء', 'المساكين', 'العاملون على جمع الزكاة', 'المؤلفة قلوبهم', 'في الرقاب', 'الغارمون', 'في سبيل الله', 'ابن السبيل'];
const CHANNEL_UI = {
  zakati: { title: 'منصة «زكاتي»', desc: 'هيئة الزكاة · تصل للمستحقين في الضمان الاجتماعي', icon: Landmark, to: 'منصة زكاتي · هيئة الزكاة والضريبة والجمارك', bank: 'قنوات الدفع الإلكترونية للهيئة', how: 'ننقلك إلى «زكاتي» بالمبلغ جاهزًا، وتدفع من هناك' },
  charity: { title: 'جمعية مرخّصة توكّلها', desc: 'وكيل يوصلها لمستحقيها من الثمانية', icon: HandHeart, to: 'جمعية مرخّصة (وكيل) · 0451 ••••', bank: 'مصرف الإنماء', how: 'تحويل من بنكك بموافقتك في تطبيق البنك' },
  beneficiary: { title: 'مستحق تعرفه', desc: 'بالآيبان · تحدد مصرفه من الثمانية', icon: WalletCards, to: 'حساب مستفيد', bank: 'حسب الآيبان', how: 'تحويل من بنكك بموافقتك في تطبيق البنك' },
  self: { title: 'أخرجتها بنفسي', desc: 'تسجيل فقط، دون تحويل', icon: CheckCheck, to: 'إخراج يدوي', bank: '—', how: 'نسجّلها في سجلك فقط' },
};
// سجلات قديمة في الجلسة قد تحمل جهة محذوفة
const channelOf = k => CHANNEL_UI[k] ?? CHANNEL_UI.zakati;

function NewBeneficiary({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [iban, setIban] = useState('SA');
  const clean = iban.replace(/\s/g, '').toUpperCase();
  const ok = name.trim().length > 2 && /^SA\d{22}$/.test(clean);
  return (
    <Modal size="sm" title="مستحق جديد" desc="نتحقق من اسم صاحب الحساب قبل التحويل" onClose={onClose}
      foot={<><Btn onClick={onClose}>إلغاء</Btn><Btn variant="primary" disabled={!ok} onClick={() => onSave({ name: name.trim(), iban: clean })}>حفظ</Btn></>}>
      <TextInput label="اسم المستحق" value={name} onChange={setName} placeholder="كما في البنك" />
      <TextInput label="رقم الآيبان" value={iban} onChange={setIban} dir="ltr" placeholder="SA00 0000 0000 0000 0000 0000"
        help={clean.length > 2 && !/^SA\d{22}$/.test(clean) ? 'الآيبان السعودي يبدأ بـ SA ويتبعه 22 رقمًا' : 'يستحب تقديم الأقارب المستحقين ممن لا تجب نفقتهم عليك (دليل الهيئة §6)'} warn={clean.length > 2 && !/^SA\d{22}$/.test(clean)} />
    </Modal>
  );
}

export function Payout({ path }) {
  const { view, due, channel, setChannel, fromAccount, setFromAccount, pay, payment, historical, nextDue, unpaidDues, unpaidTotal } = useStore();
  const [newBen, setNewBen] = useState(false);
  const [ben, setBen] = useState(null);
  const [category, setCategory] = useState('');
  const [intent, setIntent] = useState(false);
  const accounts = view.accounts.filter(a => accountInfo(a).included);
  const from = accounts.find(a => a.id === fromAccount) ?? accounts[0];
  const ch = channelOf(channel);
  const chKey = CHANNEL_UI[channel] ? channel : 'zakati';
  // /app/payout/2026-03-22: إخراج زكاة سابقة لم يُسجَّل سدادها
  const targetDate = path.startsWith('/app/payout/') ? path.split('/').pop() : null;
  const target = targetDate ? unpaidDues.find(d => d.date === targetDate) : null;
  const amount = target ? target.zakat : due.zakat;
  const base = target ? target.base : due.base;
  if (payment && !target) {
    return (
      <Shell path={path} title="إخراج الزكاة" desc="أخرجت زكاة اليوم">
        <Card><div className="col" style={{ gap: 12, alignItems: 'flex-start' }}>
          <p>أخرجت {sar(payment.amount)} اليوم، والوجوب القادم بعد {nextDue ? days(nextDue.inDays) : '—'}.</p>
          <Btn variant="primary" onClick={() => go('/app/receipt')}>عرض الإيصال</Btn>
        </div></Card>
      </Shell>
    );
  }
  if (!due.today && !target) {
    return (
      <Shell path={path} title="إخراج الزكاة" desc={`لا شيء مستحق ${historical ? `في ${gregText(view.today)}` : 'اليوم'}`}>
        <div className="w-cols c-dash">
          <Card>
            <div className="w-hero-num">
              <span className="lbl">المستحق اليوم</span>
              <div className="w-amount"><strong>0.00</strong><span>ر.س</span></div>
              <p className="w-quiet">لا نطلب منك إخراج مبلغ لم يجب بعد.</p>
            </div>
            {nextDue && (
              <p className="w-quiet" style={{ marginTop: 18, lineHeight: '24px' }}>
                القادم <b>{sar(nextDue.zakat)}</b> في {hijriText(nextDue.date)} ({gregText(nextDue.date)}){nextDue.advanced ? '، تعجيلًا في رمضان' : '، توقّع إذا بقي الرصيد كما هو'}. يجوز تعجيلها لسنتين فأقل ما دمت تملك النصاب (دليل الهيئة §5)، لكنها لا تُضاف إلى المستحق.
              </p>
            )}
          </Card>
          {view.dues.length > 0 && (
            <Card title="زكوات سابقة" action={<span className="t12 muted">{unpaidDues.length ? `بلا سداد مسجل: ${plain(unpaidTotal)}` : 'سُجّل سدادها'}</span>}>
              <div className="w-rows">
                {view.dues.map(d => {
                  const open = unpaidDues.some(u => u.date === d.date);
                  return (
                    <div key={d.date} className="w-rowline">
                      <span className="t">{gregText(d.date)}</span>
                      <span className="v">{plain(d.zakat)}</span>
                      <span className="d">على {plain(d.base)} · {open ? <button className="w-link" onClick={() => go(`/app/payout/${d.date}`)}>إخراجها</button> : 'سُجّل سدادها'}</span>
                    </div>
                  );
                })}
              </div>
              <p className="w-note" style={{ marginTop: 12 }}><Icon as={Info} size={14} /><span>من ترك الزكاة لسنوات يخرجها عن كل سنة بقيمتها يوم وجبت. ومن نسي عدد السنوات أخرج المتيقن، والاحتياط فيما شك فيه حسن (دليل الهيئة §4.2).</span></p>
            </Card>
          )}
        </div>
      </Shell>
    );
  }
  const needsCategory = chKey === 'beneficiary';
  const transfer = chKey === 'charity' || chKey === 'beneficiary';
  const enough = !transfer || from.balance >= amount;
  const ready = intent && enough && (!needsCategory || (ben && category));
  const confirm = () => {
    const rec = pay(target, { category: needsCategory ? category : null, beneficiary: needsCategory ? ben?.name : null });
    go(target ? `/app/receipt/${target.date}` : '/app/receipt');
    return rec;
  };
  const late = target ? daysFrom(target.date, view.today) : 0;
  return (
    <Shell path={path} title={target ? 'إخراج زكاة سابقة' : 'إخراج الزكاة'} desc={target ? `وجبت في ${hijriText(target.date)} · ${gregText(target.date)}` : 'اختر الجهة، ثم أكّد بنيتك'}>
      <div className="w-cols c-wide">
        <div className="col" style={{ gap: 24 }}>
          <Card title="إلى" desc="جهات داخل مصارف الزكاة الثمانية فقط">
            <div className="w-grid2 stack-xs">
              {Object.entries(CHANNEL_UI).map(([k, c]) => (
                <Option key={k} selected={chKey === k} onClick={() => setChannel(k)} icon={c.icon} title={k === 'beneficiary' && ben ? ben.name : c.title}
                  desc={k === 'beneficiary' && ben ? `${ben.iban.slice(0, 4)} •••• ${ben.iban.slice(-4)}` : c.desc} />
              ))}
            </div>
            {needsCategory && (
              <div className="col" style={{ gap: 12, marginTop: 16 }}>
                {!ben && <Btn icon={Plus} onClick={() => setNewBen(true)}>إضافة مستحق بالآيبان</Btn>}
                <Select label="مصرفه من مصارف الزكاة" value={category} onChange={setCategory}
                  options={[{ value: '', label: 'اختر المصرف' }, ...RECIPIENTS.map(r => ({ value: r, label: r }))]} />
              </div>
            )}
            <p className="w-note" style={{ marginTop: 14 }}><Icon as={Info} size={14} /><span>لا تُدفع الزكاة لغير الأصناف الثمانية، كالأعمال الخيرية العامة والمساجد والمستشفيات، ويجوز دفعها لصنف واحد أو لشخص واحد (دليل الهيئة §6). وما تجبيه الهيئة يُصرف للضمان الاجتماعي بأمر ملكي.</span></p>
          </Card>
          {transfer && (
            <Card title="من حساب" desc="يُنفّذ التحويل من تطبيق بنكك بعد موافقتك؛ نماء لا يحتفظ بأموالك">
              <div className="col" style={{ gap: 10 }}>
                {accounts.map(a => (
                  <Option key={a.id} selected={from.id === a.id} onClick={() => setFromAccount(a.id)} icon={a.id.endsWith('1') ? Landmark : Building2}
                    title={`${ACCOUNTS[a.id].bank} · ${ACCOUNTS[a.id].kind}`} desc={`${ACCOUNTS[a.id].mask} ••••`}
                    trailing={<span style={{ textAlign: 'left' }}><span className="b7" style={{ display: 'block' }}>{sar(a.balance)}</span><span className="t11 sub">الرصيد</span></span>} />
                ))}
              </div>
            </Card>
          )}
        </div>
        <Card title="المبلغ">
          <div className="w-amount md"><strong>{plain(amount)}</strong><span>ر.س</span></div>
          <p className="t12 sub" style={{ marginBottom: 16 }}>زكاة مال · على {plain(base)} ر.س{target ? ` · بقيمتها يوم وجبت` : ''}</p>
          <div className="w-soft" style={{ marginBottom: 16 }}>
            <div className="w-line"><span>الجهة</span><span>{needsCategory && ben ? ben.name : ch.title}</span></div>
            {needsCategory && category && <div className="w-line" style={{ borderTop: '1px solid var(--line)' }}><span>المصرف</span><span>{category}</span></div>}
            <div className="w-line" style={{ borderTop: '1px solid var(--line)' }}><span>التنفيذ</span><span>{ch.how}</span></div>
            <div className="w-line" style={{ borderTop: '1px solid var(--line)' }}><span>الوقت</span><span>{target ? `متأخرة ${days(late)}` : 'فور وجوبها'}</span></div>
          </div>
          {target && <p className="w-help warn" style={{ marginBottom: 12 }}>تجب المبادرة بها فور وجوبها، ولا تسقط بالتأخير (دليل الهيئة §4.2).</p>}
          {!enough && <p className="w-help warn" style={{ marginBottom: 12 }}>رصيد هذا الحساب أقل من المبلغ، اختر حسابًا آخر.</p>}
          <label className="w-intent" style={{ marginBottom: 16 }}>
            <input type="checkbox" checked={intent} onChange={e => setIntent(e.target.checked)} />
            <span>{chKey === 'self' ? 'أخرجت هذا المبلغ بنية زكاة مالي' : 'أنوي بهذا المبلغ زكاة مالي'}<span className="t11 sub" style={{ display: 'block' }}>النية شرط لإخراج الزكاة، ولا يُخرجها أحد عنك بغير إذنك (دليل الهيئة §4)</span></span>
          </label>
          <div className="col" style={{ gap: 10 }}>
            <Btn variant="primary" className="lg" disabled={!ready} onClick={confirm}>
              {chKey === 'self' ? 'تسجيل الإخراج' : chKey === 'zakati' ? 'المتابعة إلى «زكاتي»' : 'المتابعة إلى تطبيق البنك'}
            </Btn>
            <Btn onClick={() => go(target ? '/app/history' : '/app')}>رجوع</Btn>
          </div>
        </Card>
      </div>

      {newBen && <NewBeneficiary onClose={() => setNewBen(false)} onSave={b => { setBen(b); setChannel('beneficiary'); setNewBen(false); }} />}
    </Shell>
  );
}

// ---------- الإيصال ----------
// «20:09» ← «8:09 م»
const time12 = t => { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'ص' : 'م'}`; };
export function ReceiptPage({ path }) {
  const { view, payment: todayPayment, selfPaid, nextDue } = useStore();
  const [copied, setCopied] = useState(false);
  // /app/receipt/2026-03-22: إيصال زكاة سابقة أُخرجت عبر نماء
  const pastDate = path.startsWith('/app/receipt/') ? path.split('/').pop() : null;
  const payment = pastDate ? selfPaid[pastDate]?.receipt : todayPayment;
  if (!payment) {
    return (
      <Shell path={path} title="إيصال الإخراج">
        <Card><div className="col" style={{ gap: 12, alignItems: 'flex-start' }}><p className="sub">لا يوجد سداد مسجل، فلا يوجد إيصال.</p><Btn variant="primary" onClick={() => go('/app/payout')}>إخراج الزكاة</Btn></div></Card>
      </Shell>
    );
  }
  const ch = channelOf(payment.channel);
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
            <h2 className="b7" style={{ fontSize: 20 }}>{payment.channel === 'self' ? 'سجّلنا إخراج الزكاة' : payment.channel === 'zakati' ? 'أُخرجت عبر «زكاتي»' : 'تم إخراج الزكاة'}</h2>
            <p className="t13 sub">تقبّل الله منك</p>
            <div className="w-amount md"><strong>{plain(payment.amount)}</strong><span>ر.س</span></div>
          </div>
          <div style={{ padding: '4px 24px' }} className="w-divide">
            <div className="w-line"><span>الرقم المرجعي</span><span className="row ltr" style={{ gap: 6 }}><button onClick={() => { navigator.clipboard?.writeText(payment.ref); setCopied(true); }} aria-label="نسخ"><Icon as={Copy} size={14} /></button>{payment.ref}</span></div>
            <div className="w-line"><span>التاريخ والوقت</span><span>{gregText(payment.date)} · {time12(payment.time)}</span></div>
            {(payment.channel === 'charity' || payment.channel === 'beneficiary') && <div className="w-line"><span>من حساب</span><span>{acc.short} {acc.kind} · {acc.mask} ••••</span></div>}
            <div className="w-line"><span>إلى</span><span>{payment.beneficiary ?? ch.to}</span></div>
            {payment.category && <div className="w-line"><span>المصرف</span><span>{payment.category}</span></div>}
            <div className="w-line"><span>الغرض</span><span>زكاة مال {payment.dueDate ? `وجبت ${hijriText(payment.dueDate)}` : `${y}هـ`}</span></div>
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
            {!payment.dueDate && (<div className="w-list-row"><span className="w-ico ok"><Icon as={CalendarPlus} /></span><span className="grow"><span className="t" style={{ display: 'block' }}>بدأ حول جديد</span><span className="d">لمبلغ {plain(payment.base)} ر.س من اليوم، ويكتمل في {nextHawl ? hijriText(nextHawl) : ''}</span></span></div>)}
            {nextDue && <div className="w-list-row"><span className="w-ico sel"><Icon as={CalendarClock} /></span><span className="grow"><span className="t" style={{ display: 'block' }}>الوجوب القادم بعد {days(nextDue.inDays)}</span><span className="d">{hijriText(nextDue.date)} · {sar(nextDue.zakat)}</span></span></div>}
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
