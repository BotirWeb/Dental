import { createMiddleware } from "hono/factory";
import type { UserRole } from "@dental/shared";
import type { AppVariables } from "../context";

/**
 * Rol tekshiruvi — qollanma bo'lim 6 "Rollar" jadvaliga asosan har route'ga
 * qo'llanadi. DIQQAT: bu middleware `requireAuth`dan KEYIN ishlashi shart
 * (c.get("user") requireAuth tomonidan to'ldiriladi).
 *
 * Masalan: shifokor boshqa shifokorning moliyaviy raqamini ko'rmasligi
 * kerak (bo'lim 6) — bu qoida route darajasida requireRole bilan emas,
 * query darajasida (doctorId = c.get("user").id) amalga oshiriladi; bu
 * middleware faqat "umuman shu ekranga kira oladimi" savoliga javob beradi.
 */
export const requireRole = (...allowed: UserRole[]) =>
  createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
    const user = c.get("user");
    if (!allowed.includes(user.role)) {
      return c.json({ error: "Bu amal uchun ruxsat yo'q" }, 403);
    }
    await next();
  });
