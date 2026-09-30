// مكونات واجهة فيجما المشتركة: كل شاشة تتركب منها، والمقاسات في figma.css.
// الأيقونات من Lucide بنفس الأسماء المستخدمة في ملف فيجما، وسماكة خطها 1.6 مثل الملف.
import { ArrowRight } from 'lucide-react';

export function Ico({ as: Comp, size = 18 }) {
  return <Comp size={size} absoluteStrokeWidth strokeWidth={1.6} aria-hidden="true" />;
}

// أيقونات شريط الحالة (مصدّرة من فيجما كما هي)
function StatusIcons() {
  return (
    <div className="nm-status-icons" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor"><path fillRule="evenodd" clipRule="evenodd" d="M17.28 4.97914C17.28 4.40932 16.8502 3.9474 16.32 3.9474H15.36C14.8298 3.9474 14.4 4.40932 14.4 4.97914V13.9209C14.4 14.4907 14.8298 14.9526 15.36 14.9526H16.32C16.8502 14.9526 17.28 14.4907 17.28 13.9209V4.97914ZM10.5893 6.14844H11.5493C12.0795 6.14844 12.5093 6.62146 12.5093 7.20495V13.8961C12.5093 14.4796 12.0795 14.9526 11.5493 14.9526H10.5893C10.0591 14.9526 9.62928 14.4796 9.62928 13.8961V7.20495C9.62928 6.62146 10.0591 6.14844 10.5893 6.14844ZM6.6907 8.5329H5.73071C5.20051 8.5329 4.7707 9.0119 4.7707 9.60283V13.8826C4.7707 14.4736 5.20051 14.9526 5.73071 14.9526H6.6907C7.2209 14.9526 7.6507 14.4736 7.6507 13.8826V9.60283C7.6507 9.0119 7.2209 8.5329 6.6907 8.5329ZM1.92 10.7339H0.960003C0.429807 10.7339 0 11.2061 0 11.7886V13.8979C0 14.4804 0.429807 14.9526 0.960003 14.9526H1.92C2.4502 14.9526 2.88 14.4804 2.88 13.8979V11.7886C2.88 11.2061 2.4502 10.7339 1.92 10.7339Z" /></svg>
      <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor"><path fillRule="evenodd" clipRule="evenodd" d="M8.61456 5.22205C10.8529 5.22214 13.0057 6.05202 14.628 7.54016C14.7502 7.65504 14.9454 7.65359 15.0658 7.53691L16.2335 6.39978C16.2944 6.3406 16.3284 6.26043 16.3279 6.17702C16.3274 6.0936 16.2925 6.01383 16.2308 5.95533C11.9729 2.01809 5.25555 2.01809 0.997643 5.95533C0.935957 6.01378 0.900965 6.09354 0.900398 6.17695C0.899827 6.26037 0.933734 6.34056 0.99461 6.39978L2.16268 7.53691C2.28292 7.65377 2.47833 7.65522 2.60043 7.54016C4.22289 6.05193 6.37594 5.22204 8.61456 5.22205ZM8.61154 9.02031C9.83316 9.02022 11.0111 9.48084 11.9167 10.3125C12.0391 10.4305 12.232 10.428 12.3514 10.3068L13.5099 9.1194C13.5709 9.05712 13.6049 8.97259 13.604 8.88479C13.6031 8.797 13.5675 8.71323 13.5052 8.65221C10.7478 6.05045 6.47758 6.05045 3.72013 8.65221C3.65784 8.71323 3.6223 8.79704 3.62149 8.88486C3.62067 8.97269 3.65464 9.05721 3.71579 9.1194L4.87401 10.3068C4.99339 10.428 5.18632 10.4305 5.3088 10.3125C6.2137 9.48138 7.39076 9.02085 8.61154 9.02031ZM10.8835 11.5345C10.8853 11.6293 10.8519 11.7208 10.7913 11.7872L8.83233 13.9964C8.7749 14.0613 8.69661 14.0978 8.61492 14.0978C8.53323 14.0978 8.45493 14.0613 8.39751 13.9964L6.43818 11.7872C6.37765 11.7207 6.34436 11.6292 6.34615 11.5345C6.34794 11.4396 6.38467 11.3498 6.44766 11.2862C7.69875 10.1037 9.53112 10.1037 10.7822 11.2862C10.8451 11.3499 10.8817 11.4397 10.8835 11.5345Z" /></svg>
      <svg width="25" height="18" viewBox="0 0 25 18" fill="currentColor"><path d="M16.5179 3.6C18.3487 3.6 19.2641 3.60023 19.9837 3.90849C20.8985 4.30034 21.6266 5.03436 22.0154 5.95634C22.3212 6.68174 22.3214 7.60455 22.3214 9.45C22.3214 11.2955 22.3212 12.2182 22.0154 12.9436L21.9387 13.1142C21.535 13.956 20.8413 14.6241 19.9837 14.9915L19.846 15.046C19.1458 15.2999 18.234 15.3 16.5179 15.3H5.80357L4.59071 15.2956C3.52724 15.2812 2.87735 15.2227 2.33764 14.9915C1.4801 14.6241 0.786441 13.956 0.382778 13.1142L0.306047 12.9436C0.000234055 12.2182 0 11.2955 0 9.45C0 7.72009 9.58198e-05 6.80102 0.251988 6.09521L0.306047 5.95634C0.67051 5.09194 1.33333 4.39273 2.16849 3.98584L2.33764 3.90849C2.87735 3.67731 3.52724 3.61885 4.59071 3.60439L5.80357 3.6H16.5179ZM5.80357 4.5C4.8757 4.5 4.22552 4.5002 3.71617 4.53604C3.21536 4.57127 2.91768 4.6378 2.68729 4.73643C1.98524 5.03715 1.42574 5.60112 1.12741 6.30879C1.02956 6.54102 0.963562 6.84108 0.928607 7.3459C0.893054 7.85932 0.892857 8.5147 0.892857 9.45C0.892857 10.3853 0.893054 11.0407 0.928607 11.5541C0.963562 12.0589 1.02956 12.359 1.12741 12.5912C1.42574 13.2989 1.98524 13.8629 2.68729 14.1636C2.91768 14.2622 3.21536 14.3287 3.71617 14.364C4.22552 14.3998 4.8757 14.4 5.80357 14.4H16.5179C17.4457 14.4 18.0959 14.3998 18.6053 14.364C19.1061 14.3287 19.4037 14.2622 19.6341 14.1636C20.3362 13.8629 20.8957 13.2989 21.194 12.5912C21.2919 12.359 21.3579 12.0589 21.3929 11.5541C21.4284 11.0407 21.4286 10.3853 21.4286 9.45C21.4286 8.5147 21.4284 7.85932 21.3929 7.3459C21.3579 6.84108 21.2919 6.54102 21.194 6.30879C20.8957 5.60112 20.3362 5.03715 19.6341 4.73643C19.4037 4.6378 19.1061 4.57127 18.6053 4.53604C18.0959 4.5002 17.4457 4.5 16.5179 4.5H5.80357ZM16.9643 5.4C18.2143 5.4 18.8393 5.40006 19.3168 5.64521C19.7368 5.86093 20.0785 6.20535 20.2924 6.62871C20.5356 7.10999 20.5357 7.74002 20.5357 9V9.9C20.5357 11.16 20.5356 11.79 20.2924 12.2713C20.0785 12.6947 19.7368 13.0391 19.3168 13.2548C18.8393 13.4999 18.2143 13.5 16.9643 13.5H5.35714C4.10716 13.5 3.48213 13.4999 3.00467 13.2548C2.58467 13.0391 2.24298 12.6947 2.02898 12.2713C1.78578 11.79 1.78571 11.16 1.78571 9.9V9C1.78571 7.74002 1.78578 7.10999 2.02898 6.62871C2.24298 6.20535 2.58467 5.86093 3.00467 5.64521C3.48213 5.40006 4.10716 5.4 5.35714 5.4H16.9643ZM23.2143 7.65C23.9328 7.96065 24.4001 8.68363 24.4001 9.48429C24.4 10.2848 23.9327 11.007 23.2143 11.3177V7.65Z" /></svg>
    </div>
  );
}

