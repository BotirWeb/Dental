import { normalizeClinicSlug } from "@dental/shared";

/**
 * LOGIN'DA KLINIKA KODINI ANIQLASH — tahlil C4 / T2.
 *
 * SOF FUNKSIYA (qollanma bo'lim 9, qoida 1). Test MAJBURIY.
 *
 * Qoida: so'rovda `clinic` bo'lsa — o'sha ishlatiladi. Bo'lmasa —
 * `DEFAULT_CLINIC_SLUG` env (bitta klinikali joylashuv uchun qulaylik).
 * Ikkalasi ham bo'lmasa — xato (API buni 400 qilib qaytaradi).
 */
export class ClinicResolutionError extends Error {
  constructor() {
    super("Klinika kodi kerak");
    this.name = "ClinicResolutionError";
  }
}

export interface ResolveClinicSlugInput {
  inputClinic?: string | null;
  defaultClinicSlug?: string | null;
}

export function resolveClinicSlug(input: ResolveClinicSlugInput): string {
  const fromInput = input.inputClinic?.trim();
  if (fromInput) return normalizeClinicSlug(fromInput);

  const fromEnv = input.defaultClinicSlug?.trim();
  if (fromEnv) return normalizeClinicSlug(fromEnv);

  throw new ClinicResolutionError();
}
