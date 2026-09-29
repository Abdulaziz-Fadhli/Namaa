// الشاشة 2: أموال لا تراها البنوك.
// الإدخال الوحيد اليدوي في الميزة. ويرفض المواشي والمحاصيل اللي ما بلغت نصابها.
// النقد والذهب والفضة والعقار ما تنرفض: تُضم لأرصدة البنوك لتكميل النصاب (الملحق أ).
import { lazy, Suspense, useState } from 'react';

// دليل الأسهم (1600+ ورقة) يُحمَّل عند فتح هذه الشاشة فقط، حتى لا يثقل التطبيق
const StockZakatCheck = lazy(() => import('../components/StockZakatCheck.jsx'));

// أنصبة المواشي: كل نوع بنصابه، ولا يُضم نوع إلى آخر (الضأن والماعز نوع واحد)
const LIVESTOCK = {
  camels: { name: 'إبل', of: 'الإبل', nisab: 5 },
  cattle: { name: 'بقر', of: 'البقر', nisab: 30 },
  sheep: { name: 'غنم', of: 'الغنم', nisab: 40 }, // ضأن وماعز
};
// نصاب المحاصيل: خمسة أوسق. الرقم بالكيلو يعتمده العضو 2 من مصدر (تختلف التقديرات)
const CROP_NISAB_KG = 612;

const num = v => Number(String(v).replace(/[^\d.]/g, '')) || 0;

