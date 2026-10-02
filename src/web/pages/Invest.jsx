// تطبيقات الاستثمار: ربط المحفظة (محاكاة)، وصفحة المحفظة، وعمليات الشراء والبيع التي تحدّث الزكاة فورًا.
import { useEffect, useState } from 'react';
import { Check, ChevronLeft, Download, FileUp, Link2, LoaderCircle, Search, ShieldCheck } from 'lucide-react';
import { Btn, Card, CompanyMark, Icon, Modal, NamaaMark, Select, TextInput } from '../kit.jsx';
import { go } from '../nav.js';
import { Shell } from '../Shell.jsx';
import { useStore } from '../../figma/model.js';
import { gregText } from '../../figma/format.js';
import { resolveHawlDueDate } from '../../engine/engine.js';
import {
  GROUPS, KINDS, PROVIDERS, STATEMENT_SAMPLE, markOf, nextScripted, parseStatement, portfolioFromStatement, seedPortfolio, summarize, tradeLabel, tradeNote,
} from '../../engine/portfolio.js';
import { plain, sar } from '../data.js';

const hawlEnd = iso => resolveHawlDueDate(new Date(`${iso}T00:00:00Z`)).toISOString().slice(0, 10);
const fins = n => (n === 1 ? 'تمويل واحد' : n === 2 ? 'تمويلان' : n <= 10 ? `${n} تمويلات` : `${n} تمويلًا`);
const customId = name => `custom-${[...name.trim()].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7).toString(36)}`;
const papers = n => (n === 1 ? 'ورقة واحدة' : n === 2 ? 'ورقتان' : n <= 10 ? `${n} أوراق` : `${n} ورقة`);
const units = n => plain(n, Number.isInteger(Math.round(n * 1e6) / 1e6) ? 0 : 2);

