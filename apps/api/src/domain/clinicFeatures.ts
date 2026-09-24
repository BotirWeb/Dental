import { CLINIC_FEATURES, type ClinicFeatures } from "@dental/shared";

/**
 * `clinics.features` (jsonb) xom qiymatini to'liq, ishonchli obyektga
 * aylantiradi. CLAUDE.md qoida 7: yangi modul feature flag ortida — va u
 * DEFAULT O'CHIQ. Shuning uchun faqat aniq `true` yoqilgan hisoblanadi:
 * kalit yo'q, `null`, `"true"` (matn), `1` — hammasi `false`.
 *
 * jsonb'ga qo'lda SQL bilan yozilishi mumkin (hozircha sozlamalar ekrani
 * yo'q), shuning uchun kutilmagan shakl xato tashlamaydi — shunchaki o'chiq.
 * Noma'lum kalitlar tashlab yuboriladi (frontendga faqat ma'lum flag'lar).
 */
export function resolveClinicFeatures(raw: unknown): ClinicFeatures {
  const source = raw !== null && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const resolved = {} as ClinicFeatures;
  for (const feature of CLINIC_FEATURES) {
    resolved[feature] = source[feature] === true;
  }
  return resolved;
}
