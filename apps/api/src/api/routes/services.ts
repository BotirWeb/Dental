import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { services } from "../../db/schema";
import { requireAuth } from "../middleware/auth";
import type { AppVariables } from "../context";

/** Ekran 6 "Kassa" (xizmat tanlash) uchun — faol xizmatlar ro'yxati. To'liq CRUD — ekran 11, hali yo'q. */
export const serviceRoutes = new Hono<{ Variables: AppVariables }>();

serviceRoutes.use("*", requireAuth);

serviceRoutes.get("/", async (c) => {
  const user = c.get("user");
  const rows = await db
    .select()
    .from(services)
    .where(and(eq(services.clinicId, user.clinicId), eq(services.isActive, true)));
  return c.json(rows);
});
