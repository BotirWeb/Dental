import { z } from "zod";
import { USER_ROLES } from "../enums";

/** Ekran 12 "Foydalanuvchilar" — faqat owner. */
export const userSchema = z.object({
  id: z.string(),
  clinicId: z.string(),
  login: z.string(),
  fullName: z.string(),
  role: z.enum(USER_ROLES),
  isActive: z.boolean(),
  createdAt: z.string(),
});
export type UserDto = z.infer<typeof userSchema>;

export const createUserSchema = z.object({
  login: z.string().trim().min(1, "Login kiritilishi shart"),
  password: z.string().min(1, "Parol kiritilishi shart"),
  fullName: z.string().trim().min(1, "F.I.Sh kiritilishi shart"),
  role: z.enum(USER_ROLES),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  fullName: z.string().trim().min(1).optional(),
  role: z.enum(USER_ROLES).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const resetPasswordSchema = z.object({
  password: z.string().min(1, "Parol kiritilishi shart"),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
