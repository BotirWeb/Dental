/**
 * Qollanma bo'lim 9, qoida 4: "Vaqt — UTC saqlanadi, Asia/Tashkent da
 * ko'rsatiladi." Backend har doim UTC ISO-satr qaytaradi (timestamptz);
 * ko'rsatishda BU YERDA, faqat shu bitta joyda, Asia/Tashkent'ga o'giramiz.
 */
const dateTimeFormatter = new Intl.DateTimeFormat("uz-UZ", {
  timeZone: "Asia/Tashkent",
  dateStyle: "medium",
  timeStyle: "short",
});

const dateFormatter = new Intl.DateTimeFormat("uz-UZ", {
  timeZone: "Asia/Tashkent",
  dateStyle: "medium",
});

const timeFormatter = new Intl.DateTimeFormat("uz-UZ", {
  timeZone: "Asia/Tashkent",
  timeStyle: "short",
});

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

/** Faqat vaqt (masalan "14:30") — ekran 2 "Jadval" katakchalari uchun. */
export function formatTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
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
