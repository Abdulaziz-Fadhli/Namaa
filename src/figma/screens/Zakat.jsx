// تفسير الزكاة والخط الزمني والإخراج والإيصال. الأرقام والشروح من أحداث المحرك (START و DUE).
import { useState } from 'react';
import {
  ArrowLeft, Building2, Calculator, CalendarSync, Check, CircleMinus, Download, HandHeart, House, Landmark,
  Layers3, LockKeyhole, Scale, ShieldCheck,
} from 'lucide-react';
import { Button, Frame, Ico, InfoRow, Line, Note, Screen, AmountCard } from '../ui.jsx';
import { CHANNELS, bankName, useStore } from '../model.js';
import { HIJRI_MONTHS, daysText, gregShort, gregText, hijriParts, hijriText, money } from '../format.js';

function Step({ icon, title, detail }) {
  return (
    <div className="nm-step">
      <span className="nm-step-icon"><Ico as={icon} /></span>
      <span className="nm-row-info">
        <span className="nm-row-title">{title}</span>
        <span className="nm-step-detail">{detail}</span>
      </span>
    </div>
  );
}

export function Explain({ go, back }) {
  const { view, vault, payment, due } = useStore();
  const [sources, setSources] = useState(false);
  const exempt = view.accounts.filter(a => a.exempt);
  if (!due.today && !payment) {
    return (
      <Screen theme="dark" title="لا زكاة واجبة اليوم" desc="لم يكتمل الحول اليوم على أي مبلغ في وعائك." onBack={back}
        cta={<Button variant="primary" icon={ArrowLeft} onClick={() => go('timeline')}>الخط الزمني</Button>}>
        <Note icon={Scale}>{view.nextDue
          ? `الوجوب القادم في ${hijriText(view.nextDue.date)}: ${money(view.nextDue.zakat, { decimals: 2 })}، إن بقي الوعاء فوق النصاب (${money(Math.round(view.nisab))}).`
          : `الوعاء ${money(Math.round(vault))} والنصاب ${money(Math.round(view.nisab))}.`}</Note>
      </Screen>
    );
  }
  return (
    <Screen theme="dark" title={`كيف وصلنا إلى ${money(due.zakat)}؟`} desc="احتساب واضح يستند إلى الأصول التي أكملت الحول." onBack={back}
      cta={payment
        ? <Button variant="primary" icon={ArrowLeft} onClick={() => go('success')}>عرض الإيصال</Button>
        : <Button variant="primary" icon={ArrowLeft} onClick={() => go('payout')}>إخراج الزكاة</Button>}>
      <Step icon={Layers3} title="جمع الأصول الزكوية" detail={`إجمالي الوعاء ${money(vault)}`} />
      <Step icon={CircleMinus} title="استبعاد غير الخاضع"
        detail={`${exempt.map(a => `${a.product} ${money(a.balance)}`).join('، ')}، والمبالغ التي لم يكتمل حولها`} />
      <Step icon={Calculator} title="تطبيق النسبة" detail={`2.5٪ على ${money(due.base)} اكتمل حولها اليوم`} />
      {due.inKind.length > 0 && (
        <Step icon={HandHeart} title="زكاة المواشي والمحاصيل"
          detail={`${due.inKind.map(a => `${a.short}: ${a.result.inKind}`).join('، ')}. تُخرج من جنسها عبر بوابة الهيئة، ولا تدخل المبلغ أعلاه.`} />
      )}
      <div className="nm-btn-pair">
        <Button onClick={() => go('timeline')}>الخط الزمني</Button>
        <Button onClick={() => setSources(s => !s)}>{sources ? 'إخفاء المصادر' : 'المصادر'}</Button>
      </div>
      {sources && (
        <div className="nm-box" role="region" aria-label="المصادر">
          {view.due && <p style={{ fontSize: 11, lineHeight: '18px' }}>{view.due.explanation}</p>}
          {due.matured.length > 0 && (
            <p style={{ fontSize: 11, lineHeight: '18px' }}>
              وأصول أضفتها أكملت حولًا هجريًا من تاريخ تملكها: {due.matured.map(a => `${a.title} ${money(a.value)}`).join('، ')}، زكاتها {money(due.maturedBase / 40, { decimals: 2 })}.
            </p>
          )}
          {view.start && <p style={{ fontSize: 11, lineHeight: '18px', color: 'var(--nm-muted)' }}>{view.start.explanation}</p>}
          <p style={{ fontSize: 11, lineHeight: '18px', color: 'var(--nm-muted)' }}>{view.methodology.statement}</p>
          {view.methodology.applied.map(r => (
            <p key={r.rule} style={{ fontSize: 11, lineHeight: '18px', color: 'var(--nm-muted)' }}>{r.text} ({r.source})</p>
          ))}
        </div>
      )}
      <Note icon={Scale}>النصاب الحالي {money(Math.round(view.nisab))}، والوعاء أعلى منه.</Note>
    </Screen>
  );
}

