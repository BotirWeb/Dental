import { defineConfig } from "drizzle-kit";
import "dotenv/config";

/**
 * drizzle-kit konfiguratsiyasi.
 * Qollanma bo'lim 9, qoida 5: "Migratsiya faqat oldinga. Har o'zgarish alohida fayl."
 * -> shuning uchun migration fayllarini qo'lda o'chirish/tahrirlash TAQIQLANADI,
 *    faqat yangi migratsiya qo'shiladi.
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://dental_app:dental_app@localhost:5432/dental_dev",
  },
  strict: true,
  verbose: true,
});
