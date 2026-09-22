import { z } from "zod";

/** Umumiy davr so'rovi — ekran 9/10. `from`/`to` ISO sana/timestamp. */
export const reportPeriodQuerySchema = z.object({
  from: z.string().min(1, "Boshlanish sanasi shart"),
  to: z.string().min(1, "Tugash sanasi shart"),
});
export type ReportPeriodQuery = z.infer<typeof reportPeriodQuerySchema>;

export const dailyReportQuerySchema = z.object({
  date: z.string().min(1, "Sana shart"),
});
export type DailyReportQuery = z.infer<typeof dailyReportQuerySchema>;

/** Ekran 8 "Kunlik hisobot". */
export const dailyReportSchema = z.object({
  date: z.string(),
  revenue: z.number(),
  doctorEarnings: z.number(),
  materialCost: z.number(),
  margin: z.number(),
  paymentsByMethod: z.record(z.string(), z.number()),
  totalPayments: z.number(),
  expenses: z.number(),
  visitsCount: z.number(),
  cashSession: z
    .object({
      id: z.string(),
      openedAt: z.string(),
      closedAt: z.string().nullable(),
      expectedCash: z.string().nullable(),
      countedCash: z.string().nullable(),
      diff: z.string().nullable(),
    })
    .nullable(),
});
export type DailyReport = z.infer<typeof dailyReportSchema>;

/** Ekran 9 "Oylik marja" — bo'lim 1: asosiy farqlanish nuqtasi. */
export const marginByCategorySchema = z.object({
  categoryId: z.string().nullable(),
  categoryName: z.string(),
  revenue: z.number(),
  doctorEarnings: z.number(),
  materialCost: z.number(),
  labCost: z.number(),
  margin: z.number(),
});
export type MarginByCategory = z.infer<typeof marginByCategorySchema>;

export const marginReportSchema = z.object({
  from: z.string(),
  to: z.string(),
  revenue: z.number(),
  doctorEarnings: z.number(),
  materialCost: z.number(),
  labCost: z.number(),
  margin: z.number(),
  expenses: z.number(),
  netProfit: z.number(),
  byCategory: z.array(marginByCategorySchema),
});
export type MarginReport = z.infer<typeof marginReportSchema>;

/** Ekran 10 "Shifokor hisobi". */
export const doctorReportRowSchema = z.object({
  doctorId: z.string(),
  doctorName: z.string(),
  servicesCount: z.number(),
  revenue: z.number(),
  doctorEarnings: z.number(),
});
export type DoctorReportRow = z.infer<typeof doctorReportRowSchema>;
