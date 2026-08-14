import { numeric, timestamp } from "drizzle-orm/pg-core";

/**
 * Umumiy ustun helperlari — qollanma bo'lim 9 (Kod qoidalari) ni bir joyda
 * majburlash uchun:
 *   qoida 3 — "Pul — integer (tiyin emas, so'm). Float ishlatilmaydi. numeric(14,0)."
 *   qoida 4 — "Vaqt — UTC saqlanadi, Asia/Tashkent da ko'rsatiladi."
 *
 * `timestamptz` Postgres'da ichkarida har doim UTC saqlaydi — biz faqat
 * frontendda ko'rsatishda Asia/Tashkent'ga o'giramiz (apps/web/src/lib/time.ts).
 *
 * MUHIM: drizzle-orm 0.36'da `numeric` ustuni har doim JS tomonida STRING
 * sifatida ifodalanadi (float xatosidan qochish uchun aynan shunday —
 * Postgres numeric'ni JS number'ga to'g'ridan-to'g'ri aylantirish xavfli).
 * Shuning uchun DB chegarasida (insert/select) `toMoneyInput`/`fromMoney`
 * orqali aylantiramiz; domain qatlami (src/domain) esa har doim oddiy
 * `number` bilan ishlaydi — ikkalasi aralashib ketmasin.
 */

export const money = (name: string) => numeric(name, { precision: 14, scale: 0 });

/** Foiz ustuni (masalan shifokor foizi): 0.00–999.99 oralig'ida, kasr bilan. */
export const percent = (name: string) => numeric(name, { precision: 5, scale: 2 });

export const createdAtCol = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
export const deletedAtCol = () => timestamp("deleted_at", { withTimezone: true });

/** DB'ga yozishdan oldin: number -> money ustuni kutgan string (butun so'm). */
export function toMoneyInput(value: number): string {
  return Math.round(value).toString();
}

/** DB'dan o'qishdan keyin: money ustunining string qiymati -> number.
 * 14 xona limit JS Number.MAX_SAFE_INTEGER'dan kichik, shuning uchun xavfsiz. */
export function fromMoney(value: string): number {
  return Number(value);
}

/** DB'ga yozishdan oldin: number -> percent ustuni kutgan string (2 xonagacha kasr). */
export function toPercentInput(value: number): string {
  return value.toFixed(2);
}

export function fromPercent(value: string): number {
  return Number(value);
}
