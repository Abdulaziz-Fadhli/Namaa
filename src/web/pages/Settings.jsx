// الإعدادات (المنهجية تعيد تشغيل المحرك فعليًا)، والإشعارات، وربط بنك جديد.
import { useState } from 'react';
import {
  Bell, BookOpen, Building2, Check, CheckCheck, ChevronLeft, CircleCheck, FileText, Info, Landmark, LockKeyhole,
  Receipt, RefreshCw, Scale, Search, ShieldCheck, UserRound,
} from 'lucide-react';
import { Btn, Card, Icon, Modal, Option, Pill, Seg, Switch, TextInput } from '../kit.jsx';
import { go } from '../nav.js';
import { Shell, SignOut } from '../Shell.jsx';
import { useStore } from '../../figma/model.js';
import { gregShort, hijriText } from '../../figma/format.js';
import { ZATCA } from '../../engine/zatca.js';
import { ACCOUNTS, BANKS, hijriFromParts, plain, sar } from '../data.js';

const MENU = [
  ['profile', 'الملف الشخصي', UserRound],
  ['methodology', 'منهجية الحساب', Scale],
  ['linked', 'الحسابات المرتبطة', Landmark],
  ['security', 'الأمان وتسجيل الدخول', LockKeyhole],
  ['alerts', 'التنبيهات', Bell],
  ['terms', 'الشروط والخصوصية', FileText],
];

