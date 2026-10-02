// الرئيسية وصفحة «كيف حُسبت زكاتك». كل رقم من المحرك: buildView (الوعاء والنصاب والوجوب والمواعيد) + أصول المستخدم.
import { ArrowLeft, CalendarCheck2, ChevronLeft, CircleMinus, Clock3, Download, Info } from 'lucide-react';
import { Btn, Card, CompanyMark, Icon, Pill } from '../kit.jsx';
import { go } from '../nav.js';
import { Shell } from '../Shell.jsx';
import { useStore } from '../../figma/model.js';
import { gregText, hijriText, hijriToIso, money } from '../../figma/format.js';
import { ACCOUNTS, accountInfo, bothDates, daysFrom, greeting, kFmt, monthName, plain, sar, weekday, days, times } from '../data.js';
import { AHMAD_V2 } from '../../engine/ahmad-v2.js';
import { markOf, summarize } from '../../engine/portfolio.js';
import { K4Review } from './Assets.jsx';
import { useState } from 'react';

function AccountsCard({ view, vault }) {
  const { portfolios } = useStore();
  return (
    <Card title="حساباتك" action={<button className="w-link t13" onClick={() => go('/app/assets')}>كل الأصول</button>}>
      <div className="w-rows">
        {view.accounts.map(a => {
          const info = accountInfo(a);
          return (
            <button key={a.id} className="w-rowline" style={{ width: '100%', textAlign: 'start' }} onClick={() => go(`/app/account/${a.id}`)}>
              <span className="t">{info.title}</span>
              <span className="v" style={info.kind === 'review' ? { color: 'var(--muted)', fontWeight: 500 } : undefined}>{plain(a.balance)}</span>
              <span className="d">{info.kind === 'cash' ? `•••• ${info.mask}` : info.kind === 'review' ? <span style={{ color: 'var(--warn)' }}>يحتاج مراجعة · غير محسوب</span> : info.sub}</span>
            </button>
          );
        })}
        {portfolios.map(p => {
          const sm = summarize(p);
          return (
            <button key={p.id} className="w-rowline" style={{ width: '100%', textAlign: 'start' }} onClick={() => go(`/app/invest/${p.id}`)}>
              <span className="t row" style={{ gap: 10 }}><CompanyMark mark={markOf(p)} size={24} />{p.name}</span>
              <span className="v">{plain(sm.base)}</span>
              <span className="d">محفظة استثمار · ما يدخل الوعاء منها</span>
            </button>
          );
        })}
      </div>
      <div className="w-total"><span>الوعاء الزكوي</span><span>{sar(vault)}</span></div>
    </Card>
  );
}

// الوعاء في آخر يوم من كل شهر هجري (يُعرض في السجل)
function VaultChart({ view }) {
  const months = view.monthly;
  const max = Math.max(...months.map(m => m.total), view.nisab) * 1.08;
  const nisab = months.at(-1).nisab;
  return (
    <Card title="الوعاء شهرًا بشهر"
      action={<span className="w-legend"><span><i style={{ background: 'var(--gold)', height: 2, width: 14 }} />النصاب {plain(nisab, 0)}</span></span>}>
      <div className="w-bars" role="img" aria-label="الوعاء في آخر يوم من كل شهر هجري">
        <span className="nisab" style={{ bottom: `${20 + (nisab / max) * 150}px` }} />
        {[...months].reverse().map((m, i) => (
          <div key={m.date} className={`bar${i === 0 ? ' now' : ''}`} title={`${monthName(m.hijri[1])}: ${money(m.total)}`}>
            <b>{kFmt(m.total)}</b>
            <i style={{ height: `${(m.total / max) * 150}px` }} />
            <small>{monthName(m.hijri[1])}</small>
          </div>
        ))}
      </div>
    </Card>
  );
}

