import type { UserRole } from "@dental/shared";

/**
 * Auth qilingan foydalanuvchi haqida so'rov davomida kerak bo'ladigan
 * minimal ma'lumot. Har bir himoyalangan route shu orqali clinic_id'ni
 * oladi — qo'lda hech qachon so'rov tanasidan/parametridan clinic_id
 * o'qilmaydi (xavfsizlik: bemor boshqa klinika ma'lumotini so'ray olmasin).
 */
export interface AuthUser {
  id: string;
  clinicId: string;
  login: string;
  fullName: string;
  role: UserRole;
}

export type AppVariables = {
  user: AuthUser;
};
