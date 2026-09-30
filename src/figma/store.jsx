// حالة النموذج: أرقام أحمد من المحرك (ahmad-view.json) + ما يضيفه المستخدم أثناء التجربة
// (أصول خارج البنوك، بنك جديد، تاريخ آخر زكاة، قناة الإخراج، الإيصال).
// الوعاء = أرصدة البنوك من المحرك + calculateAssetValue على الأصول المضافة.
import { useMemo, useState } from 'react';
import { calculateAssetValue, isHawlComplete } from '../engine/engine.js';
import { StoreContext } from './model.js';
import view from '../data/ahmad-view.json';

export function StoreProvider({ children }) {
  const [assets, setAssets] = useState([]);
  const [pendingBanks, setPendingBanks] = useState([]);
  const [lastZakat, setLastZakat] = useState(null);     // { calendar: 'hijri'|'gregorian', iso }
  const [remembers, setRemembers] = useState('yes');     // هل يتذكر تاريخ آخر زكاة؟
  const [channel, setChannel] = useState('fund');
  const [payment, setPayment] = useState(null);

  const value = useMemo(() => {
    const merged = {};
    for (const a of assets) for (const [k, list] of Object.entries(a.engine)) merged[k] = [...(merged[k] ?? []), ...list];
    const otherAssets = assets.length ? calculateAssetValue(merged) : 0;
    const vault = view.bankTotal + otherAssets;
    // أصل مضاف يدويًا أكمل حولًا هجريًا من تاريخ تملكه (isHawlComplete من المحرك): تجب زكاته اليوم مع زكاة الحسابات
    const today = new Date(`${view.today}T00:00:00Z`);
    const matured = assets.filter(a => a.value > 0 && isHawlComplete(new Date(`${a.acquired}T00:00:00Z`), today));
    const maturedBase = matured.reduce((s, a) => s + a.value, 0);
    const due = {
      base: view.due.base + maturedBase,
      zakat: Math.round((view.due.zakat + maturedBase / 40) * 100) / 100,
      bankBase: view.due.base,
      bankZakat: view.due.zakat,
      matured,
      maturedBase,
    };
    return {
      view,
      assets,
      otherAssets,
      vault,
      pendingBanks,
      lastZakat,
      remembers,
      channel,
      payment,
      due,
      dueNow: payment ? 0 : due.zakat,
      addAsset: a => setAssets(list => [...list, { ...a, id: `${a.kind}-${list.length + 1}` }]),
      addBank: name => setPendingBanks(list => (list.includes(name) ? list : [...list, name])),
      setLastZakat,
      setRemembers,
      setChannel,
      pay: () => {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0'), mm = String(now.getMinutes()).padStart(2, '0');
        const seq = String(Math.floor(1000 + Math.random() * 9000));
        setPayment({ amount: due.zakat, channel, time: `${hh}:${mm}`, ref: `NM-${view.today.slice(2).replaceAll('-', '')}-${seq}` });
      },
    };
  }, [assets, pendingBanks, lastZakat, remembers, channel, payment]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

