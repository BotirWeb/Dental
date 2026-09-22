import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, gt, isNull, lt, or } from "drizzle-orm";
import { createAppointmentSchema, scheduleQuerySchema, updateAppointmentStatusSchema } from "@dental/shared";
import { db } from "../../db/client";
import { appointments, patients } from "../../db/schema";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import { idempotency } from "../middleware/idempotency";
import { recordAudit } from "../audit";
import { findAppointmentConflicts } from "../../domain/appointments";
import type { AppVariables } from "../context";

/**
 * Ekran 2 "Jadval" / ekran 5 "Yozuv modal". `appointments` — REJA (Tamoyil
 * #1, qollanma bo'lim 5.1), `visits`/kassa bilan bog'lanmaydi (ekran 6, hali
 * qurilmagan).
 */
export const appointmentRoutes = new Hono<{ Variables: AppVariables }>();

appointmentRoutes.use("*", requireAuth);

/**
 * Ikki rejim (packages/shared/src/dto/appointments.ts, ScheduleQuery):
 *   - `from`+`to` — ekran 2 "Jadval": bitta kun/hafta oralig'i.
 *   - `patientId` — ekran 4 "Bemor kartasi": shu bemorning barcha yozuvlari.
 */
appointmentRoutes.get("/", zValidator("query", scheduleQuerySchema), async (c) => {
  const user = c.get("user");
  const { from, to, patientId } = c.req.valid("query");

  const conditions = [eq(appointments.clinicId, user.clinicId), isNull(appointments.deletedAt)];

  if (from && to) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return c.json({ error: "Sana formati noto'g'ri" }, 400);
    }
    conditions.push(lt(appointments.startAt, toDate), gt(appointments.endAt, fromDate));
  }
  if (patientId) {
    conditions.push(eq(appointments.patientId, patientId));
  }

  const rows = await db
    .select({
      id: appointments.id,
      clinicId: appointments.clinicId,
      patientId: appointments.patientId,
      patientFullName: patients.fullName,
      doctorId: appointments.doctorId,
      chairId: appointments.chairId,
      startAt: appointments.startAt,
      endAt: appointments.endAt,
      status: appointments.status,
      note: appointments.note,
      createdBy: appointments.createdBy,
      createdAt: appointments.createdAt,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .where(and(...conditions))
    .orderBy(desc(appointments.startAt));

  return c.json(rows);
});

/** Rol jadvali (bo'lim 6): yozuvni admin/ega qo'shadi (registratura) — patients.ts naqshi. */
appointmentRoutes.post(
  "/",
  requireRole("owner", "admin"),
  idempotency(),
  zValidator("json", createAppointmentSchema),
  async (c) => {
    const user = c.get("user");
    const input = c.req.valid("json");
    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);

    /**
     * VAQT TO'QNASHUVI — bitta kreslo/shifokor bir vaqtda ikkita yozuvga
     * bo'lmasin. `src/domain/appointments.ts` (sof funksiya, test bilan).
     * Tekshiruv doirasi: shu kun atrofidagi (kengroq) yozuvlar — SQL'da
     * chair/doctor mosligi bilan cheklab, aniq kesishuvni JS'da hal qilamiz.
     */
    const nearby = await db
      .select({
        id: appointments.id,
        chairId: appointments.chairId,
        doctorId: appointments.doctorId,
        startAt: appointments.startAt,
        endAt: appointments.endAt,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.clinicId, user.clinicId),
          isNull(appointments.deletedAt),
          or(eq(appointments.chairId, input.chairId), eq(appointments.doctorId, input.doctorId)),
        ),
      );

    const conflicts = findAppointmentConflicts({ chairId: input.chairId, doctorId: input.doctorId, startAt, endAt }, nearby);
    if (conflicts.length > 0) {
      return c.json({ error: "Shu vaqtda kreslo yoki shifokor band — boshqa vaqt tanlang" }, 409);
    }

    const [created] = await db
      .insert(appointments)
      .values({
        clinicId: user.clinicId,
        patientId: input.patientId,
        doctorId: input.doctorId,
        chairId: input.chairId,
        startAt,
        endAt,
        note: input.note,
        createdBy: user.id,
      })
      .returning();

    await recordAudit({
      clinicId: user.clinicId,
      userId: user.id,
      entity: "appointments",
      entityId: created.id,
      action: "create",
      newValue: created,
    });

    return c.json(created, 201);
  },
);

/** Holat o'zgartirish (masalan "kelmadi", "bekor qilindi") — registratura. */
appointmentRoutes.patch(
  "/:id",
  requireRole("owner", "admin"),
  zValidator("json", updateAppointmentStatusSchema),
  async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const { status } = c.req.valid("json");

    const rows = await db
      .select()
      .from(appointments)
      .where(and(eq(appointments.id, id), eq(appointments.clinicId, user.clinicId), isNull(appointments.deletedAt)))
      .limit(1);
    const existing = rows[0];
    if (!existing) return c.json({ error: "Yozuv topilmadi" }, 404);

    const [updated] = await db
      .update(appointments)
      .set({ status })
      .where(eq(appointments.id, id))
      .returning();

    await recordAudit({
      clinicId: user.clinicId,
      userId: user.id,
      entity: "appointments",
      entityId: id,
      action: "update",
      oldValue: existing,
      newValue: updated,
    });

    return c.json(updated);
  },
);
