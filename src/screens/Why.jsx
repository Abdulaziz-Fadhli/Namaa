// الشاشة 5: لماذا هذا المبلغ؟
// تشرح مبلغ الزكاة الواجبة: أي دفعة حال حولها، وأي دفعات لم يحل حولها بعد.
// الأرقام الحين ثابتة (دفعات أحمد يوم العرض من المحرك).
// يوم الأربعاء نستبدل DATA بمخرجات المحرك (events و lots).
import { useState } from 'react';

const DATA = {
  zakat: 165.35,
  base: 6614,
  dueNow: [{ amount: 6614, entered: '22 ربيع الآخر 1447', note: 'مكافأة', zakat: 165.35 }],
  upcoming: [
    { amount: 776, entered: '5 جمادى الأولى 1447', completes: '5 جمادى الأولى 1448', zakat: 19.40 },
    { amount: 2918, entered: '6 جمادى الآخرة 1447', completes: '6 جمادى الآخرة 1448', zakat: 72.95 },
    { amount: 1228, entered: '7 رجب 1447', completes: '7 رجب 1448', zakat: 30.70 },
  ],
  more: { count: 16, total: 54787 },
  hawlSince: '29 شوال 1446',
};

const money = n => n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

function LotRow({ amount, entered, right, rightSub, first }) {
  return (
    <div className="list-row" style={{ padding: '8px 16px', borderTop: first ? 'none' : undefined }}>
      <div className="col">
        <span className="bold" style={{ fontSize: 15 }}>{money(amount)} ريال</span>
        <span className="small muted">دخل {entered}</span>
      </div>
      <div className="col" style={{ alignItems: 'flex-end' }}>
        <span style={{ fontWeight: 500 }}>{right}</span>
        <span className="small muted">{rightSub}</span>
      </div>
    </div>
  );
}

export default function Why({ back }) {
  const d = DATA;
  const [showMethod, setShowMethod] = useState(false);

  return (
    <>
      <div className="subheader">
        <button className="icon-btn" onClick={back} aria-label="رجوع">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        </button>
        <h1 className="h2">لماذا هذا المبلغ؟</h1>
      </div>

      <div className="screen">
        <div className="card col" style={{ gap: 6, padding: '14px 18px' }}>
          <div className="row" style={{ alignItems: 'baseline' }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: 'var(--accent)' }}>
              {money(d.zakat)} <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>ريال</span>
            </span>
            <span dir="ltr" className="label soft">{money(d.base)} × 2.5%</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.8, color: '#DCE5EB' }}>
            كل مبلغ يدخل حسابك له حول مستقل يبدأ من يوم دخوله. اليوم اكتمل الحول على {money(d.base)} ريالًا
            بقيت من مكافأتك، فوجبت زكاتها وحدها: ربع العشر.
          </p>
        </div>

        <span className="label bold" style={{ color: 'var(--accent)' }}>حال حولها اليوم</span>
        <div className="card accent flush" style={{ borderRadius: 18 }}>
          {d.dueNow.map((l, i) => (
            <LotRow key={i} first amount={l.amount} entered={`${l.entered} · ${l.note}`}
              right={`${money(l.zakat)} ريال`} rightSub="اكتمل اليوم" />
          ))}
        </div>

        <span className="label bold">لم يحل حولها بعد</span>
        <div className="card flush" style={{ borderRadius: 18 }}>
          {d.upcoming.map((l, i) => (
            <LotRow key={i} first={i === 0} amount={l.amount} entered={l.entered}
              right={`${money(l.zakat)} ريال`} rightSub={`يكتمل ${l.completes}`} />
          ))}
          <div className="list-row label soft" style={{ padding: '10px 16px' }}>
            و{d.more.count} دفعة أخرى بمجموع {money(d.more.total)} ريالًا
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, borderRadius: 18, padding: '12px 16px', fontSize: 13, lineHeight: 1.6 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="9" /><polyline points="8 12 11 15 16 9" />
          </svg>
          <span>لم ينقطع الحول: بقي مجموع أموالك فوق النصاب منذ {d.hawlSince}</span>
        </div>

        <button onClick={() => setShowMethod(v => !v)} aria-expanded={showMethod}
          style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--field)', border: '1px solid var(--line)', borderRadius: 18, padding: '12px 16px', color: 'inherit', textAlign: 'start' }}>
          <span className="row" style={{ width: '100%' }}>
            <span className="col">
              <span className="label bold">المنهجية: فتوى اللجنة الدائمة رقم 282</span>
              <span className="small muted">حول مستقل لكل مبلغ من يوم ملكه</span>
            </span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
              style={{ transform: showMethod ? 'rotate(-90deg)' : 'none', transition: 'transform .2s' }}><path d="M15 6l-6 6 6 6" /></svg>
          </span>
          {showMethod && (
            <span style={{ fontSize: 13, lineHeight: 1.8, color: '#DCE5EB' }}>
              نصّت الفتوى على أن من يدّخر من راتبه شهريًا عليه أن يجعل لنفسه جدول حساب لكسبه، يخص فيه كل مبلغ بحول يبدأ من يوم ملكه.
              وهذا الجدول هو ما نمسكه عنك تلقائيًا. وجميع الإعدادات قابلة للضبط من الهيئة الشرعية لمصرف الإنماء.
            </span>
          )}
        </button>
      </div>
    </>
  );
}