export function StatusBar() {
  return (
    <div className="nm-status">
      <span className="nm-status-time">٩:٤١</span>
      <StatusIcons />
    </div>
  );
}

// إطار الشاشة: الخلفية (فاتحة أو داكنة) + شريط الحالة
export function Frame({ theme = 'light', gradient = false, label, children }) {
  return (
    <div className={`nm ${theme}${gradient ? ' gradient' : ''}`} dir="rtl" lang="ar" aria-label={label} role="main">
      <StatusBar />
      {children}
    </div>
  );
}

export function AppBar({ onBack }) {
  return (
    <div className="nm-appbar">
      <div className="nm-brand">
        <span className="nm-badge" aria-hidden="true">ن</span>
        <span className="nm-brand-name">نماء</span>
      </div>
      <button className="nm-round" onClick={onBack} aria-label="رجوع"><Ico as={ArrowRight} /></button>
    </div>
  );
}

// الشاشة القياسية: شريط التطبيق، ثم العنوان والمحتوى، والزر الرئيسي تحت
export function Screen({ theme, title, desc, onBack, cta, children, packed = false, titleGap, label }) {
  return (
    <Frame theme={theme} label={label ?? title}>
      <div className={`nm-app${packed ? ' tight' : ''}`}>
        <AppBar onBack={onBack} />
        <div className={`screen nm-body${packed ? ' packed' : ''}`}>
          <div className={`nm-main${packed ? ' g10' : ''}`}>
            <div className={`nm-title${titleGap === 2 ? ' g2' : ''}`}>
              <h1>{title}</h1>
              {desc && <p>{desc}</p>}
            </div>
            {children}
          </div>
          {cta}
        </div>
      </div>
    </Frame>
  );
}

