import { z } from "zod";
import { DISCOUNT_TYPES } from "../enums";

/** Ekran 6 — vizitda bajarilgan xizmat qatori. Tamoyil #2: narx/foiz snapshot. */
export const performedServiceSchema = z.object({
  id: z.string(),
  clinicId: z.string(),
  visitId: z.string(),
  serviceId: z.string(),
  /** Ko'rsatish uchun — `GET /api/visits/:id` join orqali qo'shadi. */
  serviceName: z.string().optional(),
  doctorId: z.string(),
  tooth: z.number().nullable(),
  surfaces: z.string().nullable(),
  qty: z.number(),
  priceSnapshot: z.string(),
  discountType: z.enum(DISCOUNT_TYPES),
  discountValue: z.string(),
  discountAmount: z.string(),
  doctorPctSnapshot: z.string(),
  materialCostSnapshot: z.string(),
  labCost: z.string(),
  isWarranty: z.boolean(),
  createdAt: z.string(),
});
export type PerformedService = z.infer<typeof performedServiceSchema>;

/**
 * `doctorId` bu yerda YO'Q — MVP soddalashtirishi: xizmatni bajaruvchi doim
 * vizitning shifokori deb olinadi (`visits.doctorId`), snapshot o'shandan
 * olinadi. Sxema boshqa shifokorni ruxsat etadi (performed_services.doctor_id
 * mustaqil), lekin buni UI'da tanlash MVP qamroviga kiritilmadi.
 */
export const createPerformedServiceSchema = z.object({
  serviceId: z.string().min(1, "Xizmat tanlanishi shart"),
  /** FDI tish raqami — ixtiyoriy (umumiy konsultatsiya kabi tishga bog'liq bo'lmagan xizmatlar uchun). */
  tooth: z.number().int().min(11).max(85).optional(),
  surfaces: z.string().optional(),
  qty: z.number().int().min(1).default(1),
  discountType: z.enum(DISCOUNT_TYPES).default("amount"),
  discountValue: z.number().min(0).default(0),
  isWarranty: z.boolean().default(false),
});
export type CreatePerformedServiceInput = z.infer<typeof createPerformedServiceSchema>;
