// هيكل صفحات التطبيق: القائمة الجانبية على الكمبيوتر، والشريط السفلي على الجوال، ورأس كل صفحة.
import { ArrowLeft, Bell, HandCoins, History, House, LogOut, RefreshCw, Settings, WalletCards } from 'lucide-react';
import { Brand, Icon } from './kit.jsx';
import { go } from './nav.js';
import { useStore } from '../figma/model.js';
import { clock } from './data.js';

const NAV = [
  { path: '/app', label: 'الرئيسية', icon: House },
  { path: '/app/assets', label: 'الأصول', icon: WalletCards },
  { path: '/app/history', label: 'سجل الزكاة', icon: History, short: 'السجل' },
  { path: '/app/payout', label: 'إخراج الزكاة', icon: HandCoins, mobile: false },
  { path: '/app/notifications', label: 'الإشعارات', icon: Bell, badge: true, mobile: false },
  { path: '/app/settings', label: 'الإعدادات', icon: Settings },
];

const section = path => {
  if (path === '/app' || path === '/app/explain') return '/app';
  if (path.startsWith('/app/receipt')) return '/app/payout';
  return NAV.find(n => n.path !== '/app' && path.startsWith(n.path))?.path ?? '/app';
};

export function Shell({ path, title, desc, crumb, actions, children }) {
  const { payment, due, live, feed } = useStore();
  const current = section(path);
  const unread = payment ? 1 : due.today ? 2 : 1;
  const synced = live && feed.receivedAt ? clock(new Date(feed.receivedAt)) : '9:41 ص';
  return (
    <div className="w-app">
      <aside className="w-side" aria-label="القائمة">
        <div>
          <Brand onClick={() => go('/app')} />
          <nav>
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
          <span className="w-avatar">أس</span>
          <span className="grow" style={{ textAlign: 'start' }}>
            <span className="b7" style={{ display: 'block' }}>أحمد السبيعي</span>
            <span className="t11 sub" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>ahmad.alsubaie@gmail.com</span>
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
          </div>
          <div className="w-top-actions">
            {actions}
            <button className="w-round" onClick={() => go('/app/notifications')} aria-label="الإشعارات">
              <Icon as={Bell} />
              {unread > 0 && <span className="w-dot" />}
            </button>
            <button className="w-chip" onClick={() => feed.refresh?.()} title="مزامنة الحسابات والأسعار">
              <Icon as={RefreshCw} size={15} />
              <span>آخر مزامنة {synced}</span>
            </button>
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
