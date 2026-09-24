import { z } from "zod";

/**
 * Klinika darajasidagi feature flag'lar (CLAUDE.md qoida 7: "Yangi modul
 * feature flag ortida"). DB'da `clinics.features` (jsonb) — bu yerdagi har
 * kalit yo'q bo'lsa `false` hisoblanadi (yangi modul default o'chiq).
 *
 * Frontendga `/auth/me` orqali TO'LIQ (har kalit boolean) holatda keladi —
 * xom jsonb'ni tozalash backend'da (`apps/api/src/domain/clinicFeatures.ts`).
 */
export const CLINIC_FEATURES = [
  /** T5: tish kartasi (odontogramma) — `docs/tasks/2026-09-24-odontogram.md`. */
  "odontogram",
] as const;
export type ClinicFeature = (typeof CLINIC_FEATURES)[number];

export const clinicFeaturesSchema = z.object({
  odontogram: z.boolean(),
});
export type ClinicFeatures = z.infer<typeof clinicFeaturesSchema>;
