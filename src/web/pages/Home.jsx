// الرئيسية وصفحة «كيف حُسبت زكاتك». كل رقم من المحرك: buildView (الوعاء والنصاب والوجوب والمواعيد) + أصول المستخدم.
import {
  ArrowLeft, Building2, CalendarCheck2, CalendarClock, ChevronLeft, CircleMinus, Clock3, Download, Info, Landmark,
  WalletCards,
} from 'lucide-react';
import { Btn, Card, Icon, Pill } from '../kit.jsx';
import { go } from '../nav.js';
import { Shell } from '../Shell.jsx';
import { useStore } from '../../figma/model.js';
import { gregText, hijriText, hijriToIso, money } from '../../figma/format.js';
import { ACCOUNTS, bothDates, daysFrom, greeting, hijriFromParts, kFmt, monthName, plain, sar, weekday } from '../data.js';

function AccountsCard({ view }) {
  return (
    <Card title="الحسابات المرتبطة" action={<button className="t12 b7" onClick={() => go('/app/settings/linked')}>إدارة</button>}>
      <div className="w-divide">
        {view.accounts.map(a => (
          <button key={a.id} className="w-list-row" style={{ width: '100%' }} onClick={() => go(`/app/account/${a.id}`)}>
            <span className="w-ico"><Icon as={a.id === 'A1' ? Landmark : a.exempt ? WalletCards : Building2} /></span>
            <span className="grow" style={{ textAlign: 'start' }}>
              <span className="t" style={{ display: 'block' }}>{a.exempt ? `محفظة ${a.product}` : `${ACCOUNTS[a.id].bank} · ${ACCOUNTS[a.id].kind}`}</span>
              <span className="d">{a.exempt ? 'لا تدخل الوعاء · معفاة' : `•••• ${ACCOUNTS[a.id].mask} · محدّث ${ACCOUNTS[a.id].synced}`}</span>
            </span>
            <span className="v" style={a.exempt ? { color: 'var(--muted)', fontWeight: 500 } : undefined}>{sar(a.balance)}</span>
          </button>
        ))}
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
              <span className="d">{gregText(u.date)}{u.inDays <= 30 ? ` · بعد ${u.inDays} يومًا` : ''}</span>
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
  const { view, vault, due, payment } = useStore();
  const next = view.nextDue;
  const today = view.today;
  return (
    <Shell path={path} title={`${greeting()} يا ${view.name}`} desc={`${weekday(today)} ${gregText(today)} · ${hijriText(today)}`}>
      <div className="w-cols c-dash">
        <div className="col" style={{ gap: 24 }}>
          <Card>
            <div className="between" style={{ marginBottom: 8 }}>
              <h2 className="t16 b7">زكاة المال</h2>
              {payment ? <Pill tone="ok">أُخرجت</Pill> : due.today ? <Pill tone="warn">مستحقة اليوم</Pill> : <Pill>لا وجوب اليوم</Pill>}
            </div>
            <div className="w-amount">
              <strong>{payment ? plain(payment.amount) : due.today ? plain(due.zakat) : plain(next?.zakat ?? 0)}</strong>
              <span>ر.س</span>
            </div>
            <p className="t12 muted" style={{ marginBottom: 20 }}>
              {due.today || payment ? bothDates(today) : next ? `القادمة في ${hijriFromParts(next.hijri)} · بعد ${next.inDays} يومًا` : ''}
            </p>
            <div className="w-stats" style={{ marginBottom: 20 }}>
              <div className="w-stat"><span>إجمالي الوعاء</span><strong>{sar(vault)}</strong></div>
              <div className="w-stat"><span>أكمل حولًا هجريًا</span><strong>{sar(due.base)}</strong></div>
              <div className="w-stat"><span>نسبة الزكاة</span><strong>2.5٪</strong></div>
            </div>
            <div className="row" style={{ gap: 12 }}>
              {payment
                ? <Btn variant="primary" className="grow" onClick={() => go('/app/receipt')}>عرض الإيصال</Btn>
                : <Btn variant="primary" className="grow" disabled={!due.today} onClick={() => go('/app/payout')}>إخراج الزكاة</Btn>}
              <Btn className="grow" onClick={() => go('/app/explain')}>كيف حُسبت؟</Btn>
            </div>
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
  const today = view.today;
  const exempt = view.accounts.filter(a => a.exempt);
  const exemptTotal = exempt.reduce((s, a) => s + a.balance, 0);
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
                  <span className="d">لم يكمل حولها بعد{nearest ? ` · أقربها بعد ${nearest.inDays} يومًا` : ''}</span>
                </span>
                <span className="v" style={{ color: 'var(--sub)' }}>{plain(newer)}</span>
              </div>
              {exempt.map(a => (
                <div key={a.id} className="w-list-row">
                  <span className="w-ico"><Icon as={CircleMinus} /></span>
                  <span className="grow">
                    <span className="t" style={{ display: 'block' }}>محفظة {a.product}</span>
                    <span className="d">منتج استثماري معفى · لا يدخل الوعاء</span>
                  </span>
                  <span className="v" style={{ color: 'var(--muted)' }}>{plain(exemptTotal)}</span>
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
