import { z } from "zod";
import { isValidUzPhone, normalizePhone } from "../phone";

/**
 * Ekran 5 (Yozuv modal) va ekran 4 (Bemor kartasi) uchun asos.
 * Faza 1, hafta 3-4 ishi shu sxema ustiga quriladi — hozircha faqat
 * "yaratish" va "qidirish" (skeletni isbotlash uchun namuna slice).
 */
export const createPatientSchema = z.object({
  fullName: z.string().min(2, "F.I.Sh kamida 2 ta belgi"),
  /**
   * Tahlil C2: raqam har xil ko'rinishda kiritiladi, lekin bazada kanonik
   * 9 raqam saqlanadi. Xato xabari harakatga chorlovchi (tahlil, Pog'ona 0).
   */
  phone: z
    .string()
    .trim()
    .refine(isValidUzPhone, "Telefon 9 xonadan iborat bo'lsin: 90 123 45 67"),
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
  phoneNormalized: z.string(),
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

/**
 * Yangi bemor qo'shishda dublikat OGOHLANTIRISHI (tahlil C3).
 * Qattiq taqiq emas — O'zbekistonda oila a'zolari bitta raqamdan
 * foydalanadi (ona va bola). Admin ko'radi va o'zi qaror qiladi.
 */
export const duplicateWarningSchema = z.object({
  duplicates: z.array(
    z.object({ id: z.string(), fullName: z.string(), phone: z.string() }),
  ),
});
export type DuplicateWarning = z.infer<typeof duplicateWarningSchema>;

/** Qidiruvda foydalanish uchun: kiritilgan matn telefonga o'xshaydimi? */
export function looksLikePhone(q: string): boolean {
  const digits = q.replace(/\D+/g, "");
  return digits.length >= 3 && digits.length >= q.trim().length - 4;
}

export { normalizePhone };
