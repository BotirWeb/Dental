import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { clinics, sessions, users } from "../../db/schema";
import { isSessionExpired, shouldRefreshActivity } from "../../domain/sessionExpiry";
import type { AuthUser } from "../context";

/** Absolyut chegara — T3, tahlil D2: "bitta VPS smenasi + zaxira" emas, "cookie abadiy ishlamasin". */
const SESSION_MAX_DAYS = Number(process.env.SESSION_MAX_DAYS ?? 7);
/** Idle (harakatsizlik) chegara — T3: "bitta smena sig'adi, ketgan xodim ertasiga kira olmaydi". */
const SESSION_IDLE_HOURS = Number(process.env.SESSION_IDLE_HOURS ?? 12);
/** Faollik vaqti DB'da bundan tez-tez yangilanmaydi (yozuv yukini kamaytirish). */
const ACTIVITY_REFRESH_MIN_MINUTES = 5;

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/** Yangi session yaratadi va tokenni qaytaradi (cookie sifatida yuboriladi). */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_MAX_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({ id: token, userId, expiresAt, lastActivityAt: now });

  return { token, expiresAt };
}

/**
 * Token orqali auth foydalanuvchini topadi. Muddati o'tgan (idle YOKI
 * absolyut, `src/domain/sessionExpiry.ts`), mavjud bo'lmasa yoki
 * foydalanuvchi faol bo'lmasa (deaktivatsiya/soft-delete) — null.
 *
 * Yaroqli bo'lsa, faollik vaqti bosqichma-bosqich yangilanadi (har so'rovda
 * emas — T3 talabi).
 */
export async function getUserBySessionToken(token: string): Promise<AuthUser | null> {
  const rows = await db
    .select({
      sessionExpiresAt: sessions.expiresAt,
      lastActivityAt: sessions.lastActivityAt,
      id: users.id,
      clinicId: users.clinicId,
      clinicSlug: clinics.slug,
      clinicName: clinics.name,
      login: users.login,
      fullName: users.fullName,
      role: users.role,
      isActive: users.isActive,
      deletedAt: users.deletedAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(clinics, eq(users.clinicId, clinics.id))
    .where(eq(sessions.id, token))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const now = new Date();
  if (isSessionExpired({ now, expiresAt: row.sessionExpiresAt, lastActivityAt: row.lastActivityAt, idleHours: SESSION_IDLE_HOURS })) {
    return null;
  }
  if (!row.isActive || row.deletedAt) return null;

  if (shouldRefreshActivity({ now, lastActivityAt: row.lastActivityAt, minIntervalMinutes: ACTIVITY_REFRESH_MIN_MINUTES })) {
    await db.update(sessions).set({ lastActivityAt: now }).where(eq(sessions.id, token));
  }

  return {
    id: row.id,
    clinicId: row.clinicId,
    clinicSlug: row.clinicSlug,
    clinicName: row.clinicName,
    login: row.login,
    fullName: row.fullName,
    role: row.role,
  };
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, token));
}

/** Foydalanuvchining BARCHA sessiyalari — deaktivatsiya/parol o'zgarganda (T3). */
export async function deleteAllSessionsForUser(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
