import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { chairs } from "../../db/schema";
import { requireAuth } from "../middleware/auth";
import type { AppVariables } from "../context";

/** Ekran 2 uchun — faol kreslolar ro'yxati (klinika ichida), jadval ustunlari. */
export const chairRoutes = new Hono<{ Variables: AppVariables }>();

chairRoutes.use("*", requireAuth);

chairRoutes.get("/", async (c) => {
  const user = c.get("user");
  const rows = await db
    .select()
    .from(chairs)
    .where(and(eq(chairs.clinicId, user.clinicId), eq(chairs.isActive, true)));
  return c.json(rows);
});