function Card({ title, hint, children }) {
  return (
    <div className="card col" style={{ gap: 12 }}>
      <div className="row" style={{ alignItems: 'baseline' }}>
        <span className="bold" style={{ fontSize: 16 }}>{title}</span>
        {hint && <span className="small muted">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return <label className="field-label">{label}{children}</label>;
}

function Status({ ok, children, sub }) {
  const color = ok ? 'var(--green)' : 'var(--red)';
  return (
    <div role={ok ? 'status' : 'alert'} style={{
      display: 'flex', gap: 10, alignItems: 'flex-start', borderRadius: 12, padding: '10px 12px',
      background: ok ? 'rgba(76,195,138,0.10)' : 'rgba(255,122,122,0.12)',
    }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }}>
        {ok ? <polyline points="20 6 9 17 4 12" /> : <><circle cx="12" cy="12" r="9" /><path d="M12 7v6" /><path d="M12 16.5v.5" /></>}
      </svg>
      <div className="col" style={{ fontSize: 13, lineHeight: 1.6 }}>
        <span className="bold" style={{ color: ok ? '#9BE3BF' : '#FFB3B3' }}>{children}</span>
        {sub && <span style={{ color: '#DCE5EB' }}>{sub}</span>}
      </div>
    </div>
  );
}

const NOTE = { fontSize: 12, lineHeight: 1.6, color: 'var(--muted)' };

export default function Manual({ go, back }) {
  // القيم الأولية مثال التصميم: 6 من الإبل (مقبولة) و25 من الغنم (مرفوضة)
  const [herd, setHerd] = useState([
    { id: 1, type: 'camels', count: '6', grazing: true },
    { id: 2, type: 'sheep', count: '25', grazing: true },
  ]);
  const [crop, setCrop] = useState({ kind: 'تمر', kg: '', irrigation: 'free', harvest: '' });

  const updateHerd = (id, patch) => setHerd(h => h.map(r => (r.id === id ? { ...r, ...patch } : r)));
  const addHerd = () => setHerd(h => [...h, { id: Date.now(), type: 'cattle', count: '', grazing: true }]);
  const removeHerd = id => setHerd(h => h.filter(r => r.id !== id));

  // لو تكرر النوع في أكثر من صف، يُجمع عدده قبل المقارنة بالنصاب
  const totalByType = herd.reduce((t, r) => (r.grazing ? { ...t, [r.type]: (t[r.type] || 0) + num(r.count) } : t), {});

  const cropKg = num(crop.kg);
  const cropRate = crop.irrigation === 'free' ? 0.1 : 0.05;

  return (
    <>
      <div className="subheader">
        <button className="icon-btn" onClick={back} aria-label="رجوع">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        </button>
        <h1 className="h2">أموال لا تراها البنوك</h1>
      </div>

      <div className="screen" style={{ gap: 12 }}>
        <p className="soft" style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}>
          أدخلها مرة واحدة، ونعيد تقييمها يوميًا. وما لم يبلغ نصابه منها لا يُضاف.
        </p>

        <Card title="ذهب">
          <div className="grid2">
            <Field label="الوزن (جرام)"><input className="input" inputMode="decimal" placeholder="مثال: 50" /></Field>
            <Field label="العيار"><select className="input"><option>24</option><option>21</option><option>18</option></select></Field>
          </div>
          <span style={NOTE}>يُضم إلى أرصدتك البنكية لتكميل النصاب، ونحسب قيمته كل يوم بسعر الذهب</span>
        </Card>

        <Card title="فضة">
          <div className="grid2">
            <Field label="الوزن (جرام)"><input className="input" inputMode="decimal" placeholder="مثال: 200" /></Field>
            <Field label="النقاوة"><select className="input"><option>999 (خالصة)</option><option>925</option><option>800</option></select></Field>
          </div>
          <span style={NOTE}>تُضم إلى أرصدتك البنكية لتكميل النصاب، ونحسب قيمتها كل يوم بسعر الفضة</span>
        </Card>

        <Card title="نقد في البيت">
          <div className="grid2">
            <Field label="المبلغ (ريال)"><input className="input" inputMode="decimal" placeholder="مثال: 3000" /></Field>
            <Field label="موجود منذ"><input className="input" placeholder="التاريخ" /></Field>
          </div>
          <span style={NOTE}>يُضم إلى أرصدتك البنكية لتكميل النصاب</span>
        </Card>

        <Card title="عقار معد للبيع">
          <div className="grid2">
            <Field label="القيمة التقديرية (ريال)"><input className="input" inputMode="decimal" placeholder="القيمة" /></Field>
            <Field label="معروض منذ"><input className="input" placeholder="التاريخ" /></Field>
          </div>
        </Card>

        <Card title="محصول زراعي">
          <div className="grid2">
            <Field label="النوع">
              <select className="input" value={crop.kind} onChange={e => setCrop({ ...crop, kind: e.target.value })}>
                <option>تمر</option><option>قمح</option><option>شعير</option>
              </select>
            </Field>
            <Field label="الكمية (كجم)">
              <input className={`input ${cropKg > 0 && cropKg < CROP_NISAB_KG ? 'error' : ''}`} inputMode="decimal"
                placeholder="مثال: 900" value={crop.kg} onChange={e => setCrop({ ...crop, kg: e.target.value })} />
            </Field>
            <Field label="طريقة السقي">
              <select className="input" value={crop.irrigation} onChange={e => setCrop({ ...crop, irrigation: e.target.value })}>
                <option value="free">بلا كلفة (العُشر)</option><option value="cost">بكلفة (نصف العُشر)</option>
              </select>
            </Field>
            <Field label="تاريخ الحصاد">
              <input className="input" placeholder="التاريخ" value={crop.harvest} onChange={e => setCrop({ ...crop, harvest: e.target.value })} />
            </Field>
          </div>
          {cropKg > 0 && (cropKg < CROP_NISAB_KG
            ? <Status sub={`نصاب المحاصيل خمسة أوسق (نحو ${CROP_NISAB_KG} كجم)، فلا زكاة في ${cropKg} كجم`}>لم يبلغ النصاب، فلن يُضاف</Status>
            : <Status ok sub="تُخرج عند الحصاد، بدون حول">بلغ النصاب: زكاته {Math.round(cropKg * cropRate * 10) / 10} كجم من {crop.kind}</Status>)}
          <span style={NOTE}>نصابه خمسة أوسق (نحو {CROP_NISAB_KG} كجم)، ويُزكّى عند الحصاد بدون حول</span>
        </Card>

        <Card title="مواشي" hint="كل نوع بنصابه">
          {herd.map((r, i) => {
            const n = num(r.count);
            const total = totalByType[r.type] || 0;
            const nisab = LIVESTOCK[r.type].nisab;
            const rejected = r.grazing && n > 0 && total < nisab;
            return (
              <div key={r.id} className="col" style={{
                gap: 10, background: 'var(--field)', borderRadius: 16, padding: 12,
                border: `1px solid ${rejected ? 'var(--red)' : 'var(--line)'}`,
              }}>
                <div className="row">
                  <span className="label bold">النوع {i + 1}</span>
                  <button className="icon-btn" style={{ width: 36, height: 36, color: 'var(--muted)' }}
                    onClick={() => removeHerd(r.id)} aria-label={`حذف النوع ${i + 1}`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /></svg>
                  </button>
                </div>
                <div className="grid2">
                  <Field label="النوع">
                    <select className="input" value={r.type} onChange={e => updateHerd(r.id, { type: e.target.value })} style={{ background: 'var(--bg)' }}>
                      {Object.entries(LIVESTOCK).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
                    </select>
                  </Field>
                  <Field label="العدد (رأس)">
                    <input className={`input ${rejected ? 'error' : ''}`} inputMode="numeric" value={r.count}
                      aria-invalid={rejected} onChange={e => updateHerd(r.id, { count: e.target.value })} style={{ background: 'var(--bg)' }} />
                  </Field>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                  <input type="checkbox" checked={r.grazing} onChange={e => updateHerd(r.id, { grazing: e.target.checked })} style={{ width: 20, height: 20 }} />
                  ترعى أغلب السنة (سائمة)
                </label>
                {n > 0 && !r.grazing && (
                  <Status sub="إلا إذا كانت معدّة للتجارة، فتُضاف كعروض تجارة">المعلوفة لا زكاة فيها، فلن تُضاف</Status>
                )}
                {rejected && (
                  <Status sub={`نصاب ${LIVESTOCK[r.type].of} ${nisab} رأسًا، فلا زكاة في ${total} رأسًا`}>لم تبلغ النصاب، فلن تُضاف</Status>
                )}
                {r.grazing && n > 0 && !rejected && (
                  <Status ok>بلغت النصاب ({nisab} من {LIVESTOCK[r.type].of})، وتُضاف</Status>
                )}
              </div>
            );
          })}
          <button onClick={addHerd} className="btn outline" style={{ height: 46, fontSize: 14, borderStyle: 'dashed' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
            إضافة نوع آخر
          </button>
          <span style={NOTE}>النصاب: 5 من الإبل · 30 من البقر · 40 من الغنم. ولا يُضم نوع إلى آخر، والضأن والماعز نوع واحد. ولو تكرر النوع يُجمع عدده.</span>
        </Card>

        <Suspense fallback={<div className="card small muted">جارٍ تحميل دليل الأسهم...</div>}>
          <StockZakatCheck />
        </Suspense>

        <button className="btn primary" onClick={() => go('offbank')}>حفظ</button>
      </div>
    </>
  );
}