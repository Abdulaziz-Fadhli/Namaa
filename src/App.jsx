// نقطة البداية: تحدد الشاشة المعروضة، والتنقل بينها بمتغير حالة واحد (بدون مكتبة توجيه).
// التطبيق يتذكر الشاشات اللي مريت فيها، حتى يرجعك زر الرجوع للمكان اللي جيت منه.
import { useState } from 'react';
import PhoneFrame from './components/PhoneFrame.jsx';
import Dashboard from './screens/Dashboard.jsx';
import Timeline from './screens/Timeline.jsx';
import Link from './screens/Link.jsx';
import Why from './screens/Why.jsx';
import Manual from './screens/Manual.jsx';

// شاشة مؤقتة، نستبدلها بالشاشات الحقيقية واحدة واحدة
function Placeholder({ name }) {
  return (
    <div className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <h1 className="h1">{name}</h1>
      <p className="soft">قيد البناء</p>
    </div>
  );
}

// ترتيب البناء يوم الثلاثاء: 3 ← 4 ← 5 ← 1 ← 2
const SCREENS = {
  dashboard: { name: '3 · لوحة الوعاء', Component: Dashboard },
  timeline: { name: '4 · الخط الزمني', Component: Timeline },
  why: { name: '5 · لماذا هذا المبلغ؟', Component: Why },
  link: { name: '1 · الربط', Component: Link },
  manual: { name: '2 · أموال لا تراها البنوك', Component: Manual },
  // شاشات أيام لاحقة، مؤقتة حتى ما تنكسر الأزرار اللي توديها
  offbank: { name: 'أموالي خارج البنوك' },
  settings: { name: '8 · الإعدادات الشرعية (العضو 2)' },
  payout: { name: '7 · الإخراج (الأربعاء)' },
};

export default function App() {
  const [history, setHistory] = useState(['dashboard']);
  const screen = history.at(-1);
  const go = next => setHistory(h => [...h, next]);
  const back = () => setHistory(h => (h.length > 1 ? h.slice(0, -1) : h));

  const current = SCREENS[screen];
  const Screen = current.Component;

  return (
    <>
      {/* أداة تطوير مؤقتة للتنقل بين الشاشات، نخفيها قبل العرض */}
      <select
        value={screen}
        onChange={e => setHistory([e.target.value])}
        style={{ position: 'fixed', top: 12, right: 12, zIndex: 10, height: 36, borderRadius: 8 }}
      >
        {Object.entries(SCREENS).map(([key, s]) => (
          <option key={key} value={key}>{s.name}</option>
        ))}
      </select>

      <PhoneFrame chrome={current.chrome !== false}>
        {Screen ? <Screen go={go} back={back} /> : <Placeholder name={current.name} />}
      </PhoneFrame>
    </>
  );
}