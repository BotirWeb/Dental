import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { app } from "../app";
import { db } from "../../db/client";
import { sessions, users } from "../../db/schema";
import {
  cleanupClinic,
  createTestClinic,
  createTestUser,
  loginAs,
  sessionTokenFromCookie,
  type TestClinic,
  type TestUser,
} from "../../testing/helpers";

/**
 * T3 (tahlil D2): sessiya idle (12s, default) + absolyut (7k, default) muddati.
 * Vaqtni JS darajasida faylashtirib bo'lmaydi (DB `now()` haqiqiy vaqtdan
 * kelib chiqadi) — shuning uchun `last_activity_at`/`expires_at` to'g'ridan
 * to'g'ri DB'da orqaga suriladi (xuddi T3 hisobotida qo'lda qilingan curl
 * sinovi kabi, endi avtomatlashtirilgan).
 */
describe("session — idle/absolyut muddat (T3)", () => {
  let clinic: TestClinic;
  let user: TestUser;

  beforeAll(async () => {
    clinic = await createTestClinic();
    user = await createTestUser(clinic.id, { role: "owner" });
  });

  afterAll(async () => {
    await cleanupClinic(clinic.id);
  });

  it("yangi sessiya bilan /me -> 200", async () => {
    const { cookie, status } = await loginAs(clinic.slug, user.login, user.password);
    expect(status).toBe(200);

    const res = await app.request("/api/auth/me", { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
  });

  it("IDLE: 12 soatdan ortiq harakatsizlikdan keyin -> 401", async () => {
    const { cookie } = await loginAs(clinic.slug, user.login, user.password);
    const token = sessionTokenFromCookie(cookie);

    await db
      .update(sessions)
      .set({ lastActivityAt: new Date(Date.now() - 13 * 60 * 60 * 1000) })
      .where(eq(sessions.id, token));

    const res = await app.request("/api/auth/me", { headers: { Cookie: cookie } });
    expect(res.status).toBe(401);
  });

  it("ABSOLYUT: doim faol bo'lsa ham 7 kundan keyin -> 401", async () => {
    const { cookie } = await loginAs(clinic.slug, user.login, user.password);
    const token = sessionTokenFromCookie(cookie);

    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() - 60 * 1000), lastActivityAt: new Date() })
      .where(eq(sessions.id, token));

    const res = await app.request("/api/auth/me", { headers: { Cookie: cookie } });
    expect(res.status).toBe(401);
  });

  it("deaktivatsiyadan keyin eski cookie -> 401", async () => {
    const deactivated = await createTestUser(clinic.id, { role: "admin" });
    const { cookie } = await loginAs(clinic.slug, deactivated.login, deactivated.password);

    await db.update(users).set({ isActive: false }).where(eq(users.id, deactivated.id));

    const res = await app.request("/api/auth/me", { headers: { Cookie: cookie } });
    expect(res.status).toBe(401);
  });

  it("≥5 daqiqadan kam o'tgan ketma-ket so'rovlarda last_activity_at yangilanmaydi", async () => {
    const { cookie } = await loginAs(clinic.slug, user.login, user.password);
    const token = sessionTokenFromCookie(cookie);

    const before = (await db.select({ t: sessions.lastActivityAt }).from(sessions).where(eq(sessions.id, token)))[0].t;
    await app.request("/api/auth/me", { headers: { Cookie: cookie } });
    const after = (await db.select({ t: sessions.lastActivityAt }).from(sessions).where(eq(sessions.id, token)))[0].t;

    expect(after.getTime()).toBe(before.getTime());
  });
});
