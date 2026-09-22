import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { app } from "../app";
import { db } from "../../db/client";
import { sessions } from "../../db/schema";
import {
  TEST_ORIGIN_HEADERS,
  cleanupClinic,
  createTestClinic,
  createTestUser,
  loginAs,
  sessionTokenFromCookie,
  type TestClinic,
} from "../../testing/helpers";

/**
 * Ekran 12 "Foydalanuvchilar". Bu yerda T3'da tayyorlangan, lekin hech
 * qayerdan chaqirilmagan ikkita narsa birinchi marta ishlaydi:
 * `validatePassword` va `deleteAllSessionsForUser`.
 */
describe("Foydalanuvchilar (ekran 12)", () => {
  let clinic: TestClinic;
  let ownerCookie: string;
  let ownerId: string;
  let adminCookie: string;

  beforeAll(async () => {
    clinic = await createTestClinic();
    const owner = await createTestUser(clinic.id, { role: "owner" });
    ownerId = owner.id;
    const admin = await createTestUser(clinic.id, { role: "admin" });
    ({ cookie: ownerCookie } = await loginAs(clinic.slug, owner.login, owner.password));
    ({ cookie: adminCookie } = await loginAs(clinic.slug, admin.login, admin.password));
  });

  afterAll(async () => {
    await cleanupClinic(clinic.id);
  });

  function post(path: string, cookie: string, body: unknown) {
    return app.request(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        "Idempotency-Key": crypto.randomUUID(),
        ...TEST_ORIGIN_HEADERS,
      },
      body: JSON.stringify(body),
    });
  }

  function patch(path: string, cookie: string, body: unknown) {
    return app.request(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie, ...TEST_ORIGIN_HEADERS },
      body: JSON.stringify(body),
    });
  }

  it("admin (owner emas) foydalanuvchilar ro'yxatiga kira olmaydi -> 403", async () => {
    const res = await app.request("/api/users", { headers: { Cookie: adminCookie } });
    expect(res.status).toBe(403);
  });

  it("zaif parol bilan yaratish -> 400 (validatePassword ishlaydi)", async () => {
    const res = await post("/api/users", ownerCookie, {
      login: "yangi-xodim",
      password: "12345678",
      fullName: "Yangi Xodim",
      role: "cashier",
    });
    expect(res.status).toBe(400);
  });

  it("login klinika kodi bilan bir xil parol -> 400", async () => {
    const res = await post("/api/users", ownerCookie, {
      login: "yangi-xodim2",
      password: clinic.slug,
      fullName: "Yangi Xodim",
      role: "cashier",
    });
    expect(res.status).toBe(400);
  });

  let newUserId: string;
  const newUserLogin = "yangi-kassir";

  it("to'g'ri parol bilan foydalanuvchi yaratiladi, login trim+lowercase qilinadi", async () => {
    const res = await post("/api/users", ownerCookie, {
      login: `  ${newUserLogin.toUpperCase()}  `,
      password: "KuchliParol123",
      fullName: "Yangi Kassir",
      role: "cashier",
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; login: string };
    expect(body.login).toBe(newUserLogin);
    newUserId = body.id;
  });

  it("band login bilan yana yaratishga urinish -> 409", async () => {
    const res = await post("/api/users", ownerCookie, {
      login: newUserLogin,
      password: "YanaBirParol123",
      fullName: "Boshqa Odam",
      role: "admin",
    });
    expect(res.status).toBe(409);
  });

  it("yangi foydalanuvchi kira oladi", async () => {
    const { status } = await loginAs(clinic.slug, newUserLogin, "KuchliParol123");
    expect(status).toBe(200);
  });

  it("rol o'zgartiriladi", async () => {
    const res = await patch(`/api/users/${newUserId}`, ownerCookie, { role: "admin" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { role: string };
    expect(body.role).toBe("admin");
  });

  it("owner o'zini faolsizlantira olmaydi -> 400", async () => {
    const res = await patch(`/api/users/${ownerId}`, ownerCookie, { isActive: false });
    expect(res.status).toBe(400);
  });

  it("deaktivatsiya qilinganda barcha sessiyalari o'chadi (T3, deleteAllSessionsForUser)", async () => {
    const { cookie } = await loginAs(clinic.slug, newUserLogin, "KuchliParol123");
    const token = sessionTokenFromCookie(cookie);
    const beforeRows = await db.select().from(sessions).where(eq(sessions.id, token));
    expect(beforeRows).toHaveLength(1);

    const res = await patch(`/api/users/${newUserId}`, ownerCookie, { isActive: false });
    expect(res.status).toBe(200);

    const afterRows = await db.select().from(sessions).where(eq(sessions.id, token));
    expect(afterRows).toHaveLength(0);

    const meRes = await app.request("/api/auth/me", { headers: { Cookie: cookie } });
    expect(meRes.status).toBe(401);
  });

  it("faollashtirilgach yana kira oladi", async () => {
    const res = await patch(`/api/users/${newUserId}`, ownerCookie, { isActive: true });
    expect(res.status).toBe(200);
    const { status } = await loginAs(clinic.slug, newUserLogin, "KuchliParol123");
    expect(status).toBe(200);
  });

  it("parol tiklanganda ham barcha sessiyalar o'chadi", async () => {
    const { cookie } = await loginAs(clinic.slug, newUserLogin, "KuchliParol123");
    const token = sessionTokenFromCookie(cookie);

    const res = await post(`/api/users/${newUserId}/reset-password`, ownerCookie, { password: "YangiParol456" });
    expect(res.status).toBe(204);

    const afterRows = await db.select().from(sessions).where(eq(sessions.id, token));
    expect(afterRows).toHaveLength(0);

    const oldLogin = await loginAs(clinic.slug, newUserLogin, "KuchliParol123");
    expect(oldLogin.status).toBe(401);
    const newLogin = await loginAs(clinic.slug, newUserLogin, "YangiParol456");
    expect(newLogin.status).toBe(200);
  });
});
