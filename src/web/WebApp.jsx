// موقع نماء وتطبيق الويب (من شاشات فيجما «موقع نماء»)، مربوط بمحرك الزكاة عبر StoreProvider.
// التطبيق القديم بإطار الجوال باقٍ على الرابط #/phone.
import { Suspense, lazy, useEffect } from 'react';
import './web.css';
import { StoreProvider } from '../figma/store.jsx';
import { useStore } from '../figma/model.js';
import { go, useRoute } from './nav.js';
import { Dashboard, Explain, Timeline } from './pages/Home.jsx';
import {
  KhalidAccounts, KhalidAssets, KhalidBanks, KhalidPrices, KhalidRegister, KhalidSync, KhalidWelcome, NouraPage, PersonaChooser,
} from './pages/Personas.jsx';
import { Account, Assets } from './pages/Assets.jsx';
import { InvestPage } from './pages/Invest.jsx';
import { History, Payout, ReceiptPage } from './pages/Zakat.jsx';
import { LinkBank, Notifications, SettingsPage } from './pages/Settings.jsx';
import { Forgot, Landing, Login, OnboardBanks, OnboardLast, OnboardSync, Register } from './pages/Site.jsx';

const PhoneApp = lazy(() => import('../App.jsx'));

// الرابط يحدد الشخصية: /noura و/khalid/* و/ahmad. ما عداها يبقى على الشخصية الحالية.
const personaOf = path => (path.startsWith('/noura') ? 'noura' : path.startsWith('/khalid') ? 'khalid' : path.startsWith('/ahmad') ? 'ahmad' : null);

const KHALID = { '/khalid': KhalidWelcome, '/khalid/register': KhalidRegister, '/khalid/banks': KhalidBanks, '/khalid/accounts': KhalidAccounts,
  '/khalid/assets': KhalidAssets, '/khalid/prices': KhalidPrices, '/khalid/sync': KhalidSync };

function page(path) {
  if (path === '/' || path === '') return <Landing />;
  if (path === '/personas') return <PersonaChooser />;
  if (path === '/noura') return <NouraPage />;
  if (KHALID[path]) { const P = KHALID[path]; return <P />; }
  if (path === '/app/timeline') return <Timeline path={path} />;
  if (path === '/login') return <Login />;
  if (path === '/forgot') return <Forgot />;
  if (path === '/register') return <Register />;
  if (path === '/onboarding/banks' || path === '/onboarding') return <OnboardBanks />;
  if (path === '/onboarding/last') return <OnboardLast />;
  if (path === '/onboarding/sync') return <OnboardSync />;
  if (path === '/app/explain') return <Explain path={path} />;
  if (path === '/app/assets') return <Assets path={path} />;
  if (path.startsWith('/app/account/')) return <Account path={path} />;
  if (path.startsWith('/app/invest/')) return <InvestPage path={path} />;
  if (path === '/app/link') return <LinkBank path={path} />;
  if (path === '/app/history') return <History path={path} />;
  if (path === '/app/payout') return <Payout path={path} />;
  if (path === '/app/receipt') return <ReceiptPage path={path} />;
  if (path.startsWith('/app/settings')) return <SettingsPage path={path} />;
  if (path === '/app/notifications') return <Notifications path={path} />;
  if (path.startsWith('/app')) return <Dashboard path="/app" />;
  return <Landing />;
}

function Routed({ path }) {
  const { persona, setPersona } = useStore();
  const want = personaOf(path);
  useEffect(() => {
    if (want && want !== persona) setPersona(want);
    if (path === '/ahmad') go('/app');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want, path]);
  if (want && want !== persona) return null;
  return <div className="w">{page(path)}</div>;
}

export default function WebApp() {
  const path = useRoute();
  if (path === '/phone') return <Suspense fallback={null}><PhoneApp /></Suspense>;
  return (
    <StoreProvider personaMode>
      <Routed path={path} />
    </StoreProvider>
  );
}