function Methodology() {
  const { view, settings, setSettings, due } = useStore();
  const [draft, setDraft] = useState({ acquiredMoneyMode: settings.acquiredMoneyMode, spendOrder: settings.spendOrder });
  const [saved, setSaved] = useState(null);
  const changed = draft.acquiredMoneyMode !== settings.acquiredMoneyMode || draft.spendOrder !== settings.spendOrder;
  const save = () => { const before = due.zakat; setSettings(draft); setSaved({ before }); };
  const nisabMetal = view.nisabByMetal.silver <= view.nisabByMetal.gold ? 'فضة' : 'ذهب';
  return (
    <Card title="منهجية الحساب" desc="تغيّر هذه الإعدادات طريقة حساب زكاتك من الآن فصاعدًا"
      action={<Pill>محفوظة · وفق دليل هيئة الزكاة</Pill>}>
      {saved && !changed && (
        <div className="w-toast" role="status" style={{ marginBottom: 16 }}>
          <Icon as={Check} className="green" />
          <span>تم حفظ المنهجية · أعدنا تشغيل المحرك على حساباتك: {due.today
            ? `زكاة اليوم ${sar(due.zakat)}${Math.abs(saved.before - due.zakat) < 0.005 ? '، ولم يتغيّر المبلغ المستحق' : ` بدل ${sar(saved.before)}`}.`
            : `لا زكاة واجبة اليوم بهذه المنهجية، والوجوب القادم ${view.nextDue ? `في ${hijriFromParts(view.nextDue.hijri)}: ${sar(view.nextDue.zakat)}` : 'غير محدد'}.`}</span>
        </div>
      )}
      <div className="w-divide">
        <div style={{ padding: '4px 0 20px' }}>
          <h3 className="t15 b7">أساس النصاب</h3>
          <p className="t12 sub" style={{ marginBottom: 12 }}>أدنى النصابين كما في دليل هيئة الزكاة · اليوم {plain(view.nisab)} ر.س</p>
          <Option selected title="أدنى النصابين من الذهب أو الفضة" desc={`معتمد في دليل هيئة الزكاة §2.2.4 · ${nisabMetal === 'فضة' ? '595 غ فضة' : '85 غ ذهب'} اليوم`} />
        </div>
        <div style={{ padding: '20px 0' }}>
          <h3 className="t15 b7">حول المال المستفاد</h3>
          <p className="t12 sub" style={{ marginBottom: 12 }}>كيف يُحسب حول المبالغ التي تدخل حسابك خلال السنة</p>
          <div className="w-grid2 stack-xs">
            <Option selected={draft.acquiredMoneyMode === 'INDEPENDENT_HAWL'} onClick={() => setDraft(d => ({ ...d, acquiredMoneyMode: 'INDEPENDENT_HAWL' }))}
              title="حول مستقل لكل مبلغ" desc="من يوم دخوله · دليل هيئة الزكاة §2.2.5.1" />
            <Option selected={draft.acquiredMoneyMode === 'ANNUAL_ADVANCE'} onClick={() => setDraft(d => ({ ...d, acquiredMoneyMode: 'ANNUAL_ADVANCE' }))}
              title="يوم واحد في السنة لكل المال" desc="ما لم يحل حوله يُعجَّل · دليل الهيئة §3.3" />
          </div>
        </div>
        <div style={{ padding: '20px 0' }}>
          <h3 className="t15 b7">ترتيب الصرف</h3>
          <p className="t12 sub" style={{ marginBottom: 12 }}>أي المبالغ نعتبرها صُرفت أولًا عند السحب</p>
          <div className="w-grid2 stack-xs">
            <Option selected={draft.spendOrder === 'LIFO'} onClick={() => setDraft(d => ({ ...d, spendOrder: 'LIFO' }))} title="الأحدث أولًا" desc="يبقى المال الأقدم ويكمل حوله" />
            <Option selected={draft.spendOrder === 'FIFO'} onClick={() => setDraft(d => ({ ...d, spendOrder: 'FIFO' }))} title="الأقدم أولًا" desc="يُصرف المال الأقدم قبل غيره" />
          </div>
        </div>
        <div style={{ padding: '20px 0 8px' }}>
          <h3 className="t15 b7" style={{ marginBottom: 4 }}>مصادر البيانات</h3>
          <div className="w-line"><span>المنهجية الشرعية</span><span>أدلة هيئة الزكاة والضريبة والجمارك</span></div>
          <div className="w-line"><span>التقويم</span><span>هجري · أم القرى</span></div>
          <div className="w-line"><span>أسعار الذهب والفضة</span><span>gold-api.com · تُحدَّث عند كل فتح</span></div>
          <div className="w-line"><span>الأسهم والصناديق الأمريكية</span><span>Finnhub · متأخرة حتى 15 دقيقة</span></div>
        </div>
      </div>
      <div className="between" style={{ borderTop: '1px solid var(--line)', paddingTop: 16, marginTop: 8, flexWrap: 'wrap' }}>
        <span className="w-note"><Icon as={Info} size={14} />{ZATCA.short} · الحساب استرشادي</span>
        <div className="row">
          <Btn onClick={() => setDraft({ acquiredMoneyMode: settings.acquiredMoneyMode, spendOrder: settings.spendOrder })} disabled={!changed}>إلغاء</Btn>
          <Btn variant="primary" onClick={save} disabled={!changed}>حفظ التغييرات</Btn>
        </div>
      </div>
      <p className="t11 muted" style={{ marginTop: 12 }}>{ZATCA.statement} {ZATCA.disclaimer}</p>
    </Card>
  );
}

function Linked() {
  const { view, pendingBanks } = useStore();
  const [confirm, setConfirm] = useState(null);
  const [unlinked, setUnlinked] = useState([]);
  return (
    <Card title="الحسابات المرتبطة" desc="عبر الخدمات المصرفية المفتوحة · قراءة فقط" action={<Btn className="sm" onClick={() => go('/app/link')}>ربط بنك</Btn>}>
      <div className="w-divide">
        {view.accounts.filter(a => !unlinked.includes(a.id)).map(a => (
          <div key={a.id} className="w-list-row">
            <span className="w-ico"><Icon as={a.id === 'A1' ? Landmark : Building2} /></span>
            <span className="grow">
              <span className="t" style={{ display: 'block' }}>{a.exempt ? `محفظة ${a.product}` : `${ACCOUNTS[a.id].bank} · ${ACCOUNTS[a.id].kind}`}</span>
              <span className="d">موافقة سارية حتى 3 أكتوبر 2027 · محدّث اليوم {ACCOUNTS[a.id].synced}</span>
            </span>
            <Btn variant="ghost" onClick={() => setConfirm(a)}>إلغاء الربط</Btn>
          </div>
        ))}
        {pendingBanks.map(b => (
          <div key={b} className="w-list-row">
            <span className="w-ico"><Icon as={Building2} /></span>
            <span className="grow"><span className="t" style={{ display: 'block' }}>{b}</span><span className="d">تمت الموافقة · نقرأ الحركات الآن</span></span>
            <Pill tone="info">قيد القراءة</Pill>
          </div>
        ))}
      </div>
      {confirm && (
        <Modal size="sm" title={`إلغاء ربط ${ACCOUNTS[confirm.id].bank}؟`} onClose={() => setConfirm(null)}
          foot={<><Btn onClick={() => setConfirm(null)}>تراجع</Btn><Btn variant="primary" onClick={() => { setUnlinked(u => [...u, confirm.id]); setConfirm(null); }}>إلغاء الربط</Btn></>}>
          <p className="t13 sub">نحذف بيانات الحساب من نماء ونوقف القراءة فورًا. في نسخة العرض يبقى الحساب في الحساب الزكوي حتى لا تتغير أرقام أحمد.</p>
        </Modal>
      )}
    </Card>
  );
}

