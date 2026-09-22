import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { zValidate as zValidator } from "../validate";
import { and, eq, isNull } from "drizzle-orm";
import { loginRequestSchema, normalizeLogin } from "@dental/shared";
import { db } from "../../db/client";
import { clinics, users } from "../../db/schema";
import { verifyPassword } from "../auth/password";
import { createSession, deleteSession } from "../auth/session";
import { requireAuth, SESSION_COOKIE_NAME } from "../middleware/auth";
import { clientIp, rateLimit } from "../middleware/rateLimit";
import { ClinicResolutionError, resolveClinicSlug } from "../../domain/auth";
import type { AppVariables } from "../context";
import type { MeResponse } from "@dental/shared";

export const authRoutes = new Hono<{ Variables: AppVariables }>();

const isProd = process.env.NODE_ENV === "production";
const cookieSecure = (process.env.SESSION_COOKIE_SECURE ?? String(isProd)) === "true";

/**
 * VAQT FARQI BO'LMASIN — noma'lum klinika/login uchun ham argon2 verify
 * HAQIQIY ishlaydi (tahlil D2 / T2). Aks holda "klinika/login topilmadi ->
 * darhol 401" bilan "topildi, lekin parol xato -> argon2dan keyin 401"
 * javob vaqtida farqlanadi va tashqi so'rovchi qaysi login mavjudligini
 * shu farqdan bilib olishi mumkin.
 *
 * Bu — oldindan hisoblangan, hech qachon haqiqiy foydalanuvchiga
 * to'g'ri kelmaydigan argon2id hash (tasodifiy parolning hashi).
 */
const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$TimPxIvuWsT/2RJYsBgpww$cH7NHRLjZgQGykAzylOzn2eEHg3eAsZUg319rKuQn5E";

/**
 * Login urinishlarini cheklash (tahlil D1, T2 bilan kengaytirildi).
 * 15 daqiqada 10 urinish — odam xato yozsa yetadi, brute-force uchun yetmaydi.
 * Uch kalit: IP, klinika+login birga (bitta hisobni nishonga olish, IP
 * almashtirilsa ham) — faqat IP bo'yicha umumiy chegara ham saqlanadi.
 */
const loginRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  keys: async (c) => {
    const keys = [`ip:${clientIp(c)}`];
    try {
      const body = (await c.req.raw.clone().json()) as { clinic?: unknown; login?: unknown };
      if (typeof body.login === "string" && body.login.length > 0) {
        const clinicPart = typeof body.clinic === "string" ? body.clinic.toLowerCase() : "";
        keys.push(`clinic:${clinicPart}:login:${body.login.toLowerCase()}`);
      }
    } catch {
      // Body yaroqsiz bo'lsa — zValidator baribir 400 qaytaradi.
    }
    return keys;
  },
});

/** Uch xato holatda (noma'lum klinika/login/noto'g'ri parol) bir xil javob — tahlil C4 / T2. */
function invalidCredentials(c: Context<{ Variables: AppVariables }>) {
  return c.json({ error: "Klinika kodi, login yoki parol xato" }, 401);
}

/** Ekran 1 (bo'lim 6): "klinika kodi + login + parol". Rol tanlanmaydi — login orqali topiladi. */
authRoutes.post("/login", loginRateLimit, zValidator("json", loginRequestSchema), async (c) => {
  const { clinic, login, password } = c.req.valid("json");

  let clinicSlug: string;
  try {
    clinicSlug = resolveClinicSlug({ inputClinic: clinic, defaultClinicSlug: process.env.DEFAULT_CLINIC_SLUG });
  } catch (err) {
    if (err instanceof ClinicResolutionError) {
      return c.json({ error: "Klinika kodi kerak" }, 400);
    }
    throw err;
  }

  const normalizedLogin = normalizeLogin(login);

  const clinicRows = await db.select().from(clinics).where(eq(clinics.slug, clinicSlug)).limit(1);
  const clinicRow = clinicRows[0];

  let userRow: typeof users.$inferSelect | undefined;
  if (clinicRow) {
    /**
     * `deleted_at IS NULL` SHART — T2 qabul mezoni: o'chirilgan
     * foydalanuvchining logini yangi foydalanuvchiga berish mumkin.
     * Bu filtrsiz, ikkalasi (eski o'chirilgan + yangi faol) bir xil
     * (clinic_id, login) bilan mavjud bo'lganda, SELECT tasodifan eski
     * (o'chirilgan) qatorni qaytarishi mumkin edi — unique indeks
     * (`users_login_unique`) aynan shu `WHERE deleted_at IS NULL` sharti
     * bilan qurilgan, shuning uchun bu yerda ikkalasi mos kelishi shart.
     */
    const rows = await db
      .select()
      .from(users)
      .where(and(eq(users.clinicId, clinicRow.id), eq(users.login, normalizedLogin), isNull(users.deletedAt)))
      .limit(1);
    userRow = rows[0];
  }

  const candidate = userRow && userRow.isActive && !userRow.deletedAt ? userRow : undefined;

  // Noma'lum klinika/login holatida ham DUMMY hash bilan argon2 ishlaydi —
  // vaqt farqi orqali login mavjudligi bilinmasin (izoh yuqorida).
  const passwordOk = await verifyPassword(candidate?.passwordHash ?? DUMMY_PASSWORD_HASH, password);

  if (!clinicRow || !candidate || !passwordOk) {
    return invalidCredentials(c);
  }

  const { token, expiresAt } = await createSession(candidate.id);

  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: "Lax",
    path: "/",
    expires: expiresAt,
  });

  const response: MeResponse = {
    id: candidate.id,
    clinicId: candidate.clinicId,
    login: candidate.login,
    fullName: candidate.fullName,
    role: candidate.role,
    clinic: { slug: clinicRow.slug, name: clinicRow.name },
  };

  return c.json(response);
});

authRoutes.post("/logout", requireAuth, async (c) => {
  const token = getCookie(c, SESSION_COOKIE_NAME);
  if (token) {
    await deleteSession(token);
  }
  deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });

  return c.body(null, 204);
});

authRoutes.get("/me", requireAuth, async (c) => {
  const user = c.get("user");
  const response: MeResponse = {
    id: user.id,
    clinicId: user.clinicId,
    login: user.login,
    fullName: user.fullName,
    role: user.role,
    clinic: { slug: user.clinicSlug, name: user.clinicName },
  };
  return c.json(response);
});