const hijriMonthYear = iso => { const h = hijriParts(iso); return `${HIJRI_MONTHS[h.m - 1]} ${h.y}`; };

export function Timeline({ go, back }) {
  const { view, payment, due, vault } = useStore();
  const next = view.nextDue;
  const todayText = view.due
    ? (due.matured.length ? `${view.due.explanation} ويضاف ${money(due.maturedBase / 40, { decimals: 2 })} عن أصول أضفتها أكملت حولها، فالمجموع ${money(due.zakat)}.` : view.due.explanation)
    : due.today
      ? `أصول أضفتها أكملت حولها اليوم، فتجب ${money(due.zakat)}.`
      : `لا زكاة واجبة اليوم. الوعاء ${money(Math.round(vault))} فوق النصاب ${money(Math.round(view.nisab))}، والحول مستمر.`;
  const points = [
    view.start && { key: 'start', title: 'بداية الحول', date: gregText(view.start.date), text: view.start.explanation },
    { key: 'due', title: payment ? 'أخرجت اليوم' : due.today ? 'وجوب اليوم' : 'اليوم', date: gregShort(view.today), text: todayText },
    next && {
      key: 'next', title: 'الوجوب التالي', date: `بعد ${daysText(next.inDays)}`,
      text: `في ${hijriText(next.date)} يكتمل الحول للمبالغ التي دخلت في ${hijriText(next.hawlStart)}، فتجب ${money(next.zakat, { decimals: 2 })} إن بقي الوعاء فوق النصاب.`,
    },
  ].filter(Boolean);
  const [sel, setSel] = useState(next ? 'next' : 'due');
  const current = points.find(p => p.key === sel);
  return (
    <Screen title="خطك الزمني" desc="الأحداث التي أثرت في اكتمال الحول والاستحقاق." onBack={back}
      cta={payment || due.today
        ? <Button variant="primary" icon={ArrowLeft} onClick={() => go(payment ? 'success' : 'payout')}>{payment ? 'عرض الإيصال' : 'إخراج الزكاة'}</Button>
        : <Button variant="primary" icon={ArrowLeft} onClick={() => go('home')}>الرئيسية</Button>}>
      <div className="nm-tl">
        <div className="nm-tl-period"><span>{hijriMonthYear((view.start ?? view).date ?? view.today)}</span><span>{hijriMonthYear(next ? next.date : view.today)}</span></div>
        <div className="nm-tl-track">
          {points.map((p, i) => (
            <button key={p.key} className={`nm-tl-dot${i === points.length - 1 ? ' big' : ''}`} aria-pressed={sel === p.key}
              aria-label={p.title} onClick={() => setSel(p.key)} />
          ))}
        </div>
        <div className="nm-tl-events">
          {points.map(p => (
            <button key={p.key} onClick={() => setSel(p.key)} aria-pressed={sel === p.key}>
              <strong>{p.title}</strong><span>{p.date}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="nm-event nm-invert-dark" aria-live="polite">
        <strong>{current.title}</strong>
        <p>{current.text}</p>
      </div>
    </Screen>
  );
}

const CHANNEL_ICON = { fund: Landmark, charity: Building2, beneficiary: HandHeart, self: HandHeart };
const primaryAccount = view => view.accounts.find(a => !a.exempt);

export function Payout({ go, back }) {
  const { view, channel, pay, due } = useStore();
  const c = CHANNELS[channel];
  const acc = primaryAccount(view);
  if (!due.today) {
    return (
      <Screen theme="dark" title="لا يوجد مبلغ للإخراج اليوم" desc="لم يكتمل الحول اليوم على أي مبلغ." onBack={back}
        cta={<Button variant="primary" icon={ArrowLeft} onClick={() => go('timeline')}>الخط الزمني</Button>}>
        <Note icon={Scale}>{view.nextDue ? `الوجوب القادم في ${hijriText(view.nextDue.date)}.` : 'سننبهك يوم الوجوب.'}</Note>
      </Screen>
    );
  }
  return (
    <Screen theme="dark" title="راجع إخراج الزكاة" desc="تأكد من المبلغ والقناة قبل الإرسال." onBack={back}
      cta={<Button variant="primary" icon={LockKeyhole} onClick={() => { pay(); go('success'); }}>تأكيد الإخراج</Button>}>
      <AmountCard theme="dark" label="المبلغ المستحق" amount={money(due.zakat)} />
      <InfoRow icon={CHANNEL_ICON[channel]} title={c.title} detail={`القناة المختارة • ${c.transfer ? c.detail : 'بدون تحويل'}`} onClick={() => go('channel')} />
      <div className="nm-box">
        <Line label="أساس الاحتساب" value={`${money(due.base)} × 2.5٪`} />
        <Line label="تاريخ الإخراج" value={gregText(view.today)} />
        <Line label="الحساب" value={`${bankName(acc.bank)} • جاري`} />
      </div>
      <Note icon={ShieldCheck}>{c.transfer ? 'سيطلب البنك التحقق النهائي قبل تنفيذ التحويل.' : 'لن ننفذ تحويلًا؛ نسجل الإخراج ونبدأ حولًا جديدًا.'}</Note>
    </Screen>
  );
}

export function Channel({ back }) {
  const { channel, setChannel } = useStore();
  const [pick, setPick] = useState(channel);
  const c = CHANNELS[pick];
  const row = key => (
    <InfoRow key={key} compact icon={CHANNEL_ICON[key]} title={CHANNELS[key].title}
      detail={key === pick && key !== 'self' ? `${CHANNELS[key].detail} • مختار` : CHANNELS[key].detail}
      selected={pick === key} onClick={() => setPick(key)} />
  );
  return (
    <Screen packed titleGap={2} title="اختر قناة الإخراج" desc="اختر جهة موثوقة أو التحويل المباشر." onBack={back}
      cta={<Button variant="primary" icon={Check} onClick={() => { setChannel(pick); back(); }}>حفظ</Button>}>
      {['fund', 'charity', 'beneficiary'].map(row)}
      <Note icon={ShieldCheck} tight>القنوات الخارجية تظهر بأسمائها فقط، من دون شعارات رسمية.</Note>
      {row('self')}
      <div className="nm-box plain">
        <Line label="زمن التحويل" value={c.time} />
        <Line label="رسوم القناة" value={c.fee} />
        <Line label="الإيصال" value={c.receipt} />
      </div>
    </Screen>
  );
}

function downloadReceipt(lines) {
  const text = lines.map(([k, v]) => `${k}: ${v}`).join('\n');
  const url = URL.createObjectURL(new Blob([`إيصال إخراج الزكاة — نماء\n\n${text}\n`], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'إيصال-الزكاة.txt';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Success({ reset }) {
  const { view, payment, channel, due } = useStore();
  const p = payment ?? { amount: due.zakat, channel, time: '09:41', ref: `NM-${view.today.slice(2).replaceAll('-', '')}-0000` };
  const acc = primaryAccount(view);
  const lines = [
    ['التاريخ', `${gregText(view.today)} • ${p.time}`],
    ['القناة', CHANNELS[p.channel].title],
    ['من الحساب', CHANNELS[p.channel].transfer ? `${bankName(acc.bank)} • جاري` : 'بدون تحويل'],
    ['المرجع', p.ref],
  ];
  return (
    <Frame label="نجاح الإخراج والإيصال">
      <div className="nm-success">
        <div className="nm-success-top">
          <span className="nm-success-icon"><Ico as={Check} size={30} /></span>
          <div className="nm-success-msg">
            <h1>تقبّل الله</h1>
            <p>تم إخراج الزكاة وحفظ الإيصال.</p>
          </div>
          <div className="nm-receipt nm-invert-dark">
            <div className="nm-receipt-head">
              <strong>إيصال إخراج الزكاة</strong>
              <span className="nm-receipt-status"><i />مكتمل</span>
            </div>
            <div className="nm-receipt-amount">
              <span>المبلغ</span>
              <strong>{money(p.amount)}</strong>
            </div>
            <div className="nm-divider" />
            {lines.map(([k, v]) => <Line key={k} label={k} value={<span dir={k === 'المرجع' ? 'ltr' : undefined}>{v}</span>} />)}
          </div>
          <Note icon={CalendarSync}>بدأ حول جديد للأصول التي أُخرجت زكاتها اليوم.</Note>
        </div>
        <div className="nm-success-actions">
          <Button icon={Download} onClick={() => downloadReceipt([['المبلغ', money(p.amount)], ...lines])}>تنزيل الإيصال</Button>
          <Button variant="primary" icon={House} onClick={reset}>العودة للرئيسية</Button>
        </div>
      </div>
    </Frame>
  );
}
