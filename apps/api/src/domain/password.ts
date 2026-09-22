/**
 * PAROL SIYOSATI — tahlil D2 / T3.
 *
 * SOF FUNKSIYA (qollanma bo'lim 9, qoida 1). Test MAJBURIY.
 *
 * ⚠️ HALI HECH QAYERDA CHAQIRILMAYDI: foydalanuvchi yaratish/parol
 * o'zgartirish endpoint'i hali qurilmagan (ekran 12 "Foydalanuvchilar",
 * bo'lim 7 — todo). Bu funksiya o'sha endpoint yozilganda tayyor turishi
 * uchun oldindan chiqarilgan — `validateDiscount` naqshini takrorlaydi
 * (`src/domain/discount.ts`): xato tashlamaydi, foydalanuvchiga
 * ko'rsatiladigan matn yoki `null` (hammasi joyida) qaytaradi.
 *
 * Talab: kamida 10 belgi, login bilan bir xil emas, kichik taqiq ro'yxati.
 * Katta harf/maxsus belgi talabi YO'Q — O'zbekistondagi kichik klinika
 * xodimlari uchun eslab qolish qulayligi muhimroq (uzunlik entropiyani
 * belgidan ko'ra ko'proq beradi).
 */

export const MIN_PASSWORD_LENGTH = 10;

/** Eng ko'p uchraydigan zaif parollar — to'liq ro'yxat emas, faqat aniq holatlar. */
const COMMON_PASSWORDS = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "qwerty123",
  "password",
  "password1",
  "parol123",
  "admin123",
  "11111111",
  "00000000",
]);

export interface ValidatePasswordInput {
  password: string;
  login: string;
  /** Klinika kodi — shu ham taqiqlangan (osonlikcha topiladigan). */
  clinicSlug?: string;
}

/** Yaroqlilikni tekshiradi. `null` = hammasi joyida, aks holda xato matni (foydalanuvchiga ko'rsatiladi). */
export function validatePassword(input: ValidatePasswordInput): string | null {
  const { password, login, clinicSlug } = input;

  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Parol kamida ${MIN_PASSWORD_LENGTH} belgidan iborat bo'lsin`;
  }

  const lower = password.toLowerCase();

  if (lower === login.trim().toLowerCase()) {
    return "Parol login bilan bir xil bo'lmasin";
  }

  if (clinicSlug && lower === clinicSlug.trim().toLowerCase()) {
    return "Parol klinika kodi bilan bir xil bo'lmasin";
  }

  if (COMMON_PASSWORDS.has(lower)) {
    return "Bu parol juda oddiy va taniqli — boshqasini tanlang";
  }

  return null;
}
