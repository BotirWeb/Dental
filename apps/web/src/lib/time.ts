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
