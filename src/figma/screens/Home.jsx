// الرئيسية والإشعارات والإعدادات. المنحنى من سلسلة الوعاء الأسبوعية التي يحسبها المحرك.
import {
  Bell, BellRing, BookOpen, CalendarClock, Check, CheckCheck, Database, House, Info, RefreshCw, Scale, Settings,
  ShieldCheck, WalletCards, ArrowLeft,
} from 'lucide-react';
import { Button, Ico, InfoRow, Note, Screen, StatusBar } from '../ui.jsx';
import { Flash, LivePill, RefreshButton } from '../livebits.jsx';
import { bankName, useStore } from '../model.js';
import { HIJRI_MONTHS, daysText, gregShort, hijriText, money } from '../format.js';

// منحنى ناعم يمر بالنقاط (Catmull-Rom ← Bezier)، الأقدم يسار واليوم يمين مثل فيجما
function curvePath(values, w = 310, h = 78) {
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - ((v - min) / span) * h]);
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1.map(n => n.toFixed(1)).join(' ')} ${c2.map(n => n.toFixed(1)).join(' ')} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

// متوسط متحرك لأربعة أسابيع: الرواتب والمصاريف الشهرية تجعل الرصيد الأسبوعي متعرّجًا
const smooth = values => values.map((_, i) => {
  const w = values.slice(Math.max(0, i - 3), i + 1);
  return w.reduce((a, b) => a + b, 0) / w.length;
});

export function Home({ go }) {
  const { view, vault, otherAssets, dueNow, payment, due, live, feed } = useStore();
  const next = view.nextDue;
  const nisabDir = feed.metalDir('silver') || feed.metalDir('gold');
  const s = view.series;
  const axis = [0, Math.round(s.length / 3), Math.round((2 * s.length) / 3)].map(i => HIJRI_MONTHS[s[i].hijri[1] - 1]);
  const hour = new Date().getHours();
  return (
    <div className="nm light" dir="rtl" lang="ar" role="main" aria-label="الرئيسية">
      <div className="nm-hero">
        <StatusBar />
        <div className="nm-hero-body">
          <div className="nm-hero-head">
            <div className="nm-greet">
              <span>{hour < 12 ? 'صباح الخير' : 'مساء الخير'}</span>
              <strong>{view.name}</strong>
              <LivePill />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <RefreshButton />
              <button className="nm-round" onClick={() => go('notifications')} aria-label="الإشعارات"><Ico as={Bell} /></button>
            </div>
          </div>
          <div className="nm-hero-zakat">
            {payment || due.today ? (
              <>
                <span>{payment ? 'أخرجت زكاة اليوم' : 'زكاتك المستحقة'}</span>
                <button className="nm-hero-amount" onClick={() => go('explain')} aria-label="كيف حسبنا المبلغ؟">
                  <Flash value={payment ? payment.amount : dueNow}>{money(payment ? payment.amount : dueNow)}</Flash>
                </button>
              </>
            ) : (
              <>
                <span>لا زكاة واجبة اليوم · القادمة</span>
                <button className="nm-hero-amount" onClick={() => go('timeline')} aria-label="الوجوب القادم">
                  {next ? money(next.zakat, { decimals: 2 }) : money(0)}
                </button>
              </>
            )}
            {next && (
              <button className="nm-chip" onClick={() => go('timeline')}>
                <Ico as={CalendarClock} size={14} />
                <span>{due.today || payment ? 'الوجوب التالي' : 'تجب'} بعد {daysText(next.inDays)}</span>
              </button>
            )}
          </div>
          <div className="nm-chart" aria-label="تطور الوعاء خلال الأشهر الماضية">
            <svg width="310" height="80" viewBox="-1 -1 312 80" fill="none" style={{ alignSelf: 'flex-end' }} aria-hidden="true">
              <path d={curvePath(smooth(s.map(r => r.total)))} stroke="white" strokeWidth="2" />
            </svg>
            <div className="nm-chart-axis">{axis.map((m, i) => <span key={i}>{m}</span>)}<span>اليوم</span></div>
          </div>
        </div>
      </div>
      <div className="nm-home-details">
        <div className="nm-main">
          <div className="nm-indicators">
            <button className="nm-indicator" onClick={() => go('details')}>
              <span>إجمالي الوعاء</span><strong><Flash value={vault}>{money(vault)}</Flash></strong>
            </button>
            <button className="nm-indicator" onClick={() => go('settings')}>
              <span>النصاب{live ? ' الآن' : ''}</span><strong><Flash value={view.nisab} dir={nisabDir}>{money(Math.round(view.nisab))}</Flash></strong>
            </button>
          </div>
          <div className="nm-summary">
            <button onClick={() => go('details')}><span>الحسابات البنكية</span><strong>{money(view.bankTotal)}</strong></button>
            <button onClick={() => go('offbank')}><span>أصول أخرى</span><strong><Flash value={otherAssets}>{money(otherAssets)}</Flash></strong></button>
          </div>
        </div>
        <nav className="nm-nav" aria-label="التنقل">
          <button aria-current="page"><Ico as={House} size={16} /><span>الرئيسية</span></button>
          <button onClick={() => go('details')}><Ico as={WalletCards} size={16} /><span>الأصول</span></button>
          <button onClick={() => go('settings')}><Ico as={Settings} size={16} /><span>الإعدادات</span></button>
        </nav>
      </div>
    </div>
  );
}

