import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, gte, isNull, lt } from "drizzle-orm";
import { createExpenseSchema, expensesQuerySchema } from "@dental/shared";
import { db } from "../../db/client";
import { expenses } from "../../db/schema";
import { toMoneyInput } from "../../db/columns";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import { idempotency } from "../middleware/idempotency";
import { recordAudit } from "../audit";
import type { AppVariables } from "../context";

/** Ekran 7 "Xarajatlar". Rol jadvali: owner/admin (`screens.ts`). */
export const expenseRoutes = new Hono<{ Variables: AppVariables }>();

expenseRoutes.use("*", requireAuth);

expenseRoutes.get("/", zValidator("query", expensesQuerySchema), async (c) => {
  const user = c.get("user");
  const { from, to } = c.req.valid("query");

  const conditions = [eq(expenses.clinicId, user.clinicId), isNull(expenses.deletedAt)];
  if (from) conditions.push(gte(expenses.spentAt, new Date(from)));
  if (to) conditions.push(lt(expenses.spentAt, new Date(to)));

  const rows = await db
    .select()
    .from(expenses)
    .where(and(...conditions))
    .orderBy(desc(expenses.spentAt));

  return c.json(rows);
});

expenseRoutes.post(
  "/",
  requireRole("owner", "admin"),
  idempotency(),
  zValidator("json", createExpenseSchema),
  async (c) => {
    const user = c.get("user");
    const input = c.req.valid("json");

    const [created] = await db
      .insert(expenses)
      .values({
        clinicId: user.clinicId,
        category: input.category,
        amount: toMoneyInput(input.amount),
        spentAt: new Date(input.spentAt),
        isRecurring: input.isRecurring,
        note: input.note,
        receiptUrl: input.receiptUrl,
        createdBy: user.id,
      })
      .returning();

    await recordAudit({
      clinicId: user.clinicId,
      userId: user.id,
      entity: "expenses",
      entityId: created.id,
      action: "create",
      newValue: created,
    });

    return c.json(created, 201);
  },
);
