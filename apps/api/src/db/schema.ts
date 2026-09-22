import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  pgEnum,
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  date,
  jsonb,
  uniqueIndex,
  index,
  check,
  primaryKey,
} from "drizzle-orm/pg-core";
import {
  USER_ROLES,
  APPOINTMENT_STATUSES,
  PAYMENT_METHODS,
  DOCTOR_PCT_BASES,
  DISCOUNT_TYPES,
} from "@dental/shared";
import { money, percent, decimalValue, createdAtCol, deletedAtCol } from "./columns";

/**
 * MVP ma'lumotlar modeli — qollanma bo'lim 5 ("Ma'lumotlar modeli") asosida,
 * so'zma-so'z. Faza 2/3 jadvallari (treatment_plans, tooth_records, calls,
 * messages) BU YERDA YO'Q — ular hali navbatda emas (bo'lim 7, 10).
 *
 * Besh tamoyil (bo'lim 5.1), har birini shu faylda qayerda bajarilgani:
 *   1. appointments (reja) va visits (fakt) alohida jadval.
 *   2. Narx snapshot — performed_services o'z narx/foiz nusxasini saqlaydi.
 *   3. To'lov vizitga 1:1 emas — payments.visit_id NULLABLE.
 *   4. Hech narsa o'chirilmaydi — deleted_at + audit_log.
 *   5. Har jadvalda clinic_id (audit_log va sessions bundan mustasno —
 *      ular tizim jadvali, quyida izohlangan).
 */

// ---------------------------------------------------------------------------
// Enum'lar — qiymatlar @dental/shared'dan olinadi, ikki marta yozilmaydi.
// ---------------------------------------------------------------------------

export const userRoleEnum = pgEnum("user_role", USER_ROLES);
export const appointmentStatusEnum = pgEnum("appointment_status", APPOINTMENT_STATUSES);
export const paymentMethodEnum = pgEnum("payment_method", PAYMENT_METHODS);
/**
 * OCHIQ SAVOL (bo'lim 13): "Shifokor foizi tushumdanmi yoki material
 * ayirilgandan keyinmi?" — javob kelguncha klinika darajasida sozlanadigan
 * qilib qo'yildi (default: "gross"). Ko'ring: src/domain/doctorEarnings.ts
 */
export const doctorPctBasisEnum = pgEnum("doctor_pct_basis", DOCTOR_PCT_BASES);
/** Chegirma turi — tahlil B2 (so'm yoki foiz, endi aniq). */
export const discountTypeEnum = pgEnum("discount_type", DISCOUNT_TYPES);
export const auditActionEnum = pgEnum("audit_action", ["create", "update", "delete"]);

// ---------------------------------------------------------------------------
// clinics
// ---------------------------------------------------------------------------

export const clinics = pgTable(
  "clinics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    /**
     * Login ekranidagi "Klinika kodi" — tahlil C4 / T2. Bitta shifokor bir
     * nechta klinikada ishlashi mumkin, login esa faqat klinika ICHIDA
     * noyob (users.login pastga qarang) — shuning uchun kirishda avval
     * klinika slug'i kerak. Format: 3-32 belgi, kichik lotin harf/raqam/tire.
     */
    slug: text("slug").notNull(),
    timezone: text("timezone").notNull().default("Asia/Tashkent"),
    /** Sozlanadigan: shifokor foizi qanday hisoblanadi. Bo'lim 13 ochiq savol
     * javobi topilguncha default = "gross". */
    doctorPctBasis: doctorPctBasisEnum("doctor_pct_basis").notNull().default("gross"),
    createdAt: createdAtCol(),
  },
  (t) => ({
    slugUnique: uniqueIndex("clinics_slug_unique").on(t.slug),
    slugFormat: check("clinics_slug_format", sql`${t.slug} ~ '^[a-z0-9-]{3,32}$'`),
  }),
);

