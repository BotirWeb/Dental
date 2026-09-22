import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { doctors } from "../../db/schema";
import { requireAuth } from "../middleware/auth";
import type { AppVariables } from "../context";

/** Ekran 2/5 uchun — faol shifokorlar ro'yxati (klinika ichida). */
export const doctorRoutes = new Hono<{ Variables: AppVariables }>();

doctorRoutes.use("*", requireAuth);

doctorRoutes.get("/", async (c) => {
  const user = c.get("user");
  const rows = await db
    .select()
    .from(doctors)
    .where(and(eq(doctors.clinicId, user.clinicId), eq(doctors.isActive, true)));
  return c.json(rows);
});
