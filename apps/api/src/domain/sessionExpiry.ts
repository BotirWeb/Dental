/**
 * SESSIYA MUDDATI — tahlil D2 / T3.
 *
 * SOF FUNKSIYALAR (qollanma bo'lim 9, qoida 1). Test MAJBURIY.
 *
 * Ikki mustaqil chegara birga ishlaydi:
 *   - ABSOLYUT (`expiresAt`, sessiya yaratilganda belgilanadi, SESSION_MAX_DAYS) —
 *     doim faol bo'lsa ham, shu muddatdan keyin qayta kirish talab qilinadi
 *     (o'g'irlangan cookie abadiy ishlamasin).
 *   - IDLE (`lastActivityAt`dan, SESSION_IDLE_HOURS) — bitta smena sig'adi,
 *     ketgan xodim ertasiga eski cookie bilan kira olmaydi.
 */

export interface SessionExpiryInput {
  now: Date;
  /** Sessiya yaratilganda belgilangan absolyut chegara. */
  expiresAt: Date;
  lastActivityAt: Date;
  idleHours: number;
}

export function isSessionExpired(input: SessionExpiryInput): boolean {
  if (input.now.getTime() >= input.expiresAt.getTime()) return true;

  const idleMs = input.idleHours * 60 * 60 * 1000;
  if (input.now.getTime() - input.lastActivityAt.getTime() >= idleMs) return true;

  return false;
}

export interface ShouldRefreshActivityInput {
  now: Date;
  lastActivityAt: Date;
  /** DB yozuv yukini kamaytirish uchun — har so'rovda emas. */
  minIntervalMinutes: number;
}

/** Faollik vaqtini DB'da yangilash kerakmi (T3: "≥5 daqiqada bir"). */
export function shouldRefreshActivity(input: ShouldRefreshActivityInput): boolean {
  const minIntervalMs = input.minIntervalMinutes * 60 * 1000;
  return input.now.getTime() - input.lastActivityAt.getTime() >= minIntervalMs;
}