// ---------------------------------------------------------------------------
// users — auth. login klinika ICHIDA noyob (tahlil C4 / T2). Login ekranida
// avval klinika slug'i tanlanadi (clinics.slug), keyin shu klinika ichidagi
// login. Global unique EMAS ataylab: bitta shifokor ikki klinikada ishlashi
// mumkin, va har klinikada o'z "admin"i bo'lishi kerak.
// ---------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id").notNull().references(() => clinics.id),
    /** Saqlashda doim trim + lowercase (routes/auth.ts) — solishtirish katta/kichik harfga sezgir bo'lmasin. */
    login: text("login").notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name").notNull(),
    role: userRoleEnum("role").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAtCol(),
    deletedAt: deletedAtCol(),
  },
  (t) => ({
    /**
     * `WHERE deleted_at IS NULL` — o'chirilgan foydalanuvchining logini
     * yangi foydalanuvchiga berish mumkin bo'lishi uchun (T2 qabul mezoni).
     */
    loginUnique: uniqueIndex("users_login_unique")
      .on(t.clinicId, t.login)
      .where(sql`${t.deletedAt} IS NULL`),
    clinicIdx: index("users_clinic_idx").on(t.clinicId),
  }),
);

// ---------------------------------------------------------------------------
// sessions — tizim jadvali (auth uchun). Qollanma bo'lim 3: "Session cookie +
// argon2 (JWT kerak emas)". clinic_id shart emas — user_id orqali chiqariladi.
// ---------------------------------------------------------------------------

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // xavfsiz tasodifiy token, ko'ring src/api/auth/session.ts
  userId: uuid("user_id").notNull().references(() => users.id),
  /** Absolyut chegara — yaratilishda belgilanadi, SESSION_MAX_DAYS (T3). */
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  /**
   * Idle (harakatsizlik) muddati shundan hisoblanadi — SESSION_IDLE_HOURS
   * (T3, tahlil D2). Har so'rovda EMAS, ≥5 daqiqada bir yangilanadi
   * (src/api/auth/session.ts) — DB yozuv yukini kamaytirish uchun.
   */
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: createdAtCol(),
});

// ---------------------------------------------------------------------------
// doctors
// ---------------------------------------------------------------------------

export const doctors = pgTable(
  "doctors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id").notNull().references(() => clinics.id),
    userId: uuid("user_id").references(() => users.id),
    fullName: text("full_name").notNull(),
    specialty: text("specialty"),
    /** Asosiy foiz — performed_services yozilganda snapshot sifatida nusxalanadi. */
    defaultPct: percent("default_pct").notNull().default("0"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => ({ clinicIdx: index("doctors_clinic_idx").on(t.clinicId) }),
);

// ---------------------------------------------------------------------------
// chairs
// ---------------------------------------------------------------------------

export const chairs = pgTable(
  "chairs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id").notNull().references(() => clinics.id),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => ({ clinicIdx: index("chairs_clinic_idx").on(t.clinicId) }),
);

// ---------------------------------------------------------------------------
// patients — ekran 3 "tez qidirish" uchun phone/full_name indekslangan.
// ---------------------------------------------------------------------------

