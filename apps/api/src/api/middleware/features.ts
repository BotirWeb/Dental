import { createMiddleware } from "hono/factory";
import type { ClinicFeature } from "@dental/shared";
import type { AppVariables } from "../context";

const FEATURE_LABELS: Record<ClinicFeature, string> = {
  odontogram: "Tish kartasi",
};

/**
 * CLAUDE.md qoida 7: "Yangi modul feature flag ortida". Klinikada modul
 * yoqilmagan bo'lsa — 404 (modul umuman yo'qdek), tugmani yashirish esa
 * frontendda (`/auth/me` → `features`). Faqat UI'da yashirish yetmaydi:
 * API to'g'ridan-to'g'ri chaqirilishi mumkin.
 *
 * `requireAuth`dan KEYIN turishi shart (`c.get("user").features` kerak).
 */
export const requireFeature = (feature: ClinicFeature) =>
  createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
    if (!c.get("user").features[feature]) {
      return c.json({ error: `"${FEATURE_LABELS[feature]}" moduli bu klinikada yoqilmagan` }, 404);
    }
    await next();
  });
