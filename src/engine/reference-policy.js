import {
  defaultSettings,
  runEngineDetailed,
  MAX_MONETARY_VALUE,
  hijri,
} from './engine.js';

export const REFERENCE_ID = 'ZATCA-INDIVIDUAL-2023-03';
export const REFERENCE_RULES = Object.freeze({
  goldGrams: 85,
  silverGrams: 595,
  rate: 0.025,
  cashNisab: 'LOWER_OF_GOLD_SILVER',
  deductDebts: false,
  jewelry: 'EXCLUDE_PERSONAL_USE_AND_LENDING',
  calendar: 'LUNAR_YEAR',
});
const DAY = 86400000;
const money = new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 2 });
const number = (v, label) => {
  if (!Number.isFinite(v) || v < 0 || v > MAX_MONETARY_VALUE)
    throw new RangeError(`${label}: invalid monetary value`);
  return v;
};
const record = (v, label) => {
  if (!v || typeof v !== 'object' || Array.isArray(v))
    throw new TypeError(`${label} must be an object`);
  const prototype = Object.getPrototypeOf(v);
  if (prototype !== Object.prototype && prototype !== null)
    throw new TypeError(`${label} must be a plain record`);
};
const array = (v, label) => {
  if (!Array.isArray(v)) throw new TypeError(`${label} must be an array`);
  return v;
};
const date = (v) => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v))
    throw new TypeError('date must be YYYY-MM-DD');
  const d = new Date(`${v}T00:00:00Z`);
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== v)
    throw new RangeError('invalid date');
  return d;
};
const keys = (v, allowed, label) => {
  for (const key of Object.keys(v))
    if (!allowed.includes(key))
      throw new TypeError(`${label}: unsupported field ${key}`);
};

export function validateReferencePolicy(policy = {}) {
  record(policy, 'shariaPolicy');
  keys(policy, ['newMoneyMode'], 'shariaPolicy');
  const newMoneyMode =
    policy.newMoneyMode === undefined
      ? 'INDEPENDENT_HAWL'
      : policy.newMoneyMode;
  if (!['INDEPENDENT_HAWL', 'ANNUAL_ADVANCE'].includes(newMoneyMode))
    throw new TypeError('unsupported newMoneyMode');
  return Object.freeze({
    referenceId: REFERENCE_ID,
    ...REFERENCE_RULES,
    newMoneyMode,
    newMoneySource: 'ص14 §2.2.5.1 وص19 §3.3',
    operationalAssumptions: [
      'الملاحظات يومية بتوقيت UTC؛ أم القرى أداة تقويم؛ اليوم الأخير عند غياب يوم30 اصطلاح تقني.',
    ],
  });
}

