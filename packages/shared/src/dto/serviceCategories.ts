import { z } from "zod";

/** Ekran 11 "Xizmat va narxlar" — xizmatlarni guruhlash + shifokor foizi standarti. */
export const serviceCategorySchema = z.object({
  id: z.string(),
  clinicId: z.string(),
  name: z.string(),
  defaultDoctorPct: z.string(),
});
export type ServiceCategory = z.infer<typeof serviceCategorySchema>;

export const createServiceCategorySchema = z.object({
  name: z.string().trim().min(1, "Nomi kiritilishi shart"),
  defaultDoctorPct: z.number().min(0).max(100).default(0),
});
export type CreateServiceCategoryInput = z.infer<typeof createServiceCategorySchema>;
