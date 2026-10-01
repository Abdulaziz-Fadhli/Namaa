// موقع نماء وتطبيق الويب (من شاشات فيجما «موقع نماء»)، مربوط بمحرك الزكاة عبر StoreProvider.
// التطبيق القديم بإطار الجوال باقٍ على الرابط #/phone.
import { Suspense, lazy } from 'react';
import './web.css';
import { StoreProvider } from '../figma/store.jsx';
import { useRoute } from './nav.js';
import { Dashboard, Explain } from './pages/Home.jsx';
import { Account, Assets } from './pages/Assets.jsx';
import { History, Payout, ReceiptPage } from './pages/Zakat.jsx';
import { LinkBank, Notifications, SettingsPage } from './pages/Settings.jsx';
import { Forgot, Landing, Login, OnboardBanks, OnboardLast, OnboardSync, Register } from './pages/Site.jsx';

const PhoneApp = lazy(() => import('../App.jsx'));

function page(path) {
  if (path === '/' || path === '') return <Landing />;
  if (path === '/login') return <Login />;
  if (path === '/forgot') return <Forgot />;
  if (path === '/register') return <Register />;
  if (path === '/onboarding/banks' || path === '/onboarding') return <OnboardBanks />;
  if (path === '/onboarding/last') return <OnboardLast />;
  if (path === '/onboarding/sync') return <OnboardSync />;
  if (path === '/app/explain') return <Explain path={path} />;
  if (path === '/app/assets') return <Assets path={path} />;
  if (path.startsWith('/app/account/')) return <Account path={path} />;
  if (path === '/app/link') return <LinkBank path={path} />;
  if (path === '/app/history') return <History path={path} />;
  if (path === '/app/payout') return <Payout path={path} />;
  if (path === '/app/receipt') return <ReceiptPage path={path} />;
  if (path.startsWith('/app/settings')) return <SettingsPage path={path} />;
  if (path === '/app/notifications') return <Notifications path={path} />;
  if (path.startsWith('/app')) return <Dashboard path="/app" />;
  return <Landing />;
}

export default function WebApp() {
  const path = useRoute();
  if (path === '/phone') return <Suspense fallback={null}><PhoneApp /></Suspense>;
  return (
    <StoreProvider>
      <div className="w">{page(path)}</div>
    </StoreProvider>
  );
}
