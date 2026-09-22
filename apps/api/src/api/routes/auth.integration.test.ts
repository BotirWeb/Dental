import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../app";
import { db } from "../../db/client";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";
import {
  TEST_ORIGIN_HEADERS,
  cleanupClinic,
  createTestClinic,
  createTestUser,
  loginAs,
  type TestClinic,
  type TestUser,
} from "../../testing/helpers";

/**
 * T2 (tahlil C4): klinika kodi + login, login klinika ICHIDA unique.
 * Qabul mezonlari — `docs/tasks/2026-09-22-tuzatishlar.md` T2 "Testlar".
 */
describe("auth — klinika ichida login (T2)", () => {
  let clinicA: TestClinic;
  let clinicB: TestClinic;
  let adminA: TestUser;
  let adminB: TestUser;

  beforeAll(async () => {
    clinicA = await createTestClinic();
    clinicB = await createTestClinic();
    // Ikkalasida ham AYNAN BIR XIL login — bu C4 ning asosiy sinovi.
    adminA = await createTestUser(clinicA.id, { login: "admin", role: "admin" });
    adminB = await createTestUser(clinicB.id, { login: "admin", role: "admin" });
  });

  afterAll(async () => {
    await cleanupClinic(clinicA.id);
    await cleanupClinic(clinicB.id);
  });

  it("ikkala klinikada bir xil login — har biri o'z klinikasiga kiradi", async () => {
    const a = await loginAs(clinicA.slug, adminA.login, adminA.password);
    const b = await loginAs(clinicB.slug, adminB.login, adminB.password);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect((a.body as { clinicId: string }).clinicId).toBe(clinicA.id);
    expect((b.body as { clinicId: string }).clinicId).toBe(clinicB.id);
    expect((a.body as { clinic: { slug: string } }).clinic.slug).toBe(clinicA.slug);
  });

  it("A klinika o'z bemorini ko'radi, B klinika bemorini QIDIRUVDA ko'rmaydi", async () => {
    const a = await loginAs(clinicA.slug, adminA.login, adminA.password);

    const createRes = await app.request("/api/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: a.cookie, "Idempotency-Key": crypto.randomUUID(), ...TEST_ORIGIN_HEADERS },
      body: JSON.stringify({ fullName: "Faqat A Klinika Bemori", phone: "901119911" }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { id: string };

    const b = await loginAs(clinicB.slug, adminB.login, adminB.password);
    const searchRes = await app.request("/api/patients?q=Faqat+A+Klinika", {
      headers: { Cookie: b.cookie },
    });
    const results = (await searchRes.json()) as unknown[];
    expect(results).toHaveLength(0);

    const byIdRes = await app.request(`/api/patients/${created.id}`, { headers: { Cookie: b.cookie } });
    expect(byIdRes.status).toBe(404);
  });

  it("o'chirilgan (soft-delete) foydalanuvchining logini yangi foydalanuvchiga berish mumkin", async () => {
    const oldLogin = `eski-${crypto.randomUUID().slice(0, 6)}`;
    const oldUser = await createTestUser(clinicA.id, { login: oldLogin, role: "admin", password: "EskiParolBirinchi1" });
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, oldUser.id));

    const newUser = await createTestUser(clinicA.id, { login: oldLogin, role: "admin", password: "YangiParolIkkinchi2" });

    const oldLoginRes = await loginAs(clinicA.slug, oldLogin, oldUser.password);
    expect(oldLoginRes.status).toBe(401);

    const newLoginRes = await loginAs(clinicA.slug, oldLogin, newUser.password);
    expect(newLoginRes.status).toBe(200);
  });

  it("uch xato holatda (noma'lum klinika, noma'lum login, noto'g'ri parol) javob bir xil", async () => {
    const unknownClinic = await loginAs("yoq-klinika-xyz", adminA.login, adminA.password);
    const unknownLogin = await loginAs(clinicA.slug, "yoq-foydalanuvchi-xyz", adminA.password);
    const wrongPassword = await loginAs(clinicA.slug, adminA.login, "NOTOGRIPAROL1");

    expect(unknownClinic.status).toBe(401);
    expect(unknownLogin.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    expect(unknownClinic.body).toEqual(unknownLogin.body);
    expect(unknownLogin.body).toEqual(wrongPassword.body);
  });

  it("A klinika admin bloklanishi B klinika adminga ta'sir qilmaydi", async () => {
    await db.update(users).set({ isActive: false }).where(eq(users.id, adminA.id));

    const a = await loginAs(clinicA.slug, adminA.login, adminA.password);
    const b = await loginAs(clinicB.slug, adminB.login, adminB.password);

    expect(a.status).toBe(401);
    expect(b.status).toBe(200);

    // keyingi testlar uchun tiklab qo'yamiz
    await db.update(users).set({ isActive: true }).where(eq(users.id, adminA.id));
  });
});
