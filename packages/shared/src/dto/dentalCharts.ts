import { z } from "zod";
import type { UserRole } from "../enums";

/**
 * T5 "Tish kartasi" (odontogramma) — `docs/tasks/2026-09-24-odontogram.md`.
 *
 * Karta tarkibini `react-advanced-odontogram` kutubxonasi yaratadi
 * (`getStatusChart()` — `{version, globals, teeth, case?, plan?}`). Biz uni
 * JSON sifatida SAQLAYMIZ, har tishning ichki tuzilmasini talqin qilmaymiz —
 * u kutubxonaning formati (versiyalar orasida kutubxonaning o'zi migratsiya
 * qiladi). Bu yerda faqat tashqi qobiq tekshiriladi: versiya bor, tish
 * raqamlari to'g'ri FDI, har tish holati obyekt.
 */

/** Kim ko'radi / kim tahrirlaydi — backend `requireRole` va UI `readOnly` shu bitta manbadan. */
export const DENTAL_CHART_VIEW_ROLES: readonly UserRole[] = ["owner", "admin", "doctor"];
export const DENTAL_CHART_EDIT_ROLES: readonly UserRole[] = ["owner", "doctor"];

/**
 * Bitta karta JSON'ining yuqori chegarasi (bayt). Odatiy karta ~10–30 KB;
 * chegara faqat buzilgan/qasddan katta so'rovdan himoya.
 */
export const DENTAL_CHART_MAX_BYTES = 512 * 1024;

/**
 * FDI doimiy tish raqami: birinchi raqam — chorak (1–4), ikkinchi — o'rta
 * chiziqdan sanoq (1–8). Kutubxona sut tishini alohida raqam bilan emas,
 * shu 32 pozitsiyadagi tish HOLATI sifatida saqlaydi — shuning uchun 51–85
 * bu yerda kalit bo'lmaydi (`performed_services.tooth` dan farqli).
 */
export const FDI_PERMANENT_TOOTH_KEY = /^[1-4][1-8]$/;

const toothStateSchema = z.record(z.string(), z.unknown(), {
  invalid_type_error: "Har bir tish holati obyekt bo'lishi kerak",
});

const teethSchema = z.record(
  z.string().regex(FDI_PERMANENT_TOOTH_KEY, "Tish raqami FDI bo'yicha 11–48 oralig'ida bo'lishi kerak"),
  toothStateSchema,
  {
    required_error: "Kartada tishlar ro'yxati (teeth) yo'q",
    invalid_type_error: "Tishlar ro'yxati (teeth) obyekt bo'lishi kerak",
  },
);

export const dentalChartPayloadSchema = z
  .object(
    {
      version: z
        .string({ required_error: "Karta formati versiyasi (version) yo'q" })
        .trim()
        .min(1, "Karta formati versiyasi (version) bo'sh")
        .max(20, "Karta formati versiyasi juda uzun"),
      teeth: teethSchema,
      plan: teethSchema.optional(),
      globals: z.record(z.string(), z.unknown()).optional(),
      case: z.record(z.string(), z.unknown()).optional(),
    },
    {
      required_error: "Karta ma'lumoti (payload) yuborilmadi",
      invalid_type_error: "Karta ma'lumoti (payload) obyekt bo'lishi kerak",
    },
  )
  // Kutubxonaning keyingi versiyasi yangi yuqori darajali maydon qo'shsa,
  // u jimgina tashlab yuborilmasin — karta bir baytgacha qanday kelsa
  // shunday saqlanadi (hajm chegarasi `DENTAL_CHART_MAX_BYTES`).
  .passthrough();
export type DentalChartPayload = z.infer<typeof dentalChartPayloadSchema>;

export const saveDentalChartSchema = z.object({
  payload: dentalChartPayloadSchema,
  /**
   * Foydalanuvchi qaysi versiyani ochib tahrirlagan (`GET` javobidagi
   * `chart.id`, karta hali bo'lmasa `null`). Server oxirgi versiya bilan
   * solishtiradi — mos kelmasa 409 (boshqa kishi oraliqda saqlagan).
   */
  baseChartId: z.string().uuid("baseChartId UUID yoki null bo'lishi kerak").nullable(),
});
export type SaveDentalChartInput = z.infer<typeof saveDentalChartSchema>;

/** `GET /patients/:id/dental-chart` — oxirgi versiya. */
export const dentalChartSchema = z.object({
  id: z.string(),
  patientId: z.string(),
  payload: dentalChartPayloadSchema,
  payloadVersion: z.string(),
  createdAt: z.string(),
  createdBy: z.string(),
  createdByName: z.string(),
});
export type DentalChart = z.infer<typeof dentalChartSchema>;

export interface DentalChartResponse {
  /** Bemorda hali karta saqlanmagan bo'lsa `null`. */
  chart: DentalChart | null;
}

/**
 * `POST /patients/:id/dental-chart` javobi — karta tanasi QAYTARILMAYDI
 * (mijozda allaqachon bor; idempotentlik jadvaliga katta javob yozilmasin).
 */
export const savedDentalChartSchema = dentalChartSchema.omit({ payload: true });
export type SavedDentalChart = z.infer<typeof savedDentalChartSchema>;
