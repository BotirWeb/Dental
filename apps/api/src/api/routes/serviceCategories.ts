import { Hono } from "hono";
import { zValidate as zValidator } from "../validate";
import { eq } from "drizzle-orm";
import { createServiceCategorySchema } from "@dental/shared";
import { db } from "../../db/client";
import { serviceCategories } from "../../db/schema";
import { toPercentInput } from "../../db/columns";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import { recordAudit } from "../audit";
import type { AppVariables } from "../context";

/** Ekran 11 "Xizmat va narxlar" — kategoriyalar. Rol: owner (`screens.ts`). */
export const serviceCategoryRoutes = new Hono<{ Variables: AppVariables }>();

serviceCategoryRoutes.use("*", requireAuth);

serviceCategoryRoutes.get("/", async (c) => {
  const user = c.get("user");
  const rows = await db.select().from(serviceCategories).where(eq(serviceCategories.clinicId, user.clinicId));
  return c.json(rows);
});

serviceCategoryRoutes.post("/", requireRole("owner"), zValidator("json", createServiceCategorySchema), async (c) => {
  const user = c.get("user");
  const input = c.req.valid("json");

  const [created] = await db
    .insert(serviceCategories)
    .values({ clinicId: user.clinicId, name: input.name, defaultDoctorPct: toPercentInput(input.defaultDoctorPct) })
    .returning();

  await recordAudit({
    clinicId: user.clinicId,
    userId: user.id,
    entity: "service_categories",
    entityId: created.id,
    action: "create",
    newValue: created,
  });

  return c.json(created, 201);
});
