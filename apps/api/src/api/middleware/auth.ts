import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { getUserBySessionToken } from "../auth/session";
import type { AppVariables } from "../context";

export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "dental_session";

/**
 * Har himoyalangan route'dan oldin ishlaydi. Cookie'dagi tokenni sessiyaga
 * aylantiradi va `c.set("user", ...)` orqali keyingi handler'larga uzatadi.
 *
 * clinic_id BU YERDAN keladi — route handler hech qachon so'rov
 * tanasi/parametridan clinic_id qabul qilmaydi (boshqa klinika ma'lumotini
 * so'rashning oldini olish uchun).
 */
export const requireAuth = createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE_NAME);
  if (!token) {
    return c.json({ error: "Tizimga kirilmagan" }, 401);
  }

  const user = await getUserBySessionToken(token);
  if (!user) {
    return c.json({ error: "Sessiya yaroqsiz yoki muddati o'tgan" }, 401);
  }

  c.set("user", user);
  await next();
});
