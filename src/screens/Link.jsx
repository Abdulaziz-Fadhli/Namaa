// الشاشة 1: ربط الحسابات عبر المصرفية المفتوحة (محاكاة).
// مؤشر "جاري قراءة الحركات" مؤجل لمهام الخميس (التحسين البصري).
import { useState } from 'react';

const BANKS = [
  { id: 'alinma', name: 'الإنماء', locked: true }, // مفعّل دائمًا: هو البنك الرئيسي
  { id: 'a', name: 'بنك أ' },
  { id: 'b', name: 'بنك ب' },
  { id: 'c', name: 'بنك ج' },
];

const PERMISSIONS = ['قراءة الأرصدة والعمليات فقط', 'المدة: 12 شهرًا', 'يمكنك الإلغاء في أي وقت'];

function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function Link({ go }) {
  const [selected, setSelected] = useState({ alinma: true, a: true, b: false, c: false });
  const toggle = id => setSelected(s => ({ ...s, [id]: !s[id] }));

  return (
    <div className="screen" style={{ gap: 18, paddingTop: 28 }}>
      <div className="col" style={{ gap: 8 }}>
        <span className="small bold" style={{ alignSelf: 'flex-start', color: 'var(--bg)', background: 'var(--accent)', borderRadius: 999, padding: '2px 10px' }}>
          جديد في الإنماء
        </span>
        <h1 className="h1" style={{ fontSize: 28, lineHeight: 1.35 }}>زكاتك في وقتها، بمقدارها</h1>
        <p className="soft" style={{ margin: 0, fontSize: 15, lineHeight: 1.7 }}>
          اختر البنوك التي تريد ربطها، ونحسب زكاتك من حركات حساباتك.
        </p>
      </div>

      <div className="card flush">
        {BANKS.map(b => (
          <label key={b.id} className="list-row" style={{ minHeight: 58, padding: '0 16px', fontSize: 16, cursor: b.locked ? 'default' : 'pointer' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--line)' }} />
              <span style={{ fontWeight: 500 }}>{b.name}</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {b.locked && <span className="small muted">مفعّل</span>}
              <input type="checkbox" checked={selected[b.id]} disabled={b.locked}
                onChange={() => toggle(b.id)} style={{ width: 20, height: 20 }} />
            </span>
          </label>
        ))}
      </div>

      <div className="card col" style={{ gap: 12 }}>
        <span className="bold" style={{ fontSize: 15 }}>الصلاحيات المطلوبة</span>
        {PERMISSIONS.map(p => (
          <span key={p} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}><Check />{p}</span>
        ))}
        <span className="small muted" style={{ lineHeight: 1.6 }}>عبر إطار المصرفية المفتوحة من البنك المركزي السعودي</span>
      </div>

      <button className="btn primary" style={{ marginTop: 'auto' }} onClick={() => go('dashboard')}>
        ربط الحسابات
      </button>
    </div>
  );
}