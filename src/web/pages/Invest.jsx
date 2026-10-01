// تطبيقات الاستثمار: ربط المحفظة (محاكاة)، وصفحة المحفظة، وعمليات الشراء والبيع التي تحدّث الزكاة فورًا.
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, LoaderCircle, Search, ShieldCheck, Zap } from 'lucide-react';
import { Btn, Card, Icon, Modal, NumberInput, Seg, Select, TextInput } from '../kit.jsx';
import { go } from '../nav.js';
import { Shell } from '../Shell.jsx';
import { parseNum, useStore } from '../../figma/model.js';
import { gregText } from '../../figma/format.js';
import { resolveHawlDueDate } from '../../engine/engine.js';
import { PROVIDERS, applyTrade, providerOf, seedPortfolio, summarize, USD_SAR } from '../../engine/portfolio.js';
import { check } from '../../securities/securities.js';
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
    <Modal size="sm" title={`ربطنا ${pick.name}`} desc="من الآن تتحدث زكاتك مع كل عملية في التطبيق" onClose={onClose}
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

// ---------- عملية من التطبيق (محاكاة): شراء أو بيع ----------
function TradeModal({ p, onClose, onDone }) {
  const { trade, view } = useStore();
  const s = summarize(p);
  const [side, setSide] = useState('BUY');
  const [q, setQ] = useState('AAPL');
  const [sellKey, setSellKey] = useState(s.holdings[0]?.key ?? '');
  const [qty, setQty] = useState('2');
  const [px, setPx] = useState('');
  const [err, setErr] = useState('');
  const found = useMemo(() => (side === 'BUY' && q.trim() ? check(q) : null), [side, q]);
  const key = side === 'SELL' ? sellKey : found?.found && found.symbol ? found.symbol : null;
  const known = key ? p.prices[key] : null;
  const priceStr = px === '' && known != null ? String(known) : px;
  const n = parseNum(qty), price = parseNum(priceStr);
  const us = key && (side === 'SELL' ? s.holdings.find(h => h.key === key)?.market === 'US' : found?.market === 'US');
  let preview = null, previewErr = '';
  if (key && n > 0 && price > 0) {
    try { preview = applyTrade(p, { side, key, units: n, price, date: view.today }).trade; } catch (e) { previewErr = e.message; }
  }
  const delta = preview ? preview.impact.baseAfter - preview.impact.baseBefore : 0;
  const hawlNote = !preview ? '' : side === 'BUY'
    ? (preview.zakatable ? 'تأخذ حول النقد الذي اشتُريت به، فلا يبدأ حول جديد.' : 'الشركة تزكي عن هذا السهم، فيخرج المبلغ من وعائك.')
    : (preview.zakatable ? 'النقد من البيع يكمل حول الورقة.' : 'السهم كانت تزكيه الشركة، فالنقد من بيعه مال جديد يبدأ حوله اليوم.');
  const submit = () => {
    try { onDone(trade(p.id, { side, key, units: n, price })); } catch (e) { setErr(e.message); }
  };
  return (
    <Modal size="sm" title="عملية من التطبيق" desc={`${providerOf(p.provider).name} · محاكاة لعملية تصل لحظيًا`} onClose={onClose}
      foot={<><Btn onClick={onClose}>إلغاء</Btn><Btn variant="primary" disabled={!preview} onClick={submit}>إرسال العملية</Btn></>}>
      <Seg block value={side} onChange={v => { setSide(v); setPx(''); setErr(''); }} options={[{ value: 'BUY', label: 'شراء' }, { value: 'SELL', label: 'بيع' }]} label="نوع العملية" />
      {side === 'BUY' ? (
        <TextInput label="السهم أو الصندوق" value={q} onChange={v => { setQ(v); setPx(''); }} icon={Search} placeholder="مثال: AAPL أو 1150 أو الراجحي"
          help={found ? (found.found && found.symbol ? `${found.name || found.nameEn} · ${found.marketAr} · ${found.paysZakat ? 'يزكي عنك' : 'الزكاة عليك'}` : found.message) : undefined}
          warn={Boolean(found && !(found.found && found.symbol))} />
      ) : (
        <Select label="الورقة" value={sellKey} onChange={v => { setSellKey(v); setPx(''); }}
          options={s.holdings.map(h => ({ value: h.key, label: `${h.name} · ${units(h.units)}` }))} />
      )}
      <div className="w-grid2">
        <NumberInput label="الكمية" value={qty} onChange={setQty} />
        <NumberInput label="السعر" value={priceStr} onChange={setPx} unit={us ? '$' : 'ر.س'} help={us ? `يُحوّل بسعر ${USD_SAR}` : undefined} />
      </div>
      {preview && (
        <div className="w-rows t13">
          <div className="w-line"><span>المبلغ</span><span>{sar(preview.amount)}</span></div>
          <div className="w-line"><span>أثرها على الوعاء</span><span>{delta > 0.005 ? '+' : delta < -0.005 ? '−' : ''}{plain(Math.abs(delta))} ر.س</span></div>
        </div>
      )}
      {preview && <p className="t13 sub">{hawlNote}</p>}
      {(previewErr || err) && <p className="w-help warn">{previewErr || err}</p>}
    </Modal>
  );
}

