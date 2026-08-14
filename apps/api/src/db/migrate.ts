import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

/**
 * Migratsiyani ishga tushirish. Qollanma bo'lim 9, qoida 5: "Migratsiya
 * faqat oldinga." — bu skript hech qachon eski migratsiyani o'zgartirmaydi,
 * faqat src/db/migrations/'dagi yangi fayllarni qo'llaydi.
 *
 * pgcrypto — gen_random_uuid() uchun kerak (uuid primary key default'lari).
 */
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL topilmadi — .env faylini tekshiring.");
  }

  const pool = new Pool({ connectionString });
  await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "./src/db/migrations" });

  console.log("Migratsiya muvaffaqiyatli qo'llandi.");
  await pool.end();
}

main().catch((err) => {
  console.error("Migratsiya xato bilan tugadi:", err);
  process.exit(1);
});