// ---------- استيراد كشف: المسار المتاح اليوم من أي تطبيق، بلا شراكة ولا واجهات ----------
function ImportStatement({ onClose, onBack }) {
  const { importPortfolio, view } = useStore();
  const [name, setName] = useState('');
  const [kind, setKind] = useState('brokerUS');
  const [text, setText] = useState('');
  const parsed = text.trim() ? parseStatement(text) : null;
  const ok = parsed && parsed.rows.length > 0 && name.trim().length > 1;
  const p = ok ? portfolioFromStatement(name.trim(), kind, parsed.rows, view.today) : null;
  const s = p && summarize(p);
  const readFile = f => { if (!f) return; const r = new FileReader(); r.onload = () => setText(String(r.result)); r.readAsText(f); };
  const sample = () => {
    const blob = new Blob([`\uFEFF${STATEMENT_SAMPLE}`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'نموذج-كشف-محفظة.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return (
    <Modal title="استيراد كشف المحفظة" desc="صدّر كشف المراكز من تطبيقك (CSV) وارفعه هنا" onClose={onClose}
      foot={<><Btn onClick={onBack}>رجوع</Btn><Btn variant="primary" disabled={!ok} onClick={() => { importPortfolio(p); onClose(); go(`/app/invest/${p.id}`); }}>استيراد</Btn></>}>
      <div className="w-grid2 stack-xs">
        <TextInput label="اسم التطبيق" value={name} onChange={setName} placeholder="مثل: الإنماء للاستثمار" />
        <Select label="نوعه" value={kind} onChange={setKind} options={Object.entries(KINDS).filter(([k]) => k !== 'crowd').map(([k, x]) => ({ value: k, label: x.label }))} />
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <label className="w-btn" style={{ cursor: 'pointer' }}><Icon as={FileUp} size={15} />اختر ملف CSV
          <input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={e => readFile(e.target.files?.[0])} />
        </label>
        <Btn variant="ghost" icon={Download} onClick={sample}>تنزيل النموذج</Btn>
        <Btn variant="ghost" onClick={() => { setText(STATEMENT_SAMPLE); if (!name) setName('محفظتي'); }}>جرّب بالنموذج</Btn>
      </div>
      <p className="t12 sub">الأعمدة: الرمز، الكمية، السعر الحالي، تاريخ الشراء. والنقد في سطر يبدأ بكلمة «نقد».</p>
      {parsed?.errors.length > 0 && <p className="w-help warn">{parsed.errors.slice(0, 3).join(' · ')}{parsed.errors.length > 3 ? ` · و${parsed.errors.length - 3} أخرى` : ''}</p>}
      {s && (
        <div className="w-soft">
          <div className="w-line"><span>قرأنا</span><span>{papers(s.holdings.length)} ونقد {sar(s.cash, 0)}</span></div>
          <div className="w-line" style={{ borderTop: '1px solid var(--line)' }}><span>قيمة المحفظة</span><span>{sar(s.value)}</span></div>
          <div className="w-line" style={{ borderTop: '1px solid var(--line)' }}><span>يدخل وعاءك</span><span>{sar(s.base)}</span></div>
        </div>
      )}
      <p className="w-note"><Icon as={ShieldCheck} size={14} /><span>نقرأ الملف في متصفحك فقط. حول كل ورقة من تاريخ شرائها، والأسعار من الكشف؛ استورد كشفًا جديدًا متى تغيّرت المحفظة.</span></p>
    </Modal>
  );
}

// ---------- ربط تطبيق: اختيار ← موافقة ← ربط ← ما استوردناه ----------
export function LinkInvest({ onClose, initial = null }) {
  const { portfolios, linkPortfolio, view } = useStore();
  const [q, setQ] = useState('');
  const [pick, setPick] = useState(initial);
  const [stage, setStage] = useState(initial ? 'consent' : 'pick');
  useEffect(() => {
    if (stage !== 'linking') return undefined;
    const t = setTimeout(() => { linkPortfolio(pick.id, pick.custom ? { name: pick.name, kind: pick.kind } : undefined); setStage('done'); }, 1400);
    return () => clearTimeout(t);
  }, [stage, pick, linkPortfolio]);
  const linked = new Set(portfolios.map(p => p.id));
  const preview = pick && summarize(seedPortfolio(pick.id, view.today, pick.custom ? { name: pick.name, kind: pick.kind } : undefined));
  const [own, setOwn] = useState('');
  const [ownKind, setOwnKind] = useState('brokerUS');
  const term = pick?.kind === 'crowd' ? fins : papers;
  const query = q.trim();
  const matches = PROVIDERS.filter(p => !query || p.name.includes(query));
  const ownName = own || (query && !matches.length ? query : '');

  const head = (state) => (
    <div className="w-prov-head">
      <div className="w-prov-link">
        <NamaaMark className="w-mark-svg" tile="var(--primary)" ink="#fff" />
        <span className="dash" />
        {state === 'linking' ? <Icon as={LoaderCircle} className="w-spin muted" /> : state === 'done' ? <span className="w-mark" style={{ width: 26, height: 26, background: 'var(--ok)' }}><Icon as={Check} size={15} /></span> : <Icon as={Link2} className="muted" />}
        <span className="dash" />
        <CompanyMark mark={markOf(pick)} size={52} />
      </div>
      <div>
        <b className="t16" style={{ display: 'block' }}>{pick.name}</b>
        <span className="t12 muted">{KINDS[pick.kind].label} · {pick.markets}</span>
      </div>
    </div>
  );

  if (stage === 'import') return <ImportStatement onClose={onClose} onBack={() => setStage('pick')} />;
  if (stage === 'pick') return (
    <Modal title="ربط تطبيق استثمار" desc={`اختر من ${PROVIDERS.length} تطبيقًا، أو أضف تطبيقك`} onClose={onClose}>
      <button className="w-prov" style={{ width: '100%' }} onClick={() => setStage('import')}>
        <span className="w-mark" style={{ width: 36, height: 36, background: 'var(--soft)', color: 'var(--primary)' }}><Icon as={FileUp} size={18} /></span>
        <span className="grow" style={{ minWidth: 0, textAlign: 'start' }}>
          <span className="n">استيراد كشف المحفظة</span>
          <span className="k">متاح اليوم من أي تطبيق · ملف CSV</span>
        </span>
      </button>
      <span className="t12 muted">أو ربط مباشر · عند توفر الواجهات مع الشركة</span>
      <TextInput value={q} onChange={setQ} icon={Search} placeholder="ابحث باسم التطبيق أو الشركة" />
      {GROUPS.map(([label, kinds]) => {
        const list = matches.filter(p => kinds.includes(p.kind));
        if (!list.length) return null;
        return (
          <div key={label} className="col" style={{ gap: 8 }}>
            <span className="t12 muted">{label} · {list.length}</span>
            <div className="w-provs">
              {list.map(p => {
                const on = linked.has(p.id);
                return (
                  <button key={p.id} className="w-prov" aria-disabled={on} onClick={() => { if (!on) { setPick(p); setStage('consent'); } }}>
                    <CompanyMark mark={markOf(p)} size={36} />
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span className="n">{p.name}</span>
                      <span className="k">{on ? 'مرتبط' : p.markets}</span>
                    </span>
                    {on && <Icon as={Check} size={15} className="green" />}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {query && !matches.length && <p className="w-quiet">ما لقينا «{query}» في القائمة. أضفه تحت.</p>}
      <div className="w-soft" style={{ padding: '14px 16px' }}>
        <b className="t13" style={{ display: 'block', marginBottom: 8 }}>ما لقيت تطبيقك؟</b>
        <div className="w-grid2 stack-xs">
          <TextInput label="اسم التطبيق" value={ownName} onChange={setOwn} placeholder="اسم التطبيق اللي تستخدمه" />
          <Select label="نوعه" value={ownKind} onChange={setOwnKind}
            options={Object.entries(KINDS).map(([k, x]) => ({ value: k, label: `${x.label} · ${x.markets}` }))} />
        </div>
        <Btn className="sm" style={{ marginTop: 10 }} disabled={ownName.trim().length < 2}
          onClick={() => { const name = ownName.trim(); setPick({ id: customId(name), name, kind: ownKind, markets: KINDS[ownKind].markets, custom: true }); setStage('consent'); }}>ربط {ownName.trim() || 'تطبيقي'}</Btn>
      </div>
      <p className="w-note"><Icon as={ShieldCheck} size={14} /><span>الربط المباشر هنا محاكاة للعرض: في الإطلاق يكون بشراكة مع شركة الوساطة (نبدأ بالإنماء للاستثمار)، وحتى ذلك الحين استيراد الكشف يعمل مع أي تطبيق. المحافظ والأسعار توضيحية، والحروف في المربعات علامات من نماء وليست شعارات الشركات.</span></p>
    </Modal>
  );
  if (stage === 'consent') return (
    <Modal size="sm" title="موافقة قراءة فقط" onClose={onClose}
      foot={<><Btn onClick={() => setStage('pick')}>رجوع</Btn><Btn variant="primary" onClick={() => setStage('linking')}>موافق · ربط {pick.name}</Btn></>}>
      {head('consent')}
      <div className="w-rows t13">
        <div className="w-line"><span>{pick.kind === 'crowd' ? 'التمويلات القائمة' : 'المراكز والأسعار'}</span><span>{pick.kind === 'crowd' ? 'المبالغ ومواعيد السداد' : pick.kind === 'robo' ? 'الصناديق في محفظتك' : 'أسهم وصناديق'}</span></div>
        <div className="w-line"><span>النقد في المحفظة</span><span>مع تاريخ إيداعه</span></div>
        <div className="w-line"><span>العمليات</span><span>{pick.kind === 'crowd' ? 'لحظيًا عند كل تمويل أو سداد' : 'لحظيًا عند كل شراء أو بيع'}</span></div>
        <div className="w-line"><span>مدة الموافقة</span><span>12 شهرًا</span></div>
      </div>
      <p className="w-note"><Icon as={ShieldCheck} size={14} /><span>لا نستطيع البيع أو الشراء أو التحويل من محفظتك، ولا نرى كلمة مرورك في التطبيق.</span></p>
    </Modal>
  );
  if (stage === 'linking') return (
    <Modal size="sm" title="جارٍ الربط" onClose={onClose}>
      {head('linking')}
      <p className="sub t13" style={{ textAlign: 'center', paddingBottom: 8 }}>نقرأ المحفظة والعمليات من {pick.name}…</p>
    </Modal>
  );
  const zak = preview.holdings.filter(h => h.zakatable).length;
  return (
    <Modal size="sm" title="تم الربط" onClose={onClose}
      foot={<><Btn onClick={onClose}>إغلاق</Btn><Btn variant="primary" onClick={() => { onClose(); go(`/app/invest/${pick.id}`); }}>عرض المحفظة</Btn></>}>
      {head('done')}
      <div className="w-rows t13">
        <div className="w-line"><span>استوردنا</span><span>{term(preview.holdings.length)} ونقد {sar(preview.cash, 0)}</span></div>
        <div className="w-line"><span>يدخل حساب الزكاة</span><span>{sar(preview.base)}</span></div>
        {preview.holdings.some(h => !h.zakatable) && <div className="w-line"><span>لا يدخل (تزكيه الشركات)</span><span>{sar(preview.holdings.filter(h => !h.zakatable).reduce((x, h) => x + h.value, 0))}</span></div>}
      </div>
      <p className="t13 sub">
        {pick.kind === 'crowd'
          ? 'التمويلات القائمة ديون مرجوة السداد فزكاتها عليك، ونقد المحفظة كذلك'
          : <>{zak ? `${papers(zak)} زكاتها عليك، ونقد المحفظة كذلك` : 'نقد المحفظة زكاته عليك'}
            {preview.holdings.length - zak ? `، و${papers(preview.holdings.length - zak)} تزكيها الشركة عنك فلا تدخل الوعاء` : ''}</>}.
        {' '}العمليات تصل من التطبيق تلقائيًا، وتتحدث زكاتك مع كل واحدة.
      </p>
    </Modal>
  );
}

// ---------- صفحة المحفظة ----------
export function InvestPage({ path }) {
  const { portfolios, unlinkPortfolio, feedPaused, setFeedPaused } = useStore();
  const id = path.split('/').pop();
  const p = portfolios.find(x => x.id === id);
  if (!p) return (
    <Shell path="/app/assets" title="محفظة غير مرتبطة">
      <Card><p className="w-quiet">هذه المحفظة غير مرتبطة في هذه الشخصية.</p><Btn style={{ marginTop: 12 }} onClick={() => go('/app/assets')}>الأصول</Btn></Card>
    </Shell>
  );
  const s = summarize(p);
  // الأسهم السعودية وما تزكيه الشركات عنك: تظهر للعلم فقط، ولا تدخل حساب الزكاة (دليل الهيئة §3.6)
  const inZakat = s.holdings.filter(h => h.zakatable);
  const outZakat = s.holdings.filter(h => !h.zakatable);
  const outValue = outZakat.reduce((x, h) => x + h.value, 0);
  const waiting = Boolean(nextScripted(p));
  const zakNext = s.holdings.filter(h => h.zakatable).flatMap(h => h.lots).map(l => l.hawlFrom).concat(s.cashLots.map(c => c.hawlFrom)).sort()[0];
  return (
    <Shell path="/app/assets" title={<span className="row" style={{ gap: 12 }}><CompanyMark mark={markOf(p)} size={40} />{p.name}</span>}
      crumb={<><button onClick={() => go('/app/assets')}>الأصول</button><Icon as={ChevronLeft} size={12} /><span>تطبيقات الاستثمار</span></>}
      desc={p.source === 'statement' ? `كشف مستورد · ${gregText(p.linkedAt)}` : `مرتبط منذ ${gregText(p.linkedAt)}`}>
      {p.source === 'statement' ? (
        <div className="w-live"><span className="dot" /><span className="grow">من كشف مستورد بتاريخ {gregText(p.linkedAt)} · الأسعار من الكشف · استورد كشفًا جديدًا متى تغيّرت المحفظة</span></div>
      ) : <div className="w-live">
        <span className={`dot${waiting && !feedPaused ? ' on' : ''}`} />
        <span className="grow">
          {feedPaused ? 'التحديث موقوف مؤقتًا' : waiting ? `مباشر · ${p.kind === 'crowd' ? 'أي تمويل أو سداد' : 'أي شراء أو بيع'} في التطبيق يصل هنا ويحدّث زكاتك تلقائيًا` : 'مباشر · وصلت كل العمليات، وزكاتك محدّثة'}
        </span>
        {waiting && <button className="w-link t13" onClick={() => setFeedPaused(!feedPaused)}>{feedPaused ? 'استئناف' : 'إيقاف مؤقت'}</button>}
      </div>}
      <p className="w-quiet" style={{ lineHeight: '26px' }}>
        يدخل حساب الزكاة <b>{sar(s.base)}</b> · زكاتها عند حولها <b>{sar(s.zakat)}</b>
        {outZakat.length > 0 && <> · خارج الحساب <b>{sar(outValue)}</b> (أسهم تزكيها الشركات)</>}
        {zakNext && <> · أقرب حول فيها {gregText(hawlEnd(zakNext))}</>}
      </p>
      <div className="w-cols c-wide">
        <div className="col" style={{ gap: 24 }}>
        <Card title="تدخل حساب الزكاة" action={<span className="t12 muted">القيمة</span>}>
          <div className="w-rows">
            {inZakat.map(h => (
              <details key={h.key} className="w-more">
                <summary className="w-rowline">
                  <span className="t">{h.name}{h.market === 'US' ? <span className="t12 muted"> · {h.key}</span> : null}</span>
                  <span className="v">{plain(h.value)}</span>
                  <span className="d">{h.market === 'FIN' ? 'تمويل قائم' : `${units(h.units)} × ${h.market === 'US' ? `$${plain(h.price)}` : plain(h.price)}`} · <b style={{ color: 'var(--ink)', fontWeight: 600 }}>الزكاة عليك</b></span>
                </summary>
                <div className="w-more-body">
                  {h.lots.map(l => <div key={l.hawlFrom}>{h.market === 'FIN' ? `${plain(l.units)} ر.س` : `${units(l.units)} وحدة`} · حولها من {gregText(l.hawlFrom)} ويكمل {gregText(hawlEnd(l.hawlFrom))}</div>)}
                </div>
              </details>
            ))}
            <details className="w-more">
              <summary className="w-rowline">
                <span className="t">نقد في المحفظة</span>
                <span className="v">{plain(s.cash)}</span>
                <span className="d">غير مستثمر · <b style={{ color: 'var(--ink)', fontWeight: 600 }}>الزكاة عليك</b></span>
              </summary>
              <div className="w-more-body">
                {s.cashLots.length ? s.cashLots.map(c => <div key={c.hawlFrom}>{plain(c.amount)} ر.س · حولها من {gregText(c.hawlFrom)} ويكمل {gregText(hawlEnd(c.hawlFrom))}</div>) : 'لا نقد.'}
              </div>
            </details>
          </div>
          <div className="w-total"><span>يدخل الوعاء</span><span>{sar(s.base)}</span></div>
        </Card>
        {outZakat.length > 0 && (
          <Card title="لا تدخل حساب الزكاة" desc="أسهم سعودية للاستثمار: الشركة تدفع زكاتها لهيئة الزكاة فتكفيك (دليل الهيئة §3.6)">
            <div className="w-rows">
              {outZakat.map(h => (
                <div key={h.key} className="w-rowline">
                  <span className="t" style={{ color: 'var(--sub)' }}>{h.name}</span>
                  <span className="v" style={{ color: 'var(--muted)', fontWeight: 500 }}>0.00</span>
                  <span className="d">{units(h.units)} × {plain(h.price)} = {plain(h.value)} · تزكيها الشركة عنك</span>
                </div>
              ))}
            </div>
          </Card>
        )}
        </div>
        <div className="col" style={{ gap: 24 }}>
          <Card title="العمليات من التطبيق" action={p.trades.length > 0 && <span className="t12 muted">أثرها على الوعاء</span>}>
            {p.trades.length === 0 ? (
              <p className="w-quiet">بانتظار أول عملية من التطبيق…</p>
            ) : (
              <div className="w-rows">
                {p.trades.map((t, i) => {
                  const d = t.impact.baseAfter - t.impact.baseBefore;
                  return (
                    <div key={t.id} className={`w-rowline${i === 0 ? ' w-new' : ''}`}>
                      <span className="t">{tradeLabel(t)}</span>
                      <span className="v" style={{ fontWeight: 500 }}>{d > 0.005 ? '+' : d < -0.005 ? '−' : ''}{plain(Math.abs(d))}</span>
                      <span className="d">{t.time} · بمبلغ {sar(t.amount, 0)} · {tradeNote(t)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
          <p className="t12 muted" style={{ lineHeight: '20px' }}>
            {p.source === 'statement' ? 'من ملفك: لم نتصل بالتطبيق.' : `محاكاة للعرض: المحفظة والعمليات والأسعار توضيحية (آخر سعر من ${p.name}).`}
            {' '}<button className="w-link" onClick={() => { unlinkPortfolio(p.id); go('/app/assets'); }}>إلغاء الربط</button>
          </p>
        </div>
      </div>
    </Shell>
  );
}

// ---------- بطاقة في صفحة الأصول ----------
export function InvestCard() {
  const { portfolios, historical, view } = useStore();
  const [open, setOpen] = useState(false);
  return (
    <Card title="تطبيقات الاستثمار" action={!historical && <button className="w-link t13" onClick={() => setOpen(true)}>ربط تطبيق</button>}>
      {portfolios.length === 0 ? (
        historical
          ? <p className="w-quiet">سجل مغلق كما في {gregText(view.today)}، فلا نربط فيه تطبيقات جديدة.</p>
          : (
            <div className="col" style={{ gap: 12, alignItems: 'flex-start' }}>
              <p className="w-quiet">اربط تطبيق الوساطة أو الصناديق اللي تستثمر فيه، ونحسب زكاة ما لا تزكيه الشركات عنك، ونحدّثها مع كل شراء أو بيع.</p>
              <Btn className="sm" onClick={() => setOpen(true)}>ربط تطبيق</Btn>
            </div>
          )
      ) : (
        <div className="w-rows">
          {portfolios.map(p => {
            const s = summarize(p);
            return (
              <button key={p.id} className="w-rowline" style={{ width: '100%', textAlign: 'start' }} onClick={() => go(`/app/invest/${p.id}`)}>
                <span className="t row" style={{ gap: 10 }}><CompanyMark mark={markOf(p)} size={28} />{p.name}</span>
                <span className="v">{plain(s.base)}</span>
                <span className="d">قيمتها {plain(s.value, 0)} · {(p.kind === 'crowd' ? fins : papers)(s.holdings.length)} · {p.trades.length ? `آخر عملية ${p.trades[0].time}` : 'مرتبط'}</span>
              </button>
            );
          })}
        </div>
      )}
      {open && <LinkInvest onClose={() => setOpen(false)} />}
    </Card>
  );
}