export function Notifications({ go, back }) {
  const { view, pendingBanks, payment, due } = useStore();
  const linked = view.accounts.find(a => !a.exempt && a.type === 'savings') ?? view.accounts[0];
  return (
    <Screen title="الإشعارات" desc="كل ما يحتاج انتباهك، مرتّب حسب الأهمية." onBack={back}
      cta={<Button variant="primary" icon={ArrowLeft} onClick={() => go('timeline')}>فتح تفاصيل الوجوب</Button>}>
      {payment || due.today ? (
        <InfoRow icon={BellRing} selected onClick={() => go('timeline')}
          title={payment ? 'أخرجت زكاة اليوم' : 'وجبت زكاة اليوم'}
          detail={`${money(payment ? payment.amount : due.zakat)} • ${payment ? 'تم' : 'جديد'}`} />
      ) : view.nextDue && (
        <InfoRow icon={BellRing} selected onClick={() => go('timeline')}
          title={`تجب زكاتك بعد ${daysText(view.nextDue.inDays)}`}
          detail={`${money(view.nextDue.zakat, { decimals: 2 })} في ${hijriText(view.nextDue.date)}`} />
      )}
      <InfoRow icon={RefreshCw} onClick={() => go('details')} title="اكتمل تحديث السوق"
        detail={`أعيد تقييم الذهب والفضة • ${gregShort(view.prices.date)}`} />
      <InfoRow icon={CheckCheck} onClick={() => go('link')} title="تم ربط الحساب" detail={`${bankName(linked.bank)} • أمس`} />
      {pendingBanks.length > 0 ? (
        <button className="nm-hint filled" onClick={() => go('link')}>
          <span className="nm-hint-title">بانتظار موافقة {pendingBanks.at(-1)}</span>
          <span className="nm-hint-detail">أكمل الموافقة من تطبيق البنك ثم أعد المحاولة.</span>
        </button>
      ) : view.nextDue && (
        <button className="nm-hint filled" onClick={() => go('timeline')}>
          <span className="nm-hint-title">الوجوب التالي بعد {daysText(view.nextDue.inDays)}</span>
          <span className="nm-hint-detail">{money(view.nextDue.zakat, { decimals: 2 })} في {hijriText(view.nextDue.date)}</span>
        </button>
      )}
    </Screen>
  );
}

export function SettingsScreen({ go, back }) {
  const { view, lastZakat } = useStore();
  const basis = view.nisabByMetal.silver <= view.nisabByMetal.gold ? 'الفضة' : 'الذهب';
  const count = view.accounts.length;
  return (
    <Screen title="الإعدادات" desc="تحكم في طريقة الاحتساب والبيانات والتنبيهات." onBack={back}
      cta={<Button variant="primary" icon={Check} onClick={back}>حفظ</Button>}>
      <InfoRow icon={BookOpen} title="المنهجية الشرعية"
        detail={view.settings.acquiredMoneyMode === 'INDEPENDENT_HAWL' ? 'فتوى اللجنة الدائمة 282 • حول مستقل لكل مبلغ' : 'حول سنوي واحد'} />
      <InfoRow icon={Scale} title="أساس النصاب" detail={`الأقل من الذهب والفضة (${basis}) • ${money(Math.round(view.nisab))}`} />
      <InfoRow icon={Bell} title="التنبيهات" detail={lastZakat ? `آخر زكاة ${hijriText(lastZakat.iso)} • قبل الوجوب بـ 30 و7 أيام` : 'قبل الوجوب بـ 30 و7 أيام'} />
      <InfoRow icon={Database} title="مصادر البيانات" detail={`${count} حسابات • أسعار الذهب والفضة`} onClick={() => go('link')} />
      <InfoRow icon={ShieldCheck} title="الخصوصية" detail="صلاحية قراءة فقط" />
      <Note icon={Info}>تُحفظ التغييرات من دون التأثير في سجلّك السابق.</Note>
    </Screen>
  );
}
