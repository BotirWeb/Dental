import { z } from "zod";

/** Ekran 6 "Kassa" (xizmat tanlash) va ekran 11 "Xizmat va narxlar" (hali qurilmagan CRUD) uchun. */
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
