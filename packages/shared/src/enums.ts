/**
 * Umumiy enum'lar — backend (Drizzle sxema) va frontend bir xil qiymatlarni
 * ishlatishi uchun. Bu yerda o'zgartirilgan qiymat ikki tomonda ham darhol
 * ko'rinadi (bitta manba — "single source of truth").
 *
 * Qollanma bo'lim 5 va 6 asosida.
 */

/** Foydalanuvchi roli. Qollanma bo'lim 6: "Rollar" jadvali. */
export const USER_ROLES = ["owner", "admin", "doctor", "cashier"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Yozuv (appointment) holati — REJA. Qollanma bo'lim 5. */
export const APPOINTMENT_STATUSES = [
  "planned",
  "confirmed",
  "arrived",
  "done",
  "no_show",
  "cancelled_patient",
  "cancelled_clinic",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** To'lov usuli. Qollanma bo'lim 5: payments.method. */
export const PAYMENT_METHODS = ["cash", "card", "payme", "click", "transfer"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * Shifokor foizi qanday hisoblanadi — OCHIQ SAVOL (bo'lim 13):
 * "Shifokor foizi tushumdanmi yoki material ayirilgandan keyinmi?"
 *
 * Javob hali yo'q, shuning uchun klinika darajasida SOZLANADIGAN qilib
 * qo'yilgan — kodga hardcode qilinmagan. Dala ishi/suhbatdan keyin
 * har bir klinika o'ziga mosini tanlaydi (yoki keyinchalik service_category
 * darajasiga tushirish mumkin, hozircha MVP uchun klinika darajasi yetadi).
 *
 * - "gross"          → foiz to'liq narxdan (price_snapshot * qty) olinadi
 * - "after_material" → foiz (price_snapshot * qty - material_cost_snapshot) dan olinadi
 */
export const DOCTOR_PCT_BASES = ["gross", "after_material"] as const;
export type DoctorPctBasis = (typeof DOCTOR_PCT_BASES)[number];

/** Xarajat kategoriyasi — MVP'da erkin matn emas, lekin ro'yxat sozlamadan keladi.
 * Skeleton bosqichida faqat tip sifatida qoldiramiz, DB'da free-text + category jadvali
 * keyinroq (7,11-ekran ishi bilan birga) qo'shiladi. */
export type ExpenseCategory = string;
