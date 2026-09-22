/**
 * Telefon raqam normalizatsiyasi — O'zbekiston.
 *
 * MUAMMO (tahlil C1-C3): bitta odam bazaga uch xil yozilishi mumkin —
 * "+998901234567", "901234567", "90 123 45 67". Normalizatsiyasiz:
 *   1. qidiruv ishlamaydi (ekran 3 talabi "tez" bajarilmaydi),
 *   2. bitta bemor ikki karta bilan yuradi, tarixi bo'linadi.
 *
 * YECHIM: `patients.phone_normalized` — har doim 9 raqam (operator kodi +
 * raqam, masalan "901234567"). Foydalanuvchi kiritgan asl matn `phone` da
 * saqlanib qoladi (u chekda/hujjatda qanday yozilgan bo'lsa).
 *
 * Bu funksiya SOF — backend ham, frontend ham bir xil natija beradi
 * (qollanma bo'lim 9, qoida 1).
 */

/** O'zbekiston mamlakat kodi. */
const UZ_COUNTRY_CODE = "998";

/** Milliy raqam uzunligi: operator/hudud kodi (2) + raqam (7) = 9. */
export const UZ_PHONE_LENGTH = 9;

/**
 * Faqat raqamlarni qoldiradi: "+998 (90) 123-45-67" -> "998901234567".
 */
export function digitsOnly(raw: string): string {
  return raw.replace(/\D+/g, "");
}

/**
 * Kanonik ko'rinishga keltiradi — 9 raqamli milliy raqam.
 *
 *   "+998901234567"   -> "901234567"
 *   "998901234567"    -> "901234567"
 *   "8 90 123 45 67"  -> "901234567"   (eski "8" prefiksi)
 *   "90 123 45 67"    -> "901234567"
 *   "71 123 45 67"    -> "711234567"   (Toshkent shahar raqami)
 *
 * Agar raqam tanib bo'lmaydigan uzunlikda bo'lsa — ma'lumot YO'QOTILMAYDI,
 * tozalangan raqamlar qanday bo'lsa shundayligicha qaytariladi. Yaroqliligini
 * `isValidUzPhone` alohida tekshiradi (validatsiya va saqlash ajratilgan:
 * eski bazadan ko'chirilgan g'alati raqam ham saqlanishi kerak).
 */
export function normalizePhone(raw: string): string {
  let d = digitsOnly(raw);

  // "998..." — mamlakat kodi bilan
  if (d.length === UZ_PHONE_LENGTH + UZ_COUNTRY_CODE.length && d.startsWith(UZ_COUNTRY_CODE)) {
    return d.slice(UZ_COUNTRY_CODE.length);
  }

  // "8..." — sovet davridan qolgan shaharlararo prefiks
  if (d.length === UZ_PHONE_LENGTH + 1 && d.startsWith("8")) {
    d = d.slice(1);
  }

  return d;
}

/** Normalizatsiyadan keyin raqam yaroqlimi (roppa-rosa 9 raqam). */
export function isValidUzPhone(raw: string): boolean {
  return normalizePhone(raw).length === UZ_PHONE_LENGTH;
}

/**
 * Ko'rsatish uchun chiroyli format: "901234567" -> "+998 90 123 45 67".
 * Yaroqsiz raqam bo'lsa asl matn qaytariladi (ko'r-ko'rona buzmaymiz).
 */
export function formatUzPhone(raw: string): string {
  const d = normalizePhone(raw);
  if (d.length !== UZ_PHONE_LENGTH) return raw;
  return `+${UZ_COUNTRY_CODE} ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`;
}
