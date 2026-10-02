// الشخصيتان: نورة المشكلة، وخالد رحلة التسجيل والربط الحية.
// كل رقم هنا من المحرك على بيانات الشخصية نفسها، ولا يتسرب شيء بين الشخصيات.
import { useEffect, useState } from 'react';
import {
  ArrowLeft, ArrowLeftRight, Building2, CalendarClock, CalendarX2, Check, CircleAlert, CircleCheck, Flag, Gem, HelpCircle, Landmark,
  Calculator, LoaderCircle, PieChart, Plus, Quote, RefreshCw, ShieldCheck, Sparkles, TriangleAlert, Wallet, X,
} from 'lucide-react';
import { Brand, Btn, Card, Checkbox, CompanyMark, Icon, Modal, NumberInput, Pill, Steps, TextInput } from '../kit.jsx';
import { go } from '../nav.js';
import { useStore } from '../../figma/model.js';
import { gregText } from '../../figma/format.js';
import { ACCOUNTS, PERSONAS, accountInfo, bothDates, clock, hijriFromParts, personaHoldings, plain, sar, days } from '../data.js';
import { AddAsset, K4Review } from './Assets.jsx';
import { LinkInvest } from './Invest.jsx';
import { PROVIDERS, markOf, summarize } from '../../engine/portfolio.js';

// ---------- بطاقات اختيار الشخصية (الصفحة الرئيسية وصفحة /personas) ----------
const STORY = {
  noura: { icon: Calculator, facts: ['حساب واحد · دخل غير منتظم', 'حاسبة تقليدية تسأل: متى يبدأ حولك؟', 'لا نتيجة بلا تاريخ موثّق'], cta: 'شاهد المشكلة' },
  khalid: { icon: RefreshCw, facts: ['تسجيل جديد وربط 3 بنوك', 'ذهب 100 غ ومحفظة أسهم', 'حساب استثماري يحتاج مراجعة'], cta: 'ابدأ الرحلة' },
};

export function PersonaCards() {
  return (
    <div className="w-grid3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
      {Object.values(PERSONAS).map((p, i) => {
        const s = STORY[p.key];
        return (
          <div key={p.key} className="w-feature" style={{ gap: 12 }}>
            <div className="between">
              <span className="row" style={{ gap: 10 }}>
                <span className="w-avatar" style={{ width: 40, height: 40 }}>{p.avatar}</span>
                <span><b style={{ display: 'block' }}>{p.name}</b><span className="t12 sub">{i + 1} · {p.role}</span></span>
              </span>
              <span className="w-ico"><Icon as={s.icon} /></span>
            </div>
            <p>{p.line}</p>
            <div className="col t13" style={{ gap: 6 }}>
              {s.facts.map(f => <span key={f} className="row" style={{ gap: 6 }}><Icon as={Check} size={14} className="green" />{f}</span>)}
            </div>
            <span className="t11 muted row" style={{ gap: 6 }}><Icon as={CalendarClock} size={12} />{p.asOfLabel}</span>
            <Btn variant={p.key === 'noura' ? 'primary' : 'outline'} icon={ArrowLeft} onClick={() => go(p.entry)} style={{ marginTop: 'auto' }}>{s.cta}</Btn>
          </div>
        );
      })}
    </div>
  );
}

function SiteHead({ right }) {
  return (
    <header className="w-nav-wrap">
      <div className="w-wrap w-nav" style={{ borderBottom: 0 }}>
        <Brand />
        <div className="row">{right ?? <Btn className="sm" onClick={() => go('/personas')}>الشخصيات</Btn>}</div>
      </div>
    </header>
  );
}

export function PersonaChooser() {
  return (
    <div className="w w-site">
      <SiteHead right={<Btn className="sm" onClick={() => go('/')}>الصفحة الرئيسية</Btn>} />
      <section className="w-section gray" style={{ minHeight: 'calc(100vh - 72px)' }}>
        <div className="w-wrap">
          <p className="w-eyebrow">نسخة العرض</p>
          <h2 style={{ marginBottom: 8 }}>شخصيتان، قصتان</h2>
          <p className="sub" style={{ marginBottom: 28 }}>كل شخصية لها حساباتها وأصولها ونتيجتها وتاريخها المرجعي، ولا يتسرب شيء بينها. الترتيب المقترح: نورة ثم خالد.</p>
          <PersonaCards />
          <p className="w-note" style={{ marginTop: 20 }}><Icon as={ShieldCheck} size={14} />بيانات تعليمية للعرض. البريد والجوال وهميّان، والربط البنكي محاكاة.</p>
        </div>
      </section>
    </div>
  );
}

