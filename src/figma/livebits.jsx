// قطع الوضع المباشر في الواجهة:
// - LivePill: شارة تبيّن الوجه الحالي (مباشر أو قصة أحمد)، وحالة السوق، ومتى آخر تحديث. الضغط يبدّل الوجه.
// - RefreshButton: زر تحديث الأسعار في الوضع المباشر (طلب واحد لكل ضغطة).
// - Flash: يومّض الرقم لما تتغير قيمته (أخضر صعود، أحمر نزول، وردي بدون اتجاه).
import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useStore } from './model.js';
import { Ico } from './ui.jsx';

// يومّض فقط لما تتغير القيمة فعلًا، مو أول ما تظهر الشاشة
export function Flash({ value, dir = 0, children }) {
  const [seen, setSeen] = useState(value);
  const [changes, setChanges] = useState(0);
  if (value !== seen) {
    // نمط React الموصى به لتذكّر القيمة السابقة: تحديث الحالة أثناء العرض عند تغيّر المدخل
    setSeen(value);
    setChanges(c => c + 1);
  }
  if (!changes) return <span>{children}</span>;
  return (
    <span key={changes} className={`nm-flash${dir > 0 ? ' up' : dir < 0 ? ' down' : ''}`}>
      {children}
    </span>
  );
}

function useSecondsSince(ms) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return ms ? Math.max(0, Math.round((now - ms) / 1000)) : null;
}

const ago = secs => (secs == null ? '' : secs < 60 ? `قبل ${secs} ث` : `قبل ${Math.floor(secs / 60)} د`);

export function LivePill() {
  const { live, setMode, feed } = useStore();
  const secs = useSecondsSince(live ? feed.receivedAt : null);
  let text, color;
  if (!live) {
    text = 'قصة أحمد · يوم العرض';
    color = '#C9D6DE';
  } else if (feed.loading || (!feed.ready && !feed.error)) {
    text = 'مباشر · نحدّث الأسعار…';
    color = '#E8C46A';
  } else if (!feed.metalsLive || feed.error) {
    text = 'مباشر · تعذر الاتصال، آخر سعر محفوظ';
    color = '#FF7A7A';
  } else if (feed.market && !feed.market.metals.open) {
    text = `مباشر · السوق مغلق، آخر سعر ${ago(secs)}`;
    color = '#E8C46A';
  } else {
    text = `مباشر · آخر تحديث ${ago(secs)}`;
    color = '#4CC38A';
  }
  return (
    <button
      type="button"
      onClick={() => setMode(live ? 'story' : 'live')}
      aria-label={live ? 'التبديل إلى قصة أحمد' : 'التبديل إلى الوضع المباشر'}
      className="nm-livepill"
      style={{ '--pill': color }}
    >
      <span className={`nm-livepill-dot${live && feed.metalsLive ? ' pulse' : ''}`} />
      {text}
    </button>
  );
}

export function RefreshButton() {
  const { live, feed } = useStore();
  if (!live) return null;
  return (
    <button type="button" className="nm-round" onClick={feed.refresh} disabled={feed.loading}
      aria-label="تحديث الأسعار الآن" aria-busy={feed.loading}>
      <span className={feed.loading ? 'nm-spin' : undefined} style={{ display: 'inline-flex' }}><Ico as={RefreshCw} /></span>
    </button>
  );
}
