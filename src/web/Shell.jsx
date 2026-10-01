// هيكل صفحات التطبيق: قائمة جانبية هادئة على الكمبيوتر، وشريط سفلي على الجوال، ورأس بسيط لكل صفحة.
import { ArrowLeft, Bell, ChevronDown, History, House, LogOut, RefreshCw, Settings, WalletCards } from 'lucide-react';
import { useState } from 'react';
import { Brand, Icon } from './kit.jsx';
import { go } from './nav.js';
import { useStore } from '../figma/model.js';
import { PERSONAS, clock } from './data.js';
import { gregText } from '../figma/format.js';

// أربعة أقسام فقط. الإخراج من زر الرئيسية، والإشعارات من الجرس، والخط الزمني داخل السجل.
const NAV = [
  { path: '/app', label: 'الرئيسية', icon: House },
  { path: '/app/assets', label: 'الأصول', icon: WalletCards },
  { path: '/app/history', label: 'السجل', icon: History },
  { path: '/app/settings', label: 'الإعدادات', icon: Settings },
];

const section = path => {
  if (path.startsWith('/app/timeline') || path.startsWith('/app/history')) return '/app/history';
  if (path.startsWith('/app/assets') || path.startsWith('/app/account') || path.startsWith('/app/link')) return '/app/assets';
  if (path.startsWith('/app/settings')) return '/app/settings';
  return '/app';
};

// «كما في 26 سبتمبر 2026» لأحمد، و«3 أكتوبر 2026» لخالد ونورة
const asOfText = (persona, historical, today) => (historical ? `كما في ${gregText(today)} · تاريخ مرجعي ثابت` : PERSONAS[persona].asOfLabel);

function PersonaSwitch() {
  const { persona } = useStore();
  const [open, setOpen] = useState(false);
  const p = PERSONAS[persona];
  return (
    <div style={{ position: 'relative', marginTop: 24 }}>
      <span className="t11 muted" style={{ display: 'block', padding: '0 12px 4px' }}>تعرض الآن</span>
      <button className="row" style={{ width: '100%', padding: '6px 12px', borderRadius: 6 }} onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="grow" style={{ textAlign: 'start' }}><b className="b6">{p.name}</b> <span className="sub t13">· {p.role}</span></span>
        <Icon as={ChevronDown} size={15} className="muted" />
      </button>
      {open && (
        <div className="w-card" style={{ position: 'absolute', insetInline: 0, top: 'calc(100% + 4px)', zIndex: 30, padding: 4, boxShadow: '0 10px 24px rgba(21,34,44,.08)' }}>
          {Object.values(PERSONAS).map(x => (
            <button key={x.key} style={{ width: '100%', display: 'block', textAlign: 'start', padding: '8px 10px', borderRadius: 6, background: x.key === persona ? 'var(--soft)' : undefined }}
              onClick={() => { setOpen(false); go(x.entry); }}>
              <span className="t13 b6" style={{ display: 'block' }}>{x.name} · {x.role}</span>
              <span className="t11 muted">{x.asOfLabel}</span>
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
  const unread = payment || due.today ? 1 : 0;
  const p = PERSONAS[persona];
  const priceLabel = !live ? 'تحديث الأسعار' : feed.loading ? 'نحدّث الأسعار…'
    : feed.metalsLive ? `أسعار مباشرة · ${feed.receivedAt ? clock(new Date(feed.receivedAt)) : ''}` : 'تعذّر التحديث';
  return (
    <div className="w-app">
      <aside className="w-side" aria-label="القائمة">
        <div>
          <Brand onClick={() => go('/app')} />
          <PersonaSwitch />
          <nav style={{ marginTop: 20 }}>
            {NAV.map(n => (
              <button key={n.path} aria-current={current === n.path ? 'page' : undefined} onClick={() => go(n.path)}>
                <Icon as={n.icon} />
                <span>{n.label}</span>
              </button>
            ))}
          </nav>
        </div>
        <button className="w-user" onClick={() => go('/app/settings/profile')}>
          <span className="w-avatar">{p.avatar}</span>
          <span className="grow" style={{ textAlign: 'start' }}>
            <span className="b6 t13" style={{ display: 'block' }}>{p.full}</span>
            <span className="t11 muted" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.email}</span>
          </span>
          <Icon as={ArrowLeft} size={15} className="muted" />
        </button>
      </aside>

      <main className="w-main">
        <header className="w-top">
          <div>
            {crumb && <div className="w-crumb">{crumb}</div>}
            <h1>{title}</h1>
            {desc && <p>{desc}</p>}
            <div className="w-context">
              <span>{p.name} · {asOfText(persona, historical, view.today)}</span>
              <button className="w-hide-d" onClick={() => go('/personas')}>تبديل</button>
            </div>
          </div>
          <div className="w-top-actions">
            {actions}
            {persona === 'khalid' && (
              <button className="w-btn ghost" onClick={() => { setKhalidLive(true); feed.refresh?.(); }} title="سعر الذهب الآن من gold-api.com">
                <Icon as={RefreshCw} size={15} /><span className="w-hide-m">{priceLabel}</span>
              </button>
            )}
            <button className="w-round" onClick={() => go('/app/notifications')} aria-label="الإشعارات">
              <Icon as={Bell} />
              {unread > 0 && <span className="w-dot" />}
            </button>
          </div>
        </header>
        {children}
      </main>

      <nav className="w-bottom-nav" aria-label="التنقل">
        {NAV.map(n => (
          <button key={n.path} aria-current={current === n.path ? 'page' : undefined} onClick={() => go(n.path)}>
            <Icon as={n.icon} size={20} />
            <span>{n.label}</span>
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
