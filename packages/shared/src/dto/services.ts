import { z } from "zod";

/** Ekran 6 "Kassa" (xizmat tanlash) va ekran 11 "Xizmat va narxlar" (CRUD) uchun. */
export const serviceSchema = z.object({
  id: z.string(),
  clinicId: z.string(),
  categoryId: z.string().nullable(),
  code: z.string().nullable(),
  name: z.string(),
  /** money — numeric(14,0), DB'dan JSON orqali STRING sifatida keladi. */
  price: z.string(),
  durationMin: z.number().nullable(),
  materialCost: z.string(),
  isActive: z.boolean(),
});
export type Service = z.infer<typeof serviceSchema>;

export const createServiceSchema = z.object({
  categoryId: z.string().optional(),
  code: z.string().optional(),
  name: z.string().trim().min(1, "Nomi kiritilishi shart"),
  price: z.number().min(0, "Narx manfiy bo'lishi mumkin emas"),
  durationMin: z.number().int().positive().optional(),
  materialCost: z.number().min(0).default(0),
});
export type CreateServiceInput = z.infer<typeof createServiceSchema>;

export const updateServiceSchema = z.object({
  categoryId: z.string().optional(),
  code: z.string().optional(),
  name: z.string().trim().min(1).optional(),
  price: z.number().min(0).optional(),
  durationMin: z.number().int().positive().optional(),
  materialCost: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