// إيجار اكتشفناه من حركات الحساب: نسأل المستخدم يأكده، ونشرح حكمه (دليل الهيئة §3.8)
export function RentCard() {
  const { rent, setRentStatus } = useStore();
  const r = rent.find(x => x.status === 'new');
  if (!r) return null;
  const bank = ACCOUNTS[r.accountId]?.bank ?? r.accountId;
  return (
    <Card title="اكتشفنا دخل إيجار في حسابك" desc="من حركات الحساب، بدون ما تدخل شي" action={<Pill tone="info">جديد</Pill>}>
      <div className="w-rows">
        <div className="w-rowline"><span className="t">{r.desc}</span><span className="v">{plain(r.amount, 0)} ر.س</span><span className="d">{r.everyText} · {bank} · {r.count} دفعات منذ {gregText(r.first)}</span></div>
        <div className="w-rowline"><span className="t">في السنة</span><span className="v">{plain(r.perYear, 0)} ر.س</span><span className="d">آخر دفعة {gregText(r.last)} · المتوقعة {gregText(r.next)}</span></div>
      </div>
      <p className="w-note" style={{ margin: '14px 0 16px' }}><Icon as={Info} size={14} />
        <span>العقار المؤجر لا زكاة في قيمته، فلا تضيفه كأصل. والأجرة تصل حسابك نقدًا فهي داخلة في وعائك، ويُزكّى ما بقي منها حولًا (دليل الهيئة §3.8).</span>
      </p>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <Btn variant="primary" className="sm" onClick={() => setRentStatus(r.key, 'rental')}>نعم، عقار مؤجر</Btn>
        <Btn className="sm" onClick={() => setRentStatus(r.key, 'not')}>ليس إيجارًا</Btn>
      </div>
    </Card>
  );
}

