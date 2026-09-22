import { Hono } from "hono";
import { zValidate as zValidator } from "../validate";
import { and, eq, isNull } from "drizzle-orm";
import { createPerformedServiceSchema, createVisitSchema } from "@dental/shared";
import { db } from "../../db/client";
import { doctors, performedServices, payments, services, visits } from "../../db/schema";
import { fromMoney, toMoneyInput } from "../../db/columns";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import { idempotency } from "../middleware/idempotency";
import { recordAudit } from "../audit";
import { computeDiscountAmount, lineTotal, DiscountError } from "../../domain/discount";
import type { AppVariables } from "../context";

/**
 * Ekran 6 "Kassa / vizit yakuni". `visits` — FAKT (Tamoyil #1), `appointments`
 * dan alohida. Rol — `screens.ts` ekran 6 jadvaliga mos: owner/admin/cashier
 * (registratura hammasini kiritadi, xuddi bemor/appointment'dagidek —
 * `doctor` bu ekranga umuman kirmaydi). **FARAZ:** aniq rol taqsimoti
 * spetsifikatsiyada yo'q edi, `screens.ts`dagi ro'yxatga moslashtirildi —
 * dala ishida tasdiqlanishi kerak (`docs/talablar.md`).
 */
export const visitRoutes = new Hono<{ Variables: AppVariables }>();

visitRoutes.use("*", requireAuth);

visitRoutes.post(
  "/",
  requireRole("owner", "admin", "cashier"),
  idempotency(),
  zValidator("json", createVisitSchema),
  async (c) => {
    const user = c.get("user");
    const input = c.req.valid("json");

    const [created] = await db
      .insert(visits)
      .values({
        clinicId: user.clinicId,
        appointmentId: input.appointmentId,
        patientId: input.patientId,
        doctorId: input.doctorId,
        chairId: input.chairId,
        startedAt: new Date(),
        note: input.note,
      })
      .returning();

    await recordAudit({
      clinicId: user.clinicId,
      userId: user.id,
      entity: "visits",
      entityId: created.id,
      action: "create",
      newValue: created,
    });

    return c.json(created, 201);
  },
);

/** Vizit + shu vizitdagi xizmatlar + shu vizitga bog'langan to'lovlar. */
visitRoutes.get("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const visitRows = await db
    .select()
    .from(visits)
    .where(and(eq(visits.id, id), eq(visits.clinicId, user.clinicId), isNull(visits.deletedAt)))
    .limit(1);
  const visit = visitRows[0];
  if (!visit) return c.json({ error: "Vizit topilmadi" }, 404);

  const performedRows = await db
    .select({
      id: performedServices.id,
      clinicId: performedServices.clinicId,
      visitId: performedServices.visitId,
      serviceId: performedServices.serviceId,
      serviceName: services.name,
      doctorId: performedServices.doctorId,
      tooth: performedServices.tooth,
      surfaces: performedServices.surfaces,
      qty: performedServices.qty,
      priceSnapshot: performedServices.priceSnapshot,
      discountType: performedServices.discountType,
      discountValue: performedServices.discountValue,
      discountAmount: performedServices.discountAmount,
      doctorPctSnapshot: performedServices.doctorPctSnapshot,
      materialCostSnapshot: performedServices.materialCostSnapshot,
      labCost: performedServices.labCost,
      isWarranty: performedServices.isWarranty,
      createdAt: performedServices.createdAt,
    })
    .from(performedServices)
    .innerJoin(services, eq(performedServices.serviceId, services.id))
    .where(and(eq(performedServices.visitId, id), isNull(performedServices.deletedAt)));

  const paymentRows = await db
    .select()
    .from(payments)
    .where(and(eq(payments.visitId, id), isNull(payments.deletedAt)));

  return c.json({ ...visit, performedServices: performedRows, payments: paymentRows });
});

/** Vizitni yakunlash — `finished_at` belgilanadi. */
visitRoutes.patch("/:id", requireRole("owner", "admin", "cashier"), async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const rows = await db
    .select()
    .from(visits)
    .where(and(eq(visits.id, id), eq(visits.clinicId, user.clinicId), isNull(visits.deletedAt)))
    .limit(1);
  const existing = rows[0];
  if (!existing) return c.json({ error: "Vizit topilmadi" }, 404);
  if (existing.finishedAt) return c.json({ error: "Vizit allaqachon yakunlangan" }, 409);

  const [updated] = await db.update(visits).set({ finishedAt: new Date() }).where(eq(visits.id, id)).returning();

  await recordAudit({
    clinicId: user.clinicId,
    userId: user.id,
    entity: "visits",
    entityId: id,
    action: "update",
    oldValue: existing,
    newValue: updated,
  });

  return c.json(updated);
});

/**
 * Xizmat qo'shish — Tamoyil #2 MAJBURIY snapshot: narx/shifokor foizi/material
 * narxi `services`/`doctors`dan HOZIR o'qiladi va nusxalanadi (keyin
 * o'zgarsa ham bu yozuv o'zgarmaydi). Shifokor — doim vizitning shifokori
 * (yuqoridagi FARAZ).
 */
visitRoutes.post(
  "/:id/performed-services",
  requireRole("owner", "admin", "cashier"),
  idempotency(),
  zValidator("json", createPerformedServiceSchema),
  async (c) => {
    const user = c.get("user");
    const visitId = c.req.param("id");
    const input = c.req.valid("json");

    const visitRows = await db
      .select()
      .from(visits)
      .where(and(eq(visits.id, visitId), eq(visits.clinicId, user.clinicId), isNull(visits.deletedAt)))
      .limit(1);
    const visit = visitRows[0];
    if (!visit) return c.json({ error: "Vizit topilmadi" }, 404);

    const serviceRows = await db
      .select()
      .from(services)
      .where(and(eq(services.id, input.serviceId), eq(services.clinicId, user.clinicId)))
      .limit(1);
    const service = serviceRows[0];
    if (!service) return c.json({ error: "Xizmat topilmadi" }, 404);

    const doctorRows = await db
      .select()
      .from(doctors)
      .where(and(eq(doctors.id, visit.doctorId), eq(doctors.clinicId, user.clinicId)))
      .limit(1);
    const doctor = doctorRows[0];
    if (!doctor) return c.json({ error: "Shifokor topilmadi" }, 404);

    const priceSnapshot = fromMoney(service.price);
    const total = lineTotal(priceSnapshot, input.qty);

    let discountAmount: number;
    try {
      discountAmount = computeDiscountAmount({ type: input.discountType, value: input.discountValue }, total);
    } catch (err) {
      if (err instanceof DiscountError) return c.json({ error: err.message }, 400);
      throw err;
    }

    const [created] = await db
      .insert(performedServices)
      .values({
        clinicId: user.clinicId,
        visitId,
        serviceId: service.id,
        doctorId: doctor.id,
        tooth: input.tooth,
        surfaces: input.surfaces,
        qty: input.qty,
        priceSnapshot: toMoneyInput(priceSnapshot),
        discountType: input.discountType,
        discountValue: input.discountValue.toString(),
        discountAmount: toMoneyInput(discountAmount),
        doctorPctSnapshot: doctor.defaultPct,
        materialCostSnapshot: service.materialCost,
        isWarranty: input.isWarranty,
      })
      .returning();

    await recordAudit({
      clinicId: user.clinicId,
      userId: user.id,
      entity: "performed_services",
      entityId: created.id,
      action: "create",
      newValue: created,
    });

    return c.json(created, 201);
  },
);
