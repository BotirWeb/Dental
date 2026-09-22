import { z } from "zod";

/** `GET /api/patients/:id/balance` javobi — `src/domain/patientBalance.ts` natijasi. */
export const patientBalanceSchema = z.object({
  charged: z.number(),
  paid: z.number(),
  balance: z.number(),
  debt: z.number(),
  advance: z.number(),
});
export type PatientBalanceDto = z.infer<typeof patientBalanceSchema>;
