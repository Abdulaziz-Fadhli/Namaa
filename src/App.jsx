// نقطة البداية: تحدد الشاشة المعروضة، والتنقل بينها بمتغير حالة واحد (بدون مكتبة توجيه).
import { useState } from 'react';
import PhoneFrame from './components/PhoneFrame.jsx';
import Dashboard from './screens/Dashboard.jsx';
import Timeline from './screens/Timeline.jsx';

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
  why: { name: '5 · لماذا هذا المبلغ؟' },
  link: { name: '1 · الربط' },
  manual: { name: '2 · أموال لا تراها البنوك' },
  // شاشات أيام لاحقة، مؤقتة حتى ما تنكسر الأزرار اللي توديها
  offbank: { name: 'أموالي خارج البنوك' },
  settings: { name: '8 · الإعدادات الشرعية (العضو 2)' },
  payout: { name: '7 · الإخراج (الأربعاء)' },
};

export default function App() {
  const [screen, setScreen] = useState('dashboard');
  const current = SCREENS[screen];
  const Screen = current.Component;

  return (
    <>
      {/* أداة تطوير مؤقتة للتنقل بين الشاشات، نخفيها قبل العرض */}
      <select
        value={screen}
        onChange={e => setScreen(e.target.value)}
        style={{ position: 'fixed', top: 12, right: 12, zIndex: 10, height: 36, borderRadius: 8 }}
      >
        {Object.entries(SCREENS).map(([key, s]) => (
          <option key={key} value={key}>{s.name}</option>
        ))}
      </select>

      <PhoneFrame chrome={current.chrome !== false}>
        {Screen ? <Screen go={setScreen} /> : <Placeholder name={current.name} />}
      </PhoneFrame>
    </>
  );
}