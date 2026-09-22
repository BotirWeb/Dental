import "dotenv/config";
import { db, pool } from "./client";
import { clinics, users, doctors, chairs, serviceCategories, services } from "./schema";
import { hashPassword } from "../api/auth/password";
import { toMoneyInput, toPercentInput } from "./columns";

/**
 * Lokal ishlab chiqish uchun boshlang'ich ma'lumot. PROD'da ishlatilmaydi.
 * Real klinika ma'lumoti — bo'lim 12 "Birinchi hafta" dala ishidan keyin.
 */
async function main() {
  const [clinic] = await db
    .insert(clinics)
    .values({ name: "Namuna Klinika", slug: "namuna-klinika", timezone: "Asia/Tashkent" })
    .returning();

  const credentials = [
    { login: "owner", password: "owner12345", fullName: "Klinika Egasi", role: "owner" as const },
    { login: "admin", password: "admin12345", fullName: "Administrator", role: "admin" as const },
    { login: "doctor", password: "doctor12345", fullName: "Shifokor Aliyev", role: "doctor" as const },
    { login: "cashier", password: "cashier12345", fullName: "Kassir", role: "cashier" as const },
  ];

  const createdUsers: Record<string, string> = {};
  for (const cred of credentials) {
    const passwordHash = await hashPassword(cred.password);
    const [user] = await db
      .insert(users)
      .values({
        clinicId: clinic.id,
        login: cred.login,
        passwordHash,
        fullName: cred.fullName,
        role: cred.role,
      })
      .returning();
    createdUsers[cred.role] = user.id;
  }

  await db.insert(doctors).values({
    clinicId: clinic.id,
    userId: createdUsers.doctor,
    fullName: "Shifokor Aliyev",
    specialty: "Terapevt",
    defaultPct: toPercentInput(40),
  });

  await db.insert(chairs).values([
    { clinicId: clinic.id, name: "1-kreslo" },
    { clinicId: clinic.id, name: "2-kreslo" },
  ]);

  const [category] = await db
    .insert(serviceCategories)
    .values({ clinicId: clinic.id, name: "Terapiya", defaultDoctorPct: toPercentInput(40) })
    .returning();

  await db.insert(services).values({
    clinicId: clinic.id,
    categoryId: category.id,
    code: "T-001",
    name: "Karies davolash (1 yuza)",
    price: toMoneyInput(350_000),
    durationMin: 40,
    materialCost: toMoneyInput(40_000),
  });

  console.log("Seed muvaffaqiyatli qo'llandi. Kirish uchun:");
  console.log(`  klinika kodi: ${clinic.slug}`);
  for (const cred of credentials) {
    console.log(`  ${cred.role.padEnd(8)} login: ${cred.login.padEnd(8)} parol: ${cred.password}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error("Seed xato bilan tugadi:", err);
  process.exit(1);
});