// ما نراه وما لا نراه: الحساب على ما ربطه المستخدم فقط، فنقول له صراحةً ما خارجه
function Coverage({ view }) {
  const { personaData, portfolios, assets, rent } = useStore();
  const rented = rent.filter(r => r.status === 'rental');
  const first = personaData.transactions[0]?.date ?? view.start?.date;
  const has = k => assets.some(a => a.kind === k || (k === 'gold' && a.kind === 'silver'));
  const banks = view.accounts.length;
  const missing = [
    ['cash', 'نقد خارج البنوك', 'في البيت أو محفظة رقمية', '/app/assets/add/cash'],
    ['gold', 'ذهب وفضة', 'المعد للادخار أو التجارة يُزكّى، وحلي الاستعمال لا زكاة فيه (§3.1.2)', '/app/assets/add/gold'],
    ['debt', 'ديون لك عند الناس', 'الدين على قادر غير مماطل يُزكّى كل سنة (§3.4)', '/app/assets/add/debt'],
    ['bank', 'بنوك أخرى', 'أي حساب غير مربوط لا يدخل الحساب', '/app/link'],
    ['invest', 'تطبيقات التداول', 'عوائد الأصول والراجحي المالية ودراية وغيرها', '/app/assets/add/apps'],
  ].filter(([k]) => !(k === 'invest' ? portfolios.length > 1 : k === 'bank' ? false : has(k)));
  return (
    <Card title="ما نراه وما لا نراه" desc="نحسب على ما ربطته أو أضفته فقط">
      <div className="w-cover">
        <div>
          <span className="t12 sub b6">نراه</span>
          <ul className="w-cover-list">
            <li>{banks === 1 ? 'حساب بنكي واحد' : `${banks} حسابات بنكية`} · قراءة فقط عبر الخدمات المصرفية المفتوحة</li>
            {first && <li>كشف الحساب من {gregText(first)} ({hijriText(first)})</li>}
            {portfolios.length > 0 && <li>{portfolios.length === 1 ? 'محفظة استثمار واحدة' : `${portfolios.length} محافظ استثمار`}</li>}
            {assets.length > 0 && <li>{assets.length === 1 ? 'أصل واحد أضفته' : `${assets.length} أصول أضفتها`}</li>}
            {rented.map(r => <li key={r.key}>إيجار عقار مؤجر · {plain(r.amount, 0)} ر.س {r.everyText}</li>)}
          </ul>
        </div>
        <div>
          <span className="t12 sub b6">لا نراه، إلا إذا أضفته</span>
          <div className="w-rows">
            {missing.map(([k, t, d, to]) => (
              <button key={k} className="w-rowline" style={{ width: '100%', textAlign: 'start' }} onClick={() => go(to)}>
                <span className="t">{t}</span>
                <span className="v w-link t13">{k === 'bank' ? 'ربط' : 'إضافة'}</span>
                <span className="d">{d}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      {first && (
        <p className="w-note" style={{ marginTop: 14 }}><Icon as={Info} size={14} />
          <span>الرصيد الموجود في أول يوم من الكشف اعتبرنا حوله يبدأ من ذلك اليوم. إن كان المال عندك قبله فحوله أقدم وقد تكون زكاته وجبت أبكر. والديون التي عليك لا تُخصم من الوعاء (دليل الهيئة §3.4).</span>
        </p>
      )}
    </Card>
  );
}

// الرئيسية تجاوب على سؤال واحد: كم عليّ، ومتى؟
export function Dashboard({ path }) {
  const { view, vault, due, payment, historical, persona, k4, nextDue: next, unpaidDues, unpaidTotal } = useStore();
  const [review, setReview] = useState(false);
  const today = view.today;
  const k4Pending = persona === 'khalid' && !k4;
  const name = view.name;
  const state = payment ? 'paid' : due.today ? 'due' : 'none';
  const amount = state === 'paid' ? payment.amount : state === 'due' ? due.zakat : next?.zakat ?? 0;
  return (
    <Shell path={path} title={historical ? `سجل ${name}` : `${greeting()} يا ${name}`}
      desc={historical ? `من ${gregText(view.start?.date ?? today)} إلى ${gregText(today)}` : `${weekday(today)} ${gregText(today)} · ${hijriText(today)}`}>
      {k4Pending && (
        <div className="w-banner" style={{ background: 'var(--warn-soft)', border: '1px solid #EADBB8' }}>
          <span className="grow">المحفظة الاستثمارية (50,000 ر.س) غير محسوبة حتى تحدد نوعها، فالنتيجة جزئية.</span>
          <Btn className="sm" onClick={() => setReview(true)}>تحديد النوع</Btn>
        </div>
      )}
      <div className="w-cols c-dash">
        <Card>
          <div className="w-hero-num">
            <span className="lbl">
              {state === 'paid' ? 'أخرجت زكاتك' : state === 'due' ? 'زكاتك مستحقة اليوم' : `لا شيء مستحق ${historical ? `في ${gregText(today)}` : 'اليوم'}. القادم:`}
              {state === 'none' && <Pill>{next?.advanced ? 'رمضان · تعجيل' : 'توقّع'}</Pill>}
            </span>
            <div className="w-amount"><strong>{plain(amount)}</strong><span>ر.س</span></div>
            <p className="w-quiet">
              {state === 'none' && next ? `${hijriText(next.date)} · ${gregText(next.date)} · بعد ${days(next.inDays)}، إذا بقي الرصيد كما هو` : bothDates(today)}
              {state === 'none' && next?.advanced && <><br />تعجيل قبل موعدها ({hijriText(next.originalDate)}) بـ{days(Math.round((new Date(`${next.originalDate}T00:00:00Z`) - new Date(`${next.date}T00:00:00Z`)) / 86400000))}، ثم يصير رمضان يوم زكاتك كل سنة.</>}
            </p>
          </div>
          <p className="w-quiet" style={{ margin: '18px 0 22px', lineHeight: '24px' }}>
            الوعاء <b>{sar(vault)}</b> · النصاب {historical ? 'يومها' : 'اليوم'} <b>{sar(view.nisab)}</b>
            {state === 'due' && <> · أكمل حولًا <b>{sar(due.base)}</b></>}
            {view.dues.length > 0 && state !== 'due' && (unpaidDues.length > 0
              ? <><br />زكاة سابقة لم تسجّل سدادها <b>{sar(unpaidTotal)}</b> (وجبت {times(unpaidDues.length)}). <button className="w-link" onClick={() => go('/app/history')}>دفعتها؟ سجّلها</button></>
              : <><br />سجّلت سداد زكاة الفترة السابقة.</>)}
          </p>
          <div className="row" style={{ gap: 20 }}>
            {state === 'paid'
              ? <Btn variant="primary" onClick={() => go('/app/receipt')}>عرض الإيصال</Btn>
              : state === 'due'
                ? <Btn variant="primary" onClick={() => go('/app/payout')}>إخراج الزكاة</Btn>
                : <Btn variant="primary" onClick={() => go('/app/timeline')}>افتح السجل</Btn>}
            <button className="w-link t13" onClick={() => go('/app/explain')}>كيف حُسبت؟</button>
          </div>
          {due.inKind.length > 0 && (
            <p className="w-note" style={{ marginTop: 16 }}>وزكاة من جنس المال: {due.inKind.map(a => `${a.result.inKind} عن ${a.short}`).join('، ')}. تُدفع عبر بوابة هيئة الزكاة.</p>
          )}
        </Card>
        <AccountsCard view={view} vault={vault} />
      </div>
      <RentCard />
      <Coverage view={view} />
      {review && <K4Review onClose={() => setReview(false)} />}
    </Shell>
  );
}

function StepRow({ n, title, desc, value, tone }) {
  return (
    <div className="w-list-row" style={{ padding: '16px 0' }}>
      <span className="w-ico" style={{ borderRadius: 99, width: 30, height: 30, fontSize: 12, fontWeight: 700 }}>{n}</span>
      <span className="grow">
        <span className="t" style={{ display: 'block' }}>{title}</span>
        <span className="d">{desc}</span>
      </span>
      <span className="t15 b7" style={{ color: tone === 'ok' ? 'var(--ok)' : tone === 'dim' ? 'var(--sub)' : undefined }}>{value}</span>
    </div>
  );
}

export function Explain({ path }) {
  const { view, vault, due, payment } = useStore();
  if (!due.today && !payment) return <Timeline path={path} />;
  const today = view.today;
  const exempt = view.accounts.filter(a => !accountInfo(a).included && accountInfo(a).kind !== 'fund');
  const newer = vault - due.base;
  const [y, m, d] = view.todayHijri;
  const startIso = hijriToIso(y - 1, m, d);
  const nearest = view.upcoming[0];
  const p = view.prices;
  const amount = payment ? payment.amount : due.zakat;
  return (
    <Shell path={path} title="كيف حُسبت زكاتك"
      crumb={<><button onClick={() => go('/app')}>الرئيسية</button><Icon as={ChevronLeft} size={12} /><span>تفاصيل زكاة {hijriText(today)}</span></>}>
      <div className="w-cols c-wide">
        <Card title="طريقة الحساب" desc="خطوات المحرك على حساباتك المرتبطة، بالترتيب"
          action={due.today && !payment ? <Pill tone="warn">مستحقة اليوم</Pill> : payment ? <Pill tone="ok">أُخرجت</Pill> : null}>
          <div className="w-divide">
            <StepRow n="1" title="إجمالي الوعاء الزكوي" desc={`الحسابات والأصول المضافة، بعد استبعاد المعفى`} value={plain(vault)} />
            <StepRow n="2" title="مقارنة بالنصاب" desc={`الوعاء ${vault >= view.nisab ? 'أعلى من' : 'أقل من'} النصاب (${plain(view.nisab)} ر.س)${vault >= view.nisab ? '، فالزكاة واجبة' : ''}`}
              value={vault >= view.nisab ? 'تجاوز النصاب' : 'دون النصاب'} tone={vault >= view.nisab ? 'ok' : 'dim'} />
            <StepRow n="3" title="مبالغ لم يكمل حولها بعد" desc="تُزكّى معها تعجيلًا إذا اخترت مرة واحدة في السنة" value={`(${plain(newer)})`} tone="dim" />
            <StepRow n="4" title="مبالغ أكملت حولًا هجريًا اليوم" desc={`دخلت حسابك ${startIso ? hijriText(startIso) : ''}، ولم تُصرف`} value={plain(due.base)} />
            <StepRow n="5" title="نسبة الزكاة" desc="ربع العشر" value="2.5٪ ×" />
          </div>
          <div className="w-soft between" style={{ padding: '16px 20px', margin: '8px 0 16px' }}>
            <div>
              <div className="t15 b7">الزكاة المستحقة</div>
              <div className="t12 sub">{plain(due.base)} × 2.5٪ = {plain(due.zakat)}</div>
            </div>
            <div className="w-amount md"><strong>{plain(amount)}</strong><span>ر.س</span></div>
          </div>
          {due.inKind.length > 0 && (
            <div className="w-banner info" style={{ marginBottom: 16 }}>
              <Icon as={Info} />
              <span>زكاة المواشي والمحاصيل تُخرج من جنسها ولا تدخل المبلغ أعلاه: {due.inKind.map(a => `${a.short}: ${a.result.inKind}`).join('، ')}.</span>
            </div>
          )}
          <p className="w-note" style={{ marginBottom: 16 }}>
            <Icon as={Info} size={15} />
            <span>حسبناها وفق {view.methodology.guides[0].title} من {view.methodology.authority}: {view.methodology.applied.map(r => `${r.text} (${r.source})`).join(' ')} الحساب استرشادي.</span>
          </p>
          <div className="row" style={{ gap: 12 }}>
            {payment
              ? <Btn variant="primary" className="grow" onClick={() => go('/app/receipt')}>عرض الإيصال</Btn>
              : <Btn variant="primary" className="grow" disabled={!due.today} onClick={() => go('/app/payout')}>إخراج الزكاة</Btn>}
            <Btn className="grow" icon={Download} onClick={() => window.print()}>تنزيل التفاصيل PDF</Btn>
          </div>
        </Card>

        <div className="col" style={{ gap: 24 }}>
          <Card title="مصدر المبلغ المستحق" desc="المبالغ التي بقيت في حسابك سنة هجرية كاملة">
            <div className="w-divide">
              <div className="w-list-row">
                <span className="w-ico"><Icon as={CalendarCheck2} /></span>
                <span className="grow">
                  <span className="t" style={{ display: 'block' }}>منذ {startIso ? hijriText(startIso) : ''}</span>
                  <span className="d">مرّ عليها حول هجري كامل · {startIso ? daysFrom(startIso, today) : 354} يومًا</span>
                </span>
                <span className="col" style={{ alignItems: 'flex-end', gap: 4 }}>
                  <span className="v">{plain(due.base)}</span>
                  {due.today && <Pill tone="warn">تجب اليوم</Pill>}
                </span>
              </div>
              <div className="w-list-row">
                <span className="w-ico"><Icon as={Clock3} /></span>
                <span className="grow">
                  <span className="t" style={{ display: 'block' }}>مبالغ أحدث</span>
                  <span className="d">لم يكمل حولها بعد{nearest ? ` · أقربها بعد ${days(nearest.inDays)}` : ''}</span>
                </span>
                <span className="v" style={{ color: 'var(--sub)' }}>{plain(newer)}</span>
              </div>
              {exempt.map(a => (
                <div key={a.id} className="w-list-row">
                  <span className="w-ico"><Icon as={CircleMinus} /></span>
                  <span className="grow">
                    <span className="t" style={{ display: 'block' }}>{accountInfo(a).title}</span>
                    <span className="d">{accountInfo(a).sub} · لا يدخل الوعاء</span>
                  </span>
                  <span className="v" style={{ color: 'var(--muted)' }}>{plain(a.balance)}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card title="النصاب اليوم">
            <div className="w-amount md" style={{ marginBottom: 4 }}><strong>{plain(view.nisab)}</strong><span>ر.س</span></div>
            <p className="t12 sub" style={{ marginBottom: 12 }}>أدنى النصابين: 595 غ فضة أو 85 غ ذهب (دليل هيئة الزكاة §2.2.4).</p>
            <div className="w-soft">
              <div className="w-line"><span>595 غ فضة × {plain(p.silverPerGram, 4)}</span><span>{sar(view.nisabByMetal.silver)}</span></div>
              <div className="w-line" style={{ borderTop: '1px solid var(--line)' }}><span>85 غ ذهب × {plain(p.goldPerGram)}</span><span>{sar(view.nisabByMetal.gold)}</span></div>
            </div>
            <p className="t11 muted" style={{ marginTop: 10 }}>أسعار {gregText(p.date)} · gold-api.com</p>
          </Card>
          <Btn className="w-hide-d" icon={ArrowLeft} onClick={() => go('/app')}>العودة إلى الرئيسية</Btn>
        </div>
      </div>
    </Shell>
  );
}

// ---------- السجل: الخط الزمني (كل حدث سطر، والشرح عند الضغط) ----------
export function RecordTabs({ tab }) {
  return (
    <div className="w-tabsline" role="tablist">
      <button role="tab" aria-selected={tab === 'timeline'} onClick={() => go('/app/timeline')}>الخط الزمني</button>
      <button role="tab" aria-selected={tab === 'table'} onClick={() => go('/app/history')}>جدول الزكاة</button>
    </div>
  );
}

// زكاة وجبت في الماضي: هل سجّل المستخدم سدادها؟ (دليل الهيئة §4.2: من تركها لسنوات أخرجها عن كل سنة بقيمتها يوم وجبت)
export function PastDue({ d }) {
  const { selfPaid, recordSelfPaid, undoSelfPaid, historical } = useStore();
  const rec = selfPaid[d.date];
  if (rec) {
    return (
      <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
        <Pill tone="ok">{rec.receipt ? 'أُخرجت عبر نماء' : 'سجّلت أنك دفعتها'}</Pill>
        <span className="t12 sub">في {gregText(rec.on)}</span>
        {rec.receipt
          ? <button className="w-link t12" onClick={() => go(`/app/receipt/${d.date}`)}>الإيصال</button>
          : <button className="w-link t12" onClick={() => undoSelfPaid(d.date)}>تراجع</button>}
      </div>
    );
  }
  return (
    <div style={{ marginTop: 10 }}>
      <p className="t12 sub" style={{ marginBottom: 8 }}>لا يوجد سداد مسجل. إن كنت أخرجتها بنفسك فسجّلها، وإن لم تُخرجها فهي باقية عليك بقيمتها يوم وجبت (دليل الهيئة §4.2).</p>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Btn className="sm" onClick={() => recordSelfPaid(d.date, d.zakat)}>دفعتها بنفسي</Btn>
        {!historical && <Btn variant="primary" className="sm" onClick={() => go(`/app/payout/${d.date}`)}>إخراجها الآن</Btn>}
      </div>
    </div>
  );
}

function Ev({ when, what, amt, cls = '', children }) {
  return (
    <details className="w-more">
      <summary className={`w-ev ${cls}`}>
        <span className="when">{when}</span>
        <span className="what">{what}</span>
        <span className="amt">{amt}</span>
        <Icon as={ChevronLeft} size={14} className="w-chev" />
      </summary>
      <div className="w-more-body">{children}</div>
    </details>
  );
}

export function Timeline({ path }) {
  const { view, persona, personaData, settings, unpaidDues, unpaidTotal } = useStore();
  const annual = settings.acquiredMoneyMode === 'ANNUAL_ADVANCE';
  const transfer = personaData.transactions.find(t => t.internal && t.direction === 'debit');
  const transfers = personaData.transactions.filter(t => t.internal).length / 2;
  const holdings = personaData.holdings ?? [];
  const fund = persona === 'ahmad' ? AHMAD_V2.fund : null;
  const last = view.series.at(-1);
  const bank = view.bankTotal;
  const next = view.nextDue;
  const items = [];
  if (view.start) items.push({ date: view.start.date, el: (
    <Ev key="start" when={gregText(view.start.date)} what="بلغ المال النصاب وبدأ الحول" amt={plain(view.start.total)}>
      {hijriText(view.start.date)}: بلغ الوعاء {sar(view.start.total)}، والنصاب يومها {sar(view.start.nisab)}.
    </Ev>) });
  for (const e of view.events.filter(x => x.type === 'BREAK')) items.push({ date: e.date, el: (
    <Ev key={`b-${e.date}`} when={gregText(e.date)} what="نزل تحت النصاب وانقطع الحول" amt={plain(e.total)}>
      النصاب يومها {sar(e.nisab)}. يبدأ حول جديد حين يعود المال فوق النصاب.
    </Ev>) });
  for (const h of holdings) {
    const acq = h.acquired ?? personaData.period.start;
    const what = h.type === 'fund' ? `تملّك ${fund?.name ?? 'صندوق'}` : h.type === 'gold' ? `شراء ${h.grams} غ ذهب عيار ${h.karat}` : h.type === 'stocks' ? `${h.name ?? 'محفظة أسهم'} للمضاربة` : 'أصل';
    items.push({ date: acq, el: (
      <Ev key={`h-${h.id ?? h.type}`} when={gregText(acq)} what={what} amt={h.type === 'fund' ? plain(h.marketValue) : h.cost ? plain(h.cost) : ''}>
        {h.type === 'fund'
          ? `استثمر ${plain(h.marketValue, 0)} ر.س. يدخل الوعاء بحصته الزكوية لا بقيمته: ${plain(fund?.fundZakatBase ?? 0, 0)} × ${(fund?.ownershipShare ?? 0) * 100}٪ = ${plain(h.zakatableValue, 0)} ر.س (${fund?.disclosureId ?? ''}).`
          : h.type === 'gold' ? `دُفع من ${ACCOUNTS[h.paidFrom]?.bank ?? h.paidFrom}، ويُقيَّم بسعر يوم الوجوب لا بتكلفته.`
            : `تاريخ التملك من أول كشف (تلقائي). تُزكّى بقيمتها السوقية يوم الوجوب.`}
      </Ev>) });
  }
  if (transfer) items.push({ date: transfer.date, el: (
    <Ev key="transfer" when={gregText(transfer.date)} what={`تحويل ${plain(transfer.amount, 0)} ر.س بين حساباتك`} amt="">
      من {ACCOUNTS[transfer.accountId]?.short ?? transfer.accountId} إلى {ACCOUNTS[transfer.counterparty]?.short ?? transfer.counterparty}. طرفان مرتبطان، فلا يُعد دخلًا ولا يبدأ حولًا جديدًا.{transfers > 1 ? ` ومثله ${transfers - 1} تحويلًا آخر في السجل.` : ''}
    </Ev>) });
  for (const d of view.dues) items.push({ date: d.date, el: (
    <Ev key={`d-${d.date}`} cls="due" when={gregText(d.date)} what={`وجبت زكاة ${plain(d.zakat)} ر.س`} amt={plain(d.base)}>
      {hijriText(d.date)}: {annual ? `يوم الزكاة السنوي، فزُكّي الوعاء كله ${sar(d.base)}: ما أكمل حوله، والأحدث تعجيلًا` : `أكمل ${sar(d.base)} حولًا هجريًا`}{d.assetsBase ? ` (نقد ${plain(d.cashBase)} وحصة الصندوق ${plain(d.assetsBase)})` : ''}. النصاب يومها {sar(d.nisab)}.
      {d.date !== view.today && <PastDue d={d} />}
    </Ev>) });
  items.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
  return (
    <Shell path={path} title="السجل" desc={`من ${gregText(view.start?.date ?? personaData.period.start)} إلى ${gregText(view.today)}`}>
      <RecordTabs tab="timeline" />
      <p className="w-quiet" style={{ lineHeight: '26px', maxWidth: 760 }}>
        {view.dues.length
          ? <>وجبت الزكاة <b>{times(view.dues.length)}</b> مجموعها <b>{sar(view.totalDueInPeriod)}</b>، {unpaidDues.length ? <>لم يُسجَّل سداد <b>{sar(unpaidTotal)}</b> منها. </> : 'وسُجّل سدادها كلها. '}</>
          : <>لم يكتمل حول أي مبلغ في هذه الفترة. </>}
        الوعاء في آخر يوم <b>{sar(last.total)}</b>{last.total - bank > 0.005 ? ` (نقد ${plain(bank)} وأصول ${plain(last.total - bank)})` : ''}، والنصاب {plain(view.nisab)}.
      </p>
      <div className="w-cols c-wide">
        <Card title="ما حدث بالترتيب" action={<span className="t12 muted">التاريخ · الحدث · المبلغ</span>}>
          <div className="w-rows">{items.map(i => i.el)}</div>
          {next && (
            <div className="w-ev fc" style={{ borderTop: '1px dashed var(--line-2)', marginTop: 4 }}>
              <span className="when">{gregText(next.date)}</span>
              <span className="what">القادم، توقّع: {plain(next.zakat)} ر.س إذا بقي الرصيد</span>
              <span className="amt" />
              <span />
            </div>
          )}
          {next && <p className="t12 muted" style={{ marginTop: 6 }}>التوقّع منفصل ولا يُضاف إلى مستحقات الفترة.</p>}
        </Card>
        <div className="col" style={{ gap: 24 }}>
          <VaultChart view={view} />
          {fund && (
            <Card title="الصندوق" action={<span className="t11 muted">{fund.disclosureId}</span>}>
              <div className="w-line"><span>المبلغ المستثمر</span><span>{sar(fund.originalInvestment, 0)}</span></div>
              <div className="w-line" style={{ borderTop: '1px solid var(--line)' }}><span>وعاء الصندوق × حصة {view.name}</span><span>{plain(fund.fundZakatBase, 0)} × {fund.ownershipShare * 100}٪</span></div>
              <div className="w-line" style={{ borderTop: '1px solid var(--line)' }}><span>يدخل الوعاء</span><span>{sar(fund.fundZakatBase * fund.ownershipShare, 0)}</span></div>
              <p className="t12 muted" style={{ marginTop: 8 }}>صندوق تعليمي افتراضي لأغراض العرض (دليل الهيئة §3.9).</p>
            </Card>
          )}
        </div>
      </div>
    </Shell>
  );
}
