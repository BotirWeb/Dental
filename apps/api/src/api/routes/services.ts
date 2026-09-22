import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { createServiceSchema, updateServiceSchema } from "@dental/shared";
import { db } from "../../db/client";
import { services } from "../../db/schema";
import { toMoneyInput } from "../../db/columns";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import { recordAudit } from "../audit";
import type { AppVariables } from "../context";

/** Ekran 6 "Kassa" (xizmat tanlash) va ekran 11 "Xizmat va narxlar" (CRUD, owner) uchun. */
export const serviceRoutes = new Hono<{ Variables: AppVariables }>();

serviceRoutes.use("*", requireAuth);

const listQuerySchema = z.object({ includeInactive: z.enum(["true", "false"]).optional() });

/** Standart — faqat faol xizmatlar (Kassa uchun). `?includeInactive=true` — ekran 11 uchun hammasi. */
serviceRoutes.get("/", zValidator("query", listQuerySchema), async (c) => {
  const user = c.get("user");
  const { includeInactive } = c.req.valid("query");

  const conditions = [eq(services.clinicId, user.clinicId)];
  if (includeInactive !== "true") conditions.push(eq(services.isActive, true));

  const rows = await db
    .select()
    .from(services)
    .where(and(...conditions));
  return c.json(rows);
});

serviceRoutes.post("/", requireRole("owner"), zValidator("json", createServiceSchema), async (c) => {
  const user = c.get("user");
  const input = c.req.valid("json");

  const [created] = await db
    .insert(services)
    .values({
      clinicId: user.clinicId,
      categoryId: input.categoryId,
      code: input.code,
      name: input.name,
      price: toMoneyInput(input.price),
      durationMin: input.durationMin,
      materialCost: toMoneyInput(input.materialCost),
    })
    .returning();

  await recordAudit({
    clinicId: user.clinicId,
    userId: user.id,
    entity: "services",
    entityId: created.id,
    action: "create",
    newValue: created,
  });

  return c.json(created, 201);
});

/**
 * Tahrirlash — xizmat NARXI kelajakka nisbatan o'zgaradi, o'tgan
 * `performed_services.price_snapshot`ga ta'sir qilmaydi (Tamoyil #2, bo'lim
 * 5.1). Shuning uchun bu yerda UPDATE xavfsiz — tarix buzilmaydi.
 */
serviceRoutes.patch("/:id", requireRole("owner"), zValidator("json", updateServiceSchema), async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const input = c.req.valid("json");

  const rows = await db
    .select()
    .from(services)
    .where(and(eq(services.id, id), eq(services.clinicId, user.clinicId)))
    .limit(1);
  const existing = rows[0];
  if (!existing) return c.json({ error: "Xizmat topilmadi" }, 404);

  const [updated] = await db
    .update(services)
    .set({
      categoryId: input.categoryId,
      code: input.code,
      name: input.name,
      price: input.price !== undefined ? toMoneyInput(input.price) : undefined,
      durationMin: input.durationMin,
      materialCost: input.materialCost !== undefined ? toMoneyInput(input.materialCost) : undefined,
      isActive: input.isActive,
    })
    .where(eq(services.id, id))
    .returning();

  await recordAudit({
    clinicId: user.clinicId,
    userId: user.id,
    entity: "services",
    entityId: id,
    action: "update",
    oldValue: existing,
    newValue: updated,
  });

  return c.json(updated);
});
