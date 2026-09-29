// الشاشة 3: لوحة الوعاء.
// الأرقام الحين ثابتة (أرقام أحمد الحقيقية من المحرك يوم العرض).
// يوم الأربعاء نستبدل كائن DATA بمخرجات المحرك.
import ZakatHeader from '../components/ZakatHeader.jsx';

const DATA = {
  total: 66323,
  nisab: 4613,
  nisabBasis: '595 جم فضة × سعر اليوم',
  dueToday: { zakat: 165.35, hijri: '22 ربيع الآخر 1448', gregorian: '3 أكتوبر 2026' },
  next: { inDays: 13, hijri: '5 جمادى الأولى 1448', amount: 776, day: 341, of: 354 },
  accounts: [
    { name: 'الإنماء · جاري', balance: 30323, share: 46, color: 'var(--accent)' },
    { name: 'بنك أ · ادخار', balance: 36000, share: 54, color: '#7FA7C2' },
  ],
  exempt: { name: 'نماء الاستثماري', balance: 20000 },
};

const money = n => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

export default function Dashboard({ go }) {
  const d = DATA;
  return (
    <>
      <ZakatHeader active="dashboard" go={go} />
      <div className="screen" style={{ gap: 8 }}>

        <div className="card col" style={{ gap: 2, padding: '12px 18px' }}>
          <span className="label soft">إجمالي الوعاء الزكوي</span>
          <span className="big-number" style={{ fontSize: 30 }}>{money(d.total)} <span className="unit">ريال</span></span>
          <span className="small muted">نصاب اليوم: {money(d.nisab)} ريال ({d.nisabBasis})</span>
        </div>

        <div className="card accent row" style={{ padding: '12px 18px' }}>
          <div className="col">
            <span className="label bold" style={{ color: 'var(--accent)' }}>زكاة واجبة اليوم</span>
            <span style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.3 }}>
              {money(d.dueToday.zakat)} <span style={{ fontSize: 14, fontWeight: 500 }}>ريال</span>
            </span>
            <span className="small soft">{d.dueToday.hijri} · {d.dueToday.gregorian}</span>
            <button onClick={() => go('why')} className="small bold" style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', textAlign: 'start' }}>
              لماذا هذا المبلغ؟
            </button>
          </div>
          <button className="btn primary small" onClick={() => go('payout')}>أخرج زكاتك</button>
        </div>

        <div className="card col" style={{ gap: 8, padding: '12px 18px' }}>
          <div className="row label">
            <span className="bold">الوجوب التالي بعد {d.next.inDays} يومًا</span>
            <span className="soft">{d.next.hijri}</span>
          </div>
          <div className="progress"><div style={{ width: `${(d.next.day / d.next.of) * 100}%` }} /></div>
          <span className="small muted">حول {money(d.next.amount)} ريال: اليوم {d.next.day} من {d.next.of}</span>
        </div>

        <div className="card flush">
          <div className="col" style={{ padding: '12px 18px 8px', gap: 8 }}>
            <span className="label bold">الحسابات</span>
            <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2 }}>
              {d.accounts.map(a => <span key={a.name} style={{ width: `${a.share}%`, background: a.color }} />)}
            </div>
          </div>
          {d.accounts.map(a => (
            <div key={a.name} className="list-row" style={{ borderTop: '1px solid var(--line)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: a.color }} />{a.name}
              </span>
              <span>{money(a.balance)} ريال</span>
            </div>
          ))}
          <div className="list-row" style={{ borderTop: '1px solid var(--line)' }}>
            <div className="col" style={{ gap: 4 }}>
              <span>{d.exempt.name}</span>
              <span className="badge">معفى، بحسب إفصاح المصرف</span>
            </div>
            <span className="muted" style={{ textDecoration: 'line-through' }}>{money(d.exempt.balance)} ريال</span>
          </div>
          <button className="list-row" onClick={() => go('offbank')}
            style={{ width: '100%', background: 'none', border: 'none', borderTop: '1px solid var(--line)', color: 'inherit', textAlign: 'start', padding: '10px 18px' }}>
            <span className="col">
              <span className="bold">أموال خارج البنوك</span>
              <span className="small muted">ذهب، نقد، مواشي، محاصيل… تعدّلها بنفسك</span>
            </span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
        </div>

      </div>
    </>
  );
}