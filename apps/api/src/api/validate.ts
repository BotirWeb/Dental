import { zValidator as honoZValidator } from "@hono/zod-validator";
import type { ZodTypeAny } from "zod";

/**
 * `@hono/zod-validator`ning STANDART xatosi `{ error: ZodError }` shaklida —
 * `ZodError` OBYEKT, matn EMAS. Loyihaning boshqa hamma joyida
 * `c.json({ error: "matn" }, ...)` qoidasiga amal qilinadi (`lib/api.ts`
 * frontendda `body.error`ni to'g'ridan-to'g'ri matn sifatida ko'rsatadi) —
 * shu farq sabab frontendda "[object Object]" chiqadi.
 *
 * Bu wrapper birinchi Zod xatosini O'ZBEK TILIDAGI (sxemada yozilgan) matn
 * qilib qaytaradi. `zValidator` o'rniga BARCHA route'larda shu ishlatiladi.
 */
export function zValidate<T extends ZodTypeAny>(target: Parameters<typeof honoZValidator>[0], schema: T) {
  return honoZValidator(target, schema, (result, c) => {
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? "Ma'lumot noto'g'ri";
      return c.json({ error: message }, 400);
    }
  });
}
