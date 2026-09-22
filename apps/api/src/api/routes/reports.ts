import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq, gte, isNull, lt } from "drizzle-orm";
import { dailyReportQuerySchema, reportPeriodQuerySchema } from "@dental/shared";
import { db } from "../../db/client";
import {
  cashSessions,
  clinics,
  doctors,
  expenses,
  payments,
  performedServices,
  serviceCategories,
  services,
  visits,
} from "../../db/schema";
import { fromMoney, fromPercent } from "../../db/columns";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import { calculateDoctorEarning, calculateRevenue, calculateServiceMargin, type PerformedServiceInput } from "../../domain/doctorEarnings";
import type { AppVariables } from "../context";

/**
 * Ekran 8/9/10 — hisobotlar. Faqat OWNER (screens.ts). Yangi domen mantiq
 * yo'q — allaqachon test bilan tayyor `src/domain/doctorEarnings.ts`ga
 * tayanadi. `clinics.doctor_pct_basis` har so'rovda bir marta o'qiladi.
 */
export const reportRoutes = new Hono<{ Variables: AppVariables }>();

reportRoutes.use("*", requireAuth);
reportRoutes.use("*", requireRole("owner"));

async function getDoctorPctBasis(clinicId: string) {
  const rows = await db.select({ basis: clinics.doctorPctBasis }).from(clinics).where(eq(clinics.id, clinicId)).limit(1);
  return rows[0]?.basis ?? "gross";
}

function toPerformedServiceInput(row: {
  priceSnapshot: string;
  qty: number;
  discountAmount: string;
  doctorPctSnapshot: string;
  materialCostSnapshot: string;
  labCost: string;
  isWarranty: boolean;
}): PerformedServiceInput {
  return {
    priceSnapshot: fromMoney(row.priceSnapshot),
    qty: row.qty,
    discountAmount: fromMoney(row.discountAmount),
    doctorPctSnapshot: fromPercent(row.doctorPctSnapshot),
    materialCostSnapshot: fromMoney(row.materialCostSnapshot),
    labCost: fromMoney(row.labCost),
    isWarranty: row.isWarranty,
  };
}

/** Ekran 8 "Kunlik hisobot". */
reportRoutes.get("/daily", zValidator("query", dailyReportQuerySchema), async (c) => {
  const user = c.get("user");
  const { date } = c.req.valid("query");

  const dayStart = new Date(date);
  if (Number.isNaN(dayStart.getTime())) return c.json({ error: "Sana formati noto'g'ri" }, 400);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const basis = await getDoctorPctBasis(user.clinicId);

  const performedRows = await db
    .select({
      priceSnapshot: performedServices.priceSnapshot,
      qty: performedServices.qty,
      discountAmount: performedServices.discountAmount,
      doctorPctSnapshot: performedServices.doctorPctSnapshot,
      materialCostSnapshot: performedServices.materialCostSnapshot,
      labCost: performedServices.labCost,
      isWarranty: performedServices.isWarranty,
    })
    .from(performedServices)
    .where(
      and(
        eq(performedServices.clinicId, user.clinicId),
        isNull(performedServices.deletedAt),
        gte(performedServices.createdAt, dayStart),
        lt(performedServices.createdAt, dayEnd),
      ),
    );

  let revenue = 0;
  let doctorEarnings = 0;
  let materialCost = 0;
  for (const row of performedRows) {
    const input = toPerformedServiceInput(row);
    revenue += calculateRevenue(input);
    doctorEarnings += calculateDoctorEarning(input, basis);
    materialCost += input.materialCostSnapshot;
  }

  const paymentRows = await db
    .select({ amount: payments.amount, method: payments.method })
    .from(payments)
    .where(
      and(
        eq(payments.clinicId, user.clinicId),
        isNull(payments.deletedAt),
        gte(payments.paidAt, dayStart),
        lt(payments.paidAt, dayEnd),
      ),
    );
  const paymentsByMethod: Record<string, number> = {};
  let totalPayments = 0;
  for (const p of paymentRows) {
    const amount = fromMoney(p.amount);
    paymentsByMethod[p.method] = (paymentsByMethod[p.method] ?? 0) + amount;
    totalPayments += amount;
  }

  const expenseRows = await db
    .select({ amount: expenses.amount })
    .from(expenses)
    .where(
      and(
        eq(expenses.clinicId, user.clinicId),
        isNull(expenses.deletedAt),
        gte(expenses.spentAt, dayStart),
        lt(expenses.spentAt, dayEnd),
      ),
    );
  const expensesTotal = expenseRows.reduce((acc, e) => acc + fromMoney(e.amount), 0);

  const visitRows = await db
    .select({ id: visits.id })
    .from(visits)
    .where(
      and(
        eq(visits.clinicId, user.clinicId),
        isNull(visits.deletedAt),
        gte(visits.startedAt, dayStart),
        lt(visits.startedAt, dayEnd),
      ),
    );

  const sessionRows = await db
    .select()
    .from(cashSessions)
    .where(
      and(
        eq(cashSessions.clinicId, user.clinicId),
        isNull(cashSessions.deletedAt),
        gte(cashSessions.openedAt, dayStart),
        lt(cashSessions.openedAt, dayEnd),
      ),
    )
    .limit(1);
  const session = sessionRows[0];

  return c.json({
    date,
    revenue,
    doctorEarnings,
    materialCost,
    margin: revenue - doctorEarnings - materialCost,
    paymentsByMethod,
    totalPayments,
    expenses: expensesTotal,
    visitsCount: visitRows.length,
    cashSession: session
      ? {
          id: session.id,
          openedAt: session.openedAt,
          closedAt: session.closedAt,
          expectedCash: session.expectedCash,
          countedCash: session.countedCash,
          diff: session.diff,
        }
      : null,
  });
});

