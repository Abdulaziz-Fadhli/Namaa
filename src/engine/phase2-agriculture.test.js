import { describe, expect, test } from 'vitest';
import { evaluateCropZakat, evaluateLivestockZakat } from './engine.js';
const strict = { validationMode: 'strict' };
const crop = (patch = {}) => ({ kind: 'WHEAT', classification: 'GRAIN', quantity: 1000, unit: 'KG', goodWheat: true, measurementState: 'CLEANED_GRAIN', ownedAtObligation: true, obligationReached: true, irrigation: 'WITH_COST', ...patch });
const herd = (type, count, patch = {}) => ({ type, count, purpose: 'PRODUCTION', grazing: 'ALL_YEAR', acquired: new Date('2025-04-01T00:00:00Z'), asOf: new Date('2026-03-22T00:00:00Z'), countChange: 'STABLE', ...patch });

describe('C01–C10 / G12,27; D10,27; F4–5', () => {
  test('D27 exact example: 1000kg good wheat, 5%, 11 per kg = 550', () => {
    expect(evaluateCropZakat(crop({ pricePerUnit: 11 }), strict)).toMatchObject({ dueQuantity: 50, settlementValue: 550 });
  });
  test.each([['WITH_COST', 50], ['WITHOUT_COST', 100], ['HALF_COST', 75]])('source irrigation %s', (irrigation, amount) => {
    expect(evaluateCropZakat(crop({ irrigation }), strict)).toMatchObject({ status: 'CALCULATED', dueQuantity: amount, requiresHawl: false });
  });
  test('612kg is good wheat only; volume is 900L', () => {
    expect(evaluateCropZakat(crop({ quantity: 612 }), strict).dueQuantity).toBe(30.6);
    expect(evaluateCropZakat(crop({ kind: 'DATES', classification: 'STORABLE_FRUIT', goodWheat: false, measurementState: 'DRIED_FRUIT', quantity: 612 }), strict).status).toBe('UNRESOLVED');
    expect(evaluateCropZakat(crop({ unit: 'L', quantity: 900 }), strict).dueQuantity).toBe(45);
  });
  test('missing irrigation is UNKNOWN; arbitrary mixed irrigation unresolved', () => {
    expect(evaluateCropZakat(crop({ irrigation: undefined }), strict)).toMatchObject({ status: 'UNKNOWN', zakat: null });
    expect(evaluateCropZakat(crop({ irrigation: 'MIXED' }), strict)).toMatchObject({ status: 'UNRESOLVED', zakat: null });
  });
  test('absence of ownership at obligation and excluded crops are exemptions', () => {
    expect(evaluateCropZakat(crop({ ownedAtObligation: false }), strict).status).toBe('EXEMPT');
    expect(evaluateCropZakat(crop({ kind: 'VEGETABLES', classification: 'NON_ZAKATABLE' }), strict).status).toBe('EXEMPT');
  });
  test('known source classifications cannot contradict wheat and vegetable facts', () => {
    expect(() => evaluateCropZakat(crop({ classification: 'NON_ZAKATABLE' }), strict)).toThrow(/classification/);
    expect(() => evaluateCropZakat(crop({ kind: 'VEGETABLES' }), strict)).toThrow(/classification/);
  });
  test('raw crop / aggregation never produces a final quantity', () => {
    expect(evaluateCropZakat(crop({ measurementState: 'RAW' }), strict).status).toBe('UNKNOWN');
    expect(evaluateCropZakat(crop({ aggregate: true }), strict).status).toBe('UNRESOLVED');
  });
});