export const patients = pgTable(
  "patients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id").notNull().references(() => clinics.id),
    fullName: text("full_name").notNull(),
    /** Foydalanuvchi kiritgan ASL matn (chekda qanday yozilgan bo'lsa). */
    phone: text("phone").notNull(),
    /**
     * Kanonik 9 raqam — tahlil C1-C3. Qidiruv va dublikat tekshiruvi SHU
     * ustun bo'yicha ketadi (`normalizePhone`, @dental/shared).
     *
     * UNIQUE EMAS — ataylab: O'zbekistonda oila a'zolari (ona va bola)
     * bitta raqamdan foydalanadi. Dublikat qattiq taqiqlanmaydi, balki
     * yozuv qo'shishda OGOHLANTIRISH ko'rsatiladi (routes/patients.ts).
     */
    phoneNormalized: text("phone_normalized").notNull().default(""),
    birthDate: date("birth_date"),
    gender: text("gender"), // "male" | "female" — MVP'da erkin, keyin enum bo'lishi mumkin
    source: text("source"), // qayerdan bilgan (referral, instagram, ...)
    telegramChatId: text("telegram_chat_id"), // Faza 3
    /** Rozilik — bo'lim 8 (huquqiy talablar): yozma rozilik shart. */
    consentMessaging: boolean("consent_messaging").notNull().default(false),
    consentData: boolean("consent_data").notNull().default(false),
    notes: text("notes"),
    createdAt: createdAtCol(),
    deletedAt: deletedAtCol(),
  },
  (t) => ({
    clinicIdx: index("patients_clinic_idx").on(t.clinicId),
    /**
     * Prefiks qidiruv (`LIKE '9012%'`) uchun — tahlil C1.
     *
     * `text_pattern_ops` MAJBURIY. Usiz PostgreSQL bu indeksni prefiks
     * shartiga UMUMAN ishlatmaydi (lokal Postgres 16 da EXPLAIN bilan
     * tekshirilgan: `enable_seqscan=off` bo'lganda ham planner boshqa
     * indeksga o'tib, LIKE'ni Filter sifatida bajardi).
     *
     * Natija (20 000 bemor):
     *   text_pattern_ops'siz -> Seq Scan
     *   text_pattern_ops'bilan -> Index Scan
     */
    phoneNormIdx: index("patients_phone_norm_idx").on(
      t.clinicId,
      t.phoneNormalized.op("text_pattern_ops"),
    ),
    nameIdx: index("patients_name_idx").on(t.clinicId, t.fullName),
  }),
);

// ---------------------------------------------------------------------------
// appointments — REJA (kelajak). Tamoyil #1: visits'dan alohida.
// ---------------------------------------------------------------------------

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id").notNull().references(() => clinics.id),
    patientId: uuid("patient_id").notNull().references(() => patients.id),
    doctorId: uuid("doctor_id").notNull().references(() => doctors.id),
    chairId: uuid("chair_id").notNull().references(() => chairs.id),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    status: appointmentStatusEnum("status").notNull().default("planned"),
    note: text("note"),
    createdBy: uuid("created_by").notNull().references(() => users.id),
    createdAt: createdAtCol(),
    deletedAt: deletedAtCol(),
  },
  (t) => ({
    clinicIdx: index("appointments_clinic_idx").on(t.clinicId),
    scheduleIdx: index("appointments_schedule_idx").on(t.clinicId, t.startAt),
    doctorIdx: index("appointments_doctor_idx").on(t.doctorId, t.startAt),
    chairIdx: index("appointments_chair_idx").on(t.chairId, t.startAt),
  }),
);

// ---------------------------------------------------------------------------
// visits — FAKT (o'tmish). appointmentId NULLABLE: kelib qolgan (walk-in)
// bemor oldindan yozuvsiz ham vizit bo'lishi mumkin.
// ---------------------------------------------------------------------------

export const visits = pgTable(
  "visits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id").notNull().references(() => clinics.id),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    patientId: uuid("patient_id").notNull().references(() => patients.id),
    doctorId: uuid("doctor_id").notNull().references(() => doctors.id),
    chairId: uuid("chair_id").references(() => chairs.id),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    note: text("note"),
    createdAt: createdAtCol(),
    /** Tamoyil #4 (tahlil A2): tibbiy yozuv o'chirilmaydi, belgilanadi. */
    deletedAt: deletedAtCol(),
  },
  (t) => ({
    clinicIdx: index("visits_clinic_idx").on(t.clinicId),
    patientIdx: index("visits_patient_idx").on(t.patientId),
  }),
);

// ---------------------------------------------------------------------------
// service_categories / services — ekran 11 "Xizmat va narxlar".
// ---------------------------------------------------------------------------

