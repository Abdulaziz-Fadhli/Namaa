// يوم الزكاة في رمضان، كما في دليل هيئة الزكاة (§4.2 و§5):
// - لا يجوز تأخير الزكاة بعد وجوبها انتظارًا لرمضان، إلا التأخير اليسير (تجب آخر شعبان فتؤخر إلى أول رمضان).
// - من أراد أن يكون يوم زكاته في رمضان: يُخرجها في رمضان «قبل» تمام السنة (تعجيل)، ثم يصبح رمضان يوم وجوبه كل سنة.
// - التعجيل جائز بشرط ملك النصاب، ولسنتين فأقل.
import { daysBetween, hijriParts, hijriToIso } from './format.js';

// أول يوم من رمضان في هذا التاريخ أو بعده (وإن كنا في رمضان فاليوم نفسه)
export function ramadanOnOrAfter(iso) {
  const { y, m } = hijriParts(iso);
  if (m === 9) return iso;
  return hijriToIso(m < 9 ? y : y + 1, 9, 1);
}

// نفس اليوم الهجري بعد سنة (إن لم يكن الشهر 30 يومًا فآخر يوم فيه)
export function nextHijriYear(iso) {
  const { y, m, d } = hijriParts(iso);
  return hijriToIso(y + 1, m, d) ?? hijriToIso(y + 1, m, d - 1);
}

// خطة نقل يوم الزكاة إلى رمضان، من اليوم وموعد الوجوب القادم
// ADVANCE: رمضان يأتي قبل موعدك → عجّلها فيه.
// SMALL_DELAY: موعدك آخر شعبان → يجوز تأخيرها اليسير إلى أول رمضان.
// PAY_THEN_ADVANCE: رمضان بعد موعدك → أخرجها في موعدها، ثم عجّل زكاة السنة التالية في رمضان.
export function ramadanPlan(today, nextDue, { ownsNisab = true } = {}) {
  if (!nextDue) return null;
  if (!ownsNisab) return { kind: 'NO_NISAB' };
  const ramadan = ramadanOnOrAfter(today);
  if (ramadan <= nextDue) return { kind: 'ADVANCE', ramadan, due: nextDue, daysEarly: daysBetween(ramadan, nextDue) };
  const late = daysBetween(nextDue, ramadan);
  const { m } = hijriParts(nextDue);
  if (m === 8 && late <= 10) return { kind: 'SMALL_DELAY', ramadan, due: nextDue, daysLate: late };
  const following = nextHijriYear(nextDue);
  return { kind: 'PAY_THEN_ADVANCE', ramadan, due: nextDue, daysLate: late, following, daysEarly: daysBetween(ramadan, following) };
}
