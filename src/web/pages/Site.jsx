// الموقع العام: الصفحة الرئيسية، وتسجيل الدخول وإنشاء الحساب وتأكيد البريد، والتهيئة بثلاث خطوات.
// أرقام البطاقات من المحرك نفسه (زكاة أحمد اليوم، الوعاء، النصاب، الوجوب القادم).
import { useEffect, useState } from 'react';
import {
  ArrowRight, CalendarClock, CalendarDays, Check, ChevronDown, CircleCheck, Eye, EyeOff, FileText, Info, Landmark, Layers3,
  LockKeyhole, Plus, RefreshCw, Scale, Search, ShieldCheck, X,
} from 'lucide-react';
import { Brand, Btn, Checkbox, Icon, Option, Otp, Pill, Select, Seg, Steps, TextInput } from '../kit.jsx';
import { go } from '../nav.js';
import { useStore } from '../../figma/model.js';
import { gregText, hijriMonthLength, hijriText, hijriToIso, HIJRI_MONTHS } from '../../figma/format.js';
import { BANKS, hijriFromParts, plain, sar } from '../data.js';
import { ZATCA } from '../../engine/zatca.js';

function ZakatCard({ compact }) {
  const { view } = useStore();
  const due = view.due;
  return (
    <div className={compact ? 'w-auth-card' : 'w-hero-card'}>
      <div className="between" style={{ marginBottom: 8 }}>
        <span className="t13 sub">زكاة المال{compact ? '' : ` · ${view.name}`}</span>
        {due && <Pill tone="warn">مستحقة اليوم</Pill>}
      </div>
      <div className="w-amount md"><strong>{plain(due?.zakat ?? 0)}</strong><span>ر.س</span></div>
      <p className="t12 muted" style={{ marginBottom: compact ? 0 : 12 }}>
        {compact ? `على ${plain(due?.base ?? 0)} ر.س أكملت حولها في ${hijriText(view.today)}.` : `${hijriText(view.today)} · ${gregText(view.today)}`}
      </p>
      {!compact && (
        <div className="w-divide">
          <div className="w-line"><span>مبالغ أكملت حولًا هجريًا</span><span>{sar(due?.base ?? 0)}</span></div>
          <div className="w-line"><span>إجمالي الوعاء</span><span>{sar(view.total)}</span></div>
          <div className="w-line"><span>النصاب اليوم (فضة)</span><span>{sar(view.nisab)}</span></div>
        </div>
      )}
    </div>
  );
}

const FAQ = [
  ['هل يستطيع نماء تحويل أموالي؟', 'لا. الربط بصلاحية قراءة فقط، وأي إخراج للزكاة يتم بتأكيد منك ورمز تحقق يرسله بنكك.'],
  ['كيف تحسبون الحول إذا كان دخلي يتغير كل شهر؟', 'لكل مبلغ يدخل حسابك حوله المستقل من يوم دخوله، كما في دليل هيئة الزكاة (§2.2.5.1). ولك أن تختار يومًا واحدًا في السنة تزكّي فيه كل المال، فيُعجَّل ما لم يحل حوله (§3.3).'],
  ['هل أزكي على أسهم الشركات السعودية؟', 'إن كنت مستثمرًا فلا، لأن هيئة الزكاة تجبي زكاة الشركات المساهمة في المملكة، فيكفيك إخراج الشركة عنك (§3.6). أما المضارب فيزكي القيمة السوقية.'],
  ['هل يحسب نماء زكاة المواشي والمحاصيل؟', 'نعم. الإبل والبقر والغنم بجداول الهيئة، والحبوب والثمار بنصاب خمسة أوسق، وزكاتها من جنسها وتُدفع عبر بوابة الهيئة.'],
  ['ماذا لو لم أتذكر تاريخ آخر زكاة أخرجتها؟', 'نبدأ الحساب من أول يوم بلغ فيه مالك النصاب حسب كشف حساباتك.'],
  ['هل الخدمة مجانية؟', 'نعم، الحساب والتذكير مجانيان، ولا رسوم على إخراج الزكاة.'],
];

