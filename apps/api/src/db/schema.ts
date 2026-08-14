import {
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
} from "drizzle-orm/pg-core";
import { USER_ROLES, APPOINTMENT_STATUSES, PAYMENT_METHODS, DOCTOR_PCT_BASES } from "@dental/shared";
import { money, percent, createdAtCol, deletedAtCol } from "./columns";

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
export const auditActionEnum = pgEnum("audit_action", ["create", "update", "delete"]);

// ---------------------------------------------------------------------------
// clinics
// ---------------------------------------------------------------------------

export const clinics = pgTable("clinics", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("Asia/Tashkent"),
  /** Sozlanadigan: shifokor foizi qanday hisoblanadi. Bo'lim 13 ochiq savol
   * javobi topilguncha default = "gross". */
  doctorPctBasis: doctorPctBasisEnum("doctor_pct_basis").notNull().default("gross"),
  createdAt: createdAtCol(),
});

// ---------------------------------------------------------------------------
// users — auth. login GLOBAL noyob (login ekranida klinika tanlanmaydi,
// bo'lim 6 ekran-1: faqat "login + parol").
// ---------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id").notNull().references(() => clinics.id),
    login: text("login").notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name").notNull(),
    role: userRoleEnum("role").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAtCol(),
    deletedAt: deletedAtCol(),
  },
  (t) => ({
    loginUnique: uniqueIndex("users_login_unique").on(t.login),
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
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
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
    phone: text("phone").notNull(),
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
    phoneIdx: index("patients_phone_idx").on(t.clinicId, t.phone),
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
    /** FARAZ (dala ishida aniqlanadi): chegirma so'mda, foizda emas —
     * bo'lim 13 ochiq savollar ro'yxatida yo'q, lekin shifokor foizi bilan
     * bir xil noaniqlik toifasiga kiradi. Kerak bo'lsa keyin o'zgartiriladi. */
    discount: money("discount").notNull().default("0"),
    doctorPctSnapshot: percent("doctor_pct_snapshot").notNull(),
    materialCostSnapshot: money("material_cost_snapshot").notNull().default("0"),
    labCost: money("lab_cost").notNull().default("0"),
    /** Kafolat: tushum yo'q, xarajat bor. Ko'ring src/domain/doctorEarnings.ts */
    isWarranty: boolean("is_warranty").notNull().default(false),
    createdAt: createdAtCol(),
  },
  (t) => ({
    clinicIdx: index("performed_services_clinic_idx").on(t.clinicId),
    visitIdx: index("performed_services_visit_idx").on(t.visitId),
    doctorIdx: index("performed_services_doctor_idx").on(t.doctorId),
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
    createdBy: uuid("created_by").notNull().references(() => users.id),
    note: text("note"),
  },
  (t) => ({
    clinicIdx: index("payments_clinic_idx").on(t.clinicId),
    patientIdx: index("payments_patient_idx").on(t.patientId),
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