// ---------- صفحة المحفظة ----------
export function InvestPage({ path }) {
  const { portfolios, unlinkPortfolio, vault, nextDue } = useStore();
  const id = path.split('/').pop();
  const p = portfolios.find(x => x.id === id);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [last, setLast] = useState(null);
  if (!p) return (
    <Shell path="/app/assets" title="محفظة غير مرتبطة">
      <Card><p className="w-quiet">هذه المحفظة غير مرتبطة في هذه الشخصية.</p><Btn style={{ marginTop: 12 }} onClick={() => go('/app/assets')}>الأصول</Btn></Card>
    </Shell>
  );
  const prov = providerOf(p.provider);
  const s = summarize(p);
  const zakNext = s.holdings.filter(h => h.zakatable).flatMap(h => h.lots).map(l => l.hawlFrom).concat(s.cashLots.map(c => c.hawlFrom)).sort()[0];
  return (
    <Shell path="/app/assets" title={prov.name}
      crumb={<><button onClick={() => go('/app/assets')}>الأصول</button><Icon as={ChevronLeft} size={12} /><span>تطبيقات الاستثمار</span></>}
      desc={`مرتبط منذ ${gregText(p.linkedAt)} · تتحدث الزكاة مع كل عملية`}
      actions={<Btn variant="primary" className="sm" icon={Zap} onClick={() => setTradeOpen(true)}>عملية من التطبيق</Btn>}>
      {last && (
        <div className="w-banner ok" style={{ alignItems: 'flex-start' }}>
          <span className="grow">
            <b style={{ display: 'block' }}>وصلت عملية {last.trade.side === 'BUY' ? 'شراء' : 'بيع'} {units(last.trade.units)} {last.trade.name} · {last.trade.time}</b>
            <span className="t13">الوعاء الزكوي {plain(last.vaultBefore)} ← <b>{plain(vault)}</b>
              {' '}· زكاة هذه المحفظة عند حولها {plain(last.trade.impact.baseBefore / 40)} ← <b>{plain(last.trade.impact.baseAfter / 40)}</b>
              {nextDue && <><br />أقرب زكاة عليك {plain(nextDue.zakat)} ر.س في {gregText(nextDue.date)}{last.nextBefore && Math.abs(last.nextBefore.zakat - nextDue.zakat) > 0.005 && last.nextBefore.date === nextDue.date ? ` (كانت ${plain(last.nextBefore.zakat)})` : ''}</>}
            </span>
          </span>
          <button className="t12 sub" onClick={() => setLast(null)}>إخفاء</button>
        </div>
      )}
      <p className="w-quiet" style={{ lineHeight: '26px' }}>
        قيمة المحفظة <b>{sar(s.value)}</b> · يدخل وعاءك منها <b>{sar(s.base)}</b>
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
          <Card title="آخر العمليات" action={p.trades.length > 0 && <span className="t12 muted">أثرها على الوعاء</span>}>
            {p.trades.length === 0 ? (
              <p className="w-quiet">لا عمليات بعد. أي شراء أو بيع في التطبيق يصل هنا لحظيًا ويحدّث زكاتك.</p>
            ) : (
              <div className="w-rows">
                {p.trades.map(t => {
                  const d = t.impact.baseAfter - t.impact.baseBefore;
                  return (
                    <div key={t.id} className="w-rowline">
                      <span className="t">{t.side === 'BUY' ? 'شراء' : 'بيع'} {units(t.units)} {t.name}</span>
                      <span className="v" style={{ fontWeight: 500 }}>{d > 0.005 ? '+' : d < -0.005 ? '−' : ''}{plain(Math.abs(d))}</span>
                      <span className="d">{t.time} · بمبلغ {sar(t.amount, 0)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
          <p className="t12 muted" style={{ lineHeight: '20px' }}>
            محاكاة للعرض: المحفظة والأسعار توضيحية. شراء ورقة زكاتها عليك بنقد المحفظة لا يقطع الحول، وبيعها يترك النقد يكمل حولها.
            {' '}<button className="w-link" onClick={() => { unlinkPortfolio(p.id); go('/app/assets'); }}>إلغاء الربط</button>
          </p>
        </div>
      </div>
      {tradeOpen && <TradeModal p={p} onClose={() => setTradeOpen(false)}
        onDone={t => { setLast({ trade: t, vaultBefore: vault, nextBefore: nextDue }); setTradeOpen(false); }} />}
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