/** Ekran 9 "Oylik marja" — bo'lim 1: asosiy farqlanish nuqtasi. */
reportRoutes.get("/margin", zValidator("query", reportPeriodQuerySchema), async (c) => {
  const user = c.get("user");
  const { from, to } = c.req.valid("query");
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return c.json({ error: "Sana formati noto'g'ri" }, 400);
  }

  const basis = await getDoctorPctBasis(user.clinicId);

  const rows = await db
    .select({
      priceSnapshot: performedServices.priceSnapshot,
      qty: performedServices.qty,
      discountAmount: performedServices.discountAmount,
      doctorPctSnapshot: performedServices.doctorPctSnapshot,
      materialCostSnapshot: performedServices.materialCostSnapshot,
      labCost: performedServices.labCost,
      isWarranty: performedServices.isWarranty,
      categoryId: services.categoryId,
      categoryName: serviceCategories.name,
    })
    .from(performedServices)
    .innerJoin(services, eq(performedServices.serviceId, services.id))
    .leftJoin(serviceCategories, eq(services.categoryId, serviceCategories.id))
    .where(
      and(
        eq(performedServices.clinicId, user.clinicId),
        isNull(performedServices.deletedAt),
        gte(performedServices.createdAt, fromDate),
        lt(performedServices.createdAt, toDate),
      ),
    );

  const totals = { revenue: 0, doctorEarnings: 0, materialCost: 0, labCost: 0, margin: 0 };
  const byCategory = new Map<string, { categoryId: string | null; categoryName: string; revenue: number; doctorEarnings: number; materialCost: number; labCost: number; margin: number }>();

  for (const row of rows) {
    const input = toPerformedServiceInput(row);
    const result = calculateServiceMargin(input, basis);

    totals.revenue += result.revenue;
    totals.doctorEarnings += result.doctorEarning;
    totals.materialCost += result.materialCost;
    totals.labCost += result.labCost;
    totals.margin += result.margin;

    const key = row.categoryId ?? "__none__";
    const bucket = byCategory.get(key) ?? {
      categoryId: row.categoryId,
      categoryName: row.categoryName ?? "Kategoriyasiz",
      revenue: 0,
      doctorEarnings: 0,
      materialCost: 0,
      labCost: 0,
      margin: 0,
    };
    bucket.revenue += result.revenue;
    bucket.doctorEarnings += result.doctorEarning;
    bucket.materialCost += result.materialCost;
    bucket.labCost += result.labCost;
    bucket.margin += result.margin;
    byCategory.set(key, bucket);
  }

  const expenseRows = await db
    .select({ amount: expenses.amount })
    .from(expenses)
    .where(
      and(
        eq(expenses.clinicId, user.clinicId),
        isNull(expenses.deletedAt),
        gte(expenses.spentAt, fromDate),
        lt(expenses.spentAt, toDate),
      ),
    );
  const expensesTotal = expenseRows.reduce((acc, e) => acc + fromMoney(e.amount), 0);

  return c.json({
    from,
    to,
    ...totals,
    expenses: expensesTotal,
    netProfit: totals.margin - expensesTotal,
    byCategory: Array.from(byCategory.values()),
  });
});

/** Ekran 10 "Shifokor hisobi". */
reportRoutes.get("/doctors", zValidator("query", reportPeriodQuerySchema), async (c) => {
  const user = c.get("user");
  const { from, to } = c.req.valid("query");
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return c.json({ error: "Sana formati noto'g'ri" }, 400);
  }

  const basis = await getDoctorPctBasis(user.clinicId);

  const rows = await db
    .select({
      priceSnapshot: performedServices.priceSnapshot,
      qty: performedServices.qty,
      discountAmount: performedServices.discountAmount,
      doctorPctSnapshot: performedServices.doctorPctSnapshot,
      materialCostSnapshot: performedServices.materialCostSnapshot,
      labCost: performedServices.labCost,
      isWarranty: performedServices.isWarranty,
      doctorId: performedServices.doctorId,
      doctorName: doctors.fullName,
    })
    .from(performedServices)
    .innerJoin(doctors, eq(performedServices.doctorId, doctors.id))
    .where(
      and(
        eq(performedServices.clinicId, user.clinicId),
        isNull(performedServices.deletedAt),
        gte(performedServices.createdAt, fromDate),
        lt(performedServices.createdAt, toDate),
      ),
    );

  const byDoctor = new Map<string, { doctorId: string; doctorName: string; servicesCount: number; revenue: number; doctorEarnings: number }>();
  for (const row of rows) {
    const input = toPerformedServiceInput(row);
    const revenue = calculateRevenue(input);
    const doctorEarning = calculateDoctorEarning(input, basis);

    const bucket = byDoctor.get(row.doctorId) ?? {
      doctorId: row.doctorId,
      doctorName: row.doctorName,
      servicesCount: 0,
      revenue: 0,
      doctorEarnings: 0,
    };
    bucket.servicesCount += 1;
    bucket.revenue += revenue;
    bucket.doctorEarnings += doctorEarning;
    byDoctor.set(row.doctorId, bucket);
  }

  return c.json(Array.from(byDoctor.values()));
});
