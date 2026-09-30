// إطار الجوال: يحتوي الشاشة.
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

// الإطار يأخذ زوايا شاشات فيجما وظلها (لها شريط حالة خاص فيها)
export default function PhoneFrame({ children }) {
  const scale = useFitScale();
  const phoneRef = useRef(null);
  useDragScroll(phoneRef, scale);
  return (
    <div className="stage">
      <div className="phone figma" ref={phoneRef} style={{ transform: `scale(${scale})` }}>
        <div className="nm-host">{children}</div>
      </div>
    </div>
  );
}
