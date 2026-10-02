// ثوابت ودوال مشتركة بين شاشات فيجما (منفصلة عن ملفات المكونات حتى يشتغل التحديث السريع في Vite).
import { createContext, useContext } from 'react';
import { calculateAssetValue } from '../engine/engine.js';

export const StoreContext = createContext(null);
export const useStore = () => useContext(StoreContext);

export const CHANNELS = {
  fund: { title: 'منصة «زكاتي»', detail: 'هيئة الزكاة · للضمان الاجتماعي', time: 'فوري', fee: 'بدون رسوم', receipt: 'يصدر فورًا', transfer: true },
  charity: { title: 'جمعية مرخصة (وكيل)', detail: 'توصلها لمصارف الزكاة الثمانية', time: 'يوم عمل', fee: 'بدون رسوم', receipt: 'يصدر فورًا', transfer: true },
  beneficiary: { title: 'حساب مستفيد', detail: 'أدخل رقم الآيبان يدويًا', time: 'فوري', fee: 'حسب البنك', receipt: 'يصدر بعد التحويل', transfer: true },
  self: { title: 'سأخرجها بنفسي', detail: 'نماء يسجل الإخراج ويبدأ الحول الجديد دون تنفيذ تحويل.', time: 'لا يوجد تحويل', fee: 'بدون رسوم', receipt: 'سجل داخلي', transfer: false },
};

// قيمة أصل واحد في الوعاء حسب المحرك (0 للأصل غير الخاضع مثل سهم شركة سعودية تزكي عنه)
export const zakatableOf = asset => calculateAssetValue(asset.engine);

export const BANK_NAME = { 'الإنماء': 'مصرف الإنماء' };
export const ACCOUNT_TYPE = { current: 'حساب جاري', savings: 'حساب ادخار', investment: 'حساب استثماري' };
export const bankName = b => BANK_NAME[b] ?? b;

// يقبل الأرقام العربية والفواصل: «٢٬٥٠٠» ← 2500
export const parseNum = v => {
  const s = String(v).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[٬,\s]/g, '').replace('٫', '.');
  return s === '' || !/^\d*\.?\d*$/.test(s) ? NaN : Number(s);
};
