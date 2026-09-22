/**
 * Login va klinika kodi (slug) normalizatsiyasi — tahlil C4 / T2.
 *
 * SOF FUNKSIYALAR (qollanma bo'lim 9, qoida 1) — backend ham, frontend ham
 * bir xil natija beradi, xuddi `phone.ts` naqshi kabi.
 */

/** Saqlash va solishtirishdan oldin: bo'sh joy olib tashlanadi, kichik harfga o'tkaziladi. */
export function normalizeLogin(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Klinika kodi formati: 3-32 belgi, kichik lotin harf/raqam/tire. */
export const CLINIC_SLUG_PATTERN = /^[a-z0-9-]{3,32}$/;

export function normalizeClinicSlug(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidClinicSlug(raw: string): boolean {
  return CLINIC_SLUG_PATTERN.test(raw);
}
