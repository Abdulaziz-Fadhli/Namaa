// «اسأل نماء»: أسئلة الزكاة بأرقام المستخدم، والجواب من دليل هيئة الزكاة مع رقم الفقرة (src/engine/assistant.js)
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, SendHorizontal } from 'lucide-react';
import { Btn, Card, Icon, NamaaMark } from '../kit.jsx';
import { go } from '../nav.js';
import { Shell } from '../Shell.jsx';
import { useStore } from '../../figma/model.js';
import { gregText, hijriText } from '../../figma/format.js';
import { SUGGESTED, answer } from '../../engine/assistant.js';

function Bot({ m }) {
  return (
    <div className="w-msg">
      <NamaaMark className="w-msg-av" tile="var(--primary)" ink="#fff" />
      <div className="w-bubble">
        <p>{m.text}</p>
        {(m.cite || m.act) && (
          <div className="row" style={{ gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
            {m.cite && <span className="w-cite">{m.cite}</span>}
            {m.act && <button className="w-link t13 row" style={{ gap: 4 }} onClick={() => go(m.act[1])}>{m.act[0]}<Icon as={ArrowLeft} size={13} /></button>}
          </div>
        )}
      </div>
    </div>
  );
}

export function Ask({ path }) {
  const { view, vault, due, nextDue, unpaidTotal, rent, ramadanPlan: plan } = useStore();
  const ctx = useMemo(() => ({
    nisab: view.nisab, vault, goldPerGram: view.prices?.goldPerGram,
    dueToday: due.today ? due.zakat : 0, dueBase: due.base,
    nextDue: nextDue && { zakat: nextDue.zakat, hijri: hijriText(nextDue.date), greg: gregText(nextDue.date), advanced: nextDue.advanced },
    unpaidTotal, rent,
    ramadan: plan?.kind === 'ADVANCE' ? `في حسابك: رمضان القادم (${hijriText(plan.ramadan)}) قبل موعد زكاتك، فتقدر تعجّلها فيه.`
      : plan?.kind === 'PAY_THEN_ADVANCE' ? `في حسابك: رمضان القادم بعد موعد زكاتك (${hijriText(plan.due)})، فأخرجها في موعدها، ثم عجّل زكاة السنة التالية في رمضان.` : '',
  }), [view, vault, due, nextDue, unpaidTotal, rent, plan]);
  const [msgs, setMsgs] = useState([{ from: 'bot', text: 'هلا! اسألني عن زكاتك: كم ومتى، أو حكم الذهب والأسهم والعقار والديون. أجاوبك من دليل هيئة الزكاة لزكاة الأفراد، ومع كل جواب رقم الفقرة.' }]);
  const [q, setQ] = useState('');
  const [typing, setTyping] = useState(false);
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [msgs, typing]);
  const send = text => {
    const t = text.trim();
    if (!t || typing) return;
    setMsgs(m => [...m, { from: 'me', text: t }]);
    setQ('');
    setTyping(true);
    setTimeout(() => { setMsgs(m => [...m, { from: 'bot', ...answer(t, ctx) }]); setTyping(false); }, 450);
  };
  const asked = new Set(msgs.filter(m => m.from === 'me').map(m => m.text));
  return (
    <Shell path={path} title="اسأل نماء" desc="أجوبة من دليل هيئة الزكاة فقط، بأرقام حسابك، ومع رقم الفقرة">
      <Card flush>
        <div className="w-chat">
          {msgs.map((m, i) => (m.from === 'me'
            ? <div key={i} className="w-msg me"><div className="w-bubble">{m.text}</div></div>
            : <Bot key={i} m={m} />))}
          {typing && <div className="w-msg"><NamaaMark className="w-msg-av" tile="var(--primary)" ink="#fff" /><div className="w-bubble w-typing"><i /><i /><i /></div></div>}
          <div ref={end} />
        </div>
        <div className="w-chips">
          {SUGGESTED.filter(s => !asked.has(s)).slice(0, 5).map(s => <button key={s} className="w-chip" onClick={() => send(s)}>{s}</button>)}
        </div>
        <form className="w-ask" onSubmit={e => { e.preventDefault(); send(q); }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="اكتب سؤالك عن الزكاة…" aria-label="سؤالك" />
          <Btn variant="primary" icon={SendHorizontal} disabled={!q.trim() || typing} type="submit">إرسال</Btn>
        </form>
      </Card>
      <p className="t12 muted">نماء لا يفتي: إذا ما لقى السؤال في دليل الهيئة يقول لك ذلك. والدليل إرشادي مبني على فتاوى اللجنة الدائمة للبحوث العلمية والإفتاء.</p>
    </Shell>
  );
}
