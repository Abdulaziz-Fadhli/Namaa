// نقطة البداية: تحدد الشاشة المعروضة، والتنقل بينها بمتغير حالة واحد (بدون مكتبة توجيه).
// التطبيق يتذكر الشاشات اللي مريت فيها، حتى يرجعك زر الرجوع للمكان اللي جيت منه.
// الشاشات الحالية مبنية من ملف فيجما (src/figma) وتنقلها مطابق لروابط النموذج في فيجما،
// والشاشات القديمة باقية في القائمة تحت «النسخة السابقة» للمقارنة.
import { Suspense, lazy, useState } from 'react';
import PhoneFrame from './components/PhoneFrame.jsx';
import Dashboard from './screens/Dashboard.jsx';
import Timeline from './screens/Timeline.jsx';
import Link from './screens/Link.jsx';
import Why from './screens/Why.jsx';
import Manual from './screens/Manual.jsx';
import { StoreProvider } from './figma/store.jsx';
import * as Onb from './figma/screens/Onboarding.jsx';
import * as Ast from './figma/screens/Assets.jsx';
import * as Hm from './figma/screens/Home.jsx';
import * as Zk from './figma/screens/Zakat.jsx';

// شاشة الأسهم تحمل دليل الأوراق المالية، فنحمّلها عند فتحها فقط
const Security = lazy(() => import('./figma/screens/Security.jsx'));

// شاشات فيجما بترتيب الملف
const FIGMA = {
  start: { name: 'بداية نماء', Component: Onb.Start },
  link: { name: 'ربط الحسابات', Component: Onb.Link },
  bank: { name: 'اختيار بنك', Component: Onb.Bank },
  lastzakat: { name: 'تاريخ آخر زكاة', Component: Onb.LastZakat },
  sync: { name: 'مزامنة الحسابات', Component: Onb.Sync },
  offbank: { name: 'الأصول خارج البنوك', Component: Ast.OffBank },
  metals: { name: 'إضافة معادن', Component: Ast.Metals },
  security: { name: 'إضافة سهم أو صندوق', Component: Security },
  cash: { name: 'إضافة نقد', Component: Ast.Cash },
  property: { name: 'إضافة عقار', Component: Ast.Property },
  home: { name: 'الرئيسية', Component: Hm.Home },
  notifications: { name: 'الإشعارات', Component: Hm.Notifications },
  details: { name: 'تفاصيل الأصول', Component: Ast.Details },
  settings: { name: 'الإعدادات', Component: Hm.SettingsScreen },
  explain: { name: 'تفسير الزكاة', Component: Zk.Explain },
  timeline: { name: 'الخط الزمني', Component: Zk.Timeline },
  payout: { name: 'إخراج الزكاة', Component: Zk.Payout },
  channel: { name: 'اختيار قناة الإخراج', Component: Zk.Channel },
  success: { name: 'نجاح الإخراج والإيصال', Component: Zk.Success },
};

// النسخة السابقة (قبل فيجما)
const LEGACY = {
  'old:dashboard': { name: 'لوحة الوعاء', Component: Dashboard },
  'old:timeline': { name: 'الخط الزمني', Component: Timeline },
  'old:why': { name: 'لماذا هذا المبلغ؟', Component: Why },
  'old:link': { name: 'الربط', Component: Link },
  'old:manual': { name: 'أموال لا تراها البنوك', Component: Manual },
};
// أزرار الشاشات القديمة تنادي أسماءها القديمة
const LEGACY_ALIAS = { dashboard: 'old:dashboard', why: 'old:why', manual: 'old:manual', offbank: 'offbank', payout: 'payout', settings: 'settings' };

export default function App() {
  const [history, setHistory] = useState(['start']);
  const screen = history.at(-1);
  const legacy = screen.startsWith('old:');
  const go = next => setHistory(h => [...h, legacy ? (LEGACY_ALIAS[next] ?? `old:${next}`) : next]);
  const back = () => setHistory(h => (h.length > 1 ? h.slice(0, -1) : h));
  const reset = () => setHistory(['home']);

  const current = FIGMA[screen] ?? LEGACY[screen] ?? FIGMA.start;
  const Screen = current.Component;

  return (
    <StoreProvider>
      {/* أداة تطوير مؤقتة للتنقل بين الشاشات، نخفيها قبل العرض */}
      <select
        value={screen}
        onChange={e => setHistory(e.target.value === 'start' ? ['start'] : ['home', e.target.value])}
        aria-label="الانتقال إلى شاشة"
        style={{ position: 'fixed', top: 12, right: 12, zIndex: 10, height: 36, borderRadius: 8 }}
      >
        <optgroup label="شاشات فيجما">
          {Object.entries(FIGMA).map(([key, s]) => <option key={key} value={key}>{s.name}</option>)}
        </optgroup>
        <optgroup label="النسخة السابقة">
          {Object.entries(LEGACY).map(([key, s]) => <option key={key} value={key}>{s.name}</option>)}
        </optgroup>
      </select>

      <PhoneFrame chrome={legacy} figma={!legacy}>
        <Suspense fallback={null}>
          <Screen key={screen} go={go} back={back} reset={reset} />
        </Suspense>
      </PhoneFrame>
    </StoreProvider>
  );
}
