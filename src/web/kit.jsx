// أدوات الموقع المشتركة: التنقل بالروابط (#/app/assets)، والأيقونات، والحقول، والنوافذ.
import { useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { parseNum } from '../figma/model.js';
import logo from '../assets/namaa-logo.png';

import { go } from './nav.js';

// ---------- عناصر صغيرة ----------
export function Icon({ as: C, size = 18, ...rest }) {
  return <C size={size} strokeWidth={1.6} absoluteStrokeWidth aria-hidden="true" {...rest} />;
}

export function Brand({ onClick }) {
  return (
    <button className="w-brand" onClick={onClick ?? (() => go('/'))} aria-label="نماء، الصفحة الرئيسية">
      <img src={logo} alt="" />
      <span>نماء</span>
    </button>
  );
}

export function Card({ title, desc, action, children, className = '', flush }) {
  return (
    <section className={`w-card${flush ? ' flush' : ''} ${className}`}>
      {(title || action) && (
        <div className="w-card-head" style={flush ? { padding: '20px 24px 0' } : undefined}>
          <div>
            {title && <h2>{title}</h2>}
            {desc && <p>{desc}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Btn({ variant = 'outline', icon, children, className = '', ...rest }) {
  return (
    <button type="button" className={`w-btn ${variant} ${className}`} {...rest}>
      {children}
      {icon && <Icon as={icon} size={16} />}
    </button>
  );
}

export const Pill = ({ tone = '', children }) => <span className={`w-pill ${tone}`}>{children}</span>;

export function Field({ label, help, warn, children }) {
  return (
    <div className="w-field">
      {label && <label>{label}</label>}
      {children}
      {help && <span className={`w-help${warn ? ' warn' : ''}`} role={warn ? 'alert' : undefined}>{help}</span>}
    </div>
  );
}

export function TextInput({ label, help, warn, value, onChange, unit, type = 'text', dir, placeholder, icon, ...rest }) {
  return (
    <Field label={label} help={help} warn={warn}>
      <span className="w-input">
        {icon && <Icon as={icon} size={16} className="muted" />}
        <input type={type} value={value} dir={dir} placeholder={placeholder} aria-label={label}
          onChange={e => onChange(e.target.value)} {...rest} />
        {unit && <span className="unit">{unit}</span>}
      </span>
    </Field>
  );
}

// رقم: يقبل الأرقام العربية والفواصل
export function NumberInput({ label, value, onChange, unit, help, warn, max = 1e12 }) {
  return (
    <TextInput label={label} value={value} unit={unit} help={help} warn={warn} inputMode="decimal" dir="ltr"
      onChange={v => { const n = parseNum(v); if (v === '' || (!Number.isNaN(n) && n <= max)) onChange(v); }} />
  );
}

export function Select({ label, value, onChange, options, help }) {
  return (
    <Field label={label} help={help}>
      <span className="w-input">
        <select value={value} aria-label={label} onChange={e => onChange(e.target.value)}>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </span>
    </Field>
  );
}

export function Seg({ value, onChange, options, label, block }) {
  return (
    <div className={`w-seg${block ? ' block' : ''}`} role="group" aria-label={label}>
      {options.map(o => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Option({ selected, onClick, title, desc, icon, trailing }) {
  return (
    <button type="button" className="w-option" aria-pressed={selected} onClick={onClick}>
      <span className="w-radio" />
      {icon && <span className="w-ico"><Icon as={icon} /></span>}
      <span className="grow">
        <span className="b7" style={{ display: 'block' }}>{title}</span>
        {desc && <span className="t12 sub">{desc}</span>}
      </span>
      {trailing}
    </button>
  );
}

export function Switch({ on, onChange, label }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className="w-switch" onClick={() => onChange(!on)} />;
}

export function Checkbox({ on, onChange, children }) {
  return (
    <button type="button" className="row t13" onClick={() => onChange(!on)} role="checkbox" aria-checked={on}>
      <span className="w-check" aria-checked={on}>{on && <Check size={14} strokeWidth={2.4} />}</span>
      <span>{children}</span>
    </button>
  );
}

export function Modal({ title, desc, onClose, children, foot, tabs, size }) {
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="w-modal-back" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`w-modal${size === 'sm' ? ' sm' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        {title && (
          <div className="w-modal-head">
            <div>
              <h2>{title}</h2>
              {desc && <p className="t12 sub">{desc}</p>}
            </div>
            <button className="w-x" onClick={onClose} aria-label="إغلاق"><Icon as={X} size={16} /></button>
          </div>
        )}
        {tabs}
        <div className="w-modal-body">{children}</div>
        {foot && <div className="w-modal-foot">{foot}</div>}
      </div>
    </div>
  );
}

export function Steps({ items, current }) {
  return (
    <div className="w-steps">
      {items.map((label, i) => (
        <span key={label} className="row" style={{ gap: 12 }}>
          {i > 0 && <hr className={i <= current ? 'done' : ''} />}
          <span className={`s${i < current ? ' done' : i === current ? ' on' : ''}`}>
            <i>{i < current ? '✓' : i + 1}</i>{label}
          </span>
        </span>
      ))}
    </div>
  );
}
