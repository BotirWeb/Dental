import { z } from "zod";

/**
 * Login so'rovi. Qollanma bo'lim 6, ekran 1: "login + parol".
 * Ekran 1 rol-erkin — hamma shu bilan kiradi.
 */
export const loginRequestSchema = z.object({
  login: z.string().min(1, "Login talab qilinadi"),
  password: z.string().min(1, "Parol talab qilinadi"),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

/** /auth/me javobi — frontendga hozirgi foydalanuvchi va roli haqida. */
export const meResponseSchema = z.object({
  id: z.string(),
  clinicId: z.string(),
  login: z.string(),
  fullName: z.string(),
  role: z.enum(["owner", "admin", "doctor", "cashier"]),
});
export type MeResponse = z.infer<typeof meResponseSchema>;