export const serviceCategories = pgTable(
  "service_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id").notNull().references(() => clinics.id),
    name: text("name").notNull(),
    defaultDoctorPct: percent("default_doctor_pct").notNull().default("0"),
  },
  (t) => ({ clinicIdx: index("service_categories_clinic_idx").on(t.clinicId) }),
);

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id").notNull().references(() => clinics.id),
    categoryId: uuid("category_id").references(() => serviceCategories.id),
    code: text("code"),
    name: text("name").notNull(),
    price: money("price").notNull(),
    durationMin: integer("duration_min"),
    materialCost: money("material_cost").notNull().default("0"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => ({ clinicIdx: index("services_clinic_idx").on(t.clinicId) }),
);

// ---------------------------------------------------------------------------
// performed_services — Tamoyil #2: MAJBURIY narx snapshot. `services`ga
// live havola qilinmaydi — narx keyin o'zgarsa, o'tgan hisobot buzilmaydi.
// ---------------------------------------------------------------------------

export const performedServices = pgTable(
  "performed_services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id").notNull().references(() => clinics.id),
    visitId: uuid("visit_id").notNull().references(() => visits.id),
    serviceId: uuid("service_id").notNull().references(() => services.id),
    doctorId: uuid("doctor_id").notNull().references(() => doctors.id),
    /** FDI tish raqami. Bo'lim 5: "birinchi raqam — chorak (1-4 doimiy,
     * 5-8 sut), ikkinchi — o'rta chiziqdan sanoq (1-8)." Butun tish bo'lmagan
     * xizmat uchun NULL (masalan umumiy konsultatsiya). */
    tooth: integer("tooth"),
    surfaces: text("surfaces"), // masalan 'MOD' — nullable
    qty: integer("qty").notNull().default(1),
    priceSnapshot: money("price_snapshot").notNull(),
    /**
     * CHEGIRMA — tahlil B2. Avval bitta `discount` ustuni bor edi va uning
     * so'mmi yoki foizmi ekani hech qayerda yozilmagan edi ("FARAZ QILINDI").
     * Endi uchta ustun:
     *   discount_type   — "amount" (so'm) yoki "percent" (0-100)
     *   discount_value  — foydalanuvchi kiritgan qiymat, o'sha birlikda
     *   discount_amount — HISOBLANGAN so'm, snapshot (hisobotlar shuni oladi)
     *
     * Chegirma har doim SATR jamisiga (price_snapshot * qty) qo'llanadi,
     * donaga emas. Ko'ring: src/domain/discount.ts
     */
    discountType: discountTypeEnum("discount_type").notNull().default("amount"),
    discountValue: decimalValue("discount_value").notNull().default("0"),
    discountAmount: money("discount_amount").notNull().default("0"),
    doctorPctSnapshot: percent("doctor_pct_snapshot").notNull(),
    materialCostSnapshot: money("material_cost_snapshot").notNull().default("0"),
    labCost: money("lab_cost").notNull().default("0"),
    /** Kafolat: tushum yo'q, xarajat bor. Ko'ring src/domain/doctorEarnings.ts */
    isWarranty: boolean("is_warranty").notNull().default(false),
    createdAt: createdAtCol(),
    /** Tamoyil #4 (tahlil A2): moliyaviy yozuv o'chirilmaydi. */
    deletedAt: deletedAtCol(),
  },
  (t) => ({
    clinicIdx: index("performed_services_clinic_idx").on(t.clinicId),
    visitIdx: index("performed_services_visit_idx").on(t.visitId),
    doctorIdx: index("performed_services_doctor_idx").on(t.doctorId),
  }),
);

// ---------------------------------------------------------------------------
// cash_sessions — KASSA SMENASI (tahlil B1).
//
// MUAMMO: avval kunlik hisobot faqat HISOBLANGAN edi, TEKSHIRILMAGAN.
// Ega uchun eng muhim raqam — tizimdagi naqd va qo'ldagi naqd orasidagi FARQ.
// Bu jadvalsiz "kassada 200 000 so'm yetishmayapti" degan savol tug'ilmaydi,
// ya'ni tizim o'zini o'zi tekshirmaydi.
//
// Ishlash tartibi: smena ochiladi -> naqd to'lovlar unga bog'lanadi
// (payments.cash_session_id) -> smena yopilganda admin pulni sanaydi ->
// expected_cash (tizim) va counted_cash (qo'l) solishtiriladi.
// Ko'ring: src/domain/cashSession.ts
// ---------------------------------------------------------------------------

