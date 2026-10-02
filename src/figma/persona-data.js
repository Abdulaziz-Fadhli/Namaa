// بيانات شخصيتي الموقع (منفصلة عن ملف المتجر حتى يشتغل التحديث السريع في Vite).
import khalid from '../data/khalid.json';
import noura from '../data/noura.json';

// الشخصيتان: لكل شخصية بياناتها وتاريخها المرجعي، ولا يتسرب شيء بينها
export const PERSONA_DATA = {
  khalid: { data: khalid, asOf: khalid.period.end, historical: false },
  noura: { data: noura, asOf: noura.period.end, historical: false },
};

// حساب خالد الاستثماري القديم K4: لا نعتمد «معفى» من اسم المنتج (وثيقة التسليم ص2 و12).
// بلا حقائق يبقى خارج الحساب ويظهر «يحتاج مراجعة». إذا أكّد خالد نوعه يُعاد تشغيل المحرك:
//   cash: حساب نقدي/ودائع ← يدخل الوعاء من أول ظهور له في الكشف
//   fund: صندوق ← يدخل بحصته الزكوية التي أدخلها خالد (من إفصاح الصندوق)
export function khalidWith(k4) {
  if (!k4) return khalid;
  if (k4.type === 'cash') return { ...khalid, accounts: khalid.accounts.map(a => (a.accountId === 'K4' ? { ...a, zakatExempt: false, product: undefined } : a)) };
  if (k4.type === 'fund') return {
    ...khalid,
    accounts: khalid.accounts.map(a => (a.accountId === 'K4' ? { ...a, fund: true } : a)),
    holdings: [...khalid.holdings, { id: 'K4-FUND', type: 'fund', intent: 'long_term', acquired: khalid.period.start, marketValue: 50000, zakatableValue: k4.zakatableValue }],
  };
  return khalid;
}
