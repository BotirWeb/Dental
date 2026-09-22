import { z } from "zod";

/** Ekran 2 "Jadval" — kreslo ustunlari. */
export const chairSchema = z.object({
  id: z.string(),
  clinicId: z.string(),
  name: z.string(),
  isActive: z.boolean(),
});
export type Chair = z.infer<typeof chairSchema>;