export const cashSessions = pgTable(
  "cash_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id").notNull().references(() => clinics.id),
    openedBy: uuid("opened_by").notNull().references(() => users.id),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    /** Smena boshidagi qoldiq (kassadagi mayda pul). */
    openingFloat: money("opening_float").notNull().default("0"),
    closedBy: uuid("closed_by").references(() => users.id),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    /** Tizim hisoblagan naqd: opening_float + smenadagi naqd to'lovlar jamisi. */
    expectedCash: money("expected_cash"),
    /** Admin qo'lda sanagan naqd. */
    countedCash: money("counted_cash"),
    /** counted - expected. Manfiy = yetishmayapti. Ega ko'radigan raqam. */
    diff: money("diff"),
    note: text("note"),
    createdAt: createdAtCol(),
    deletedAt: deletedAtCol(),
  },
  (t) => ({
    clinicIdx: index("cash_sessions_clinic_idx").on(t.clinicId),
    openIdx: index("cash_sessions_open_idx").on(t.clinicId, t.closedAt),
  }),
);

// ---------------------------------------------------------------------------
// payments — Tamoyil #3: vizitga 1:1 BOG'LANMAYDI (avans, bo'lib-bo'lib to'lov).
// ---------------------------------------------------------------------------

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id").notNull().references(() => clinics.id),
    patientId: uuid("patient_id").notNull().references(() => patients.id),
    amount: money("amount").notNull(),
    method: paymentMethodEnum("method").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull(),
    visitId: uuid("visit_id").references(() => visits.id), // NULLABLE — avans ham bo'lishi mumkin
    /** Qaysi kassa smenasida qabul qilindi (tahlil B1). Naqd bo'lmagan
     * to'lov uchun NULL bo'lishi mumkin. */
    cashSessionId: uuid("cash_session_id").references(() => cashSessions.id),
    createdBy: uuid("created_by").notNull().references(() => users.id),
    note: text("note"),

    // -----------------------------------------------------------------------
    // TO'LOVNI TUZATISH (tahlil A3). Admin 500 000 o'rniga 5 000 000 kiritsa
    // nima bo'ladi? Avval hech narsa — tuzatish yo'li yo'q edi.
    //
    // Ikki mexanizm birga ishlaydi:
    //   1. TUZATUVCHI YOZUV (buxgalteriya uslubi) — manfiy summali yangi
    //      qator, `reversal_of_id` asl yozuvga ishora qiladi. Asl yozuv
    //      O'ZGARMAYDI, revizor ikkalasini ham ko'radi.
    //   2. BEKOR BELGISI — asl yozuvda `voided_at` qo'yiladi, interfeys uni
    //      chizib ko'rsatadi.
    //
    // ⚠️ KANONIK QOIDA (buzilmasin): hisobotlar `deleted_at IS NULL` bo'lgan
    // BARCHA qatorlarni qo'shadi. Tuzatuvchi yozuv manfiy bo'lgani uchun
    // o'zi nolga chiqaradi. `voided_at` ni hisobot filtrida ISHLATMANG —
    // aks holda summa IKKI MARTA ayriladi. Ko'ring: src/domain/payments.ts
    // -----------------------------------------------------------------------
    /** Bu qator qaysi to'lovni tuzatyapti (manfiy summali qator uchun). */
    reversalOfId: uuid("reversal_of_id").references((): AnyPgColumn => payments.id),
    /** Asl yozuvda: qachon bekor qilindi (faqat UI belgisi). */
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: uuid("voided_by").references(() => users.id),
    voidReason: text("void_reason"),

    createdAt: createdAtCol(),
    /** Tamoyil #4 (tahlil A2). Bu — umuman bo'lmasligi kerak bo'lgan qator
     * uchun (masalan noto'g'ri bemorga yozilgan). Oddiy tuzatish yo'li —
     * yuqoridagi reversal, bu emas. */
    deletedAt: deletedAtCol(),
  },
  (t) => ({
    clinicIdx: index("payments_clinic_idx").on(t.clinicId),
    patientIdx: index("payments_patient_idx").on(t.patientId),
    sessionIdx: index("payments_cash_session_idx").on(t.cashSessionId),
    reversalIdx: index("payments_reversal_idx").on(t.reversalOfId),
  }),
);

