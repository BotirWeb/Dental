import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import {
  DENTAL_CHART_EDIT_ROLES,
  DENTAL_CHART_MAX_BYTES,
  DENTAL_CHART_VIEW_ROLES,
  saveDentalChartSchema,
  type DentalChartPayload,
  type DentalChartResponse,
  type SavedDentalChart,
} from "@dental/shared";
import { zValidate as zValidator } from "../validate";
import { db } from "../../db/client";
import { dentalCharts, patients, users } from "../../db/schema";
import { requireRole } from "../middleware/roles";
import { requireFeature } from "../middleware/features";
import { idempotency } from "../middleware/idempotency";
import { recordAudit } from "../audit";
import { decideChartSave, jsonByteLength } from "../../domain/dentalChart";
import type { AppVariables } from "../context";

/**
 * T5 "Tish kartasi" — `/api/patients/:patientId/dental-chart`.
 *
 * `patientRoutes` ICHIGA ulanadi (`routes/patients.ts`) — `requireAuth`
 * o'sha yerdagi `use("*")`dan keladi, bu yerda ikkinchi marta qo'yilmaydi
 * (aks holda har so'rovda sessiya ikki marta o'qilardi).
 *
 * Rollar (`docs/talablar.md`, T5): ko'radi — owner/admin/doctor, tahrirlaydi —
 * owner/doctor. Kassir kirmaydi. Bitta manba: `DENTAL_CHART_*_ROLES` (shared).
 */
export const dentalChartRoutes = new Hono<{ Variables: AppVariables }>();

dentalChartRoutes.use("*", requireFeature("odontogram"));

// Noto'g'ri UUID Postgres'ga yetib borsa "invalid input syntax" -> 500 bo'lardi.
const paramSchema = z.object({ patientId: z.string().uuid("Bemor ID noto'g'ri") });

const MAX_BYTES_LABEL = `${Math.round(DENTAL_CHART_MAX_BYTES / 1024)} KB`;

dentalChartRoutes.get("/", requireRole(...DENTAL_CHART_VIEW_ROLES), zValidator("param", paramSchema), async (c) => {
  const user = c.get("user");
  const { patientId } = c.req.valid("param");

  const patientRows = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, patientId), eq(patients.clinicId, user.clinicId), isNull(patients.deletedAt)))
    .limit(1);
  if (!patientRows[0]) return c.json({ error: "Bemor topilmadi" }, 404);

  const rows = await db
    .select({
      id: dentalCharts.id,
      patientId: dentalCharts.patientId,
      payload: dentalCharts.payload,
      payloadVersion: dentalCharts.payloadVersion,
      createdAt: dentalCharts.createdAt,
      createdBy: dentalCharts.createdBy,
      createdByName: users.fullName,
    })
    .from(dentalCharts)
    .innerJoin(users, eq(dentalCharts.createdBy, users.id))
    .where(
      and(
        eq(dentalCharts.clinicId, user.clinicId),
        eq(dentalCharts.patientId, patientId),
        isNull(dentalCharts.deletedAt),
      ),
    )
    .orderBy(desc(dentalCharts.createdAt), desc(dentalCharts.id))
    .limit(1);

  const row = rows[0];
  const response: DentalChartResponse = {
    chart: row
      ? {
          ...row,
          // jsonb -> unknown; saqlashda `saveDentalChartSchema`dan o'tgan.
          payload: row.payload as DentalChartPayload,
          createdAt: row.createdAt.toISOString(),
        }
      : null,
  };
  return c.json(response);
});

