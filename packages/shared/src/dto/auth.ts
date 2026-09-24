import { z } from "zod";
import { clinicFeaturesSchema } from "./features";

/**
 * Login so'rovi. Qollanma bo'lim 6, ekran 1 / bo'lim 5.2 "users" (T2, tahlil
 * C4): endi klinika kodi ham kerak — bitta shifokor bir nechta klinikada
 * ishlashi mumkin, login esa faqat klinika ICHIDA noyob.
 *
 * `clinic` ixtiyoriy: bo'sh bo'lsa, backend `DEFAULT_CLINIC_SLUG` env'ni
 * ishlatadi (bitta klinikali kichik joylashuv uchun) — ikkalasi ham bo'lmasa
 * 400 (`apps/api/src/domain/auth.ts`, `resolveClinicSlug`).
 */
export const loginRequestSchema = z.object({
  clinic: z.string().trim().min(1).optional(),
  login: z.string().min(1, "Login talab qilinadi"),
  password: z.string().min(1, "Parol talab qilinadi"),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

/** `/auth/me` va login javobidagi klinika ma'lumoti — login ekranida "eslab qolish" uchun ham kerak. */
export const clinicInfoSchema = z.object({
  slug: z.string(),
  name: z.string(),
});
export type ClinicInfo = z.infer<typeof clinicInfoSchema>;

/** `/auth/me` javobi — frontendga hozirgi foydalanuvchi, roli va klinikasi haqida. */
export const meResponseSchema = z.object({
  id: z.string(),
  clinicId: z.string(),
  login: z.string(),
  fullName: z.string(),
  role: z.enum(["owner", "admin", "doctor", "cashier"]),
  clinic: clinicInfoSchema,
  /** Klinikada yoqilgan modullar (CLAUDE.md qoida 7) — navigatsiya/tugmalarni ko'rsatish uchun. */
  features: clinicFeaturesSchema,
});
export type MeResponse = z.infer<typeof meResponseSchema>;