// All policy-critical fields are facts, never arbitrary exemption switches.
export function classifyReferenceAsset(asset, prices) {
  record(asset, 'asset');
  keys(
    asset,
    [
      'id',
      'kind',
      'acquired',
      'value',
      'grams',
      'karat',
      'purity',
      'purpose',
      'intent',
      'zakatableValue',
      'companyZakatPaid',
      'companyEvidence',
      'recovery',
      'tradeCapital',
      'quantity',
      'hawlSource',
    ],
    'asset',
  );
  if (typeof asset.id !== 'string' || !asset.id.trim())
    throw new TypeError('stable asset id required');
  const fields = {
    CASH: ['value', 'tradeCapital'],
    GOLD: ['grams', 'karat', 'purpose'],
    SILVER: ['grams', 'purity', 'purpose'],
    TRADE_GOODS: ['intent', 'value', 'quantity'],
    STOCK: [
      'intent',
      'value',
      'zakatableValue',
      'companyZakatPaid',
      'companyEvidence',
      'quantity',
    ],
    FUND: ['intent', 'value', 'zakatableValue', 'quantity'],
    DEBT_INSTRUMENT: ['intent', 'value', 'zakatableValue', 'quantity'],
    PROPERTY: ['intent', 'value'],
    RECEIVABLE: ['value', 'recovery'],
  };
  if (!Object.hasOwn(fields, asset.kind))
    throw new TypeError('unsupported reference asset kind');
  keys(
    asset,
    ['id', 'kind', 'acquired', 'hawlSource', ...fields[asset.kind]],
    'asset facts',
  );
  record(prices, 'prices');
  for (const key of ['gold', 'silver'])
    if (number(prices[key], key) === 0)
      throw new RangeError('prices must be positive');
  for (const field of [
    'value',
    'zakatableValue',
    'grams',
    'karat',
    'purity',
    'quantity',
  ])
    if (Object.hasOwn(asset, field)) number(asset[field], field);
  const acquired = date(asset.acquired);
  for (const flag of ['companyZakatPaid', 'tradeCapital'])
    if (asset[flag] !== undefined && typeof asset[flag] !== 'boolean')
      throw new TypeError(`${flag} must be boolean`);
  let normalized,
    value,
    included = true,
    explanationArabic,
    source,
    group = 'CASH_TRADE',
    trade = false;
  switch (asset.kind) {
    case 'CASH':
      value = number(asset.value, 'cash');
      if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-4)
        throw new RangeError('cash requires cents');
      normalized = {
        kind: 'cash',
        value,
        type: asset.tradeCapital ? 'TRADE_CAPITAL' : 'INDEPENDENT',
      };
      trade = asset.tradeCapital === true;
      explanationArabic =
        'نقد مملوك يدخل الوعاء ولا يُخصم منه الدين على صاحبه.';
      source = 'ص18 §3.2.1 وص20 §3.4';
      break;
    case 'GOLD':
    case 'SILVER': {
      if (
        ![
          'PERSONAL_USE',
          'LENDING',
          'SALE',
          'TRADING',
          'SAVED_FOR_SALE',
          'RENTAL',
          'INVESTMENT',
        ].includes(asset.purpose)
      )
        throw new TypeError('metal purpose is required');
      group = asset.purpose === 'TRADING' ? 'CASH_TRADE' : asset.kind;
      const gold = asset.kind === 'GOLD';
      const fineness = gold ? asset.karat : asset.purity;
      if (
        !Number.isFinite(asset.grams) ||
        asset.grams < 0 ||
        !Number.isFinite(fineness) ||
        fineness <= 0 ||
        fineness > (gold ? 24 : 1000)
      )
        throw new RangeError('invalid metal weight or purity');
      const price = prices[gold ? 'gold' : 'silver'];
      normalized = gold
        ? {
            kind: 'gold',
            grams: asset.grams,
            karat: fineness,
            pricePerGram: price,
          }
        : {
            kind: 'silver',
            grams: asset.grams,
            purity: fineness,
            pricePerGram: price,
          };
      value = number(
        ((asset.grams * fineness) / (gold ? 24 : 1000)) * price,
        'metal value',
      );
      included = !['PERSONAL_USE', 'LENDING'].includes(asset.purpose);
      trade = asset.purpose === 'TRADING';
      explanationArabic = included
        ? `معدن غير معد للاستعمال أو الإعارة؛ القيمة ${money.format(value)} ريال من الوزن النقي وسعر يوم الملاحظة.`
        : 'حلي معد للاستعمال أو الإعارة؛ مستبعد من الوعاء.';
      source = 'ص15–16 §3.1 و§3.1.1 و§3.1.2';
      break;
    }
    case 'TRADE_GOODS':
    case 'STOCK':
    case 'FUND':
    case 'DEBT_INSTRUMENT': {
      if (!['TRADING', 'INVESTMENT', 'PERSONAL_USE'].includes(asset.intent))
        throw new TypeError('asset intent is required');
      if (asset.kind !== 'TRADE_GOODS' && asset.intent === 'PERSONAL_USE')
        throw new TypeError('invalid investment intent');
      trade = asset.intent === 'TRADING';
      source =
        asset.kind === 'STOCK'
          ? 'ص22–23 §3.6'
          : asset.kind === 'FUND'
            ? 'ص24–25 §3.9'
            : asset.kind === 'DEBT_INSTRUMENT'
              ? 'ص23 §3.7'
              : 'ص20–22 §3.5';
      if (asset.companyZakatPaid !== undefined && asset.kind !== 'STOCK')
        throw new TypeError(
          'company discharge applies only to investment shares in this reference',
        );
      if (asset.companyZakatPaid === true) {
        if (trade)
          throw new TypeError(
            'trading stock cannot be exempted by company payment',
          );
        record(asset.companyEvidence, 'companyEvidence');
        keys(
          asset.companyEvidence,
          ['jurisdiction', 'source'],
          'companyEvidence',
        );
        if (
          asset.companyEvidence.jurisdiction !== 'SA' ||
          typeof asset.companyEvidence.source !== 'string' ||
          !asset.companyEvidence.source.trim()
        )
          throw new TypeError('Saudi company discharge evidence required');
        included = false;
        value = asset.value === undefined ? 0 : asset.value;
        explanationArabic =
          'أسهم استثمار في شركة سعودية موثق إخراجها للزكاة؛ يكتفى بإخراج الشركة، دون إعفاء أسهم المضاربة.';
      } else if (
        asset.kind === 'TRADE_GOODS' &&
        asset.intent === 'PERSONAL_USE'
      ) {
        included = false;
        value = asset.value === undefined ? 0 : asset.value;
        explanationArabic =
          'مقتنيات غير معدة للتجارة؛ لا تدخل قيمة الأصل في الوعاء.';
      } else {
        if (asset.kind === 'TRADE_GOODS' && !trade)
          throw new TypeError('trade goods require trading or personal intent');
        value = number(
          trade ? asset.value : asset.zakatableValue,
          'declared investment value',
        );
        explanationArabic = trade
          ? 'مال معد للتجارة؛ يدخل بكامل قيمته السوقية في يوم الوجوب.'
          : 'استثمار يحتسب منه الجزء الزكوي المعلن فقط؛ لا تُفترض قيمة مجهولة.';
      }
      normalized = {
        kind: asset.kind === 'STOCK' ? 'stocks' : 'investmentProducts',
        type: trade ? 'TRADING' : 'LONG_TERM',
        ...(trade ? { marketValue: value } : { zakatableValue: value }),
        ...(asset.quantity !== undefined ? { quantity: asset.quantity } : {}),
      };
      break;
    }
    case 'PROPERTY':
      if (!['USE', 'RENTAL', 'TRADING'].includes(asset.intent))
        throw new TypeError('property intent is required');
      trade = asset.intent === 'TRADING';
      included = trade;
      value = included
        ? number(asset.value, 'property value')
        : asset.value === undefined
          ? 0
          : asset.value;
      normalized = {
        kind: 'properties',
        intent: asset.intent,
        marketValue: value,
      };
      explanationArabic = included
        ? 'عقار للتجارة يقوّم يوم الوجوب بالقيمة السوقية.'
        : 'العقار للاستخدام أو التأجير لا تزكى قيمته؛ الإيجار نقد مستقل إن توافرت شروطه.';
      source = 'ص24 §3.8 و§3.8.1';
      break;
    case 'RECEIVABLE':
      if (!['SOLVENT_NON_DELAYING', 'DOUBTFUL'].includes(asset.recovery))
        throw new TypeError('receivable recovery fact required');
      value = number(asset.value, 'receivable');
      included = asset.recovery === 'SOLVENT_NON_DELAYING';
      normalized = { kind: 'cash', value, type: 'RECEIVABLE' };
      explanationArabic = included
        ? 'دين للمستخدم على قادر غير مماطل؛ كالمال في اليد ويزكى مع مرور الحول.'
        : 'دين مشكوك تحصيله؛ يستبعد حتى القبض، ثم يبدأ حول ما قبضه.';
      source = 'ص19–20 §3.4';
      break;
    default:
      throw new TypeError('unsupported reference asset kind');
  }
  if (asset.companyEvidence !== undefined && asset.companyZakatPaid !== true)
    throw new TypeError('company evidence conflicts with payment flag');
  if (asset.recovery !== undefined && asset.kind !== 'RECEIVABLE')
    throw new TypeError('recovery belongs to receivables');
  if (asset.tradeCapital !== undefined && asset.kind !== 'CASH')
    throw new TypeError('tradeCapital belongs to cash');
  if (
    asset.quantity !== undefined &&
    (!Number.isFinite(asset.quantity) || asset.quantity < 0)
  )
    throw new RangeError('invalid quantity');
  return {
    ...asset,
    valuationKnown:
      included ||
      ['GOLD', 'SILVER', 'RECEIVABLE', 'CASH'].includes(asset.kind) ||
      asset.value !== undefined,
    normalized: { ...normalized, id: asset.id, acquired },
    value,
    included,
    group,
    trade,
    source,
    explanationArabic,
  };
}