export function Landing() {
  const { view } = useStore();
  const [open, setOpen] = useState(0);
  const next = view.nextDue;
  return (
    <div className="w w-site">
      <header className="w-nav-wrap">
        <div className="w-wrap w-nav" style={{ borderBottom: 0 }}>
          <Brand />
          <nav className="links">
            <a href="#features" onClick={e => { e.preventDefault(); document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }); }}>المزايا</a>
            <a href="#how" onClick={e => { e.preventDefault(); document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' }); }}>كيف يعمل</a>
            <a href="#method" onClick={e => { e.preventDefault(); document.getElementById('method')?.scrollIntoView({ behavior: 'smooth' }); }}>المنهجية</a>
            <a href="#faq" onClick={e => { e.preventDefault(); document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' }); }}>الأسئلة الشائعة</a>
          </nav>
          <div className="row">
            <Btn variant="primary" className="sm w-hide-m" onClick={() => go('/register')}>إنشاء حساب</Btn>
            <Btn className="sm" onClick={() => go('/login')}>تسجيل الدخول</Btn>
          </div>
        </div>
      </header>

      <section className="w-hero">
        <div className="w-wrap">
          <div>
            <Pill tone="info">لعملاء البنوك في السعودية</Pill>
            <h1 style={{ marginTop: 14 }}>زكاة أموالك محسوبة بدقة،<br />كل مبلغ في حوله</h1>
            <p className="lead">نماء يقرأ حساباتك البنكية بصلاحية قراءة فقط، ويتابع حول كل مبلغ من يوم دخوله حسابك، ثم يخبرك متى تجب الزكاة وكم مقدارها بالهللة.</p>
            <div className="row" style={{ gap: 12 }}>
              <Btn variant="primary" className="lg" onClick={() => go('/register')}>ابدأ مجانًا</Btn>
              <Btn className="lg" onClick={() => go('/app')}>شاهد كيف يعمل</Btn>
            </div>
            <div className="w-trust">
              <span><Icon as={Check} size={14} className="green" />صلاحية قراءة فقط</span>
              <span><Icon as={LockKeyhole} size={14} className="green" />بيانات مشفّرة</span>
              <span><Icon as={ShieldCheck} size={14} className="green" />وفق منهجية هيئة الزكاة والضريبة والجمارك</span>
            </div>
          </div>
          <div className="col" style={{ gap: 12 }}>
            <ZakatCard />
            {next && (
              <div className="w-hero-card row" style={{ padding: 16, maxWidth: 360 }}>
                <span className="w-ico"><Icon as={CalendarClock} /></span>
                <span><span className="b7 t13" style={{ display: 'block' }}>الوجوب القادم بعد {next.inDays} يومًا</span><span className="t11 sub">{hijriFromParts(next.hijri)} · {sar(next.zakat)}</span></span>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="w-banks"><div className="w-wrap"><span>يعمل مع البنوك المرخّصة للخدمات المصرفية المفتوحة:</span>{BANKS.map(b => <span key={b}>{b}</span>)}</div></div>

      <section className="w-section" id="how">
        <div className="w-wrap">
          <p className="w-eyebrow">كيف يعمل</p>
          <h2>ثلاث خطوات وتعرف زكاتك</h2>
          <div className="w-grid3">
            {[['ربط حساباتك', 'عبر الخدمات المصرفية المفتوحة بموافقة قراءة فقط لمدة 12 شهرًا، وتلغيها متى شئت.'],
              ['أضف ما خارج البنوك', 'الذهب والفضة والأسهم والصناديق والنقد والعقار المعد للبيع والمواشي والمحاصيل، بتاريخ تملك كل أصل.'],
              ['اعرف موعدك ومقدارك', 'نحسب حول كل مبلغ على حدة، وننبهك قبل الوجوب بثلاثين يومًا ثم بسبعة أيام.']].map(([t, d], i) => (
              <div key={t} className="w-feature" style={{ background: 'var(--bg)', border: 0 }}>
                <span className="w-step-n">{i + 1}</span><h3>{t}</h3><p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="w-section gray" id="features">
        <div className="w-wrap">
          <p className="w-eyebrow">المزايا</p>
          <h2>مصمم لطريقة دخلك الحقيقية</h2>
          <div className="w-grid3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            {[[Scale, 'النصاب بسعر اليوم', `نحدّث النصاب يوميًا بأدنى النصابين: 85 غرام ذهب أو 595 غرام فضة.`, `نصاب اليوم ${sar(view.nisab)}`],
              [CalendarDays, 'حول مستقل لكل مبلغ', 'الراتب الذي دخل حسابك في شوال لا يُزكّى مع مبلغ دخل في رمضان. لكل مبلغ تاريخه وحوله.', `${sar(view.due?.base ?? 0)} أكملت حولها اليوم`],
              [Layers3, 'الأسهم والذهب والمواشي', 'نعرف إن كانت الشركة تزكي عنك، ونحسب الذهب والفضة بسعر السوق، والأنعام والزروع بجداول الهيئة.', 'سهم الراجحي للمستثمر: الشركة تزكي عنه'],
              [FileText, 'إخراج وإيصال موثّق', 'أخرج زكاتك لجهة مرخّصة من حسابك، واحتفظ بإيصال فيه الرقم المرجعي والتاريخ.', 'المرجع NM-261003-4236']].map(([ic, t, d, tag]) => (
              <div key={t} className="w-feature">
                <span className="w-ico"><Icon as={ic} /></span><h3>{t}</h3><p>{d}</p>
                <span className="w-pill" style={{ alignSelf: 'flex-start' }}>{tag}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="w-section dark" id="method">
        <div className="w-wrap w-grid3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 48, alignItems: 'center' }}>
          <div>
            <p className="w-eyebrow" style={{ color: '#9DB3C4' }}>المنهجية</p>
            <h2 style={{ marginBottom: 16 }}>منهجية واضحة تقدر تراجعها بنفسك</h2>
            <p style={{ color: '#DCE5EC', lineHeight: '28px' }}>{ZATCA.statement} نحسب حول كل مبلغ من يوم تملكه، ونعرض لك طريقة الحساب سطرًا بسطر: كم في الوعاء، وكم أكمل حوله، وكيف خرج المبلغ.</p>
            <p className="t12" style={{ color: '#9DB3C4', marginTop: 12 }}>{ZATCA.disclaimer}</p>
          </div>
          <div className="col" style={{ gap: 12 }}>
            {[[Eye, 'قراءة فقط', 'لا نستطيع تحويل أي مبلغ من حساباتك، الإخراج يتم بتأكيدك وبرمز تحقق من بنكك.'],
              [LockKeyhole, 'بياناتك مشفّرة', 'التشفير أثناء النقل والتخزين، ولا نشارك بياناتك مع أي طرف.'],
              [ShieldCheck, 'تلغي الربط متى شئت', 'من الإعدادات، وتُحذف بيانات الحساب المرتبط فورًا.']].map(([ic, t, d]) => (
              <div key={t} className="w-dark-card"><span className="w-ico"><Icon as={ic} /></span><span><b style={{ display: 'block' }}>{t}</b><span className="t12" style={{ color: '#B9C7D2' }}>{d}</span></span></div>
            ))}
          </div>
        </div>
      </section>

      <section className="w-section" id="faq">
        <div className="w-wrap w-grid3" style={{ gridTemplateColumns: 'minmax(220px, 1fr) minmax(0, 2fr)', gap: 48 }}>
          <div>
            <p className="w-eyebrow">الأسئلة الشائعة</p>
            <h2 style={{ marginBottom: 12 }}>عندك سؤال؟</h2>
            <p className="sub t13">إذا ما لقيت جوابك هنا، راسلنا من داخل التطبيق ونرد خلال يوم عمل.</p>
          </div>
          <div>
            {FAQ.map(([q, a], i) => (
              <div key={q} className="w-faq">
                <button aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
                  <span>{q}</span><Icon as={ChevronDown} style={{ transform: open === i ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
                </button>
                {open === i && <p>{a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="w-section gray" style={{ padding: '56px 0' }}>
        <div className="w-wrap between" style={{ flexWrap: 'wrap' }}>
          <div><h2 style={{ marginBottom: 4, fontSize: 28 }}>جاهز تعرف زكاتك بالضبط؟</h2><p className="sub">إنشاء الحساب يأخذ دقيقة، والربط دقيقتين.</p></div>
          <div className="row"><Btn variant="primary" className="lg" onClick={() => go('/register')}>إنشاء حساب</Btn><Btn className="lg" onClick={() => go('/login')}>تسجيل الدخول</Btn></div>
        </div>
      </section>

      <footer className="w-footer">
        <div className="w-wrap">
          <div className="cols">
            <div><div className="w-brand" style={{ color: '#fff', marginBottom: 12 }}><span>نماء</span></div><p>حاسبة زكاة تقرأ حساباتك البنكية وتتابع حول كل مبلغ، وتخبرك متى تجب الزكاة وكم مقدارها.</p></div>
            <div><h4>المنتج</h4><a href="#features">المزايا</a><a href="#how">كيف يعمل</a><a href="#method">المنهجية</a><a href="#faq">الأسئلة الشائعة</a></div>
            <div><h4>الدعم</h4><a href="#faq">مركز المساعدة</a><a href="#/app/notifications">الدعم داخل التطبيق</a></div>
            <div><h4>قانوني</h4><a href="#/app/settings/terms">الشروط والأحكام</a><a href="#/app/settings/terms">سياسة الخصوصية</a></div>
          </div>
          <div className="legal"><span>© 2026 نماء. نسخة العرض لهاكاثون VentureX.</span><span>الحساب استرشادي ولا يغني عن سؤال أهل العلم.</span></div>
        </div>
      </footer>
    </div>
  );
}

function AuthLayout({ title, lead, children, side }) {
  return (
    <div className="w w-auth">
      <div className="w-auth-form">
        <div className="between"><Brand />{side}</div>
        <div className="inner">
          <h1>{title}</h1>
          {lead && <p className="sub t13">{lead}</p>}
          {children}
        </div>
      </div>
      <aside className="w-auth-side">
        <div><h2>زكاتك بالهللة، وفي موعدها</h2><p>سجّل دخولك وتابع حول كل مبلغ في حساباتك، ومتى تجب زكاته.</p></div>
        <ZakatCard compact />
        <ul>
          <li><Icon as={CircleCheck} size={16} />صلاحية قراءة فقط عبر الخدمات المصرفية المفتوحة</li>
          <li><Icon as={CircleCheck} size={16} />حول مستقل لكل مبلغ وفق دليل هيئة الزكاة</li>
          <li><Icon as={CircleCheck} size={16} />تنبيه قبل الوجوب بـ 30 و7 أيام</li>
        </ul>
      </aside>
    </div>
  );
}

function Password({ value, onChange, label = 'كلمة المرور' }) {
  const [show, setShow] = useState(false);
  return (
    <div className="w-field">
      <label>{label}</label>
      <span className="w-input">
        <input type={show ? 'text' : 'password'} value={value} dir="ltr" aria-label={label} onChange={e => onChange(e.target.value)} />
        <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'إخفاء' : 'إظهار'}><Icon as={show ? EyeOff : Eye} size={16} className="muted" /></button>
      </span>
    </div>
  );
}

export function Login() {
  const [email, setEmail] = useState('ahmad.alsubaie@gmail.com');
  const [pw, setPw] = useState('namaa-demo');
  const [remember, setRemember] = useState(true);
  const ok = /.+@.+\..+/.test(email) && pw.length >= 6;
  return (
    <AuthLayout title="تسجيل الدخول" lead="أهلًا بعودتك. أدخل بريدك وكلمة المرور.">
      <form className="col" style={{ gap: 14 }} onSubmit={e => { e.preventDefault(); if (ok) go('/app'); }}>
        <TextInput label="البريد الإلكتروني" type="email" value={email} onChange={setEmail} dir="ltr" autoComplete="username" />
        <Password value={pw} onChange={setPw} />
        <div className="between"><Checkbox on={remember} onChange={setRemember}>تذكرني على هذا الجهاز</Checkbox><button type="button" className="t13 b6" onClick={() => go('/forgot')}>نسيت كلمة المرور؟</button></div>
        <button type="submit" className="w-btn primary lg" disabled={!ok}>تسجيل الدخول</button>
        <p className="t13 sub" style={{ textAlign: 'center' }}>ليس لديك حساب؟ <button type="button" className="b7" style={{ color: 'var(--ink)' }} onClick={() => go('/register')}>أنشئ حسابًا</button></p>
      </form>
    </AuthLayout>
  );
}

export function Forgot() {
  const [email, setEmail] = useState('ahmad.alsubaie@gmail.com');
  const [sent, setSent] = useState(false);
  return (
    <AuthLayout title="نسيت كلمة المرور" lead="نرسل لك رابطًا لتعيين كلمة مرور جديدة.">
      <TextInput label="البريد الإلكتروني" value={email} onChange={setEmail} dir="ltr" />
      {sent && <div className="w-banner ok"><Icon as={CircleCheck} className="green" />أرسلنا رابط التعيين إلى بريدك. صالح لمدة 30 دقيقة.</div>}
      <Btn variant="primary" className="lg" onClick={() => setSent(true)}>{sent ? 'إعادة الإرسال' : 'إرسال الرابط'}</Btn>
      <Btn icon={ArrowRight} onClick={() => go('/login')}>العودة لتسجيل الدخول</Btn>
    </AuthLayout>
  );
}

export function Register() {
  const [f, setF] = useState({ name: 'أحمد عبدالله السبيعي', email: 'ahmad.alsubaie@gmail.com', phone: '+966 55 012 3447', pw: 'namaa-2026' });
  const [agree, setAgree] = useState(true);
  const set = k => v => setF(s => ({ ...s, [k]: v }));
  const strength = [f.pw.length >= 8, /\d/.test(f.pw), /[a-zA-Z؀-ۿ]/.test(f.pw), f.pw.length >= 12].filter(Boolean).length;
  const ok = f.name.trim().length > 2 && /.+@.+\..+/.test(f.email) && f.pw.length >= 8 && agree;
  return (
    <AuthLayout title="أنشئ حسابك" lead="بعدها نربط حساباتك البنكية بصلاحية قراءة فقط." side={<span className="t12 sub">الخطوة 1 من 3</span>}>
      <form className="col" style={{ gap: 14 }} onSubmit={e => { e.preventDefault(); if (ok) go('/verify'); }}>
        <TextInput label="الاسم الكامل" value={f.name} onChange={set('name')} />
        <TextInput label="البريد الإلكتروني" value={f.email} onChange={set('email')} dir="ltr" help="نرسل لك رابط تأكيد على هذا البريد" />
        <TextInput label="رقم الجوال" value={f.phone} onChange={set('phone')} dir="ltr" help="نستخدمه لرمز التحقق عند إخراج الزكاة فقط" />
        <Password value={f.pw} onChange={set('pw')} />
        <div className="w-strength">{[0, 1, 2, 3].map(i => <i key={i} className={i < strength ? 'on' : ''} />)}</div>
        <Checkbox on={agree} onChange={setAgree}>أوافق على <b>الشروط والأحكام</b> و<b>سياسة الخصوصية</b></Checkbox>
        <button type="submit" className="w-btn primary lg" disabled={!ok}>إنشاء الحساب</button>
        <p className="t13 sub" style={{ textAlign: 'center' }}>لديك حساب؟ <button type="button" className="b7" style={{ color: 'var(--ink)' }} onClick={() => go('/login')}>سجّل الدخول</button></p>
      </form>
    </AuthLayout>
  );
}

export function Verify() {
  const [code, setCode] = useState('7305');
  const [left, setLeft] = useState(42);
  useEffect(() => { const t = setInterval(() => setLeft(s => Math.max(0, s - 1)), 1000); return () => clearInterval(t); }, []);
  return (
    <div className="w" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 16px', gap: 24 }}>
      <Brand />
      <div className="w-card col" style={{ width: 'min(460px, 100%)', gap: 16 }}>
        <button className="row t12 b6" onClick={() => go('/register')}><Icon as={ArrowRight} size={14} />تعديل البريد</button>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>تحقق من بريدك</h1>
        <p className="t13 sub">أرسلنا رمزًا من 6 أرقام إلى <span className="ltr">ahmad.alsubaie@gmail.com</span>. الرمز صالح لمدة 10 دقائق.</p>
        <Otp value={code} onChange={setCode} />
        <Btn variant="primary" className="lg" disabled={code.length < 6} onClick={() => go('/onboarding/banks')}>تأكيد البريد</Btn>
        <div className="w-banner ok t12"><Icon as={CircleCheck} className="green" size={16} />{left ? `لم يصلك الرمز؟ إعادة الإرسال بعد 0:${String(left).padStart(2, '0')}، وتأكد من مجلد الرسائل غير المرغوبة.` : <button className="b7" onClick={() => setLeft(42)}>إعادة إرسال الرمز</button>}</div>
        <p className="t11 muted" style={{ textAlign: 'center' }}>نسخة العرض: أي 6 أرقام تكفي.</p>
      </div>
    </div>
  );
}

// ---------- التهيئة ----------
function Flow({ step, children }) {
  return (
    <div className="w w-flow">
      <header className="w-flow-head">
        <Brand />
        <Steps items={['ربط الحسابات', 'آخر زكاة', 'المزامنة']} current={step} />
        <button className="row t13 sub" onClick={() => go('/app')}><Icon as={X} size={14} />حفظ والخروج</button>
      </header>
      <div className="w-flow-body">{children}</div>
    </div>
  );
}

export function OnboardBanks() {
  const { pendingBanks, addBank } = useStore();
  const [q, setQ] = useState('');
  const [consent, setConsent] = useState(null);
  const linked = ['مصرف الإنماء', 'البنك الأهلي السعودي', ...pendingBanks];
  const masks = { 'مصرف الإنماء': 'حساب جاري · 1842 ••••', 'البنك الأهلي السعودي': 'حساب ادخار · 7730 ••••' };
  return (
    <Flow step={0}>
      <div><h1>اربط حساباتك البنكية</h1><p className="sub">نقرأ أرصدتك وحركاتك لنحسب الوعاء والحول بدقة. لا نستطيع تحريك أموالك.</p></div>
      <TextInput value={q} onChange={setQ} icon={Search} placeholder="ابحث عن بنكك" />
      <div className="w-card" style={{ padding: '4px 20px' }}>
        <div className="w-divide">
          {BANKS.filter(b => b.includes(q.trim())).map(b => (
            <div key={b} className="w-list-row">
              <span className="w-ico"><Icon as={Landmark} /></span>
              <span className="grow"><span className="t" style={{ display: 'block' }}>{b}</span><span className="d">{masks[b] ?? (linked.includes(b) ? 'تمت الموافقة · نقرأ الحركات' : 'متاح للربط')}</span></span>
              {linked.includes(b) ? <Pill tone="ok"><Icon as={Check} size={12} /> مرتبط</Pill> : <Btn className="sm" icon={Plus} onClick={() => setConsent(b)}>ربط</Btn>}
            </div>
          ))}
        </div>
      </div>
      <div className="w-banner info t13"><Icon as={ShieldCheck} />موافقة قراءة فقط لمدة 12 شهرًا عبر الخدمات المصرفية المفتوحة، ويمكنك إلغاؤها في أي وقت من الإعدادات.</div>
      <div className="between">
        <span className="t13 sub">{linked.length} من {BANKS.length} بنوك مرتبطة</span>
        <Btn variant="primary" className="lg" onClick={() => go('/onboarding/last')}>متابعة · {linked.length === 2 ? 'حسابان' : `${linked.length} حسابات`}</Btn>
      </div>
      {consent && (
        <div className="w-modal-back" onMouseDown={e => { if (e.target === e.currentTarget) setConsent(null); }}>
          <div className="w-modal sm" role="dialog" aria-modal="true">
            <div className="w-modal-head"><div><h2>موافقة مشاركة البيانات</h2><p className="t12 sub">{consent} · حسابات الأفراد</p></div><button className="w-x" onClick={() => setConsent(null)} aria-label="إغلاق"><Icon as={X} size={16} /></button></div>
            <div className="w-modal-body">
              <p className="t13">نقرأ اسم الحساب ونوعه، والأرصدة، والحركات لآخر 24 شهرًا. لن نحوّل أي مبلغ، ولن نرى كلمة مرور بنكك.</p>
              <div className="w-line"><span>مدة الموافقة</span><span>12 شهرًا</span></div>
            </div>
            <div className="w-modal-foot"><Btn onClick={() => setConsent(null)}>إلغاء</Btn><Btn variant="primary" onClick={() => { addBank(consent); setConsent(null); }}>متابعة إلى {consent}</Btn></div>
          </div>
        </div>
      )}
    </Flow>
  );
}

export function OnboardLast() {
  const { view, setLastZakat, setRemembers, remembers } = useStore();
  const [cal, setCal] = useState('hijri');
  const [h, setH] = useState({ y: 1446, m: 10, d: 29 });
  const [g, setG] = useState('2025-04-27');
  const iso = cal === 'hijri' ? hijriToIso(h.y, h.m, Math.min(h.d, hijriMonthLength(h.y, h.m))) : g;
  const months = iso ? Math.round((new Date(`${view.today}T00:00:00Z`) - new Date(`${iso}T00:00:00Z`)) / 86400000 / 29.53) : 0;
  return (
    <Flow step={1}>
      <div><h1>متى أخرجت زكاتك آخر مرة؟</h1><p className="sub">نبدأ حساب الحول من هذا التاريخ، ونراجع حركاتك منذ ذلك الحين.</p></div>
      <div className="w-grid2 stack-xs">
        <Option selected={remembers === 'yes'} onClick={() => setRemembers('yes')} title="أعرف التاريخ" desc="أدخله بالهجري أو الميلادي" />
        <Option selected={remembers === 'no'} onClick={() => setRemembers('no')} title="لا أتذكر" desc="نبدأ من أول يوم بلغ فيه مالك النصاب" />
      </div>
      {remembers === 'yes' && (
        <div className="w-card col" style={{ gap: 16 }}>
          <div className="between"><h2 className="t16 b7">تاريخ آخر زكاة</h2><Seg value={cal} onChange={setCal} options={[{ value: 'hijri', label: 'هجري' }, { value: 'greg', label: 'ميلادي' }]} /></div>
          {cal === 'hijri' ? (
            <div className="w-grid3" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
              <Select label="اليوم" value={h.d} onChange={v => setH(s => ({ ...s, d: Number(v) }))} options={Array.from({ length: hijriMonthLength(h.y, h.m) }, (_, i) => ({ value: i + 1, label: String(i + 1) }))} />
              <Select label="الشهر" value={h.m} onChange={v => setH(s => ({ ...s, m: Number(v) }))} options={HIJRI_MONTHS.map((n, i) => ({ value: i + 1, label: n }))} />
              <Select label="السنة" value={h.y} onChange={v => setH(s => ({ ...s, y: Number(v) }))} options={[1448, 1447, 1446, 1445].map(y => ({ value: y, label: `${y}هـ` }))} />
            </div>
          ) : (
            <div className="w-field"><label>التاريخ</label><span className="w-input"><input type="date" value={g} max={view.today} onChange={e => e.target.value && setG(e.target.value)} /></span></div>
          )}
          <div className="w-soft between" style={{ padding: '12px 16px' }}>
            <span className="row t13 sub"><Icon as={CalendarDays} size={15} />{cal === 'hijri' ? 'يقابله ميلاديًا' : 'يقابله هجريًا'}</span>
            <b>{iso ? (cal === 'hijri' ? gregText(iso) : hijriText(iso)) : '—'}</b>
          </div>
          <p className="t11 muted">يمكن تعديل التاريخ لاحقًا من الإعدادات.</p>
        </div>
      )}
      <div className="between">
        <span className="t13 sub">{remembers === 'yes' && iso ? `مرّت عليه ${months >= 12 ? `سنة هجرية${months - 12 > 0 ? ` و${months - 12} أشهر` : ''}` : `${months} أشهر`} تقريبًا` : ''}</span>
        <div className="row"><Btn onClick={() => go('/onboarding/banks')}>رجوع</Btn><Btn variant="primary" className="lg" onClick={() => { setLastZakat(remembers === 'yes' && iso ? { calendar: cal === 'hijri' ? 'hijri' : 'gregorian', iso } : null); go('/onboarding/sync'); }}>متابعة</Btn></div>
      </div>
    </Flow>
  );
}

export function OnboardSync() {
  const { view } = useStore();
  const [p, setP] = useState(8);
  useEffect(() => {
    if (p >= 100) { const t = setTimeout(() => go('/app'), 700); return () => clearTimeout(t); }
    const t = setTimeout(() => setP(x => Math.min(100, x + 7)), 140);
    return () => clearTimeout(t);
  }, [p]);
  const steps = [
    ['مصرف الإنماء · جاري', '1,284 حركة', 30],
    ['البنك الأهلي · ادخار', '612 حركة', 55],
    ['حساب الوعاء والنصاب لكل يوم', `من ${hijriText(view.start?.date ?? view.today)} إلى اليوم`, 85],
    ['تحديد حول كل مبلغ والمواعيد القادمة', 'بمحرك نماء', 100],
  ];
  return (
    <Flow step={2}>
      <div><h1>نجهّز حساباتك</h1><p className="sub">نقرأ حركات حسابين منذ {hijriText(view.start?.date ?? view.today)}، ونحسب حول كل مبلغ.</p></div>
      <div className="w-card">
        <div className="between" style={{ marginBottom: 8 }}><b>{p < 100 ? 'قيد المعالجة · بضع ثوانٍ متبقية' : 'اكتملت المزامنة'}</b><b>{p}٪</b></div>
        <div className="w-progress" style={{ marginBottom: 12 }}><i style={{ width: `${p}%`, background: 'var(--primary)' }} /></div>
        <div className="w-divide">
          {steps.map(([t, d, at], i) => {
            const done = p >= at, on = !done && (i === 0 || p >= steps[i - 1][2]);
            return (
              <div key={t} className="w-list-row">
                <span className={`w-ico${done ? ' ok' : ''}`} style={{ borderRadius: 99 }}><Icon as={done ? Check : on ? RefreshCw : CalendarClock} /></span>
                <span className="grow"><span className="t" style={{ display: 'block', color: done || on ? undefined : 'var(--sub)' }}>{t}</span><span className="d">{d}{done ? ' · اكتملت' : ''}</span></span>
                <Pill tone={done ? 'ok' : on ? 'info' : ''}>{done ? 'اكتملت' : on ? 'جارٍ' : 'بالانتظار'}</Pill>
              </div>
            );
          })}
        </div>
      </div>
      <p className="w-note"><Icon as={Info} size={14} />يمكنك مغادرة الشاشة؛ سنرسل إشعارًا عند اكتمال المزامنة.</p>
    </Flow>
  );
}
