import { z } from "zod";

/** Ekran 2 "Jadval" va ekran 5 "Yozuv modal" uchun — shifokorlar ro'yxati. */
export const doctorSchema = z.object({
  id: z.string(),
  clinicId: z.string(),
  fullName: z.string(),
  specialty: z.string().nullable(),
  isActive: z.boolean(),
});
export type Doctor = z.infer<typeof doctorSchema>;
