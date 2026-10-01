// تطبيقات الاستثمار: ربط المحفظة (محاكاة)، وصفحة المحفظة، وعمليات الشراء والبيع التي تحدّث الزكاة فورًا.
import { useEffect, useState } from 'react';
import { ChevronLeft, LoaderCircle, Search, ShieldCheck } from 'lucide-react';
import { Btn, Card, Icon, Modal, TextInput } from '../kit.jsx';
import { go } from '../nav.js';
import { Shell } from '../Shell.jsx';
import { useStore } from '../../figma/model.js';
import { gregText } from '../../figma/format.js';
import { resolveHawlDueDate } from '../../engine/engine.js';
import { PROVIDERS, nextScripted, providerOf, seedPortfolio, summarize } from '../../engine/portfolio.js';
import { plain, sar } from '../data.js';

const hawlEnd = iso => resolveHawlDueDate(new Date(`${iso}T00:00:00Z`)).toISOString().slice(0, 10);
const papers = n => (n === 1 ? 'ورقة واحدة' : n === 2 ? 'ورقتان' : n <= 10 ? `${n} أوراق` : `${n} ورقة`);
const units = n => plain(n, Number.isInteger(Math.round(n * 1e6) / 1e6) ? 0 : 2);

// ---------- ربط تطبيق: اختيار ← موافقة ← ربط ← ما استوردناه ----------
export function LinkInvest({ onClose }) {
  const { portfolios, linkPortfolio, view } = useStore();
  const [q, setQ] = useState('');
  const [pick, setPick] = useState(null);
  const [stage, setStage] = useState('pick');
  useEffect(() => {
    if (stage !== 'linking') return undefined;
    const t = setTimeout(() => { linkPortfolio(pick.id); setStage('done'); }, 1400);
    return () => clearTimeout(t);
  }, [stage, pick, linkPortfolio]);
  const linked = new Set(portfolios.map(p => p.id));
  const preview = pick && summarize(seedPortfolio(pick.id, view.today));

  if (stage === 'pick') return (
    <Modal title="ربط تطبيق استثمار" desc="نقرأ محفظتك وعملياتك، ونحدّث زكاتك مع كل شراء أو بيع" onClose={onClose}>
      <TextInput value={q} onChange={setQ} icon={Search} placeholder="ابحث باسم التطبيق أو شركة الوساطة" />
      <div className="w-rows">
        {PROVIDERS.filter(p => p.name.includes(q.trim())).map(p => (
          <div key={p.id} className="w-list-row">
            <span className="grow"><span className="t" style={{ display: 'block' }}>{p.name}</span><span className="d">{p.markets.join(' · ')}</span></span>
            {linked.has(p.id) ? <span className="t12 sub">مرتبط</span> : <Btn className="sm" onClick={() => { setPick(p); setStage('consent'); }}>ربط</Btn>}
          </div>
        ))}
      </div>
      <p className="w-note"><Icon as={ShieldCheck} size={14} /><span>محاكاة للعرض: لا اتصال حقيقي بشركات الوساطة، والمحافظ والأسعار توضيحية.</span></p>
    </Modal>
  );
  if (stage === 'consent') return (
    <Modal size="sm" title={`ربط ${pick.name}`} desc="موافقة قراءة فقط" onClose={onClose}
      foot={<><Btn onClick={() => setStage('pick')}>رجوع</Btn><Btn variant="primary" onClick={() => setStage('linking')}>موافق · ربط</Btn></>}>
      <div className="w-rows t13">
        <div className="w-line"><span>المراكز والأسعار</span><span>أسهم وصناديق</span></div>
        <div className="w-line"><span>النقد في المحفظة</span><span>مع تاريخ إيداعه</span></div>
        <div className="w-line"><span>العمليات</span><span>لحظيًا عند كل شراء أو بيع</span></div>
        <div className="w-line"><span>مدة الموافقة</span><span>12 شهرًا</span></div>
      </div>
      <p className="t13 sub">لا نستطيع البيع أو الشراء أو التحويل من محفظتك، ولا نرى كلمة مرورك في التطبيق.</p>
    </Modal>
  );
  if (stage === 'linking') return (
    <Modal size="sm" title={`ربط ${pick.name}`} onClose={onClose}>
      <div className="row" style={{ padding: '24px 0', justifyContent: 'center' }}><Icon as={LoaderCircle} className="w-spin" /><span className="sub">نقرأ المحفظة والعمليات…</span></div>
    </Modal>
  );
  const zak = preview.holdings.filter(h => h.zakatable).length;
  return (
    <Modal size="sm" title={`ربطنا ${pick.name}`} desc="العمليات تصل من التطبيق تلقائيًا، وتتحدث زكاتك مع كل واحدة" onClose={onClose}
      foot={<><Btn onClick={onClose}>إغلاق</Btn><Btn variant="primary" onClick={() => { onClose(); go(`/app/invest/${pick.id}`); }}>عرض المحفظة</Btn></>}>
      <div className="w-rows t13">
        <div className="w-line"><span>استوردنا</span><span>{papers(preview.holdings.length)} ونقد {sar(preview.cash, 0)}</span></div>
        <div className="w-line"><span>قيمة المحفظة</span><span>{sar(preview.value)}</span></div>
        <div className="w-line"><span>يدخل وعاءك</span><span>{sar(preview.base)}</span></div>
      </div>
      <p className="t13 sub">
        {zak ? `${papers(zak)} زكاتها عليك، ونقد المحفظة كذلك` : 'نقد المحفظة زكاته عليك'}
        {preview.holdings.length - zak ? `، و${papers(preview.holdings.length - zak)} تزكيها الشركة عنك فلا تدخل الوعاء` : ''}.
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
  const prov = providerOf(p.provider);
  const s = summarize(p);
  const waiting = Boolean(nextScripted(p));
  const zakNext = s.holdings.filter(h => h.zakatable).flatMap(h => h.lots).map(l => l.hawlFrom).concat(s.cashLots.map(c => c.hawlFrom)).sort()[0];
  return (
    <Shell path="/app/assets" title={prov.name}
      crumb={<><button onClick={() => go('/app/assets')}>الأصول</button><Icon as={ChevronLeft} size={12} /><span>تطبيقات الاستثمار</span></>}
      desc={`مرتبط منذ ${gregText(p.linkedAt)}`}>
      <div className="w-live">
        <span className={`dot${waiting && !feedPaused ? ' on' : ''}`} />
        <span className="grow">
          {feedPaused ? 'التحديث موقوف مؤقتًا' : waiting ? 'مباشر · أي شراء أو بيع في التطبيق يصل هنا ويحدّث زكاتك تلقائيًا' : 'مباشر · وصلت كل العمليات، وزكاتك محدّثة'}
        </span>
        {waiting && <button className="w-link t13" onClick={() => setFeedPaused(!feedPaused)}>{feedPaused ? 'استئناف' : 'إيقاف مؤقت'}</button>}
      </div>
      <p className="w-quiet" style={{ lineHeight: '26px' }}>
        قيمة المحفظة <b>{sar(s.value)}</b> · يدخل وعاءك منها <b>{sar(s.base)}</b> · زكاتها عند حولها <b>{sar(s.zakat)}</b>
        {zakNext && <> · أقرب حول فيها {gregText(hawlEnd(zakNext))}</>}
      </p>
      <div className="w-cols c-wide">
        <Card title="المحفظة" action={<span className="t12 muted">القيمة · الزكاة</span>}>
          <div className="w-rows">
            {s.holdings.map(h => (
              <details key={h.key} className="w-more">
                <summary className="w-rowline">
                  <span className="t">{h.name}{h.market === 'US' ? <span className="t12 muted"> · {h.key}</span> : null}</span>
                  <span className="v">{plain(h.value)}</span>
                  <span className="d">{units(h.units)} × {h.market === 'US' ? `$${plain(h.price)}` : plain(h.price)} · {h.zakatable ? <b style={{ color: 'var(--ink)', fontWeight: 600 }}>الزكاة عليك</b> : 'تزكيها الشركة عنك'}</span>
                </summary>
                <div className="w-more-body">
                  {h.zakatable
                    ? h.lots.map(l => <div key={l.hawlFrom}>{units(l.units)} وحدة · حولها من {gregText(l.hawlFrom)} ويكمل {gregText(hawlEnd(l.hawlFrom))}</div>)
                    : <div>{h.detail}</div>}
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
                      <span className="t">{t.side === 'BUY' ? 'شراء' : 'بيع'} {units(t.units)} {t.name}</span>
                      <span className="v" style={{ fontWeight: 500 }}>{d > 0.005 ? '+' : d < -0.005 ? '−' : ''}{plain(Math.abs(d))}</span>
                      <span className="d">{t.time} · بمبلغ {sar(t.amount, 0)} · {tradeNote(t)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
          <p className="t12 muted" style={{ lineHeight: '20px' }}>
            محاكاة للعرض: المحفظة والعمليات والأسعار توضيحية.
            {' '}<button className="w-link" onClick={() => { unlinkPortfolio(p.id); go('/app/assets'); }}>إلغاء الربط</button>
          </p>
        </div>
      </div>
    </Shell>
  );
}

// سطر يشرح أثر العملية على الحول
const tradeNote = t => (t.side === 'BUY'
  ? (t.zakatable ? 'تكمل حول النقد' : 'تزكيه الشركة، فخرج المبلغ من الوعاء')
  : (t.zakatable ? 'النقد يكمل حولها' : 'نقد جديد يبدأ حوله اليوم'));

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
                <span className="t">{providerOf(p.provider).name}</span>
                <span className="v">{plain(s.base)}</span>
                <span className="d">قيمتها {plain(s.value, 0)} · {papers(s.holdings.length)} · {p.trades.length ? `آخر عملية ${p.trades[0].time}` : 'مرتبط'}</span>
              </button>
            );
          })}
        </div>
      )}
      {open && <LinkInvest onClose={() => setOpen(false)} />}
    </Card>
  );
}
