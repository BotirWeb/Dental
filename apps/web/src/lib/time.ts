/**
 * Qollanma bo'lim 9, qoida 4: "Vaqt — UTC saqlanadi, Asia/Tashkent da
 * ko'rsatiladi." Backend har doim UTC ISO-satr qaytaradi (timestamptz);
 * ko'rsatishda BU YERDA, faqat shu bitta joyda, Asia/Tashkent'ga o'giramiz.
 *
 * Format: 24.09.2026 / 24.09.2026 14:30 / 14:30 (kun.oy.yil, 24 soat).
 *
 * `Intl.DateTimeFormat("uz-UZ", { dateStyle })` ATAYLAB ishlatilmaydi:
 * Chrome o'zbek tili ma'lumotlarisiz (qisqartirilgan ICU) keladi va
 * "2026 M09 24" chiqaradi, Node esa "24-sen, 2026" — bir kod, ikki natija.
 * Shuning uchun Intl faqat vaqt zonasini hisoblashga (raqamlar) ishlatiladi,
 * satr esa shu yerda yig'iladi — har brauzerda bir xil.
 */
const tashkentParts = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Tashkent",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  // h23: yarim tun "00:05" (ba'zi dvigatellar hour12:false bilan "24:05" beradi).
  hourCycle: "h23",
});

function partsOf(iso: string): Record<"day" | "month" | "year" | "hour" | "minute", string> {
  const parts = tashkentParts.formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return { day: get("day"), month: get("month"), year: get("year"), hour: get("hour"), minute: get("minute") };
}

/** "24.09.2026 14:30" */
export function formatDateTime(iso: string): string {
  const p = partsOf(iso);
  return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`;
}

/** "24.09.2026" */
export function formatDate(iso: string): string {
  const p = partsOf(iso);
  return `${p.day}.${p.month}.${p.year}`;
}

/** Faqat vaqt (masalan "14:30") — ekran 2 "Jadval" katakchalari uchun. */
export function formatTime(iso: string): string {
  const p = partsOf(iso);
  return `${p.hour}:${p.minute}`;
}

/** Joriy oy — `<input type="month">` qiymati (masalan "2026-09"). Ekran 9/10. */
export function currentMonthInputValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** `<input type="month">` qiymatidan [from, to) oralig'ini hisoblaydi — ekran 9/10. */
export function monthRange(monthValue: string): { from: string; to: string } {
  const [year, month] = monthValue.split("-").map(Number);
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 1);
  return { from: from.toISOString(), to: to.toISOString() };
}
