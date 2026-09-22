import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq, ilike, isNull, like, or } from "drizzle-orm";
import {
  createPatientSchema,
  looksLikePhone,
  normalizePhone,
  searchPatientsQuerySchema,
} from "@dental/shared";
import { db } from "../../db/client";
import { patients } from "../../db/schema";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import { recordAudit } from "../audit";
import type { AppVariables } from "../context";

/**
 * NAMUNA SLICE — to'liq bemor moduli emas (u Faza-1, 3-4 hafta ishi,
 * qollanma bo'lim 7). Bu yerdagi maqsad: auth -> rol -> clinic_id qamrovi
 * -> zod validatsiya -> audit_log zanjirini uchidan-uchiga ishlab
 * ko'rsatish, keyingi ekranlar (4, 5) shu naqshni takrorlaydi.
 */
export const patientRoutes = new Hono<{ Variables: AppVariables }>();

patientRoutes.use("*", requireAuth);

/** Ekran 3: "Bemor qidirish — telefon/ism bo'yicha, tez". */
patientRoutes.get("/", zValidator("query", searchPatientsQuerySchema), async (c) => {
  const user = c.get("user");
  const { q } = c.req.valid("query");

  const scope = and(eq(patients.clinicId, user.clinicId), isNull(patients.deletedAt));

  let whereClause = scope;

  if (q) {
    if (looksLikePhone(q)) {
      /**
       * TELEFON BO'YICHA — tahlil C1.
       *
       * Avval `ILIKE '%...%'` ishlatilardi: boshidagi `%` sababli btree
       * indeks UMUMAN ishlamas edi, har qidiruvda to'liq jadval skani
       * ketardi. Endi normalizatsiyalangan ustunda PREFIKS qidiruv —
       * `patients_phone_norm_idx` indeksi ishlaydi.
       *
       * Admin "90 123" deb yozsa ham, "+998901" deb yozsa ham topiladi,
       * chunki ikkala tomon ham normalizatsiyadan o'tadi.
       */
      whereClause = and(scope, like(patients.phoneNormalized, `${normalizePhone(q)}%`))!;
    } else {
      whereClause = and(
        scope,
        or(ilike(patients.fullName, `%${q}%`), like(patients.phoneNormalized, `${normalizePhone(q)}%`)),
      )!;
    }
  }

  const rows = await db.select().from(patients).where(whereClause).limit(50);
  return c.json(rows);
});

/**
 * Ekran 4 "Bemor kartasi" ning eng minimal qismi — faqat asosiy ma'lumot.
 * Vizit tarixi / to'lovlar / qarz (bo'lim 6, ekran 4 to'liq mazmuni)
 * appointments/visits/payments ekranlari bilan birga (hafta 3-6) qo'shiladi.
 */
patientRoutes.get("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const rows = await db
    .select()
    .from(patients)
    .where(and(eq(patients.id, id), eq(patients.clinicId, user.clinicId), isNull(patients.deletedAt)))
    .limit(1);

  const patient = rows[0];
  if (!patient) return c.json({ error: "Bemor topilmadi" }, 404);

  return c.json(patient);
});

/** Rol jadvali (bo'lim 6): bemor yozuvini admin/ega qo'shadi (registratura). */
patientRoutes.post("/", requireRole("owner", "admin"), zValidator("json", createPatientSchema), async (c) => {
  const user = c.get("user");
  const input = c.req.valid("json");

  const phoneNormalized = normalizePhone(input.phone);

  /**
   * DUBLIKAT OGOHLANTIRISHI — tahlil C3.
   *
   * Qattiq UNIQUE cheklov ATAYLAB qo'yilmagan: O'zbekistonda oila a'zolari
   * (ona va bola) bitta telefondan foydalanadi. Shuning uchun yozuv
   * to'silmaydi — javobda `duplicates` qaytariladi va interfeys
   * "Shu raqam bilan bemor bor: ... — baribir qo'shilsinmi?" deb so'raydi.
   */
  const duplicates = await db
    .select({ id: patients.id, fullName: patients.fullName, phone: patients.phone })
    .from(patients)
    .where(
      and(
        eq(patients.clinicId, user.clinicId),
        isNull(patients.deletedAt),
        eq(patients.phoneNormalized, phoneNormalized),
      ),
    )
    .limit(5);

  const [created] = await db
    .insert(patients)
    .values({
      clinicId: user.clinicId,
      fullName: input.fullName,
      phone: input.phone,
      phoneNormalized,
      birthDate: input.birthDate,
      gender: input.gender,
      source: input.source,
      consentMessaging: input.consentMessaging,
      consentData: input.consentData,
      notes: input.notes,
    })
    .returning();

  await recordAudit({
    clinicId: user.clinicId,
    userId: user.id,
    entity: "patients",
    entityId: created.id,
    action: "create",
    newValue: created,
  });

  return c.json({ ...created, duplicates }, 201);
});