function ToggleRow({ on, onChange, title, desc }) {
  return (
    <div className="between" style={{ padding: '14px 0' }}>
      <span><span className="b6" style={{ display: 'block' }}>{title}</span>{desc && <span className="t12 sub">{desc}</span>}</span>
      <Switch on={on} onChange={onChange} label={title} />
    </div>
  );
}

function Simple({ id }) {
  const [t, setT] = useState({ face: true, twofa: true, before3: true, onDue: true, nisab: true, monthly: false, push: true, email: true, sms: false });
  const tog = k => v => setT(s => ({ ...s, [k]: v }));
  if (id === 'profile') return (
    <Card title="الملف الشخصي" desc="بياناتك الأساسية">
      <div className="col" style={{ gap: 14 }}>
        <TextInput label="الاسم الكامل" value="أحمد عبدالله السبيعي" onChange={() => {}} />
        <TextInput label="البريد الإلكتروني" value="ahmad.alsubaie@gmail.com" onChange={() => {}} dir="ltr" />
        <TextInput label="رقم الجوال" value="+966 55 012 3447" onChange={() => {}} dir="ltr" />
      </div>
    </Card>
  );
  if (id === 'security') return (
    <Card title="الأمان وتسجيل الدخول" desc="تحكم في طريقة الدخول والأجهزة">
      <div className="w-divide">
        <ToggleRow on={t.face} onChange={tog('face')} title="الدخول ببصمة الوجه" desc="على هذا الجهاز" />
        <ToggleRow on={t.twofa} onChange={tog('twofa')} title="رمز تحقق عند كل إخراج" desc="مطلوب دائمًا للتحويل" />
        <div className="between" style={{ padding: '14px 0' }}><span><span className="b6" style={{ display: 'block' }}>الأجهزة المسجّلة</span><span className="t12 sub">آيفون 15 · ماك بوك · آخر دخول اليوم</span></span><Btn variant="ghost">إدارة</Btn></div>
      </div>
    </Card>
  );
  if (id === 'alerts') return (
    <Card title="التنبيهات" desc="تصلك التنبيهات قبل الوجوب حتى تستعد">
      <div className="w-divide">
        <ToggleRow on={t.before3} onChange={tog('before3')} title="قبل الوجوب بـ 3 أيام" desc="مع المبلغ المتوقع" />
        <ToggleRow on={t.onDue} onChange={tog('onDue')} title="يوم الوجوب" desc="حين يكتمل حول أي مبلغ" />
        <ToggleRow on={t.nisab} onChange={tog('nisab')} title="تغيّر النصاب" desc="إذا تغيّر بأكثر من 5٪" />
        <ToggleRow on={t.monthly} onChange={tog('monthly')} title="ملخص شهري" desc="أول كل شهر هجري" />
      </div>
    </Card>
  );
  return (
    <Card title="الشروط والخصوصية">
      <div className="col t13 sub" style={{ gap: 12 }}>
        <p>{ZATCA.statement}</p>
        <p>{ZATCA.disclaimer}</p>
        <p>نقرأ أرصدتك وحركاتك بموافقتك عبر الخدمات المصرفية المفتوحة، ولا نشارك بياناتك مع أي طرف، ولا نحوّل أي مبلغ إلا برمز تحقق منك.</p>
      </div>
    </Card>
  );
}

