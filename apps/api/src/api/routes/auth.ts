import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { loginRequestSchema } from "@dental/shared";
import { db } from "../../db/client";
import { users } from "../../db/schema";
import { verifyPassword } from "../auth/password";
import { createSession, deleteSession } from "../auth/session";
import { requireAuth, SESSION_COOKIE_NAME } from "../middleware/auth";
import type { AppVariables } from "../context";

export const authRoutes = new Hono<{ Variables: AppVariables }>();

const isProd = process.env.NODE_ENV === "production";
const cookieSecure = (process.env.SESSION_COOKIE_SECURE ?? String(isProd)) === "true";

/** Ekran 1 (bo'lim 6): "login + parol". Rol tanlanmaydi — login orqali topiladi. */
authRoutes.post("/login", zValidator("json", loginRequestSchema), async (c) => {
  const { login, password } = c.req.valid("json");

  const rows = await db.select().from(users).where(eq(users.login, login)).limit(1);
  const user = rows[0];

  // Login topilmasa ham, topilib parol xato bo'lsa ham BIR XIL xabar —
  // qaysi login mavjudligini tashqi so'rovchi bilmasin.
  if (!user || !user.isActive || user.deletedAt) {
    return c.json({ error: "Login yoki parol xato" }, 401);
  }

  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) {
    return c.json({ error: "Login yoki parol xato" }, 401);
  }

  const { token, expiresAt } = await createSession(user.id);

  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: "Lax",
    path: "/",
    expires: expiresAt,
  });

  return c.json({
    id: user.id,
    clinicId: user.clinicId,
    login: user.login,
    fullName: user.fullName,
    role: user.role,
  });
});

authRoutes.post("/logout", requireAuth, async (c) => {
  const token = getCookie(c, SESSION_COOKIE_NAME);
  if (token) {
    await deleteSession(token);
  }
  deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });

  return c.body(null, 204);
});

authRoutes.get("/me", requireAuth, async (c) => {
  return c.json(c.get("user"));
});