export function runReferenceEngine(request) {
  record(request, 'request');
  keys(
    request,
    ['days', 'prices', 'asOfDate', 'shariaPolicy', 'liabilities'],
    'request',
  );
  const policyApplied = validateReferencePolicy(request.shariaPolicy);
  const asOf = date(request.asOfDate);
  const input = array(request.days, 'days');
  if (!input.length) throw new RangeError('observed history is required');
  record(request.prices, 'prices');
  const liabilities =
    request.liabilities === undefined
      ? []
      : array(request.liabilities, 'liabilities');
  const liabilityIds = new Set();
  for (const debt of liabilities) {
    record(debt, 'liability');
    keys(debt, ['id', 'amount'], 'liability');
    if (typeof debt.id !== 'string' || !debt.id || liabilityIds.has(debt.id))
      throw new TypeError('duplicate or missing liability id');
    liabilityIds.add(debt.id);
    number(debt.amount, 'liability');
  }
  const observations = [],
    seenEver = new Set(),
    identities = new Map(),
    warnings = [];
  let previousDate = null;
  for (const row of input) {
    record(row, 'day');
    keys(row, ['date', 'assets'], 'day');
    const d = date(row.date);
    if (d > asOf || (previousDate && d - previousDate !== DAY))
      throw new RangeError(
        'daily history must be continuous, ordered and end at asOfDate',
      );
    previousDate = d;
    const prices = request.prices[row.date];
    record(prices, 'daily prices');
    for (const key of ['gold', 'silver'])
      if (number(prices[key], `${key} price`) === 0)
        throw new RangeError('prices must be positive');
    const assets = array(row.assets, 'daily assets').map((a) =>
      classifyReferenceAsset(a, prices),
    );
    const ids = new Set();
    for (const a of assets) {
      if (ids.has(a.id) || liabilityIds.has(a.id))
        throw new TypeError('duplicate asset id');
      ids.add(a.id);
      if (a.normalized.acquired > d)
        throw new RangeError('observed asset cannot have future acquisition');
      const identity = JSON.stringify([
        a.kind,
        a.acquired,
        a.intent,
        a.purpose,
        a.recovery,
        a.tradeCapital,
        a.companyZakatPaid,
        a.companyEvidence,
      ]);
      if (identities.has(a.id) && identities.get(a.id) !== identity)
        throw new TypeError(
          'asset facts cannot change under an existing lot id',
        );
      if (
        !identities.has(a.id) &&
        observations.length &&
        a.acquired !== row.date
      )
        throw new TypeError(
          'a new observed lot must be acquired on that day; earlier ownership needs explicit history',
        );
      if (!identities.has(a.id) && seenEver.has(a.id))
        throw new TypeError('removed asset id cannot be reused');
      if (
        !identities.has(a.id) &&
        a.acquired < row.date &&
        a.acquired < input[0].date
      )
        warnings.push(
          `الأصل ${a.id}: تاريخ التملك سابق للسجل؛ لا يثبت حولًا سابقًا أو التزامات ماضية.`,
        );
      identities.set(a.id, identity);
      seenEver.add(a.id);
      if (
        a.hawlSource !== undefined &&
        observations.length &&
        observations.at(-1).assets.some((old) => old.id === a.id)
      )
        throw new TypeError(
          'hawlSource is allowed only when a target first appears',
        );
    }
    for (const id of identities.keys()) if (!ids.has(id)) identities.delete(id);
    const included = assets.filter((a) => a.included);
    const groups = new Set(
      included.filter((a) => a.value > 0).map((a) => a.group),
    );
    const goldValue = number(85 * prices.gold, 'gold nisab'),
      silverValue = number(595 * prices.silver, 'silver nisab');
    const basis =
      groups.size === 1 && groups.has('GOLD')
        ? 'PURE_GOLD_85G'
        : groups.size === 1 && groups.has('SILVER')
          ? 'PURE_SILVER_595G'
          : 'LOWER_OF_GOLD_SILVER';
    const appliedValue =
      basis === 'PURE_GOLD_85G'
        ? goldValue
        : basis === 'PURE_SILVER_595G'
          ? silverValue
          : Math.min(goldValue, silverValue);
    observations.push({
      date: d,
      assets,
      nisab: { basis, goldValue, silverValue, appliedValue },
    });
  }
  if (previousDate.getTime() !== asOf.getTime())
    throw new RangeError('last observation must equal asOfDate');
  const days = observations.map((o) => ({
    date: o.date,
    nisab: o.nisab.appliedValue,
    assets: o.assets.filter((a) => a.included).map((a) => a.normalized),
  }));
  const resolver = (d, oldLots) => {
    const index = observations.findIndex(
      (o) => o.date.getTime() === d.getTime(),
    );
    const current = observations[index],
      previous = observations[index - 1];
    const starts = new Map(),
      used = new Set();
    for (const target of current.assets) {
      if (target.hawlSource === undefined) continue;
      const link = target.hawlSource;
      record(link, 'hawlSource');
      keys(link, ['sourceId', 'type', 'transferredValue'], 'hawlSource');
      const source = previous?.assets.find((a) => a.id === link.sourceId);
      if (
        !source ||
        !target.included ||
        oldLots.some((l) => l.id === target.id)
      )
        throw new TypeError(
          'lineage requires a previous source and a new included target',
        );
      const old = oldLots.find((l) => l.id === source.id);
      if (link.type === 'TRADE_PROFIT') {
        if (
          !source.trade ||
          !old ||
          target.kind !== 'CASH' ||
          link.transferredValue !== undefined
        )
          throw new TypeError(
            'trade profit needs a trading parent and a cash target',
          );
      } else if (['TRADE_CONVERSION', 'DEBT_RECOVERY'].includes(link.type)) {
        if (used.has(source.id))
          throw new TypeError('split conversions require separate source lots');
        used.add(source.id);
        const moved = number(link.transferredValue, 'transferred value');
        const left = current.assets.find((a) => a.id === source.id)?.value ?? 0;
        if (
          moved === 0 ||
          Math.abs(source.value - left - moved) > 1e-7 ||
          target.value !== moved
        )
          throw new RangeError(
            'conversion must reconcile source reduction and target value',
          );
        if (
          link.type === 'TRADE_CONVERSION' &&
          (!source.trade || !target.trade || !old)
        )
          throw new TypeError(
            'trade conversion requires trade facts on both sides',
          );
        if (
          link.type === 'DEBT_RECOVERY' &&
          (source.kind !== 'RECEIVABLE' || target.kind !== 'CASH')
        )
          throw new TypeError('debt recovery requires receivable to cash');
      } else throw new TypeError('unknown hawl lineage type');
      const wasAbove =
        previous.assets
          .filter((a) => a.included)
          .reduce((n, a) => n + a.value, 0) >= previous.nisab.appliedValue;
      starts.set(target.id, old?.start ?? (wasAbove ? d : null));
    }
    return starts;
  };
  // Independent obligations remain obligations. The optional annual selection
  // generates advance quotes; it does not pretend that payment occurred.
  const raw = runEngineDetailed(days, defaultSettings, resolver);
  const events = raw.events.map((e) => {
    const observation = observations.find(
      (o) => o.date.getTime() === e.date.getTime(),
    );
    const assets = e.assets?.map((a) => ({
      ...a,
      kind: observation.assets.find((item) => item.id === a.id).kind,
    }));
    const cashBase =
      assets
        ?.filter((a) => a.kind === 'CASH')
        .reduce((n, a) => n + a.value, 0) ?? 0;
    const full = raw.series.find(
      (s) => s.date.getTime() === e.date.getTime(),
    ).total;
    return {
      ...e,
      ...(e.type === 'DUE'
        ? { assets, cashBase, otherAssetsBase: e.base - cashBase }
        : {}),
      date: e.date.toISOString().slice(0, 10),
      ...(e.type === 'DUE'
        ? {
            advanceSuggested:
              policyApplied.newMoneyMode === 'ANNUAL_ADVANCE'
                ? (full - e.base) / 40
                : 0,
            referenceSource:
              'ص14 وص19؛ التعجيل اقتراح وليس دينًا واجبًا جديدًا أو دفعًا منفذًا',
          }
        : {}),
      nisab: observation.nisab,
    };
  });
  const last = observations.at(-1),
    end = raw.series.at(-1);
  const obligations = events.filter((e) => e.type === 'DUE');
  const zakatDue = obligations.reduce((n, e) => n + e.zakat, 0);
  number(zakatDue, 'cumulative zakat');
  const firstStart = events.find((e) => e.type === 'START');
  const latestStart = events.filter((e) => e.type === 'START').at(-1);
  const assetBreakdown = last.assets.map((a) => ({
    id: a.id,
    kind: a.kind,
    included: a.included,
    value: a.valuationKnown ? a.value : null,
    zakatableValue: a.included ? a.value : 0,
    acquired: a.acquired,
    hawlStart:
      raw.assetLots
        ?.find((l) => l.id === a.id)
        ?.start?.toISOString()
        .slice(0, 10) ?? null,
    explanationArabic: a.explanationArabic,
    referenceSource: a.source,
  }));
  const needsHistoryReview = warnings.length > 0;
  if (policyApplied.newMoneyMode === 'ANNUAL_ADVANCE')
    warnings.push(
      'وضع التعجيل يعرض اقتراحًا فقط؛ إتمام الدفع وتغيير موعد الحول غير منفذين في هذا العقد.',
    );
  const explanationsArabic = [
    ...events.map((e) => e.explanation),
    ...assetBreakdown.map((a) => a.explanationArabic),
    `النصاب المطبق ${money.format(last.nisab.appliedValue)} ريال؛ النقد وعروض التجارة يتبعان الأدنى، والمعدن المنفرد يتبع نصابه الخالص.`,
    ...(liabilities.length
      ? ['الدين على المستخدم لا يخصم من الوعاء، وفق ص20 §3.4.']
      : []),
    ...(warnings.length ? warnings : []),
  ];
  if (!firstStart)
    explanationsArabic.push(
      'لم يبلغ الوعاء النصاب خلال السجل، فلم يبدأ الحول.',
    );
  return {
    referenceId: REFERENCE_ID,
    asOfDate: request.asOfDate,
    nisab: last.nisab,
    zakatableWealth: end.total,
    status: needsHistoryReview
      ? 'NEEDS_HISTORY_REVIEW'
      : zakatDue > 0
        ? 'ZAKAT_DUE'
        : end.above
          ? 'HAWL_RUNNING'
          : 'BELOW_NISAB',
    hawlStart: end.above ? (latestStart?.date ?? null) : null,
    nextDueDate: raw.nextDue?.dueDate.toISOString().slice(0, 10) ?? null,
    nextDueHijri: raw.nextDue?.targetHijri ?? null,
    projectedNextZakat: raw.nextDue?.zakat ?? 0,
    zakatDue,
    paymentRecorded: false,
    advanceSuggested: obligations.at(-1)?.advanceSuggested ?? 0,
    assetBreakdown,
    events,
    series: raw.series.map((s) => ({
      ...s,
      date: s.date.toISOString().slice(0, 10),
      hijri: hijri(s.date),
      cashBalance: observations
        .find((o) => o.date.getTime() === s.date.getTime())
        .assets.filter((a) => a.included && a.kind === 'CASH')
        .reduce((n, a) => n + a.value, 0),
      otherAssets:
        s.total -
        observations
          .find((o) => o.date.getTime() === s.date.getTime())
          .assets.filter((a) => a.included && a.kind === 'CASH')
          .reduce((n, a) => n + a.value, 0),
    })),
    explanationsArabic,
    policyApplied,
    warnings,
    limitations: [
      'المبالغ الواجبة تراكمية خلال السجل وغير مسددة في هذا العقد؛ لا واجهة دفع هنا.',
      'التعجيل لا يغير الحول إلا بعد دفع مؤكد؛ اقتراح التعجيل ليس تنفيذ دفع.',
      'الضم والنصاب يوميان؛ السجل لا يمثل الحركات داخل اليوم.',
      'أسعار السوق مدخلات؛ لا يجلب هذا العقد سعرًا حيًا.',
      'تغيّر نية الدفعة أو حالة الدين يحتاج حدثًا موثقًا؛ لا تغيّر هوية قديمة بصمت.',
    ],
  };
}
