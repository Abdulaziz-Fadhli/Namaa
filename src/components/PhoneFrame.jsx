// إطار الجوال: يحتوي الشاشة، وسطر "نموذج أولي"، وشريط تبويبات تطبيق الإنماء.
// يتكبر ويتصغر تلقائيًا حسب حجم الشاشة، حتى يملأ شاشة القاعة يوم العرض.
import { useEffect, useRef, useState } from 'react';

const PHONE_W = 390;
const PHONE_H = 844;

function useFitScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () =>
      setScale(Math.min(1.6, (window.innerHeight * 0.94) / PHONE_H, (window.innerWidth * 0.94) / PHONE_W));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return scale;
}

const icon = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

function TabBar() {
  return (
    <nav className="tabbar">
      <span className="tab">
        <svg {...icon}><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></svg>
        <span>الرئيسية</span>
      </span>
      <span className="tab">
        <svg {...icon}><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M8 10h8l-3-3" /><path d="M16 14H8l3 3" /></svg>
        <span>التحويل</span>
      </span>
      <span className="tab">
        <svg {...icon}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6" /><path d="M9 12h6" /></svg>
        <span>المدفوعات</span>
      </span>
      <span className="tab">
        <svg {...icon}><path d="M4 9l1.5-5h13L20 9" /><path d="M4 9h16v11H4z" /><path d="M10 20v-5h4v5" /></svg>
        <span>المتجر</span>
      </span>
      <span className="tab active">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="3" y="3" width="8" height="8" rx="2.5" /><rect x="13" y="3" width="8" height="8" rx="2.5" />
          <rect x="3" y="13" width="8" height="8" rx="2.5" /><rect x="13" y="13" width="8" height="8" rx="2.5" />
        </svg>
        <span>الخدمات</span>
      </span>
    </nav>
  );
}

// سحب الشاشة بالماوس مثل الإصبع في الجوال، مع انزلاق يهدأ تدريجيًا بعد الترك.
// اللمس في الجوال الحقيقي يشتغل تلقائيًا، فهذا للماوس فقط (يوم العرض على اللابتوب).
function useDragScroll(ref, scale) {
  useEffect(() => {
    const phone = ref.current;
    if (!phone) return;
    let el = null, startY = 0, startTop = 0, lastY = 0, lastT = 0, velocity = 0, dragging = false, raf = 0;

    const onDown = e => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      if (e.target.closest('input, select, textarea')) return; // الحقول تبقى تشتغل عادي
      el = e.target.closest('.screen');
      if (!el) return;
      cancelAnimationFrame(raf);
      startY = lastY = e.clientY;
      startTop = el.scrollTop;
      lastT = performance.now();
      velocity = 0;
      dragging = false;
    };

    const onMove = e => {
      if (!el) return;
      const dy = e.clientY - startY;
      if (!dragging && Math.abs(dy) < 6) return; // حركة صغيرة = ضغطة عادية مو سحب
      dragging = true;
      el.scrollTop = startTop - dy / scale;
      const now = performance.now();
      velocity = (e.clientY - lastY) / Math.max(1, now - lastT);
      lastY = e.clientY;
      lastT = now;
    };

    const onUp = () => {
      if (!el) return;
      const target = el;
      el = null;
      if (!dragging) return;
      // الانزلاق بعد الترك
      let v = (velocity * 16) / scale;
      const glide = () => {
        v *= 0.94;
        if (Math.abs(v) < 0.4) return;
        target.scrollTop -= v;
        raf = requestAnimationFrame(glide);
      };
      raf = requestAnimationFrame(glide);
      // نلغي "الضغطة" اللي تجي بعد السحب، حتى ما ينضغط زر بالغلط
      const block = ev => { ev.stopPropagation(); ev.preventDefault(); };
      window.addEventListener('click', block, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', block, { capture: true }), 0);
    };

    phone.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      cancelAnimationFrame(raf);
      phone.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [ref, scale]);
}

// chrome={false} للشاشات اللي ما فيها شريط التطبيق، مثل شاشة قفل الجوال (الإشعار)
// figma: شاشات فيجما لها شريط حالة خاص فيها، فالإطار يأخذ زواياها وظلها فقط
export default function PhoneFrame({ children, chrome = true, figma = false }) {
  const scale = useFitScale();
  const phoneRef = useRef(null);
  useDragScroll(phoneRef, scale);
  return (
    <div className="stage">
      <div className={figma ? 'phone figma' : 'phone'} ref={phoneRef} style={{ transform: `scale(${scale})` }}>
        {children}
        {chrome && <div className="footer-note">نموذج أولي، بيانات محاكاة</div>}
        {chrome && <TabBar />}
      </div>
    </div>
  );
}