export function Button({ icon, children, variant = 'outline', onClick, disabled, type = 'button' }) {
  return (
    <button type={type} className={`nm-btn ${variant}`} onClick={onClick} disabled={disabled}>
      {children}
      {icon && <Ico as={icon} />}
    </button>
  );
}

export function InfoRow({ icon, title, detail, value, selected, onClick, compact, label }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`nm-row${selected ? ' selected' : ''}${compact ? ' compact' : ''}`} onClick={onClick}
      aria-pressed={onClick && selected !== undefined ? !!selected : undefined} aria-label={label}>
      {icon && <Ico as={icon} size={19} />}
      <span className="nm-row-info">
        <span className="nm-row-title">{title}</span>
        {detail && <span className="nm-row-detail">{detail}</span>}
      </span>
      {value != null && <span className="nm-row-value">{value}</span>}
    </Tag>
  );
}

// خيارين جنب بعض. options بترتيب القراءة (الأول يمين)
export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="nm-seg" role="group" aria-label={label}>
      {options.map(o => (
        <button key={o.value} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Field({ icon, label, help, warn, active, children }) {
  return (
    <div className="nm-field">
      <label className={`nm-field-box${active ? ' active' : ''}`}>
        <Ico as={icon} />
        <span className="nm-field-label">{label}</span>
        {children}
      </label>
      {help && <span className={`nm-help${warn ? ' warn' : ''}`} role={warn ? 'alert' : undefined}>{help}</span>}
    </div>
  );
}

export function Note({ icon, children, tight }) {
  return (
    <div className={`nm-note${tight ? ' tight' : ''}`}>
      <Ico as={icon} size={16} />
      <p>{children}</p>
    </div>
  );
}

// بطاقة المبلغ تكون عكس لون الشاشة
export function AmountCard({ theme, label, amount, detail }) {
  return (
    <div className={`nm-amount ${theme === 'dark' ? 'nm-invert-light' : 'nm-invert-dark'}`} aria-live="polite">
      <span className="nm-amount-label">{label}</span>
      <span className="nm-amount-value">{amount}</span>
      {detail && <span className="nm-amount-detail">{detail}</span>}
    </div>
  );
}

export function Line({ label, value }) {
  return (
    <div className="nm-line">
      <span className="nm-line-label">{label}</span>
      <span className="nm-line-value">{value}</span>
    </div>
  );
}
