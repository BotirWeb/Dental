import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { beforeEach } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// `dotenv/config` (app.ts va h.k. ishlatadigan) faqat `.env`ni o'qiydi —
// bu yerda ATAYLAB alohida `.env.test` (qollanma: dev/prod baza bilan
// aralashmasin).
loadEnv({ path: path.resolve(dirname, "../../.env.test") });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL topilmadi. `apps/api/.env.test` yarating (`.env.test.example` asosida) " +
      "yoki DATABASE_URL'ni to'g'ridan-to'g'ri muhitga belgilang.",
  );
}

/**
 * XAVFSIZLIK QULFI: bu testlar haqiqiy yozadi/o'chiradi (klinika, foydalanuvchi,
 * bemor, sessiya). DATABASE_URL nomida "test" so'zi bo'lmasa — ishga
 * tushirilmaydi, aks holda tasodifan dev/prod bazani tozalab qo'yish xavfi bor.
 */
if (!/test/i.test(connectionString)) {
  throw new Error(
    `Integratsiya testlar faqat nomida "test" so'zi bor DATABASE_URL bilan ishlaydi ` +
      `(masalan .../dental_test). Hozirgi: ${connectionString}`,
  );
}

const pool = new Pool({ connectionString });
await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
await migrate(drizzle(pool), { migrationsFolder: path.resolve(dirname, "../db/migrations") });
await pool.end();

/**
 * Login rate-limit (`middleware/rateLimit.ts`) jarayon xotirasida — bitta
 * `singleFork` jarayonda BARCHA test fayllari bo'ylab saqlanib qoladi.
 * Testlar orasida tozalanmasa, ko'p login qiladigan testlar (T2 fayli)
 * haqiqiy urinishlar bilan bir xil hisoblagichni band qilib, kutilmagan
 * 429 qaytaradi. Har test OLDIDAN tozalanadi.
 */
const { resetRateLimit } = await import("../api/middleware/rateLimit");
beforeEach(() => {
  resetRateLimit();
});
