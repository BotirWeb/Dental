import { Hono } from "hono";
import { zValidate as zValidator } from "../validate";
import { and, eq, isNull } from "drizzle-orm";
import { createPaymentSchema, voidPaymentSchema } from "@dental/shared";
import { db } from "../../db/client";
import { cashSessions, payments } from "../../db/schema";
import { toMoneyInput } from "../../db/columns";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import { idempotency } from "../middleware/idempotency";
import { recordAudit } from "../audit";
import { buildReversal, PaymentReversalError } from "../../domain/payments";
import type { AppVariables } from "../context";

/**
 * Ekran 6 — to'lov. Tamoyil #3: `visit_id` NULLABLE (avans). Rol: faqat
 * owner/admin/cashier (pul — shifokor emas, `visits.ts` boshidagi izohga
 * qarang).
 */
export const paymentRoutes = new Hono<{ Variables: AppVariables }>();

paymentRoutes.use("*", requireAuth);

paymentRoutes.post(
  "/",
  requireRole("owner", "admin", "cashier"),
  idempotency(),
  zValidator("json", createPaymentSchema),
  async (c) => {
    const user = c.get("user");
    const input = c.req.valid("json");

    let cashSessionId: string | undefined;
    if (input.method === "cash") {
      const openRows = await db
        .select({ id: cashSessions.id })
        .from(cashSessions)
        .where(and(eq(cashSessions.clinicId, user.clinicId), isNull(cashSessions.closedAt), isNull(cashSessions.deletedAt)))
        .limit(1);
      if (!openRows[0]) {
        return c.json({ error: "Ochiq kassa smenasi yo'q — avval smenani oching" }, 409);
      }
      cashSessionId = openRows[0].id;
    }

    const [created] = await db
      .insert(payments)
      .values({
        clinicId: user.clinicId,
        patientId: input.patientId,
        amount: toMoneyInput(input.amount),
        method: input.method,
        paidAt: new Date(),
        visitId: input.visitId,
        cashSessionId,
        createdBy: user.id,
        note: input.note,
      })
      .returning();

    await recordAudit({
      clinicId: user.clinicId,
      userId: user.id,
      entity: "payments",
      entityId: created.id,
      action: "create",
      newValue: created,
    });

    return c.json(created, 201);
  },
);

/** Noto'g'ri to'lovni tuzatish — tahlil A3, `src/domain/payments.ts` (`buildReversal`). */
paymentRoutes.post("/:id/void", requireRole("owner", "admin"), zValidator("json", voidPaymentSchema), async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const { reason } = c.req.valid("json");

  const rows = await db
    .select()
    .from(payments)
    .where(and(eq(payments.id, id), eq(payments.clinicId, user.clinicId), isNull(payments.deletedAt)))
    .limit(1);
  const original = rows[0];
  if (!original) return c.json({ error: "To'lov topilmadi" }, 404);

  let draft;
  try {
    draft = buildReversal(
      { id: original.id, amount: Number(original.amount), reversalOfId: original.reversalOfId, voidedAt: original.voidedAt },
      { byUserId: user.id, reason },
    );
  } catch (err) {
    if (err instanceof PaymentReversalError) return c.json({ error: err.message }, 400);
    throw err;
  }

  const [reversal] = await db.transaction(async (tx) => {
    const [insertedReversal] = await tx
      .insert(payments)
      .values({
        clinicId: user.clinicId,
        patientId: original.patientId,
        amount: toMoneyInput(draft.insert.amount),
        method: original.method,
        paidAt: new Date(),
        visitId: original.visitId,
        cashSessionId: original.cashSessionId,
        createdBy: user.id,
        note: draft.insert.note,
        reversalOfId: draft.insert.reversalOfId,
      })
      .returning();

    await tx
      .update(payments)
      .set(draft.markOriginal)
      .where(eq(payments.id, original.id));

    return [insertedReversal];
  });

  await recordAudit({
    clinicId: user.clinicId,
    userId: user.id,
    entity: "payments",
    entityId: original.id,
    action: "update",
    oldValue: original,
    newValue: { ...original, ...draft.markOriginal },
  });
  await recordAudit({
    clinicId: user.clinicId,
    userId: user.id,
    entity: "payments",
    entityId: reversal.id,
    action: "create",
    newValue: reversal,
  });

  return c.json(reversal, 201);
});
