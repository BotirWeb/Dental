import { z } from "zod";
import { PAYMENT_METHODS } from "../enums";

/** Ekran 6 — to'lov. Tamoyil #3: vizitga 1:1 bog'lanmaydi (avans mumkin). */
export const paymentSchema = z.object({
  id: z.string(),
  clinicId: z.string(),
  patientId: z.string(),
  amount: z.string(),
  method: z.enum(PAYMENT_METHODS),
  paidAt: z.string(),
  visitId: z.string().nullable(),
  cashSessionId: z.string().nullable(),
  createdBy: z.string(),
  note: z.string().nullable(),
  reversalOfId: z.string().nullable(),
  voidedAt: z.string().nullable(),
  voidedBy: z.string().nullable(),
  voidReason: z.string().nullable(),
  createdAt: z.string(),
});
export type Payment = z.infer<typeof paymentSchema>;

export const createPaymentSchema = z.object({
  patientId: z.string().min(1, "Bemor tanlanishi shart"),
  /** Ixtiyoriy — avans bo'lsa vizitga bog'lanmaydi. */
  visitId: z.string().optional(),
  amount: z.number().positive("Summa musbat bo'lishi kerak"),
  method: z.enum(PAYMENT_METHODS),
  note: z.string().optional(),
});
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export const voidPaymentSchema = z.object({
  reason: z.string().min(3, "Bekor qilish sababi kamida 3 belgi bo'lsin"),
});
export type VoidPaymentInput = z.infer<typeof voidPaymentSchema>;
