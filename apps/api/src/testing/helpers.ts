import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { UserRole } from "@dental/shared";
import { app } from "../api/app";
import { db } from "../db/client";
import {
  appointments,
  auditLog,
  cashSessions,
  chairs,
  clinics,
  doctors,
  idempotencyKeys,
  patients,
  payments,
  performedServices,
  serviceCategories,
  services,
  sessions,
  users,
  visits,
} from "../db/schema";
import { hashPassword } from "../api/auth/password";
import { toMoneyInput, toPercentInput } from "../db/columns";

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

export interface TestDoctor {
  id: string;
  clinicId: string;
  defaultPct: number;
}

export async function createTestDoctor(clinicId: string, opts: { defaultPct?: number } = {}): Promise<TestDoctor> {
  const [row] = await db
    .insert(doctors)
    .values({
      clinicId,
      fullName: "Test Shifokor",
      defaultPct: toPercentInput(opts.defaultPct ?? 40),
    })
    .returning();
  return { id: row.id, clinicId, defaultPct: opts.defaultPct ?? 40 };
}

export interface TestChair {
  id: string;
  clinicId: string;
}

export async function createTestChair(clinicId: string): Promise<TestChair> {
  const [row] = await db.insert(chairs).values({ clinicId, name: "Test kreslo" }).returning();
  return { id: row.id, clinicId };
}

export interface TestService {
  id: string;
  clinicId: string;
  price: number;
  materialCost: number;
}

export async function createTestService(
  clinicId: string,
  opts: { price?: number; materialCost?: number } = {},
): Promise<TestService> {
  const price = opts.price ?? 350_000;
  const materialCost = opts.materialCost ?? 40_000;
  const [row] = await db
    .insert(services)
    .values({ clinicId, name: "Test xizmat", price: toMoneyInput(price), materialCost: toMoneyInput(materialCost) })
    .returning();
  return { id: row.id, clinicId, price, materialCost };
}

export interface TestPatient {
  id: string;
  clinicId: string;
}

export async function createTestPatient(clinicId: string, opts: { fullName?: string; phone?: string } = {}): Promise<TestPatient> {
  const phone = opts.phone ?? `90${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
  const [row] = await db
    .insert(patients)
    .values({ clinicId, fullName: opts.fullName ?? "Test Bemor", phone, phoneNormalized: phone })
    .returning();
  return { id: row.id, clinicId };
}

/** Sessiya jadvalidan token qiymatini o'qib olish (Cookie header'dan). */
export function sessionTokenFromCookie(cookie: string): string {
  const match = cookie.match(/dental_session=([^;]+)/);
  if (!match) throw new Error(`Cookie ichida sessiya topilmadi: ${cookie}`);
  return match[1];
}

/**
 * Test klinika va unga bog'liq BARCHA yozuvlarni tozalaydi (FK tartibida —
 * eng "ichki" jadval, ya'ni boshqalarga eng ko'p ishora qiluvchisi, birinchi
 * o'chiriladi).
 */
export async function cleanupClinic(clinicId: string): Promise<void> {
  const clinicUsers = await db.select({ id: users.id }).from(users).where(eq(users.clinicId, clinicId));
  for (const u of clinicUsers) {
    await db.delete(sessions).where(eq(sessions.userId, u.id));
  }
  await db.delete(idempotencyKeys).where(eq(idempotencyKeys.clinicId, clinicId));
  await db.delete(auditLog).where(eq(auditLog.clinicId, clinicId));
  await db.delete(performedServices).where(eq(performedServices.clinicId, clinicId));
  await db.delete(payments).where(eq(payments.clinicId, clinicId));
  await db.delete(visits).where(eq(visits.clinicId, clinicId));
  await db.delete(appointments).where(eq(appointments.clinicId, clinicId));
  await db.delete(cashSessions).where(eq(cashSessions.clinicId, clinicId));
  await db.delete(services).where(eq(services.clinicId, clinicId));
  await db.delete(serviceCategories).where(eq(serviceCategories.clinicId, clinicId));
  await db.delete(doctors).where(eq(doctors.clinicId, clinicId));
  await db.delete(chairs).where(eq(chairs.clinicId, clinicId));
  await db.delete(patients).where(eq(patients.clinicId, clinicId));
  await db.delete(users).where(eq(users.clinicId, clinicId));
  await db.delete(clinics).where(eq(clinics.id, clinicId));
}