export function SettingsPage({ path }) {
  const id = path.split('/')[3] || 'methodology';
  const { view } = useStore();
  return (
    <Shell path={path} title="الإعدادات" desc="منهجية الحساب، والحسابات، والأمان، والتنبيهات">
      <div className="w-cols c-settings">
        <div className="col" style={{ gap: 16 }}>
          <Card>
            <div className="row">
              <span className="w-avatar" style={{ width: 48, height: 48, fontSize: 15 }}>أس</span>
              <span><span className="b7" style={{ display: 'block' }}>أحمد عبدالله السبيعي</span><span className="t12 sub ltr">+966 55 012 3447</span></span>
            </div>
          </Card>
          <Card>
            <div className="col" style={{ gap: 4, margin: -12 }}>
              {MENU.map(([k, l, ic]) => (
                <button key={k} className="row" onClick={() => go(`/app/settings/${k}`)}
                  style={{ height: 42, padding: '0 12px', borderRadius: 10, background: id === k ? 'var(--sel)' : undefined, fontWeight: id === k ? 700 : 500 }}>
                  <Icon as={ic} /><span className="grow">{l}</span>
                  {k === 'linked' && <Pill>{view.accounts.filter(a => !a.exempt).length}</Pill>}
                  <Icon as={ChevronLeft} size={14} className="muted" />
                </button>
              ))}
            </div>
          </Card>
          <SignOut />
        </div>
        <div>{id === 'methodology' ? <Methodology /> : id === 'linked' ? <Linked /> : <Simple id={id} />}</div>
      </div>
    </Shell>
  );
}

