/**
 * YOZUV (APPOINTMENT) VAQT TO'QNASHUVI — ekran 2 "Jadval".
 *
 * SOF FUNKSIYA (qollanma bo'lim 9, qoida 1). Test MAJBURIY.
 *
 * Bitta kreslo bir vaqtda ikkita bemorga bo'lishi mumkin emas — xuddi shu
 * shifokor ham bir vaqtda ikki joyda bo'la olmaydi. Ikkalasi ham tekshiriladi
 * (kreslo YOKI shifokor mos kelsa — to'qnashuv).
 */

export interface AppointmentInterval {
  /** Yangilashda o'zini o'ziga to'qnashuv deb hisoblamaslik uchun. */
  id?: string;
  chairId: string;
  doctorId: string;
  startAt: Date;
  endAt: Date;
}

/** Ikki vaqt oralig'i kesishadimi (chegara ustma-ust — kesishmaydi: 10:00-10:30 va 10:30-11:00 to'qnashmaydi). */
export function timeRangesOverlap(a: { startAt: Date; endAt: Date }, b: { startAt: Date; endAt: Date }): boolean {
  return a.startAt.getTime() < b.endAt.getTime() && b.startAt.getTime() < a.endAt.getTime();
}

/** Nomzod yozuv bilan to'qnashadigan mavjud yozuvlarni qaytaradi (bo'sh = to'qnashuv yo'q). */
export function findAppointmentConflicts(
  candidate: AppointmentInterval,
  existing: readonly AppointmentInterval[],
): AppointmentInterval[] {
  return existing.filter((e) => {
    if (candidate.id && e.id === candidate.id) return false;
    if (!timeRangesOverlap(candidate, e)) return false;
    return e.chairId === candidate.chairId || e.doctorId === candidate.doctorId;
  });
}
