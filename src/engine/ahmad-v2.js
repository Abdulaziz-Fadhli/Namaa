// أحمد v2 (الشخصية التاريخية المعتمدة في وثيقة «ثلاث شخصيات»): نفس سجل أحمد الحالي مع فرقين:
// 1) الفترة مغلقة من 2025-04-01 إلى 2026-09-26 (تُعرض «كما في 26 سبتمبر 2026» لا «اليوم»).
// 2) الحساب A3 ليس منتجًا معفى؛ هو صندوق تعليمي افتراضي LONG_TERM اشتراه أحمد بـ 20,000 في 2025-04-01.
//    وعاء الصندوق المعلن 1,000,000 × حصة أحمد 1٪ = 10,000 حصته الزكوية (إفصاح تعليمي ثابت، ليس منتجًا حقيقيًا).
// ملف نقي يشتغل في المتصفح والاختبارات. النتيجة المرجعية: 7 أحداث مجموعها 765.95، والقادم 165.35 في 2026-10-03.
export const AHMAD_V2 = Object.freeze({
  asOf: '2026-09-26',
  fund: Object.freeze({
    id: 'AHMAD-V2-FUND-A3',
    name: 'صندوق الأفق التعليمي الافتراضي',
    acquired: '2025-04-01',
    originalInvestment: 20000,
    fundZakatBase: 1000000,
    ownershipShare: 0.01,
    disclosureId: 'AHMAD-V2-DISCLOSURE-001',
    assumption: 'APPROVED_SCENARIO_ASSUMPTION',
  }),
  reference: Object.freeze({ totalDueInPeriod: 765.95, events: 7, cash: 57282, fundShare: 10000, vault: 67282, nisab: 4613.2135, nextDue: 165.35, nextDueDate: '2026-10-03' }),
});

export function ahmadV2(ahmad) {
  const { asOf, fund } = AHMAD_V2;
  return {
    ...ahmad,
    persona: 'ahmad',
    description: 'موظف حكومي يتابع راتبه ومصروفاته وادخاره واستثماره عبر الزمن',
    period: { start: ahmad.period.start, end: asOf },
    // A3 يبقى في قائمة الحسابات لعرضه، لكنه لا يدخل دفتر النقد: الصندوق يدخل كأصل بحصته الزكوية
    accounts: ahmad.accounts.map(a => (a.accountId === 'A3'
      ? { ...a, product: fund.name, zakatExempt: true, fund: true }
      : a)),
    transactions: ahmad.transactions.filter(t => t.date <= asOf),
    holdings: [{
      id: fund.id,
      type: 'fund',
      intent: 'long_term',
      acquired: fund.acquired,
      marketValue: fund.originalInvestment,
      zakatableValue: fund.fundZakatBase * fund.ownershipShare,
    }],
    manual: [],
  };
}
