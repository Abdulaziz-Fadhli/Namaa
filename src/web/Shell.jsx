// هيكل صفحات التطبيق: القائمة الجانبية على الكمبيوتر، والشريط السفلي على الجوال، ورأس كل صفحة.
import { ArrowLeft, Bell, CalendarClock, ChevronDown, GitCommitVertical, HandCoins, History, House, LogOut, RefreshCw, Settings, WalletCards } from 'lucide-react';
import { useState } from 'react';
import { Brand, Icon } from './kit.jsx';
import { go } from './nav.js';
import { useStore } from '../figma/model.js';
import { PERSONAS, clock } from './data.js';
import { gregText } from '../figma/format.js';

const NAV = [
  { path: '/app', label: 'الرئيسية', icon: House },
  { path: '/app/assets', label: 'الأصول', icon: WalletCards },
  { path: '/app/timeline', label: 'الخط الزمني', icon: GitCommitVertical, short: 'الزمن' },
  { path: '/app/history', label: 'سجل الزكاة', icon: History, short: 'السجل', mobile: false },
  { path: '/app/payout', label: 'إخراج الزكاة', icon: HandCoins, mobile: false },
  { path: '/app/notifications', label: 'الإشعارات', icon: Bell, badge: true, mobile: false },
  { path: '/app/settings', label: 'الإعدادات', icon: Settings },
];

const section = path => {
  if (path === '/app' || path === '/app/explain') return '/app';
  if (path.startsWith('/app/receipt')) return '/app/payout';
  return NAV.find(n => n.path !== '/app' && path.startsWith(n.path))?.path ?? '/app';
};

// تبديل الشخصية: يعزل الحسابات والأصول والنتائج، ويُظهر التاريخ المرجعي لكل شخصية
function PersonaSwitch() {
  const { persona } = useStore();
  const [open, setOpen] = useState(false);
  const p = PERSONAS[persona];
  return (
    <div style={{ position: 'relative', marginTop: 20 }}>
      <button className="w-user" style={{ width: '100%', background: 'var(--sel)' }} onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="w-avatar">{p.avatar}</span>
        <span className="grow" style={{ textAlign: 'start' }}>
          <span className="b7" style={{ display: 'block' }}>{p.name} · {p.role}</span>
          <span className="t11 sub">{p.asOfLabel}</span>
        </span>
        <Icon as={ChevronDown} size={16} />
      </button>
      {open && (
        <div className="w-card" style={{ position: 'absolute', insetInline: 0, top: 'calc(100% + 6px)', zIndex: 30, padding: 6, boxShadow: '0 12px 30px rgba(3,28,45,.12)' }}>
          {Object.values(PERSONAS).map(x => (
            <button key={x.key} className="w-list-row" style={{ width: '100%', padding: '8px 10px', borderRadius: 10, background: x.key === persona ? 'var(--soft)' : undefined }}
              onClick={() => { setOpen(false); go(x.entry); }}>
              <span className="w-avatar" style={{ width: 30, height: 30, fontSize: 12 }}>{x.avatar}</span>
              <span className="grow" style={{ textAlign: 'start' }}><span className="t" style={{ display: 'block', fontSize: 13 }}>{x.name} · {x.role}</span><span className="d">{x.asOfLabel}</span></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Shell({ path, title, desc, crumb, actions, children }) {
  const { payment, due, live, feed, persona, historical, view, setKhalidLive } = useStore();
  const current = section(path);
  const unread = payment ? 1 : due.today ? 2 : 1;
  const p = PERSONAS[persona];
  const synced = live && feed.receivedAt ? clock(new Date(feed.receivedAt)) : persona === 'khalid' ? 'أسعار محفوظة' : '9:41 ص';
  return (
    <div className="w-app">
      <aside className="w-side" aria-label="القائمة">
        <div>
          <Brand onClick={() => go('/app')} />
          <PersonaSwitch />
          <nav style={{ marginTop: 16 }}>
            {NAV.map(n => (
              <button key={n.path} aria-current={current === n.path ? 'page' : undefined} onClick={() => go(n.path)}>
                <Icon as={n.icon} />
                <span>{n.label}</span>
                {n.badge && unread > 0 && <span className="w-pill">{unread}</span>}
              </button>
            ))}
          </nav>
        </div>
        <button className="w-user" onClick={() => go('/app/settings/profile')}>
          <span className="w-avatar">{p.avatar}</span>
          <span className="grow" style={{ textAlign: 'start' }}>
            <span className="b7" style={{ display: 'block' }}>{p.full}</span>
            <span className="t11 sub" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.email}</span>
          </span>
          <Icon as={ArrowLeft} size={16} className="muted" />
        </button>
      </aside>

      <main className="w-main">
        <header className="w-top">
          <div>
            {crumb && <div className="w-crumb">{crumb}</div>}
            <h1>{title}</h1>
            {desc && <p>{desc}</p>}
            <button className={`w-pill ${historical ? 'warn' : 'info'}`} style={{ marginTop: 8 }} onClick={() => go('/personas')} title="تبديل الشخصية">
              <Icon as={CalendarClock} size={12} />{p.name} · {historical ? `كما في ${gregText(view.today)} · تاريخ مرجعي ثابت لا «اليوم»` : p.asOfLabel}
            </button>
          </div>
          <div className="w-top-actions">
            {actions}
            <button className="w-round" onClick={() => go('/app/notifications')} aria-label="الإشعارات">
              <Icon as={Bell} />
              {unread > 0 && <span className="w-dot" />}
            </button>
            {persona === 'khalid' ? (
              <button className="w-chip" onClick={() => { setKhalidLive(true); feed.refresh?.(); }} title="أسعار الذهب والفضة الآن من gold-api.com">
                <Icon as={RefreshCw} size={15} />
                <span>{live ? (feed.loading ? 'نحدّث الأسعار…' : feed.metalsLive ? `أسعار مباشرة · ${synced}` : 'تعذّر التحديث · أسعار محفوظة') : 'تحديث الأسعار'}</span>
              </button>
            ) : (
              <span className="w-chip"><Icon as={RefreshCw} size={15} /><span>{historical ? 'سجل تاريخي · أسعار مسجلة' : `آخر مزامنة ${synced}`}</span></span>
            )}
          </div>
        </header>
        {children}
      </main>

      <nav className="w-bottom-nav" aria-label="التنقل">
        {NAV.filter(n => n.mobile !== false).map(n => (
          <button key={n.path} aria-current={current === n.path ? 'page' : undefined} onClick={() => go(n.path)}>
            <Icon as={n.icon} size={20} />
            <span>{n.short ?? n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export function SignOut() {
  return (
    <button className="w-card row b6" style={{ color: 'var(--red)', padding: '16px 20px', width: '100%' }} onClick={() => go('/')}>
      <Icon as={LogOut} /> تسجيل الخروج
    </button>
  );
}
