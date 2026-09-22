import { z } from "zod";

/** Ekran 6 "Kassa" — smena. Tahlil B1, `src/domain/cashSession.ts`. */
export const cashSessionSchema = z.object({
  id: z.string(),
  clinicId: z.string(),
  openedBy: z.string(),
  openedAt: z.string(),
  openingFloat: z.string(),
  closedBy: z.string().nullable(),
  closedAt: z.string().nullable(),
  expectedCash: z.string().nullable(),
  countedCash: z.string().nullable(),
  diff: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
});
export type CashSession = z.infer<typeof cashSessionSchema>;

export const openCashSessionSchema = z.object({
  openingFloat: z.number().min(0, "Boshlang'ich qoldiq manfiy bo'lishi mumkin emas").default(0),
});
export type OpenCashSessionInput = z.infer<typeof openCashSessionSchema>;

export const closeCashSessionSchema = z.object({
  countedCash: z.number().min(0, "Sanalgan naqd manfiy bo'lishi mumkin emas"),
  note: z.string().optional(),
});
export type CloseCashSessionInput = z.infer<typeof closeCashSessionSchema>;
