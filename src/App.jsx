// نقطة البداية: تحدد الشاشة المعروضة، والتنقل بينها بمتغير حالة واحد (بدون مكتبة توجيه).
// التطبيق يتذكر الشاشات اللي مريت فيها، حتى يرجعك زر الرجوع للمكان اللي جيت منه.
// والانتقال بين الشاشات متحرك مثل تطبيقات الجوال (View Transitions في المتصفح):
// الدخول لشاشة أعمق ينزلقها من اليسار (عربي)، والرجوع يعكسها، والتبديل بين تبويبات الرئيسية يتلاشى.
// الشاشات مبنية من ملف فيجما (src/figma) وتنقلها مطابق لروابط النموذج في فيجما.
import { Suspense, lazy, useState } from 'react';
import { flushSync } from 'react-dom';
import PhoneFrame from './components/PhoneFrame.jsx';
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
  livestock: { name: 'إضافة مواشي', Component: Ast.Livestock },
  crops: { name: 'إضافة محاصيل زراعية', Component: Ast.Crops },
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

// تبويبات الشريط السفلي في الرئيسية: التنقل بينها تلاشٍ، مو انزلاق
const TABS = new Set(['home', 'details', 'settings']);

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// kind: push (دخول لشاشة أعمق) · pop (رجوع) · fade (تبويب أو قفزة من القائمة)
// المتصفحات اللي ما تدعم الانتقالات تتنقل فورًا مثل قبل
function animate(kind, update) {
  if (!document.startViewTransition || reducedMotion()) { update(); return; }
  const root = document.documentElement;
  root.dataset.nav = kind;
  const t = document.startViewTransition(() => flushSync(update));
  t.finished.finally(() => { if (root.dataset.nav === kind) delete root.dataset.nav; });
}

export default function App() {
  const [history, setHistory] = useState(['start']);
  const screen = history.at(-1);
  const go = next => animate(TABS.has(screen) && TABS.has(next) ? 'fade' : 'push', () => setHistory(h => [...h, next]));
  const back = () => animate('pop', () => setHistory(h => (h.length > 1 ? h.slice(0, -1) : h)));
  const reset = () => animate('fade', () => setHistory(['home']));

  const current = FIGMA[screen] ?? FIGMA.start;
  const Screen = current.Component;

  return (
    <StoreProvider>
      {/* أداة تطوير مؤقتة للتنقل بين الشاشات، نخفيها قبل العرض */}
      <select
        value={screen}
        onChange={e => { const v = e.target.value; animate('fade', () => setHistory(v === 'start' ? ['start'] : ['home', v])); }}
        aria-label="الانتقال إلى شاشة"
        style={{ position: 'fixed', top: 12, right: 12, zIndex: 10, height: 36, borderRadius: 8 }}
      >
        {Object.entries(FIGMA).map(([key, s]) => <option key={key} value={key}>{s.name}</option>)}
      </select>

      <PhoneFrame>
        <Suspense fallback={null}>
          <Screen key={screen} go={go} back={back} reset={reset} />
        </Suspense>
      </PhoneFrame>
    </StoreProvider>
  );
}
