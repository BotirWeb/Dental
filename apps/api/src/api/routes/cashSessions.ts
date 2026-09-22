import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq, isNull } from "drizzle-orm";
import { closeCashSessionSchema, openCashSessionSchema } from "@dental/shared";
import { db } from "../../db/client";
import { cashSessions, payments } from "../../db/schema";
import { toMoneyInput, fromMoney } from "../../db/columns";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import { recordAudit } from "../audit";
import { closeCashSession, type CashSessionCloseInput } from "../../domain/cashSession";
import type { AppVariables } from "../context";

/**
 * Ekran 6 "Kassa" — smena. Tahlil B1: naqd to'lovlar ochiq smenaga
 * bog'lanadi (`payments.cash_session_id`), yopishda tizim (`expected_cash`)
 * va qo'lda sanalgan (`counted_cash`) solishtiriladi. Rol jadvali (ekran 6):
 * owner/admin/cashier.
 */
export const cashSessionRoutes = new Hono<{ Variables: AppVariables }>();

cashSessionRoutes.use("*", requireAuth);

/** Bugun/hozir ochiq smena — yo'q bo'lsa `null` (bu XATO emas, normal holat). */
cashSessionRoutes.get("/current", async (c) => {
  const user = c.get("user");
  const rows = await db
    .select()
    .from(cashSessions)
    .where(and(eq(cashSessions.clinicId, user.clinicId), isNull(cashSessions.closedAt), isNull(cashSessions.deletedAt)))
    .limit(1);
  return c.json(rows[0] ?? null);
});

cashSessionRoutes.post("/", requireRole("owner", "admin", "cashier"), zValidator("json", openCashSessionSchema), async (c) => {
  const user = c.get("user");
  const input = c.req.valid("json");

  const existing = await db
    .select({ id: cashSessions.id })
    .from(cashSessions)
    .where(and(eq(cashSessions.clinicId, user.clinicId), isNull(cashSessions.closedAt), isNull(cashSessions.deletedAt)))
    .limit(1);
  if (existing[0]) {
    return c.json({ error: "Ochiq smena allaqachon bor — avval uni yoping" }, 409);
  }

  const [created] = await db
    .insert(cashSessions)
    .values({ clinicId: user.clinicId, openedBy: user.id, openingFloat: toMoneyInput(input.openingFloat) })
    .returning();

  await recordAudit({
    clinicId: user.clinicId,
    userId: user.id,
    entity: "cash_sessions",
    entityId: created.id,
    action: "create",
    newValue: created,
  });

  return c.json(created, 201);
});

cashSessionRoutes.patch(
  "/:id/close",
  requireRole("owner", "admin", "cashier"),
  zValidator("json", closeCashSessionSchema),
  async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const input = c.req.valid("json");

    const rows = await db
      .select()
      .from(cashSessions)
      .where(and(eq(cashSessions.id, id), eq(cashSessions.clinicId, user.clinicId), isNull(cashSessions.deletedAt)))
      .limit(1);
    const session = rows[0];
    if (!session) return c.json({ error: "Smena topilmadi" }, 404);
    if (session.closedAt) return c.json({ error: "Smena allaqachon yopilgan" }, 409);

    const cashRows = await db
      .select({
        id: payments.id,
        amount: payments.amount,
        method: payments.method,
        cashSessionId: payments.cashSessionId,
        reversalOfId: payments.reversalOfId,
        voidedAt: payments.voidedAt,
      })
      .from(payments)
      .where(and(eq(payments.clinicId, user.clinicId), eq(payments.cashSessionId, id), isNull(payments.deletedAt)));

    const closeInput: CashSessionCloseInput = {
      openingFloat: fromMoney(session.openingFloat),
      payments: cashRows.map((p) => ({ ...p, amount: fromMoney(p.amount) })),
      countedCash: input.countedCash,
      cashSessionId: id,
    };
    const result = closeCashSession(closeInput);

    const [updated] = await db
      .update(cashSessions)
      .set({
        closedBy: user.id,
        closedAt: new Date(),
        expectedCash: toMoneyInput(result.expectedCash),
        countedCash: toMoneyInput(result.countedCash),
        diff: toMoneyInput(result.diff),
        note: input.note,
      })
      .where(eq(cashSessions.id, id))
      .returning();

    await recordAudit({
      clinicId: user.clinicId,
      userId: user.id,
      entity: "cash_sessions",
      entityId: id,
      action: "update",
      oldValue: session,
      newValue: updated,
    });

    return c.json(updated);
  },
);
