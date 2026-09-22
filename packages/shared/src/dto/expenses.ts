import { z } from "zod";

/** Ekran 7 "Xarajatlar". Kategoriya — MVP'da erkin matn (bo'lim 5, `ExpenseCategory`). */
export const expenseSchema = z.object({
  id: z.string(),
  clinicId: z.string(),
  category: z.string(),
  amount: z.string(),
  spentAt: z.string(),
  isRecurring: z.boolean(),
  note: z.string().nullable(),
  receiptUrl: z.string().nullable(),
  createdBy: z.string(),
  createdAt: z.string(),
});
export type Expense = z.infer<typeof expenseSchema>;

export const createExpenseSchema = z.object({
  category: z.string().trim().min(1, "Kategoriya kiritilishi shart"),
  amount: z.number().positive("Summa musbat bo'lishi kerak"),
  spentAt: z.string().min(1, "Sana kiritilishi shart"),
  isRecurring: z.boolean().default(false),
  note: z.string().optional(),
  receiptUrl: z.string().optional(),
});
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const expensesQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});
export type ExpensesQuery = z.infer<typeof expensesQuerySchema>;