// ---------- نورة: المشكلة ----------
export function NouraPage() {
  const { view, personaData } = useStore();
  const [balance, setBalance] = useState('');
  const [hawl, setHawl] = useState('');
  const [gold, setGold] = useState('');
  const [tried, setTried] = useState(false);
  const [help, setHelp] = useState(false);
  const deposits = personaData.transactions.filter(t => t.direction === 'credit' && (t.desc === 'رصيد افتتاحي' || t.amount >= 1000)).slice(0, 4);
  const shown = balance === '' ? plain(view.bankTotal, 0) : balance;
  const b = Number(String(shown).replace(/[^\d.]/g, '')) || 0;
  const g = Number(String(gold).replace(/[^\d.]/g, '')) || 0;
  const starts = view.events.filter(e => e.type === 'START');
  const brk = view.events.find(e => e.type === 'BREAK');
  const current = starts.at(-1);
  const next = view.nextDue;
  return (
    <div className="w w-site">
      <SiteHead right={<><Pill tone="warn">1 من 2 · المشكلة</Pill><Btn className="sm" onClick={() => go('/personas')}>الشخصيات</Btn></>} />
      <section className="w-section gray" style={{ paddingTop: 40 }}>
        <div className="w-wrap col" style={{ gap: 24 }}>
          <div>
            <span className="row" style={{ gap: 10, marginBottom: 8 }}>
              <span className="w-avatar">ن</span>
              <span><b style={{ display: 'block' }}>نورة · مصممة مستقلة</b><span className="t12 sub">زمن توضيحي · كشف حسابها حتى {gregText(view.today)}</span></span>
            </span>
            <h2 style={{ marginBottom: 6 }}>«متى يبدأ حولي؟»</h2>
            <p className="sub">دخلها يجي على دفعات مختلفة في أوقات مختلفة. الحاسبة التقليدية تطلب منها تاريخًا واحدًا لا تعرفه.</p>
          </div>

          <div className="w-cols c-even">
            <Card title="حاسبة زكاة تقليدية" desc="الطريقة التي تستخدمها نورة اليوم" action={<Pill>بدون نماء</Pill>}>
              <div className="col" style={{ gap: 14 }}>
                <NumberInput label="رصيدك الحالي" value={shown} onChange={setBalance} unit="ر.س" />
                <div className="w-field">
                  <label>متى بدأ حول مالك؟</label>
                  <span className="w-input"><input type="date" value={hawl} max={view.today} aria-label="متى بدأ حول مالك؟" onChange={e => setHawl(e.target.value)} /></span>
                  <span className={`w-help${tried && !hawl ? ' warn' : ''}`}>مطلوب · لا تعرفه نورة</span>
                </div>
                <NumberInput label="ذهب أو أصول أخرى (اختياري)" value={gold} onChange={setGold} unit="ر.س" />
                <Btn variant="primary" className="lg" icon={Calculator} onClick={() => setTried(true)}>احسب</Btn>
                {tried && !hawl && (
                  <div className="w-banner" style={{ background: 'var(--warn-bg)', border: '1px solid #F3E2B8', alignItems: 'flex-start' }}>
                    <Icon as={CalendarX2} />
                    <span><b style={{ display: 'block' }}>نحتاج تاريخًا موثّقًا للحول</b>
                      <span className="t13">بدون تاريخ بداية الحول لا نعطيك رقمًا. أي رقم الآن تخمين وليس زكاة.</span></span>
                  </div>
                )}
                {tried && hawl && (
                  <div className="w-banner" style={{ background: 'var(--warn-bg)', border: '1px solid #F3E2B8', alignItems: 'flex-start' }}>
                    <Icon as={TriangleAlert} />
                    <span><b style={{ display: 'block' }}>رقم غير موثّق: {sar((b + g) / 40)}</b>
                      <span className="t13">الحاسبة تفترض أن {plain(b + g, 0)} ر.س كلها بقيت عندك من {gregText(hawl)}، وكشفها يقول غير ذلك: الدفعات دخلت في تواريخ مختلفة، والرصيد نزل تحت النصاب ثم ارتفع.</span></span>
                  </div>
                )}
              </div>
            </Card>

            <div className="col" style={{ gap: 24 }}>
              <Card title="دخل نورة غير منتظم" desc={`من كشف ${ACCOUNTS.N1.bank} · أول ${deposits.length} دفعات`}>
                <div className="w-divide">
                  {deposits.map(t => (
                    <div key={`${t.date}-${t.amount}`} className="w-list-row">
                      <span className="w-ico"><Icon as={t.desc === 'رصيد افتتاحي' ? Wallet : Plus} /></span>
                      <span className="grow"><span className="t" style={{ display: 'block' }}>{t.desc}</span><span className="d">{bothDates(t.date)}</span></span>
                      <span className="v" style={{ color: 'var(--ok)' }}>+{plain(t.amount, 0)}</span>
                    </div>
                  ))}
                </div>
              </Card>
              <Card title="الأسئلة التي تحيّرها">
                <div className="col t13" style={{ gap: 10 }}>
                  {['هل يبدأ الحول من أول ريال دخل حسابي؟', 'أو من يوم بلغ مالي النصاب؟ ومتى كان ذلك بالضبط؟', 'كل دفعة لها حولها، أو أجمعها كلها في يوم واحد؟', 'وإذا نزل رصيدي تحت النصاب ثم ارتفع؟'].map(q => (
                    <span key={q} className="row" style={{ gap: 8, alignItems: 'flex-start' }}><Icon as={HelpCircle} size={16} className="muted" />{q}</span>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          {!help ? (
            <div className="row" style={{ justifyContent: 'center' }}>
              <Btn variant="primary" className="lg" icon={Sparkles} onClick={() => setHelp(true)}>كيف يساعدني نماء؟</Btn>
            </div>
          ) : (
            <Card title="مع نماء: الحول من كشف حسابها، لا من ذاكرتها" desc={`المحرك نفسه على ${personaData.transactions.length} حركة في كشف نورة`}>
              <div className="w-divide">
                {view.start && (
                  <div className="w-list-row"><span className="w-ico sel"><Icon as={Flag} /></span>
                    <span className="grow"><span className="t" style={{ display: 'block' }}>بدأ الحول {bothDates(view.start.date)}</span>
                      <span className="d">يوم دخلت دفعة 10,000 وبلغ رصيدها {sar(view.start.total)} والنصاب يومها {sar(view.start.nisab)}</span></span></div>
                )}
                {brk && (
                  <div className="w-list-row"><span className="w-ico warn"><Icon as={CircleAlert} /></span>
                    <span className="grow"><span className="t" style={{ display: 'block' }}>انقطع الحول {bothDates(brk.date)}</span>
                      <span className="d">نزل رصيدها إلى {sar(brk.total)}، تحت النصاب يومها {sar(brk.nisab)}، فلا زكاة عن تلك الفترة</span></span></div>
                )}
                {current && current !== view.start && (
                  <div className="w-list-row"><span className="w-ico sel"><Icon as={Flag} /></span>
                    <span className="grow"><span className="t" style={{ display: 'block' }}>بدأ حول جديد {bothDates(current.date)}</span>
                      <span className="d">عاد رصيدها فوق النصاب ({sar(current.total)})</span></span></div>
                )}
                {next && (
                  <div className="w-list-row"><span className="w-ico"><Icon as={CalendarClock} /></span>
                    <span className="grow"><span className="t" style={{ display: 'block' }}>أول وجوب {hijriFromParts(next.hijri)} · {gregText(next.date)}</span>
                      <span className="d">إذا بقي رصيدها كما هو · توقّع وليس مستحقًا الآن</span></span>
                    <span className="v">{sar(next.zakat)}</span></div>
                )}
              </div>
              <div className="w-soft row" style={{ gap: 10, marginTop: 14, padding: '14px 16px', alignItems: 'flex-start' }}>
                <Icon as={Quote} className="muted" />
                <b>«نماء يعرف متى يبدأ الحول بدل ما أحسبه بنفسي»</b>
              </div>
              <div className="row" style={{ gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
                <Btn variant="primary" className="lg" icon={ArrowLeft} onClick={() => go('/khalid')}>ابدأ مع خالد</Btn>
                <Btn className="lg" onClick={() => go('/personas')}>كل الشخصيات</Btn>
              </div>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}

// ---------- خالد: تسجيل جديد وربط حي (محاكاة) ----------
const K_STEPS = ['الحساب والموافقة', 'ربط البنوك', 'الحسابات', 'الأصول والأسعار', 'النتيجة'];
const K_BANKS = [
  { id: 'K1', bank: 'مصرف الإنماء', note: 'جاري 3391 •••• · ومعه محفظة استثمارية' },
  { id: 'K2', bank: 'البنك الأهلي السعودي', note: 'جاري 6204 ••••' },
  { id: 'K3', bank: 'مصرف الراجحي', note: 'ادخار 5518 ••••' },
];

function KFlow({ step, children }) {
  return (
    <div className="w w-flow">
      <header className="w-flow-head">
        <Brand />
        <Steps items={K_STEPS} current={step} />
        <span className="row" style={{ gap: 8 }}>
          <Pill tone="info">محاكاة للعرض</Pill>
          <button className="row t13 sub" onClick={() => go('/personas')}><Icon as={X} size={14} />خروج</button>
        </span>
      </header>
      <div className="w-flow-body">{children}</div>
    </div>
  );
}

export function KhalidWelcome() {
  const { resetPersona } = useStore();
  const p = PERSONAS.khalid;
  return (
    <KFlow step={-1}>
      <span className="row" style={{ gap: 10 }}><span className="w-avatar">خ</span><span><b style={{ display: 'block' }}>خالد · {p.role}</b><span className="t12 sub">{p.asOfLabel}</span></span></span>
      <div><h1>حساب جديد في نماء</h1><p className="sub">{p.line} يسجّل، ويوافق على مشاركة البيانات، ويربط بنوكه، ثم يراجع أصوله، ونماء يحسب المستحق والقادم.</p></div>
      <div className="w-card col" style={{ gap: 10 }}>
        {['إنشاء الحساب والموافقة على قراءة البيانات', 'ربط الإنماء والأهلي والراجحي', 'مراجعة الحسابات المكتشفة والتحويلات الداخلية', 'تأكيد الذهب والأسهم وإضافة أي أصل', 'تحديث الأسعار ثم النتيجة'].map((t, i) => (
          <span key={t} className="row" style={{ gap: 10 }}><span className="w-step-n" style={{ width: 26, height: 26, fontSize: 12 }}>{i + 1}</span>{t}</span>
        ))}
      </div>
      <div className="w-banner info t13"><Icon as={ShieldCheck} />الربط هنا محاكاة: لا نتصل بأي بنك ولا نطلب كلمة مرور. الحركات من ملف خالد التعليمي.</div>
      <Btn variant="primary" className="lg" onClick={() => { resetPersona('khalid'); go('/khalid/register'); }}>بدء جلسة جديدة</Btn>
    </KFlow>
  );
}

export function KhalidRegister() {
  const p = PERSONAS.khalid;
  const [f, setF] = useState({ name: 'خالد', email: p.email, phone: p.phone });
  const [scopes, setScopes] = useState({ accounts: true, balances: true, txs: true });
  const [agree, setAgree] = useState(false);
  const set = k => v => setF(s => ({ ...s, [k]: v }));
  const ok = f.name.trim().length > 1 && /.+@.+\..+/.test(f.email) && agree && Object.values(scopes).every(Boolean);
  return (
    <KFlow step={0}>
      <div><h1>أنشئ حسابك</h1><p className="sub">ثم وافق على قراءة بياناتك البنكية. لا نستطيع تحريك أموالك.</p></div>
      <div className="w-card col" style={{ gap: 14 }}>
        <TextInput label="الاسم" value={f.name} onChange={set('name')} />
        <div className="w-grid2 stack-xs">
          <TextInput label="البريد الإلكتروني" value={f.email} onChange={set('email')} dir="ltr" />
          <TextInput label="رقم الجوال" value={f.phone} onChange={set('phone')} dir="ltr" />
        </div>
      </div>
      <div className="w-card col" style={{ gap: 12 }}>
        <div className="between"><h2 className="t16 b7">موافقة مشاركة البيانات</h2><Pill tone="info">قراءة فقط · 12 شهرًا</Pill></div>
        <Checkbox on={scopes.accounts} onChange={v => setScopes(s => ({ ...s, accounts: v }))}>أسماء الحسابات وأنواعها</Checkbox>
        <Checkbox on={scopes.balances} onChange={v => setScopes(s => ({ ...s, balances: v }))}>الأرصدة</Checkbox>
        <Checkbox on={scopes.txs} onChange={v => setScopes(s => ({ ...s, txs: v }))}>الحركات منذ أول كشف متاح</Checkbox>
        {!Object.values(scopes).every(Boolean) && <p className="w-help warn">نحتاج الثلاثة لنحسب الحول. بدون الحركات لا نعرف متى دخل كل مبلغ.</p>}
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          <Checkbox on={agree} onChange={setAgree}>أوافق على <b>الشروط</b> و<b>سياسة الخصوصية</b>، وأفهم أن الحساب استرشادي</Checkbox>
        </div>
      </div>
      <div className="between"><Btn onClick={() => go('/khalid')}>رجوع</Btn><Btn variant="primary" className="lg" disabled={!ok} onClick={() => go('/khalid/banks')}>إنشاء الحساب والمتابعة</Btn></div>
    </KFlow>
  );
}

export function KhalidBanks() {
  const { pendingBanks, addBank } = useStore();
  const [state, setState] = useState({});
  const [tries, setTries] = useState({});
  const [consent, setConsent] = useState(null);
  const status = id => (pendingBanks.includes(id) ? 'done' : state[id] ?? 'idle');
  useEffect(() => {
    const linking = Object.entries(state).filter(([, s]) => s === 'linking');
    if (!linking.length) return undefined;
    const t = setTimeout(() => {
      for (const [id] of linking) {
        // الأهلي يفشل في أول محاولة: نعرض حالة الخطأ وإعادة المحاولة
        if (id === 'K2' && (tries.K2 ?? 0) === 1) setState(s => ({ ...s, [id]: 'fail' }));
        else { addBank(id); setState(s => ({ ...s, [id]: 'done' })); }
      }
    }, 1300);
    return () => clearTimeout(t);
  }, [state, tries, addBank]);
  const start = id => { setTries(t => ({ ...t, [id]: (t[id] ?? 0) + 1 })); setState(s => ({ ...s, [id]: 'linking' })); };
  const done = K_BANKS.filter(b => status(b.id) === 'done').length;
  return (
    <KFlow step={1}>
      <div><h1>اربط بنوكك</h1><p className="sub">اختر البنك ووافق على القراءة. يرجع كل بنك بحساباته وكشف حركاته.</p></div>
      <div className="w-card" style={{ padding: '4px 20px' }}>
        <div className="w-divide">
          {K_BANKS.map(b => {
            const s = status(b.id);
            return (
              <div key={b.id} className="w-list-row">
                <span className={`w-ico${s === 'done' ? ' ok' : s === 'fail' ? ' warn' : ''}`}><Icon as={s === 'done' ? Check : s === 'fail' ? CircleAlert : Landmark} /></span>
                <span className="grow">
                  <span className="t" style={{ display: 'block' }}>{b.bank}</span>
                  <span className={`d${s === 'fail' ? ' warn' : ''}`}>{s === 'fail' ? 'تعذّر الاتصال بالبنك · انتهت مهلة الاستجابة' : s === 'linking' ? 'جارٍ الربط وقراءة الحسابات…' : s === 'done' ? `${b.note} · مرتبط` : b.note}</span>
                </span>
                {s === 'done' && <Pill tone="ok">مرتبط</Pill>}
                {s === 'linking' && <Pill tone="info"><Icon as={LoaderCircle} size={12} className="w-spin" /> جارٍ الربط</Pill>}
                {s === 'fail' && <Btn className="sm" icon={RefreshCw} onClick={() => start(b.id)}>إعادة المحاولة</Btn>}
                {s === 'idle' && <Btn className="sm" icon={Plus} onClick={() => setConsent(b)}>ربط</Btn>}
              </div>
            );
          })}
        </div>
      </div>
      <div className="w-banner info t13"><Icon as={ShieldCheck} />محاكاة: لا اتصال حقيقي بالبنوك ولا كلمات مرور. حالات الربط والفشل لتوضيح التجربة.</div>
      <div className="between">
        <span className="t13 sub">{done} من 3 بنوك مرتبطة</span>
        <Btn variant="primary" className="lg" disabled={done < 3} onClick={() => go('/khalid/accounts')}>متابعة</Btn>
      </div>
      {consent && (
        <Modal size="sm" title="موافقة مشاركة البيانات" desc={`${consent.bank} · حسابات الأفراد`} onClose={() => setConsent(null)}
          foot={<><Btn onClick={() => setConsent(null)}>إلغاء</Btn><Btn variant="primary" onClick={() => { start(consent.id); setConsent(null); }}>موافق · ربط</Btn></>}>
          <p className="t13">نقرأ اسم الحساب ونوعه، والأرصدة، والحركات منذ أول كشف متاح. لن نحوّل أي مبلغ، ولن نرى كلمة مرور بنكك.</p>
          <div className="w-line"><span>مدة الموافقة</span><span>12 شهرًا</span></div>
          <div className="w-line"><span>الوضع</span><span>محاكاة للعرض</span></div>
        </Modal>
      )}
    </KFlow>
  );
}

export function KhalidAccounts() {
  const { view, personaData, k4 } = useStore();
  const [review, setReview] = useState(false);
  const count = id => personaData.transactions.filter(t => t.accountId === id).length;
  const pair = personaData.transactions.filter(t => t.internal && t.date === '2025-04-06');
  const out = pair.find(t => t.direction === 'debit'), inn = pair.find(t => t.direction === 'credit');
  return (
    <KFlow step={2}>
      <div><h1>وجدنا 4 حسابات</h1><p className="sub">من كشوف بنوكك منذ {bothDates(personaData.period.start)}. الأرصدة كما في {gregText(view.today)}.</p></div>
      <div className="w-card" style={{ padding: '4px 20px' }}>
        <div className="w-divide">
          {view.accounts.map(a => {
            const info = accountInfo(a);
            return (
              <div key={a.id} className="w-list-row">
                <span className={`w-ico${info.kind === 'review' ? ' warn' : ''}`}><Icon as={info.kind === 'review' ? TriangleAlert : info.kind === 'fund' ? PieChart : a.id === 'K1' ? Landmark : Building2} /></span>
                <span className="grow">
                  <span className="t" style={{ display: 'block' }}>{info.title}</span>
                  <span className="d">كشف {ACCOUNTS[a.id].short} · {count(a.id)} حركة · {info.kind === 'cash' ? 'يدخل الوعاء' : info.sub}</span>
                </span>
                <span className="col" style={{ alignItems: 'flex-end', gap: 4 }}>
                  <span className="v">{sar(a.balance)}</span>
                  {info.kind === 'review'
                    ? <button onClick={() => setReview(true)}><Pill tone="warn">يحتاج مراجعة</Pill></button>
                    : info.kind !== 'cash' && <span className="t11 sub">{info.pill[1]}</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {!k4 && (
        <div className="w-banner" style={{ background: 'var(--warn-bg)', border: '1px solid #F3E2B8' }}>
          <Icon as={TriangleAlert} />
          <span className="t13"><b>المحفظة الاستثمارية</b> لا نعتبرها معفاة من اسمها. حدّد نوعها الآن أو لاحقًا؛ حتى ذلك تبقى النتيجة جزئية.</span>
          <Btn className="sm" onClick={() => setReview(true)}>تحديد النوع</Btn>
        </div>
      )}
      {out && inn && (
        <div className="w-card col" style={{ gap: 12 }}>
          <div className="between"><h2 className="t16 b7">تحويل داخلي اكتشفناه</h2><Pill tone="info">ليس دخلًا جديدًا</Pill></div>
          <div className="w-grid2 stack-xs">
            <div className="w-soft" style={{ padding: '12px 14px' }}><span className="t12 sub" style={{ display: 'block' }}>خرج من {ACCOUNTS[out.accountId].bank}</span><b style={{ color: 'var(--ink)' }}>−{plain(out.amount, 0)} ر.س</b></div>
            <div className="w-soft" style={{ padding: '12px 14px' }}><span className="t12 sub" style={{ display: 'block' }}>دخل {ACCOUNTS[inn.accountId].bank}</span><b style={{ color: 'var(--ok)' }}>+{plain(inn.amount, 0)} ر.س</b></div>
          </div>
          <p className="t13 sub"><Icon as={ArrowLeftRight} size={14} /> {bothDates(out.date)}: طرفان مرتبطان بنفس المبلغ واليوم. المال انتقل بين حساباتك، فلا يزيد الوعاء ولا يبدأ حولًا جديدًا، ويبقى للمبلغ حوله الأصلي.</p>
        </div>
      )}
      <div className="between"><Btn onClick={() => go('/khalid/banks')}>رجوع</Btn><Btn variant="primary" className="lg" onClick={() => go('/khalid/assets')}>متابعة إلى الأصول</Btn></div>
      {review && <K4Review onClose={() => setReview(false)} />}
    </KFlow>
  );
}

export function KhalidAssets() {
  const { view, personaData, confirmed, confirmHolding, assets, removeAsset, portfolios } = useStore();
  const [tab, setTab] = useState(null);
  const [linking, setLinking] = useState(undefined);
  const [toast, setToast] = useState(null);
  const holdings = personaHoldings(personaData, view).filter(h => h.id !== 'K4-FUND');
  const all = holdings.every(h => confirmed[h.id]);
  const ICO = { gold: Gem, stock: PieChart };
  return (
    <KFlow step={3}>
      <div><h1>راجع أصولك</h1><p className="sub">وجدنا أصلين مرتبطين بحساباتك. أكّد أنها صحيحة، وأضف أي أصل خارج البنوك.</p></div>
      {toast && <div className="w-banner ok t13"><Icon as={CircleCheck} className="green" /><span className="grow">{toast.text}</span><Btn variant="ghost" className="sm" onClick={() => { removeAsset(toast.id); setToast(null); }}>تراجع</Btn></div>}
      {holdings.map(h => (
        <div key={h.id} className="w-card col" style={{ gap: 10 }}>
          <div className="w-list-row" style={{ padding: 0, alignItems: 'flex-start' }}>
            <span className="w-ico"><Icon as={ICO[h.kind] ?? Gem} /></span>
            <span className="grow">
              <span className="t" style={{ display: 'block' }}>{h.title}</span>
              <span className="d" style={{ display: 'block' }}>{h.sub}</span>
            </span>
            <span className="v">{sar(h.zakatable)}</span>
          </div>
          <div className="w-soft">
            <div className="w-line"><span>تاريخ التملك</span><span>{gregText(h.acquired)}{h.auto ? ' · تلقائي من أول كشف' : ' · من الكشف'}</span></div>
            {h.kind === 'gold' && <div className="w-line" style={{ borderTop: '1px solid var(--line)' }}><span>دُفع من</span><span>{(g => `${ACCOUNTS[g.paidFrom]?.bank} · ${plain(g.cost, 0)} ر.س`)(personaData.holdings.find(x => x.type === 'gold'))}</span></div>}
            <div className="w-line" style={{ borderTop: '1px solid var(--line)' }}><span>المصدر</span><span>{h.source}</span></div>
          </div>
          {confirmed[h.id]
            ? <Pill tone="ok"><Icon as={Check} size={12} /> مؤكد</Pill>
            : <div className="row" style={{ gap: 8 }}><Btn variant="primary" className="sm" icon={Check} onClick={() => confirmHolding(h.id)}>تأكيد</Btn><span className="t12 sub">إذا فيه خطأ تقدر تعدّله من صفحة الأصول</span></div>}
        </div>
      ))}
      {assets.map(a => (
        <div key={a.id} className="w-card w-list-row" style={{ padding: '12px 16px' }}>
          <span className="w-ico ok"><Icon as={Plus} /></span>
          <span className="grow"><span className="t" style={{ display: 'block' }}>{a.title}</span><span className="d">أضفته الآن · {a.detail}</span></span>
          <span className="v">{sar(a.value)}</span>
        </div>
      ))}
      <div className="w-card col" style={{ gap: 12 }}>
        <div>
          <b style={{ display: 'block' }}>عندك تطبيق تداول؟</b>
          <span className="t13 sub">اربط محفظتك من عوائد الأصول أو الراجحي المالية أو دراية أو غيرها ({PROVIDERS.length} تطبيقًا)، وتتحدث زكاتك مع كل صفقة. الأسهم السعودية تزكيها الشركات فلا تدخل الحساب.</span>
        </div>
        {portfolios.map(p => (
          <div key={p.id} className="w-list-row" style={{ padding: 0 }}>
            <CompanyMark mark={markOf(p)} size={32} />
            <span className="grow"><span className="t" style={{ display: 'block' }}>{p.name}</span><span className="d">مرتبط · يدخل حساب الزكاة {sar(summarize(p).base)}</span></span>
          </div>
        ))}
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {['awaed', 'alinma-invest', 'rajhi-capital', 'derayah'].map(id => PROVIDERS.find(x => x.id === id)).filter(p => !portfolios.some(x => x.id === p.id)).map(p => (
            <button key={p.id} className="w-prov" style={{ width: 'auto', paddingInlineEnd: 14 }} onClick={() => setLinking(p)}>
              <CompanyMark mark={markOf(p)} size={28} /><span className="n">{p.name}</span>
            </button>
          ))}
          <Btn className="sm" onClick={() => setTab('apps')}>كل التطبيقات</Btn>
        </div>
      </div>
      <Btn icon={Plus} onClick={() => setTab('gold')}>إضافة أصل خارج البنوك</Btn>
      {!all && <p className="w-help warn">أكّد الأصلين للمتابعة.</p>}
      <div className="between"><Btn onClick={() => go('/khalid/accounts')}>رجوع</Btn><Btn variant="primary" className="lg" disabled={!all} onClick={() => go('/khalid/prices')}>متابعة إلى الأسعار</Btn></div>
      {tab && <AddAsset tab={tab} setTab={setTab} onClose={() => setTab(null)} onAdded={(text, id) => { setTab(null); setToast({ text, id }); }}
        onLink={p => { setTab(null); setLinking(p); }} />}
      {linking !== undefined && <LinkInvest initial={linking} onClose={() => setLinking(undefined)} />}
    </KFlow>
  );
}

export function KhalidPrices() {
  const { view, personaData, khalidLive, setKhalidLive, feed } = useStore();
  const holdings = personaHoldings(personaData, view).filter(h => h.id !== 'K4-FUND');
  const gold = holdings.find(h => h.kind === 'gold');
  const stocks = holdings.find(h => h.kind === 'stock');
  const state = !khalidLive ? 'saved' : feed.loading || (!feed.ready && !feed.error) ? 'loading' : feed.metalsLive ? 'live' : 'error';
  const refresh = () => { if (!khalidLive) setKhalidLive(true); else feed.refresh(); };
  const at = feed.receivedAt ? clock(new Date(feed.receivedAt)) : '';
  return (
    <KFlow step={3}>
      <div><h1>حدّث الأسعار</h1><p className="sub">الذهب يُقيَّم بسعر السوق يوم الحساب لا بتكلفته. نجيب السعر الآن من مصدره ونعيد الحساب.</p></div>
      <div className="w-card col" style={{ gap: 12 }}>
        <div className="between">
          <h2 className="t16 b7">سعر جرام الذهب عيار 24</h2>
          {state === 'live' ? <Pill tone="ok">مباشر</Pill> : state === 'loading' ? <Pill tone="info">جارٍ التحديث</Pill> : state === 'error' ? <Pill tone="warn">تعذّر التحديث</Pill> : <Pill>سعر محفوظ</Pill>}
        </div>
        <div className="w-amount md"><strong>{plain(view.prices.goldPerGram)}</strong><span>ر.س</span></div>
        <p className="t12 sub">
          {state === 'live' ? `gold-api.com · ${at} بتوقيت الرياض`
            : state === 'loading' ? 'نتصل بـ gold-api.com…'
              : state === 'error' ? `لم يرد gold-api.com الآن، فلم نغيّر شيئًا. نستخدم آخر سعر محفوظ: ${gregText(view.prices.date)}.`
                : `آخر سعر محفوظ · ${gregText(view.prices.date)} · gold-api.com`}
        </p>
        <div className="w-soft">
          {gold && <div className="w-line"><span>{gold.title}</span><span>{sar(gold.zakatable)}</span></div>}
          {stocks && <div className="w-line" style={{ borderTop: '1px solid var(--line)' }}><span>{stocks.title}</span><span>{sar(stocks.zakatable)}</span></div>}
          {stocks && <div className="w-line" style={{ borderTop: '1px solid var(--line)' }}><span className="t12">الأسهم</span><span className="t12">{stocks.source} · من مزود المحفظة</span></div>}
        </div>
        <Btn variant="primary" icon={RefreshCw} disabled={state === 'loading'} onClick={refresh}>{state === 'saved' ? 'تحديث الأسعار الآن' : state === 'error' ? 'إعادة المحاولة' : 'تحديث مرة أخرى'}</Btn>
      </div>
      <div className="between"><Btn onClick={() => go('/khalid/assets')}>رجوع</Btn><Btn variant="primary" className="lg" onClick={() => go('/khalid/sync')}>احسب النتيجة</Btn></div>
    </KFlow>
  );
}

export function KhalidSync() {
  const { view, personaData, k4, vault, due } = useStore();
  const [p, setP] = useState(6);
  useEffect(() => {
    if (p >= 100) return undefined;
    const t = setTimeout(() => setP(x => Math.min(100, x + 6)), 120);
    return () => clearTimeout(t);
  }, [p]);
  const count = id => personaData.transactions.filter(t => t.accountId === id).length;
  const steps = [
    [`${ACCOUNTS.K1.bank} · جاري واستثماري`, `${count('K1') + count('K4')} حركة`, 25],
    [`${ACCOUNTS.K2.bank} · جاري`, `${count('K2')} حركات`, 40],
    [`${ACCOUNTS.K3.bank} · ادخار`, `${count('K3')} حركة`, 55],
    ['ربط التحويلات الداخلية', (n => `${n} ${n > 2 && n < 11 ? 'تحويلات' : 'تحويلًا'} بين حساباتك`)(personaData.transactions.filter(t => t.internal).length / 2), 72],
    ['يوم زكاتك السنوي مع الذهب والأسهم', 'بمحرك نماء', 100],
  ];
  const next = view.nextDue;
  return (
    <KFlow step={4}>
      <div><h1>{p < 100 ? 'نحسب زكاتك' : 'النتيجة جاهزة'}</h1><p className="sub">من {bothDates(personaData.period.start)} إلى {gregText(view.today)}.</p></div>
      <div className="w-card">
        <div className="between" style={{ marginBottom: 8 }}><b>{p < 100 ? 'قيد المعالجة' : 'اكتمل'}</b><b>{p}٪</b></div>
        <div className="w-progress" style={{ marginBottom: 12 }}><i style={{ width: `${p}%`, background: 'var(--primary)' }} /></div>
        <div className="w-divide">
          {steps.map(([t, d, at], i) => {
            const done = p >= at, on = !done && (i === 0 || p >= steps[i - 1][2]);
            return (
              <div key={t} className="w-list-row">
                <span className={`w-ico${done ? ' ok' : ''}`} style={{ borderRadius: 99 }}><Icon as={done ? Check : on ? RefreshCw : CalendarClock} /></span>
                <span className="grow"><span className="t" style={{ display: 'block', color: done || on ? undefined : 'var(--sub)' }}>{t}</span><span className="d">{d}</span></span>
                <Pill tone={done ? 'ok' : on ? 'info' : ''}>{done ? 'اكتملت' : on ? 'جارٍ' : 'بالانتظار'}</Pill>
              </div>
            );
          })}
        </div>
      </div>
      {p >= 100 && (
        <>
          <div className="w-kpis" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <div className="w-kpi"><span className="t12 sub">المستحق الآن</span><strong>{sar(due.zakat)}</strong><span className="t11 muted">{due.today ? 'وجبت اليوم' : `لا وجوب في ${gregText(view.today)}`}</span></div>
            <div className="w-kpi"><span className="t12 sub">القادم · توقّع</span><strong>{next ? sar(next.zakat) : '—'}</strong><span className="t11 muted">{next ? `${gregText(next.date)} · بعد ${days(next.inDays)}` : ''}</span></div>
            <div className="w-kpi"><span className="t12 sub">لم يحل حوله بعد</span><strong>{sar(vault)}</strong><span className="t11 muted">الوعاء كاملًا · فوق النصاب {plain(view.nisab)}</span></div>
            <div className="w-kpi"><span className="t12 sub">يحتاج معلومات</span><strong>{k4 ? 'لا شيء' : 'حساب واحد'}</strong><span className="t11 muted">{k4 ? 'كل الحسابات محسوبة' : 'المحفظة الاستثمارية · 50,000'}</span></div>
          </div>
          <div className="w-soft row" style={{ gap: 10, padding: '14px 16px', alignItems: 'flex-start' }}>
            <Icon as={Quote} className="muted" /><b>«ربطت حساباتي وأصولي، ونماء عرف المستحق والقادم»</b>
          </div>
          <Btn variant="primary" className="lg" onClick={() => go('/app')}>عرض لوحة النتيجة</Btn>
        </>
      )}
    </KFlow>
  );
}