dentalChartRoutes.post(
  "/",
  requireRole(...DENTAL_CHART_EDIT_ROLES),
  // Tana o'qilishidan OLDIN — katta so'rov xotiraga to'liq yuklanmasin.
  // +16 KB: `baseChartId` va JSON o'rami uchun zaxira; aniq chegara pastda.
  bodyLimit({
    maxSize: DENTAL_CHART_MAX_BYTES + 16 * 1024,
    onError: (c) => c.json({ error: `Karta juda katta — ${MAX_BYTES_LABEL} dan oshmasligi kerak` }, 413),
  }),
  idempotency(),
  zValidator("param", paramSchema),
  zValidator("json", saveDentalChartSchema),
  async (c) => {
    const user = c.get("user");
    const { patientId } = c.req.valid("param");
    const { payload, baseChartId } = c.req.valid("json");

    const bytes = jsonByteLength(payload);
    if (bytes > DENTAL_CHART_MAX_BYTES) {
      return c.json({ error: `Karta juda katta — ${MAX_BYTES_LABEL} dan oshmasligi kerak` }, 413);
    }

    // Tekshiruv + yozuv bitta tranzaksiyada, bemor qatori FOR UPDATE bilan
    // qulflanadi: shu bemor kartasini parallel saqlayotgan ikkinchi so'rov
    // birinchisi tugaguncha kutadi va keyin to'qnashuvni (409) ko'radi.
    // Izoh: `src/domain/dentalChart.ts`.
    const result = await db.transaction(async (tx) => {
      const patientRows = await tx
        .select({ id: patients.id })
        .from(patients)
        .where(and(eq(patients.id, patientId), eq(patients.clinicId, user.clinicId), isNull(patients.deletedAt)))
        .for("update");
      if (!patientRows[0]) return { kind: "not_found" } as const;

      const latestRows = await tx
        .select({ id: dentalCharts.id })
        .from(dentalCharts)
        .where(
          and(
            eq(dentalCharts.clinicId, user.clinicId),
            eq(dentalCharts.patientId, patientId),
            isNull(dentalCharts.deletedAt),
          ),
        )
        .orderBy(desc(dentalCharts.createdAt), desc(dentalCharts.id))
        .limit(1);

      const decision = decideChartSave({ latestChartId: latestRows[0]?.id ?? null, baseChartId });
      if (decision.kind === "conflict") return { kind: "conflict" } as const;

      const [created] = await tx
        .insert(dentalCharts)
        .values({
          clinicId: user.clinicId,
          patientId,
          payload,
          payloadVersion: payload.version,
          createdBy: user.id,
          // now() emas: now() — tranzaksiya BOSHLANGAN vaqt, qulfni kutgan
          // so'rov o'zidan oldin yozilganidan ham "eskiroq" vaqt olishi
          // mumkin edi. clock_timestamp() — haqiqiy yozilish vaqti, shunda
          // "oxirgi versiya" tartibi yozilish tartibiga mos.
          createdAt: sql`clock_timestamp()`,
        })
        .returning({
          id: dentalCharts.id,
          patientId: dentalCharts.patientId,
          payloadVersion: dentalCharts.payloadVersion,
          createdAt: dentalCharts.createdAt,
          createdBy: dentalCharts.createdBy,
        });
      return { kind: "created", created } as const;
    });

    if (result.kind === "not_found") return c.json({ error: "Bemor topilmadi" }, 404);
    if (result.kind === "conflict") {
      return c.json(
        { error: "Karta siz ochganingizdan keyin boshqa foydalanuvchi tomonidan saqlangan. Sahifani yangilang va o'zgarishni qayta kiriting" },
        409,
      );
    }

    // Audit'ga karta tanasi YOZILMAYDI: `dental_charts` qatori o'zi
    // o'zgarmas (UPDATE yo'q), tana o'sha yerda to'liq turadi — audit'ga
    // nusxalash har saqlashda o'nlab KB takrorlanishi bo'lardi.
    await recordAudit({
      clinicId: user.clinicId,
      userId: user.id,
      entity: "dental_charts",
      entityId: result.created.id,
      action: "create",
      newValue: { patientId, payloadVersion: payload.version, baseChartId, bytes },
    });

    const saved: SavedDentalChart = {
      ...result.created,
      createdAt: result.created.createdAt.toISOString(),
      createdByName: user.fullName,
    };
    return c.json(saved, 201);
  },
);
