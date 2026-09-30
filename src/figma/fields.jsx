// حقول الإدخال الخاصة: رقم مع وحدة، قائمة اختيار، وتاريخ يُعرض هجريًا أو ميلاديًا.
import { Field } from './ui.jsx';
import { gregText, hijriText } from './format.js';
import { parseNum } from './model.js';

export function NumberField({ icon, label, value, onChange, unit, help, warn, active, max = 1e9 }) {
  return (
    <Field icon={icon} label={label} help={help} warn={warn} active={active}>
      <input className="nm-field-input" inputMode="decimal" dir="ltr" value={value} maxLength={14}
        aria-label={label} onChange={e => { const n = parseNum(e.target.value); if (e.target.value === '' || (!Number.isNaN(n) && n <= max)) onChange(e.target.value); }} />
      {unit && <span className="nm-field-label" style={{ color: 'inherit', fontSize: 13, fontWeight: 500 }}>{unit}</span>}
    </Field>
  );
}

export function TextField({ icon, label, value, onChange, help, warn, active, placeholder }) {
  return (
    <Field icon={icon} label={label} help={help} warn={warn} active={active}>
      <input className="nm-field-input" value={value} maxLength={60} placeholder={placeholder} aria-label={label}
        onChange={e => onChange(e.target.value)} />
    </Field>
  );
}

export function SelectField({ icon, label, value, onChange, options }) {
  return (
    <Field icon={icon} label={label}>
      <select className="nm-field-input" value={value} aria-label={label} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}

// التاريخ يظهر مثل فيجما (هجري أو ميلادي) ومنتقي التاريخ الأصلي فوقه شفاف
export function DateField({ icon, label, value, onChange, calendar = 'hijri', max }) {
  return (
    <Field icon={icon} label={label}>
      <span className="nm-field-value">{calendar === 'hijri' ? hijriText(value) : gregText(value)}</span>
      <input type="date" className="nm-field-overlay" value={value} max={max} aria-label={label}
        onClick={e => e.currentTarget.showPicker?.()}
        onChange={e => e.target.value && onChange(e.target.value)} />
    </Field>
  );
}
