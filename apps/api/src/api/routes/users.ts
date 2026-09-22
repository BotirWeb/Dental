import { Hono } from "hono";
import { zValidate as zValidator } from "../validate";
import { and, eq, isNull } from "drizzle-orm";
import { createUserSchema, normalizeLogin, resetPasswordSchema, updateUserSchema } from "@dental/shared";
import { db } from "../../db/client";
import { users } from "../../db/schema";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import { idempotency } from "../middleware/idempotency";
import { recordAudit } from "../audit";
import { hashPassword } from "../auth/password";
import { deleteAllSessionsForUser } from "../auth/session";
import { validatePassword } from "../../domain/password";
import type { AppVariables } from "../context";

/**
 * Ekran 12 "Foydalanuvchilar" — faqat owner (`screens.ts`). Bu yerda T3'da
 * tayyorlab qo'yilgan, lekin hech qayerdan chaqirilmagan ikkita narsa
 * birinchi marta ishga tushadi:
 *   - `validatePassword` (`src/domain/password.ts`) — parol yaratish/
 *     tiklashda.
 *   - `deleteAllSessionsForUser` (`src/api/auth/session.ts`) — deaktivatsiya
 *     va parol tiklashda (T3, tahlil D2: "parol o'zgarsa sessiyalar o'chadi").
 */
export const userRoutes = new Hono<{ Variables: AppVariables }>();

userRoutes.use("*", requireAuth);
userRoutes.use("*", requireRole("owner"));

userRoutes.get("/", async (c) => {
  const user = c.get("user");
  const rows = await db
    .select({
      id: users.id,
      clinicId: users.clinicId,
      login: users.login,
      fullName: users.fullName,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.clinicId, user.clinicId), isNull(users.deletedAt)));
  return c.json(rows);
});

userRoutes.post("/", idempotency(), zValidator("json", createUserSchema), async (c) => {
  const user = c.get("user");
  const input = c.req.valid("json");
  const login = normalizeLogin(input.login);

  const passwordError = validatePassword({ password: input.password, login, clinicSlug: user.clinicSlug });
  if (passwordError) return c.json({ error: passwordError }, 400);

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.clinicId, user.clinicId), eq(users.login, login), isNull(users.deletedAt)))
    .limit(1);
  if (existing[0]) return c.json({ error: "Bu login band — boshqasini tanlang" }, 409);

  const passwordHash = await hashPassword(input.password);
  const [created] = await db
    .insert(users)
    .values({ clinicId: user.clinicId, login, passwordHash, fullName: input.fullName, role: input.role })
    .returning({
      id: users.id,
      clinicId: users.clinicId,
      login: users.login,
      fullName: users.fullName,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    });

  await recordAudit({
    clinicId: user.clinicId,
    userId: user.id,
    entity: "users",
    entityId: created.id,
    action: "create",
    newValue: created,
  });

  return c.json(created, 201);
});

userRoutes.patch("/:id", zValidator("json", updateUserSchema), async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const input = c.req.valid("json");

  if (id === user.id && input.isActive === false) {
    return c.json({ error: "O'zingizni faolsizlantira olmaysiz" }, 400);
  }

  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), eq(users.clinicId, user.clinicId), isNull(users.deletedAt)))
    .limit(1);
  const existing = rows[0];
  if (!existing) return c.json({ error: "Foydalanuvchi topilmadi" }, 404);

  const [updated] = await db
    .update(users)
    .set({ fullName: input.fullName, role: input.role, isActive: input.isActive })
    .where(eq(users.id, id))
    .returning({
      id: users.id,
      clinicId: users.clinicId,
      login: users.login,
      fullName: users.fullName,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    });

  /** Deaktivatsiya — barcha sessiyalari darhol o'chadi (T3, tahlil D2). */
  if (input.isActive === false) {
    await deleteAllSessionsForUser(id);
  }

  await recordAudit({
    clinicId: user.clinicId,
    userId: user.id,
    entity: "users",
    entityId: id,
    action: "update",
    oldValue: { ...existing, passwordHash: "[yashirilgan]" },
    newValue: updated,
  });

  return c.json(updated);
});

/** Parolni tiklash — owner boshqa foydalanuvchi uchun (MVP'da o'z-o'ziga xizmat oqimi yo'q). */
userRoutes.post("/:id/reset-password", zValidator("json", resetPasswordSchema), async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const { password } = c.req.valid("json");

  const rows = await db
    .select({ id: users.id, login: users.login })
    .from(users)
    .where(and(eq(users.id, id), eq(users.clinicId, user.clinicId), isNull(users.deletedAt)))
    .limit(1);
  const existing = rows[0];
  if (!existing) return c.json({ error: "Foydalanuvchi topilmadi" }, 404);

  const passwordError = validatePassword({ password, login: existing.login, clinicSlug: user.clinicSlug });
  if (passwordError) return c.json({ error: passwordError }, 400);

  const passwordHash = await hashPassword(password);
  await db.update(users).set({ passwordHash }).where(eq(users.id, id));

  /** Parol o'zgardi — barcha sessiyalari o'chadi (T3, tahlil D2). */
  await deleteAllSessionsForUser(id);

  await recordAudit({
    clinicId: user.clinicId,
    userId: user.id,
    entity: "users",
    entityId: id,
    action: "update",
    newValue: { passwordChanged: true },
  });

  return c.body(null, 204);
});