// ---------- الإشعارات: مبنية من أحداث المحرك ----------
export function Notifications({ path }) {
  const { view, due, payment } = useStore();
  const [tab, setTab] = useState('all');
  const [read, setRead] = useState(false);
  const [prefs, setPrefs] = useState({ before3: true, onDue: true, nisab: true, monthly: false, push: true, email: true, sms: false });
  const last = view.dues.filter(d => d.date !== view.today).at(-1);
  const series = view.series;
  const weekAgo = series.at(-2);
  const items = [
    payment && { g: 'today', type: 'zakat', icon: CircleCheck, tone: 'ok', title: `أخرجت زكاة ${sar(payment.amount)}`, desc: `الرقم المرجعي ${payment.ref}`, time: payment.time, unread: !read, action: ['الإيصال', '/app/receipt'] },
    due.today && !payment && { g: 'today', type: 'zakat', icon: Receipt, tone: 'warn', title: `وجبت زكاة ${sar(due.zakat)}`, desc: `اكتمل حول ${plain(due.base)} ر.س دخلت حسابك قبل سنة هجرية.`, time: '9:00 ص', unread: !read, action: ['إخراج الزكاة', '/app/payout'] },
    { g: 'today', type: 'account', icon: RefreshCw, title: 'حدّثنا أرصدتك', desc: `مزامنة ${view.accounts.filter(a => !a.exempt).map(a => ACCOUNTS[a.id].bank).join(' و')} · الوعاء الآن ${sar(view.total)}.`, time: '9:41 ص', unread: !read },
    view.nextDue && { g: 'week', type: 'zakat', icon: Bell, title: `بعد ${view.nextDue.inDays} يومًا تجب زكاة ${sar(view.nextDue.zakat)}`, desc: `في ${hijriFromParts(view.nextDue.hijri)} إذا بقي رصيدك فوق النصاب.`, time: gregShort(view.today) },
    weekAgo && { g: 'week', type: 'zakat', icon: Scale, title: `النصاب اليوم ${sar(view.nisab)}`, desc: `595 غ فضة × ${plain(view.prices.silverPerGram, 4)} ر.س · أدنى النصابين كما في دليل الهيئة.`, time: gregShort(weekAgo.date) },
    last && { g: 'older', type: 'zakat', icon: CircleCheck, title: `وجبت زكاة ${sar(last.zakat)}`, desc: `اكتمل حول ${plain(last.base)} ر.س في ${hijriFromParts(last.hijri)}.`, time: gregShort(last.date) },
  ].filter(Boolean).filter(n => tab === 'all' || n.type === tab);
  const groups = [['today', `اليوم · ${hijriText(view.today)}`], ['week', 'هذا الأسبوع'], ['older', 'سابقًا']];
  const unread = items.filter(n => n.unread).length;
  return (
    <Shell path={path} title="الإشعارات" desc={unread ? `${unread === 2 ? 'تنبيهان جديدان' : `${unread} تنبيهات جديدة`}` : 'لا تنبيهات جديدة'}>
      <div className="w-cols c-wide">
        <Card flush>
          <div className="between" style={{ padding: '18px 24px' }}>
            <Seg value={tab} onChange={setTab} options={[{ value: 'all', label: 'الكل' }, { value: 'zakat', label: 'الزكاة' }, { value: 'account', label: 'الحساب' }]} label="النوع" />
            <Btn variant="ghost" icon={CheckCheck} onClick={() => setRead(true)} disabled={!unread}>تعليم الكل كمقروء</Btn>
          </div>
          {groups.map(([g, label]) => {
            const list = items.filter(n => n.g === g);
            if (!list.length) return null;
            return (
              <div key={g}>
                <div className="t12 sub" style={{ background: 'var(--soft)', padding: '8px 24px' }}>{label}</div>
                {list.map((n, i) => (
                  <div key={i} className="w-list-row" style={{ padding: '16px 24px', borderTop: '1px solid var(--line)', background: n.unread ? '#FBFCFD' : undefined, alignItems: 'flex-start' }}>
                    <span className={`w-ico ${n.tone ?? ''}`}><Icon as={n.icon} /></span>
                    <span className="grow">
                      <span className="t" style={{ display: 'block' }}>{n.title}</span>
                      <span className="d">{n.desc}</span>
                    </span>
                    <span className="col" style={{ alignItems: 'flex-end', gap: 8 }}>
                      <span className="t11 muted row" style={{ gap: 6 }}>{n.unread && <i style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--red)', display: 'inline-block' }} />}{n.time}</span>
                      {n.action && <Btn variant="primary" className="sm" onClick={() => go(n.action[1])}>{n.action[0]}</Btn>}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </Card>
        <Card title="متى ننبهك" desc="تصلك التنبيهات قبل الوجوب حتى تستعد">
          <div className="w-divide">
            {[['before3', 'قبل الوجوب بـ 3 أيام', 'مع المبلغ المتوقع'], ['onDue', 'يوم الوجوب', 'حين يكتمل حول أي مبلغ'], ['nisab', 'تغيّر النصاب', 'إذا تغيّر بأكثر من 5٪'], ['monthly', 'ملخص شهري', 'أول كل شهر هجري']].map(([k, t, d]) => (
              <div key={k} className="between" style={{ padding: '12px 0' }}>
                <span><span className="b6" style={{ display: 'block' }}>{t}</span><span className="t12 sub">{d}</span></span>
                <Switch on={prefs[k]} onChange={v => setPrefs(p => ({ ...p, [k]: v }))} label={t} />
              </div>
            ))}
          </div>
          <h3 className="t15 b7" style={{ margin: '16px 0 4px' }}>القنوات</h3>
          <div className="w-divide">
            {[['push', 'إشعارات المتصفح والجوال', ''], ['email', 'البريد الإلكتروني', 'ahmad.alsubaie@gmail.com'], ['sms', 'رسالة نصية', '•••• 47']].map(([k, t, d]) => (
              <div key={k} className="between" style={{ padding: '12px 0' }}>
                <span><span className="b6" style={{ display: 'block' }}>{t}</span>{d && <span className="t12 sub ltr">{d}</span>}</span>
                <Switch on={prefs[k]} onChange={v => setPrefs(p => ({ ...p, [k]: v }))} label={t} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Shell>
  );
}

// ---------- ربط بنك جديد: اختيار ← موافقة ← تم ----------
export function LinkBank({ inline }) {
  const { pendingBanks, addBank } = useStore();
  const [q, setQ] = useState('');
  const [bank, setBank] = useState(null);
  const [stage, setStage] = useState('pick');
  const linked = ['مصرف الإنماء', 'البنك الأهلي السعودي', ...pendingBanks];
  const list = BANKS.filter(b => b.includes(q.trim()));
  const body = (
    <Card title="ربط حساب بنكي" desc="اختر بنكك، نقرأ الأرصدة والحركات فقط">
      <TextInput value={q} onChange={setQ} icon={Search} placeholder="ابحث باسم البنك" />
      <div className="w-divide" style={{ marginTop: 12 }}>
        {list.map(b => (
          <div key={b} className="w-list-row">
            <span className="w-ico"><Icon as={Landmark} /></span>
            <span className="grow"><span className="t" style={{ display: 'block' }}>{b}</span><span className="d">{linked.includes(b) ? 'مرتبط' : 'متاح للربط'}</span></span>
            {linked.includes(b) ? <Pill tone="ok"><Icon as={Check} size={12} /> مرتبط</Pill> : <Btn className="sm" onClick={() => { setBank(b); setStage('consent'); }}>ربط</Btn>}
          </div>
        ))}
      </div>
      <p className="w-note" style={{ marginTop: 12 }}><Icon as={ShieldCheck} size={14} className="green" />الربط عبر إطار المصرفية المفتوحة، والموافقة تتم داخل تطبيق بنكك.</p>
    </Card>
  );
  return (
    <>
      {inline ? body : <Shell path="/app/assets" title="ربط حساب بنكي" desc="أضف حسابات بنك آخر ليكتمل وعاؤك">{body}</Shell>}
      {stage === 'consent' && bank && (
        <Modal size="sm" title="موافقة مشاركة البيانات" desc={`${bank} · حسابات الأفراد`} onClose={() => setStage('pick')}
          foot={<><Btn onClick={() => setStage('pick')}>إلغاء</Btn><Btn variant="primary" onClick={() => { addBank(bank); setStage('done'); }}>متابعة إلى {bank}</Btn></>}>
          <div className="w-banner info" style={{ alignItems: 'flex-start' }}><Icon as={BookOpen} /><span><b>ما سيقرأه نماء:</b> اسم الحساب ونوعه وآخر 4 أرقام منه، والأرصدة الحالية، والحركات لآخر 24 شهرًا لحساب حول كل مبلغ.</span></div>
          <div className="w-banner ok" style={{ alignItems: 'flex-start' }}><Icon as={LockKeyhole} /><span><b>ما لن يفعله نماء:</b> لن يحوّل أي مبلغ من حسابك، ولن يرى اسم المستخدم أو كلمة المرور في بنكك، ولن يشارك بياناتك مع أي جهة.</span></div>
          <div className="w-line"><span>مدة الموافقة</span><span>12 شهرًا · حتى 3 أكتوبر 2027</span></div>
        </Modal>
      )}
      {stage === 'done' && bank && (
        <Modal size="sm" onClose={() => setStage('pick')}
          foot={<><Btn onClick={() => setStage('pick')}>ربط بنك آخر</Btn><Btn variant="primary" onClick={() => { setStage('pick'); if (!inline) go('/app/assets'); }}>تم</Btn></>}>
          <div className="col" style={{ alignItems: 'center', textAlign: 'center', gap: 8, paddingTop: 12 }}>
            <span className="w-ico ok" style={{ width: 52, height: 52, borderRadius: 99 }}><Icon as={Check} size={24} /></span>
            <h2 className="b7" style={{ fontSize: 20 }}>تمت الموافقة على ربط {bank}</h2>
            <p className="t13 sub">نقرأ حركات آخر 24 شهرًا الآن، ثم نضيف رصيده لوعائك ونحسب حول كل مبلغ فيه. نرسل لك إشعارًا عند الانتهاء.</p>
          </div>
        </Modal>
      )}
    </>
  );
}
