/**
 * IDEMPOTENTLIK QARORI — tahlil M1 / T4.
 *
 * SOF FUNKSIYA (qollanma bo'lim 9, qoida 1). Test MAJBURIY.
 *
 * Sekin internetda admin tugmani ikki marta bossa yoki so'rov timeout'dan
 * keyin qayta yuborilsa — ikki marta to'lov/bemor yaratilmasin. Kalit
 * (`Idempotency-Key`) + so'rov tanasi xeshi bo'yicha to'rtta holat mumkin,
 * shu funksiya hal qiladi (DB'dan mustaqil, sinovi oson):
 *
 *   - claim       — bunday kalit yo'q, davom etish xavfsiz.
 *   - in_progress — xuddi shu kalit+tana bilan boshqa so'rov HALI
 *                   bajarilmoqda (parallel duplikat — band qilingan, lekin
 *                   hali yakunlanmagan qator). Duplikat yozuv yaratilmasin
 *                   deb, bu so'rov RAD ETILADI (409) — takroran urinish
 *                   kutiladi, natija o'g'irlanmaydi/kutilmaydi.
 *   - replay      — xuddi shu kalit+tana bilan oldin TUGALLANGAN so'rov —
 *                   saqlangan javob qaytariladi, yangi yozuv yaratilmaydi.
 *   - conflict    — xuddi shu kalit, BOSHQA tana — 422 (mijoz xatosi).
 */

export interface ExistingIdempotencyRow {
  requestHash: string;
  statusCode: number | null;
  responseBody: string | null;
}

export type IdempotencyDecision =
  | { kind: "claim" }
  | { kind: "in_progress" }
  | { kind: "replay"; statusCode: number; responseBody: string }
  | { kind: "conflict" };

export function decideIdempotency(
  existing: ExistingIdempotencyRow | undefined,
  requestHash: string,
): IdempotencyDecision {
  if (!existing) return { kind: "claim" };

  if (existing.requestHash !== requestHash) {
    return { kind: "conflict" };
  }

  if (existing.statusCode === null || existing.responseBody === null) {
    return { kind: "in_progress" };
  }

  return { kind: "replay", statusCode: existing.statusCode, responseBody: existing.responseBody };
}

/** Idempotency-Key format — UUID (qollanma T4: "header (UUID)"). */
export const IDEMPOTENCY_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidIdempotencyKey(raw: string | undefined | null): raw is string {
  return typeof raw === "string" && IDEMPOTENCY_KEY_PATTERN.test(raw);
}
