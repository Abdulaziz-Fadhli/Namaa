// الرئيسية وصفحة «كيف حُسبت زكاتك». كل رقم من المحرك: buildView (الوعاء والنصاب والوجوب والمواعيد) + أصول المستخدم.
import {
  ArrowLeft, ArrowLeftRight, Building2, CalendarCheck2, CalendarClock, ChevronLeft, CircleMinus, Clock3, Download, Flag, Gem,
  GitCommitVertical, Info, Landmark, PieChart, Receipt, TriangleAlert,
} from 'lucide-react';
import { Btn, Card, Icon, Pill } from '../kit.jsx';
import { go } from '../nav.js';
import { Shell } from '../Shell.jsx';
import { useStore } from '../../figma/model.js';
import { gregText, hijriText, hijriToIso, money } from '../../figma/format.js';
import { ACCOUNTS, accountInfo, bothDates, daysFrom, greeting, hijriFromParts, kFmt, monthName, plain, sar, weekday, days } from '../data.js';
import { AHMAD_V2 } from '../../engine/ahmad-v2.js';
import { K4Review } from './Assets.jsx';
import { useState } from 'react';

function AccountsCard({ view }) {
  return (
    <Card title="الحسابات المرتبطة" action={<button className="t12 b7" onClick={() => go('/app/settings/linked')}>إدارة</button>}>
      <div className="w-divide">
        {view.accounts.map(a => {
          const info = accountInfo(a);
          return (
            <button key={a.id} className="w-list-row" style={{ width: '100%' }} onClick={() => go(`/app/account/${a.id}`)}>
              <span className={`w-ico${info.kind === 'review' ? ' warn' : ''}`}><Icon as={info.kind === 'fund' ? PieChart : info.kind === 'review' ? TriangleAlert : a.id.endsWith('1') ? Landmark : Building2} /></span>
              <span className="grow" style={{ textAlign: 'start' }}>
                <span className="t" style={{ display: 'block' }}>{info.title}</span>
                <span className="d">{info.kind === 'cash' ? `•••• ${info.mask} · محدّث ${info.synced}` : info.sub}</span>
              </span>
              <span className="v" style={info.kind === 'review' ? { color: 'var(--muted)', fontWeight: 500 } : undefined}>{sar(a.balance)}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function Upcoming({ view }) {
  return (
    <Card title="المواعيد القادمة" desc="متوقعة إذا بقي رصيدك كما هو"
      action={<button className="t12 b7" onClick={() => go('/app/history')}>السجل الكامل</button>}>
      <div className="w-divide">
        {view.upcoming.slice(0, 4).map(u => (
          <div key={u.date} className="w-list-row">
            <span className="w-ico"><Icon as={CalendarClock} /></span>
            <span className="grow">
              <span className="t" style={{ display: 'block' }}>{hijriFromParts(u.hijri)}</span>
              <span className="d">{gregText(u.date)}{u.inDays <= 30 ? ` · بعد ${days(u.inDays)}` : ''}</span>
            </span>
            <span style={{ textAlign: 'left' }}>
              <span className="v" style={{ display: 'block' }}>{sar(u.zakat)}</span>
              <span className="t11 muted">على {plain(u.base)}</span>
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function VaultChart({ view }) {
  const months = view.monthly;
  const max = Math.max(...months.map(m => m.total), view.nisab) * 1.08;
  const nisab = months.at(-1).nisab;
  return (
    <Card title={`الوعاء خلال ${months.length} أشهر`}
      action={<span className="w-legend"><span><i style={{ background: 'var(--gold)', height: 2, width: 14 }} />النصاب {plain(nisab)} ر.س</span></span>}>
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

export function Dashboard({ path }) {
  const { view, vault, due, payment, historical, persona, k4 } = useStore();
  const [review, setReview] = useState(false);
  const next = view.nextDue;
  const today = view.today;
  const k4Pending = persona === 'khalid' && !k4;
  const name = view.name;
  return (
    <Shell path={path} title={historical ? `سجل ${name}` : `${greeting()} يا ${name}`}
      desc={historical ? `من ${hijriText(view.start?.date ?? today)} إلى ${hijriText(today)} · ${gregText(today)}` : `${weekday(today)} ${gregText(today)} · ${hijriText(today)}`}>
      {k4Pending && (
        <div className="w-banner" style={{ background: 'var(--warn-bg)', border: '1px solid #F3E2B8' }}>
          <Icon as={TriangleAlert} />
          <span><b>النتيجة جزئية:</b> محفظة نماء الاستثمارية (50,000 ر.س) غير محسوبة حتى نعرف نوعها. لا نعتبرها معفاة من اسمها.</span>
          <Btn variant="primary" className="sm" onClick={() => setReview(true)}>إكمال المعلومات</Btn>
        </div>
      )}
      {persona === 'khalid' && (
        <div className="w-kpis">
          <div className="w-kpi"><span className="t12 sub">المستحق الآن</span><strong>{sar(payment ? 0 : due.zakat)}</strong><span className="t11 muted">{due.today ? 'وجبت اليوم' : `لا وجوب في ${gregText(today)}`}</span></div>
          <div className="w-kpi"><span className="t12 sub">لم يحل حوله بعد</span><strong>{sar(vault - (due.today ? due.base : 0))}</strong><span className="t11 muted">{view.upcoming.length} مواعيد قادمة</span></div>
          <div className="w-kpi"><span className="t12 sub">القادم · توقّع</span><strong>{next ? sar(next.zakat) : '—'}</strong><span className="t11 muted">{next ? `${gregText(next.date)} · بعد ${days(next.inDays)}` : ''}</span></div>
          <div className="w-kpi"><span className="t12 sub">يحتاج معلومات</span><strong>{k4Pending ? 'حساب واحد' : 'لا شيء'}</strong><span className="t11 muted">{k4Pending ? 'محفظة نماء الاستثمارية' : 'كل الحسابات محسوبة'}</span></div>
        </div>
      )}
      <div className="w-cols c-dash">
        <div className="col" style={{ gap: 24 }}>
          <Card>
            <div className="between" style={{ marginBottom: 8 }}>
              <h2 className="t16 b7">زكاة المال</h2>
              {payment ? <Pill tone="ok">أُخرجت</Pill> : due.today ? <Pill tone="warn">مستحقة اليوم</Pill> : <Pill tone="info">{historical ? 'لا وجوب في هذا اليوم' : 'لا وجوب اليوم'}</Pill>}
            </div>
            {!due.today && !payment && next && <p className="t12 sub">القادم · توقّع إذا بقي الرصيد كما هو، وليس مستحقًا الآن</p>}
            <div className="w-amount">
              <strong>{payment ? plain(payment.amount) : due.today ? plain(due.zakat) : plain(next?.zakat ?? 0)}</strong>
              <span>ر.س</span>
            </div>
            <p className="t12 muted" style={{ marginBottom: 20 }}>
              {due.today || payment ? bothDates(today) : next ? `${hijriFromParts(next.hijri)} · ${gregText(next.date)} · بعد ${days(next.inDays)} من ${historical ? 'تاريخ السجل' : 'اليوم'}` : ''}
            </p>
            <div className="w-stats" style={{ marginBottom: 20 }}>
              <div className="w-stat"><span>إجمالي الوعاء</span><strong>{sar(vault)}</strong></div>
              {due.today || payment
                ? <div className="w-stat"><span>أكمل حولًا هجريًا</span><strong>{sar(due.base)}</strong></div>
                : <div className="w-stat"><span>النصاب {historical ? 'يومها' : 'اليوم'}</span><strong>{sar(view.nisab)}</strong></div>}
              {due.today || payment
                ? <div className="w-stat"><span>نسبة الزكاة</span><strong>2.5٪</strong></div>
                : <div className="w-stat"><span>مستحقات الفترة</span><strong>{sar(view.totalDueInPeriod)}</strong></div>}
            </div>
            <div className="row" style={{ gap: 12 }}>
              {payment
                ? <Btn variant="primary" className="grow" onClick={() => go('/app/receipt')}>عرض الإيصال</Btn>
                : due.today
                  ? <Btn variant="primary" className="grow" onClick={() => go('/app/payout')}>إخراج الزكاة</Btn>
                  : <Btn variant="primary" className="grow" icon={GitCommitVertical} onClick={() => go('/app/timeline')}>الخط الزمني</Btn>}
              <Btn className="grow" onClick={() => go('/app/explain')}>كيف حُسبت؟</Btn>
            </div>
            {view.dues.length > 0 && !due.today && (
              <div className="w-banner info" style={{ marginTop: 16 }}>
                <Icon as={Receipt} />
                <span>مستحقات الفترة {sar(view.totalDueInPeriod)} في {view.dues.length} {view.dues.length > 2 && view.dues.length < 11 ? 'أحداث' : 'حدثًا'} · <b>لا يوجد سداد مسجل</b> في هذا السجل.</span>
              </div>
            )}
            {due.inKind.length > 0 && (
              <div className="w-banner info" style={{ marginTop: 16 }}>
                <Icon as={Info} />
                <span>وزكاة من جنس المال: {due.inKind.map(a => `${a.result.inKind} عن ${a.short}`).join('، ')}. تُدفع عبر بوابة هيئة الزكاة.</span>
              </div>
            )}
          </Card>
          <VaultChart view={view} />
        </div>
        <div className="col" style={{ gap: 24 }}>
          <Upcoming view={view} />
          <AccountsCard view={view} />
        </div>
      </div>
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
            <StepRow n="3" title="مبالغ لم يكمل حولها بعد" desc="لكل مبلغ حول مستقل من يوم دخوله إلى حسابك" value={`(${plain(newer)})`} tone="dim" />
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

// ---------- الخط الزمني: من بداية المتابعة إلى التاريخ المرجعي، ثم القادم توقعًا منفصلًا ----------
function TimelineItem({ icon, tone, date, title, children, value }) {
  return (
    <div className="row" style={{ alignItems: 'flex-start', gap: 14, padding: '14px 0' }}>
      <span className={`w-ico ${tone ?? ''}`} style={{ borderRadius: 99 }}><Icon as={icon} /></span>
      <span className="grow">
        <span className="t12 sub" style={{ display: 'block' }}>{date}</span>
        <span className="b7" style={{ display: 'block' }}>{title}</span>
        {children && <span className="t13 sub" style={{ display: 'block' }}>{children}</span>}
      </span>
      {value && <span className="b7" style={{ whiteSpace: 'nowrap' }}>{value}</span>}
    </div>
  );
}

export function Timeline({ path }) {
  const { view, persona, personaData, historical } = useStore();
  const transfer = personaData.transactions.find(t => t.internal && t.direction === 'debit');
  const holdings = personaData.holdings ?? [];
  const fund = persona === 'ahmad' ? AHMAD_V2.fund : null;
  const last = view.series.at(-1);
  const bank = view.bankTotal;
  const items = [];
  if (view.start) items.push({ date: view.start.date, el: (
    <TimelineItem key="start" icon={Flag} tone="sel" date={bothDates(view.start.date)} title="بدأ تتبع الحول" value={sar(view.start.total)}>
      بلغ الوعاء {sar(view.start.total)} والنصاب يومها {sar(view.start.nisab)}، فبدأ الحول الهجري.
    </TimelineItem>) });
  for (const h of holdings) {
    const acq = h.acquired ?? personaData.period.start;
    items.push({ date: acq, el: (
      <TimelineItem key={`h-${h.id ?? h.type}`} icon={h.type === 'gold' ? Gem : PieChart} date={bothDates(acq)}
        title={h.type === 'fund' ? `تملّك ${fund?.name ?? 'صندوق'}` : h.type === 'gold' ? `شراء ${h.grams} غ ذهب عيار ${h.karat}` : h.type === 'stocks' ? `${h.name ?? 'محفظة أسهم'} · ${h.intent === 'trading' ? 'للمضاربة' : 'للاستثمار'}` : 'أصل'}
        value={h.type === 'fund' ? sar(h.marketValue) : h.cost ? sar(h.cost) : null}>
        {h.type === 'fund'
          ? `استثمار ${plain(h.marketValue)} ر.س. وعاء الصندوق المعلن ${plain(fund?.fundZakatBase ?? 0)} × حصة ${(fund?.ownershipShare ?? 0) * 100}٪ = حصته الزكوية ${plain(h.zakatableValue)} ر.س (إفصاح ${fund?.disclosureId ?? ''}). تكلفة الصندوق ليست وعاءه.`
          : h.type === 'gold' ? `دُفعت من ${ACCOUNTS[h.paidFrom]?.bank ?? h.paidFrom} مرة واحدة، ويُقيَّم الذهب بسعر يومه لا بتكلفته.`
            : 'تُقيَّم بالقيمة السوقية يوم الوجوب (دليل الهيئة §3.6).'}
      </TimelineItem>) });
  }
  if (transfer) items.push({ date: transfer.date, el: (
    <TimelineItem key="transfer" icon={ArrowLeftRight} date={bothDates(transfer.date)} title={`تحويل داخلي ${plain(transfer.amount, 0)} ر.س`}>
      من {ACCOUNTS[transfer.accountId]?.short ?? transfer.accountId} إلى {ACCOUNTS[transfer.counterparty]?.short ?? transfer.counterparty}: طرفان مرتبطان، فلا يزيد إجمالي المال ولا يبدأ حولًا جديدًا. ومثله {personaData.transactions.filter(t => t.internal).length / 2 - 1} تحويلًا آخر.
    </TimelineItem>) });
  for (const d of view.dues) items.push({ date: d.date, el: (
    <TimelineItem key={`d-${d.date}`} icon={Receipt} tone="warn" date={bothDates(d.date)} title={`وجبت زكاة ${sar(d.zakat)}`} value={sar(d.base)}>
      اكتمل حول {plain(d.base)} ر.س{d.assetsBase ? ` (نقد ${plain(d.cashBase)} + حصة الصندوق ${plain(d.assetsBase)}، زكاتها ${plain(d.assetsBase / 40)})` : ''}. النصاب يومها {sar(d.nisab)}. لا يوجد سداد مسجل.
    </TimelineItem>) });
  items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const next = view.nextDue;
  return (
    <Shell path={path} title="الخط الزمني" desc={`من بداية المتابعة إلى ${hijriText(view.today)} · ${gregText(view.today)}`}>
      <div className="w-kpis">
        <div className="w-kpi"><span className="t12 sub">بدأ التتبع</span><strong>{view.start ? hijriText(view.start.date) : '—'}</strong><span className="t11 muted">{view.start ? gregText(view.start.date) : 'لم يبلغ النصاب بعد'}</span></div>
        <div className="w-kpi"><span className="t12 sub">مستحقات الفترة</span><strong>{sar(view.totalDueInPeriod)}</strong><span className="t11 muted">{view.dues.length} أحداث · لا يوجد سداد مسجل</span></div>
        <div className="w-kpi"><span className="t12 sub">الوعاء في آخر يوم</span><strong>{sar(last.total)}</strong><span className="t11 muted">نقد {plain(bank)}{last.total - bank > 0.005 ? ` + أصول ${plain(last.total - bank)}` : ''} · النصاب {fund ? plain(AHMAD_V2.reference.nisab, 4) : plain(last.nisab)}</span></div>
        <div className="w-kpi"><span className="t12 sub">القادم · توقّع</span><strong>{next ? sar(next.zakat) : '—'}</strong><span className="t11 muted">{next ? `${gregText(next.date)} · لا يُضاف للمجموع` : ''}</span></div>
      </div>
      <div className="w-cols c-wide">
        <Card title="ما حدث بالترتيب" desc={historical ? 'سجل مغلق: لا يتغير بمرور وقت العرض' : 'من كشف حساباتك'}>
          <div className="w-divide">{items.map(i => i.el)}</div>
          {next && (
            <div className="w-soft" style={{ marginTop: 12, padding: '4px 16px', border: '1.5px dashed var(--line-2)' }}>
              <TimelineItem icon={CalendarClock} tone="sel" date={`${bothDates(next.date)} · FORECAST`} title={`القادم: ${sar(next.zakat)}`}>
                توقّع إذا بقي الرصيد فوق النصاب. ليس مستحقًا في {gregText(view.today)}، ولا يُضاف إلى مستحقات الفترة.
              </TimelineItem>
            </div>
          )}
        </Card>
        <div className="col" style={{ gap: 24 }}>
          {fund && (
            <Card title="تفاصيل الصندوق" desc={`${fund.disclosureId} · افتراض سيناريو معتمد`}>
              <div className="w-soft">
                <div className="w-line"><span>تاريخ التملك</span><span>{gregText(fund.acquired)}</span></div>
                <div className="w-line" style={{ borderTop: '1px solid var(--line)' }}><span>المبلغ المستثمر</span><span>{sar(fund.originalInvestment)}</span></div>
                <div className="w-line" style={{ borderTop: '1px solid var(--line)' }}><span>وعاء الصندوق المعلن</span><span>{sar(fund.fundZakatBase, 0)}</span></div>
                <div className="w-line" style={{ borderTop: '1px solid var(--line)' }}><span>حصة {view.name}</span><span>{fund.ownershipShare * 100}٪</span></div>
                <div className="w-line" style={{ borderTop: '1px solid var(--line)' }}><span>الحصة الزكوية</span><span>{sar(fund.fundZakatBase * fund.ownershipShare)}</span></div>
                <div className="w-line" style={{ borderTop: '1px solid var(--line)' }}><span>زكاتها عند أول حول</span><span>{sar(fund.fundZakatBase * fund.ownershipShare / 40)}</span></div>
              </div>
              <p className="t12 sub" style={{ marginTop: 10 }}>الصندوق للاستثمار، فيُزكّى بحسب موجوداته الزكوية: وعاء الصندوق × نسبة الملكية × 2.5٪ (دليل الهيئة §3.9). صندوق تعليمي افتراضي، وليس منتجًا حقيقيًا.</p>
            </Card>
          )}
          <Card title="كيف نقرأ هذا السجل">
            <div className="col t13 sub" style={{ gap: 8 }}>
              <span>• كل مبلغ له حوله من يوم دخوله، والتحويل بين حساباتك لا يُعد دخلًا جديدًا.</span>
              <span>• مستحقات الفترة مجموع الأحداث المحسوبة ({sar(view.totalDueInPeriod)})، ولا تعني أنها دُفعت.</span>
              <span>• القادم توقّع منفصل بتاريخه وافتراضه، ولا يُضاف للمجموع.</span>
              <span>• {view.methodology.short}.</span>
            </div>
            <Btn className="block" icon={ArrowLeft} style={{ marginTop: 14 }} onClick={() => go('/app/history')}>سجل الزكاة بالجدول</Btn>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
