import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { UserRole } from "@dental/shared";
import { app } from "../api/app";
import { db } from "../db/client";
import { auditLog, clinics, idempotencyKeys, patients, sessions, users } from "../db/schema";
import { hashPassword } from "../api/auth/password";

/**
 * Integratsiya-test yordamchilari — real Postgresga ulanadi
 * (`vitest.integration.config.ts`). `app.request()` — Hono'ning o'z
 * test API'si: haqiqiy HTTP server ochmasdan, butun middleware/route
 * zanjiridan o'tkazadi.
 */

export const TEST_ORIGIN_HEADERS = { "sec-fetch-site": "same-origin" } as const;

export interface TestClinic {
  id: string;
  slug: string;
  name: string;
}

export async function createTestClinic(): Promise<TestClinic> {
  const slug = `test-${randomUUID().slice(0, 8)}`;
  const [row] = await db.insert(clinics).values({ name: `Test klinika ${slug}`, slug }).returning();
  return { id: row.id, slug: row.slug, name: row.name };
}

export interface TestUser {
  id: string;
  login: string;
  password: string;
  clinicId: string;
  role: UserRole;
}

export async function createTestUser(
  clinicId: string,
  opts: { login?: string; password?: string; role?: UserRole; fullName?: string; isActive?: boolean } = {},
): Promise<TestUser> {
  const login = opts.login ?? `user-${randomUUID().slice(0, 8)}`;
  const password = opts.password ?? "IntegrationTest1";
  const passwordHash = await hashPassword(password);
  const [row] = await db
    .insert(users)
    .values({
      clinicId,
      login,
      passwordHash,
      fullName: opts.fullName ?? "Test Foydalanuvchi",
      role: opts.role ?? "owner",
      isActive: opts.isActive ?? true,
    })
    .returning();
  return { id: row.id, login: row.login, password, clinicId, role: row.role };
}

/** Login qiladi va keyingi so'rovlarga qo'shiladigan `Cookie` header qiymatini qaytaradi. */
export async function loginAs(clinicSlug: string, login: string, password: string): Promise<{ cookie: string; status: number; body: unknown }> {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...TEST_ORIGIN_HEADERS },
    body: JSON.stringify({ clinic: clinicSlug, login, password }),
  });
  const body = await res.json().catch(() => undefined);

  if (res.status !== 200) {
    return { cookie: "", status: res.status, body };
  }

  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/dental_session=([^;]+)/);
  if (!match) throw new Error(`Login 200 qaytardi, lekin sessiya cookie topilmadi: ${setCookie}`);
  return { cookie: `dental_session=${match[1]}`, status: res.status, body };
}

/** Sessiya jadvalidan token qiymatini o'qib olish (Cookie header'dan). */
export function sessionTokenFromCookie(cookie: string): string {
  const match = cookie.match(/dental_session=([^;]+)/);
  if (!match) throw new Error(`Cookie ichida sessiya topilmadi: ${cookie}`);
  return match[1];
}

/** Test klinika va unga bog'liq BARCHA yozuvlarni tozalaydi (FK tartibida). */
export async function cleanupClinic(clinicId: string): Promise<void> {
  const clinicUsers = await db.select({ id: users.id }).from(users).where(eq(users.clinicId, clinicId));
  for (const u of clinicUsers) {
    await db.delete(sessions).where(eq(sessions.userId, u.id));
  }
  await db.delete(idempotencyKeys).where(eq(idempotencyKeys.clinicId, clinicId));
  await db.delete(auditLog).where(eq(auditLog.clinicId, clinicId));
  await db.delete(patients).where(eq(patients.clinicId, clinicId));
  await db.delete(users).where(eq(users.clinicId, clinicId));
  await db.delete(clinics).where(eq(clinics.id, clinicId));
}