// ---------------------------------------------------------------------------
// expenses — ekran 7.
// ---------------------------------------------------------------------------

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id").notNull().references(() => clinics.id),
    category: text("category").notNull(),
    amount: money("amount").notNull(),
    spentAt: timestamp("spent_at", { withTimezone: true }).notNull(),
    isRecurring: boolean("is_recurring").notNull().default(false),
    note: text("note"),
    receiptUrl: text("receipt_url"),
    createdBy: uuid("created_by").notNull().references(() => users.id),
    createdAt: createdAtCol(),
    /** Tamoyil #4 (tahlil A2): moliyaviy yozuv o'chirilmaydi. */
    deletedAt: deletedAtCol(),
  },
  (t) => ({ clinicIdx: index("expenses_clinic_idx").on(t.clinicId) }),
);

// ---------------------------------------------------------------------------
// audit_log — Tamoyil #4: hech narsa o'chirilmaydi, har o'zgarish shu yerda.
// Qollanma bo'lim 9, qoida 9.
// ---------------------------------------------------------------------------

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id").notNull().references(() => clinics.id),
    userId: uuid("user_id").references(() => users.id), // tizim amali bo'lsa NULL
    entity: text("entity").notNull(), // masalan "patients", "payments"
    entityId: uuid("entity_id").notNull(),
    action: auditActionEnum("action").notNull(),
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value"),
    createdAt: createdAtCol(),
  },
  (t) => ({
    clinicIdx: index("audit_log_clinic_idx").on(t.clinicId),
    entityIdx: index("audit_log_entity_idx").on(t.entity, t.entityId),
  }),
);

// ---------------------------------------------------------------------------
// idempotency_keys — tizim jadvali. T4 (tahlil M1, birinchi qism): sekin
// internetda admin tugmani ikki marta bossa yoki so'rov timeout'dan keyin
// qayta yuborilsa — ikki marta to'lov/bemor yaratilmasin.
//
// status_code/response_body NULLABLE — "band qilish" (claim) naqshi uchun:
// handler ishga tushishidan OLDIN shu (clinic_id, key) bilan bo'sh qator
// yoziladi (UNIQUE cheklov orqali PARALLEL ikkita so'rovdan faqat bittasi
// yoza oladi — shu bilan ikkalasi ham handler'ni bajarib, DUPLIKAT yozuv
// yaratib qo'yishining oldi olinadi). Handler tugagach, shu qatorga haqiqiy
// javob yoziladi. Ko'ring: src/api/middleware/idempotency.ts.
// ---------------------------------------------------------------------------

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    clinicId: uuid("clinic_id").notNull().references(() => clinics.id),
    /** `Idempotency-Key` header qiymati (UUID) — mijoz tomonidan yaratiladi. */
    key: text("key").notNull(),
    /** So'rov tanasining xeshi — bir xil kalit, boshqa tana holatini aniqlash uchun. */
    requestHash: text("request_hash").notNull(),
    /** NULL = hali bajarilmoqda (band qilingan, lekin tugallanmagan). */
    statusCode: integer("status_code"),
    responseBody: text("response_body"),
    createdAt: createdAtCol(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.clinicId, t.key] }),
    /** 48 soatdan eski kalitlarni tozalash uchun (T4). */
    createdAtIdx: index("idempotency_keys_created_at_idx").on(t.createdAt),
  }),
);