describe('L01–L17 / D5–9; F6–14,23', () => {
  test('F17: two lost camels do not complete the count of 36', () => {
    expect(evaluateLivestockZakat(herd('camels', 36, { lostCount: 2 }), strict).alternatives[0][0].animal).toBe('BINT_MAKHAD');
  });
  test('F11: the explicit ibn-labun substitution is distinct from disputed male cases', () => {
    const r = evaluateLivestockZakat(herd('camels', 25, { requestedSex: 'MALE', requestedAnimal: 'IBN_LABUN' }), strict);
    expect(r.status).toBe('CALCULATED');
    expect(r.documentedSubstitutions).toContainEqual({ replaces: 'BINT_MAKHAD', animal: 'IBN_LABUN', minAgeYears: 2, sex: 'MALE' });
  });
  test('F19: separated mixture retains the previous year end when individually above nisab', () => {
    const r = evaluateLivestockZakat(herd('sheep', 40, { acquired: new Date('2024-04-01T00:00:00Z'), countChange: 'SEPARATED_MIXTURE', previousMixtureHawlEnd: new Date('2025-10-01T00:00:00Z'), individualNisabMaintained: true }), strict);
    expect(r.status).toBe('ZERO');
  });
  test('sheep and goat numbers combine; equal groups use equal value weights', () => {
    const r = evaluateLivestockZakat(herd('sheep', 40, { sheepCount: 20, goatCount: 20, sheepAverageValue: 300, goatAverageValue: 200 }), strict);
    expect(r.status).toBe('CALCULATED');
    expect(r.obligationCount).toBe(1);
    expect(r.settlementValue).toBe(250);
    expect(evaluateLivestockZakat(herd('sheep', 40, { sheepCount: 20, goatCount: 20 }), strict).status).toBe('UNKNOWN');
  });
  test('offspring starts at threshold when parents were below nisab', () => {
    const r = evaluateLivestockZakat(herd('sheep', 40, { countChange: 'OFFSPRING', offspring: { parentCount: 30, offspringCount: 10, parentsHawlStart: new Date('2025-04-01T00:00:00Z'), thresholdReached: new Date('2025-10-01T00:00:00Z') } }), strict);
    expect(r.status).toBe('ZERO');
  });
  test('documented owner mixture aggregates only with all shared facts', () => {
    const acquired = new Date('2025-04-01T00:00:00Z');
    const mixture = { start: acquired, owners: [{ id: 'a', count: 20, acquired, eligibleOwner: true }, { id: 'b', count: 20, acquired, eligibleOwner: true }], shared: { marah: true, masrah: true, water: true, milking: true, stud: true, pastureTime: true, pasturePlace: true } };
    expect(evaluateLivestockZakat(herd('sheep', 40, { mixture }), strict).obligationCount).toBe(1);
    expect(evaluateLivestockZakat(herd('sheep', 40, { mixture: { ...mixture, shared: {} } }), strict).status).toBe('UNRESOLVED');
  });
  test('camel 200 returns both valid obligations without choosing cheapest', () => {
    const r = evaluateLivestockZakat(herd('camels', 200), strict);
    expect(r.status).toBe('CALCULATED');
    expect(r.alternatives).toEqual([
      [{ animal: 'BINT_LABUN', count: 5, minAgeYears: 2, sex: 'FEMALE' }],
      [{ animal: 'HIQQA', count: 4, minAgeYears: 3, sex: 'FEMALE' }],
    ]);
    expect(r.selectedAlternative).toBeNull();
  });
  test('cattle 120 has two valid alternatives', () => {
    expect(evaluateLivestockZakat(herd('cattle', 120), strict).alternatives).toHaveLength(2);
  });
  test('the documented male tabi is allowed without resolving R01', () => {
    expect(evaluateLivestockZakat(herd('cattle', 60, { requestedSex: 'MALE' }), strict).status).toBe('CALCULATED');
  });
  test('F11 average quality and whole-herd thinness exception are reported', () => {
    expect(evaluateLivestockZakat(herd('sheep', 40), strict).requirements.quality).toBe('AVERAGE_OF_HERD');
    expect(evaluateLivestockZakat(herd('sheep', 40, { wholeHerdEmaciated: true }), strict).requirements.emaciationAllowed).toBe(true);
    expect(evaluateLivestockZakat(herd('sheep', 40, { wholeHerdEmaciated: true }), strict).alternatives[0][0].quality).toBe('HERD_AVERAGE_EMACIATION_ALLOWED');
  });
  test.each([[39, 0], [40, 1], [120, 1], [121, 2], [200, 2], [201, 3], [399, 3], [400, 4]])('sheep %i requires %i', (n, count) => {
    const r = evaluateLivestockZakat(herd('sheep', n), strict);
    expect(r.obligationCount).toBe(count);
    expect(r.status).toBe(count ? 'CALCULATED' : 'ZERO');
  });
  test('missing hawl/purpose/grazing is not a proven zero below nisab', () => {
    for (const field of ['purpose', 'grazing', 'acquired']) {
      expect(evaluateLivestockZakat(herd('sheep', 1, { [field]: undefined }), strict)).toMatchObject({ status: 'UNKNOWN', zakat: null });
    }
  });
  test('working purpose alone cannot hide the unresolved stud/riding exception', () => {
    expect(evaluateLivestockZakat(herd('camels', 10, { purpose: 'WORK' }), strict)).toMatchObject({ status: 'UNKNOWN', zakat: null });
  });
  test.each([
    ['R01', { requestedSex: 'MALE' }],
    ['R02', { grazing: 'MOST_YEAR', feedingDuringGrazing: true }],
    ['R03', { purpose: 'TRADING', fatteningProject: true }],
    ['R04', { pastDueValuation: true }],
    ['R05', { purpose: 'WORK', workRole: 'BREEDING_STUD' }],
    ['R06', { countChange: 'PURCHASE' }],
  ])('%s is blocked only for the affected case', (ruleId, patch) => {
    expect(evaluateLivestockZakat(herd('sheep', 100, patch), strict)).toMatchObject({ status: 'BLOCKED_PENDING_REVIEW', ruleId, zakat: null });
    expect(evaluateLivestockZakat(herd('sheep', 100), strict).status).toBe('CALCULATED');
  });
});
