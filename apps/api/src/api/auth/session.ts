import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { sessions, users } from "../../db/schema";
import type { AuthUser } from "../context";

const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS ?? 168); // 7 kun

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/** Yangi session yaratadi va tokenni qaytaradi (cookie sifatida yuboriladi). */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);

  await db.insert(sessions).values({ id: token, userId, expiresAt });

  return { token, expiresAt };
}

/** Token orqali auth foydalanuvchini topadi. Muddati o'tgan/mavjud bo'lmasa null. */
export async function getUserBySessionToken(token: string): Promise<AuthUser | null> {
  const rows = await db
    .select({
      sessionExpiresAt: sessions.expiresAt,
      id: users.id,
      clinicId: users.clinicId,
      login: users.login,
      fullName: users.fullName,
      role: users.role,
      isActive: users.isActive,
      deletedAt: users.deletedAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, token))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.sessionExpiresAt < new Date()) return null;
  if (!row.isActive || row.deletedAt) return null;

  return {
    id: row.id,
    clinicId: row.clinicId,
    login: row.login,
    fullName: row.fullName,
    role: row.role,
  };
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, token));
}
