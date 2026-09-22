import { createMiddleware } from "hono/factory";
import type { AppVariables } from "../context";

/**
 * ORIGIN TEKSHIRUVI — tahlil D2 / T3.
 *
 * `hono/csrf` faqat FORM-content-type so'rovlarni (`application/
 * x-www-form-urlencoded`, `multipart/form-data`, `text/plain`) tekshiradi —
 * sabab: faqat shu turlar oddiy HTML `<form>` orqali CORS preflight'siz
 * yuborilishi mumkin. Bizning API butunlay `application/json` bilan ishlaydi
 * (`apps/web/src/lib/api.ts`) — shuning uchun `hono/csrf`ni to'g'ridan-to'g'ri
 * qo'llash HECH NARSANI tekshirmas edi (soxta xotirjamlik). O'rniga: har bir
 * holat o'zgartiruvchi (GET/HEAD/OPTIONS'dan boshqa) so'rovda Origin (yoki
 * zamonaviy brauzerlarda `Sec-Fetch-Site`) aniq tekshiriladi, content-type'dan
 * qat'i nazar.
 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export interface CsrfOptions {
  /**
   * Ruxsat etilgan origin'lar ro'yxati (`ALLOWED_ORIGINS` env). Bo'sh bo'lsa
   * — faqat so'rov o'zi yo'nalgan origin (Host header'dan hisoblangan)
   * ruxsat etiladi — bo'lim 3.3 "bitta origin" holatiga mos.
   */
  allowedOrigins: string[];
}

export function csrfProtection(opts: CsrfOptions) {
  return createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
    if (SAFE_METHODS.has(c.req.method)) {
      return next();
    }

    // Zamonaviy brauzer har bir fetch'da yuboradi — proksi (Vite/Caddy) Host
    // header'ni qayta yozsa ham, brauzer buni SAHIFA origin'i nuqtai
    // nazaridan hisoblaydi, shuning uchun Origin header'dan ko'ra ishonchli.
    if (c.req.header("sec-fetch-site") === "same-origin") {
      return next();
    }

    const origin = c.req.header("origin");
    if (origin) {
      const allowed =
        opts.allowedOrigins.length > 0 ? opts.allowedOrigins.includes(origin) : origin === new URL(c.req.url).origin;
      if (allowed) return next();
    }

    return c.json({ error: "Ruxsat etilmagan manba (Origin)" }, 403);
  });
}
