import { z } from "zod";

/** Ekran 6 "Kassa / vizit yakuni". Tamoyil #1 — appointments (reja) dan alohida, FAKT. */
export const visitSchema = z.object({
  id: z.string(),
  clinicId: z.string(),
  appointmentId: z.string().nullable(),
  patientId: z.string(),
  doctorId: z.string(),
  chairId: z.string().nullable(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
});
export type Visit = z.infer<typeof visitSchema>;

export const createVisitSchema = z.object({
  patientId: z.string().min(1, "Bemor tanlanishi shart"),
  doctorId: z.string().min(1, "Shifokor tanlanishi shart"),
  chairId: z.string().optional(),
  /** Ekran 2'dagi rejalashtirilgan yozuv bilan bog'lash — ixtiyoriy (kelib qolgan bemor ham bo'lishi mumkin). */
  appointmentId: z.string().optional(),
  note: z.string().optional(),
});
export type CreateVisitInput = z.infer<typeof createVisitSchema>;
