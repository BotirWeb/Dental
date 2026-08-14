import { z } from "zod";

/**
 * Ekran 5 (Yozuv modal) va ekran 4 (Bemor kartasi) uchun asos.
 * Faza 1, hafta 3-4 ishi shu sxema ustiga quriladi — hozircha faqat
 * "yaratish" va "qidirish" (skeletni isbotlash uchun namuna slice).
 */
export const createPatientSchema = z.object({
  fullName: z.string().min(2, "F.I.Sh kamida 2 ta belgi"),
  phone: z.string().min(7, "Telefon raqam noto'g'ri"),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD formatida").optional(),
  gender: z.enum(["male", "female"]).optional(),
  source: z.string().optional(),
  consentMessaging: z.boolean().default(false),
  consentData: z.boolean().default(false),
  notes: z.string().optional(),
});
export type CreatePatientInput = z.infer<typeof createPatientSchema>;

export const patientSchema = z.object({
  id: z.string(),
  clinicId: z.string(),
  fullName: z.string(),
  phone: z.string(),
  birthDate: z.string().nullable(),
  gender: z.string().nullable(),
  source: z.string().nullable(),
  consentMessaging: z.boolean(),
  consentData: z.boolean(),
  notes: z.string().nullable(),
  createdAt: z.string(),
});
export type Patient = z.infer<typeof patientSchema>;

export const searchPatientsQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
});
