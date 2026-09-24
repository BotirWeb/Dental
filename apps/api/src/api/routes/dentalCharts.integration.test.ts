import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import type { DentalChartResponse, MeResponse, SavedDentalChart } from "@dental/shared";
import { app } from "../app";
import { db } from "../../db/client";
import { auditLog, dentalCharts, patients } from "../../db/schema";
import {
  TEST_ORIGIN_HEADERS,
  cleanupClinic,
  createTestClinic,
  createTestPatient,
  createTestUser,
  loginAs,
  type TestClinic,
  type TestPatient,
} from "../../testing/helpers";

/** T5 "Tish kartasi" — `routes/dentalCharts.ts`, `domain/dentalChart.ts`. */
describe("Tish kartasi (T5)", () => {
  let clinic: TestClinic;
  let otherClinic: TestClinic;
  let disabledClinic: TestClinic;
  let doctorCookie: string;
  let ownerCookie: string;
  let adminCookie: string;
  let cashierCookie: string;
  let otherDoctorCookie: string;
  let disabledDoctorCookie: string;
  let patient: TestPatient;
  let disabledPatient: TestPatient;

  beforeAll(async () => {
    clinic = await createTestClinic({ features: { odontogram: true } });
    otherClinic = await createTestClinic({ features: { odontogram: true } });
    disabledClinic = await createTestClinic();

    const doctor = await createTestUser(clinic.id, { role: "doctor", fullName: "Dr Karimova" });
    const owner = await createTestUser(clinic.id, { role: "owner" });
    const admin = await createTestUser(clinic.id, { role: "admin" });
    const cashier = await createTestUser(clinic.id, { role: "cashier" });
    const otherDoctor = await createTestUser(otherClinic.id, { role: "doctor" });
    const disabledDoctor = await createTestUser(disabledClinic.id, { role: "doctor" });

    ({ cookie: doctorCookie } = await loginAs(clinic.slug, doctor.login, doctor.password));
    ({ cookie: ownerCookie } = await loginAs(clinic.slug, owner.login, owner.password));
    ({ cookie: adminCookie } = await loginAs(clinic.slug, admin.login, admin.password));
    ({ cookie: cashierCookie } = await loginAs(clinic.slug, cashier.login, cashier.password));
    ({ cookie: otherDoctorCookie } = await loginAs(otherClinic.slug, otherDoctor.login, otherDoctor.password));
    ({ cookie: disabledDoctorCookie } = await loginAs(disabledClinic.slug, disabledDoctor.login, disabledDoctor.password));

    patient = await createTestPatient(clinic.id);
    disabledPatient = await createTestPatient(disabledClinic.id);
  });

  afterAll(async () => {
    await cleanupClinic(clinic.id);
    await cleanupClinic(otherClinic.id);
    await cleanupClinic(disabledClinic.id);
  });

  function chartUrl(patientId: string) {
    return `/api/patients/${patientId}/dental-chart`;
  }

  function get(patientId: string, cookie: string) {
    return app.request(chartUrl(patientId), { headers: { Cookie: cookie } });
  }

  function post(patientId: string, cookie: string, body: unknown, idempotencyKey: string = crypto.randomUUID()) {
    return app.request(chartUrl(patientId), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        "Idempotency-Key": idempotencyKey,
        ...TEST_ORIGIN_HEADERS,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  }

  /** Kutubxona `getStatusChart()` shakliga o'xshash, 32 tishli karta. */
  function samplePayload(marker: string) {
    const teeth: Record<string, unknown> = {};
    for (const q of [1, 2, 3, 4]) for (let n = 1; n <= 8; n++) teeth[`${q}${n}`] = { toothSelection: "tooth-base" };
    teeth["16"] = { toothSelection: "tooth-base", caries: ["occlusal"], note: marker };
    return { version: "2.22", globals: { wisdomVisible: true, edentulous: false }, teeth };
  }

  async function chartCount(patientId: string) {
    const rows = await db.select({ id: dentalCharts.id }).from(dentalCharts).where(eq(dentalCharts.patientId, patientId));
    return rows.length;
  }

  it("/auth/me klinika feature flag'larini qaytaradi", async () => {
    const on = (await (await app.request("/api/auth/me", { headers: { Cookie: doctorCookie } })).json()) as MeResponse;
    const off = (await (await app.request("/api/auth/me", { headers: { Cookie: disabledDoctorCookie } })).json()) as MeResponse;
    expect(on.features).toEqual({ odontogram: true });
    expect(off.features).toEqual({ odontogram: false });
  });

  it("modul yoqilmagan klinikada GET va POST -> 404 (tushunarli xabar bilan)", async () => {
    const getRes = await get(disabledPatient.id, disabledDoctorCookie);
    expect(getRes.status).toBe(404);
    expect(((await getRes.json()) as { error: string }).error).toContain("yoqilmagan");

    const postRes = await post(disabledPatient.id, disabledDoctorCookie, { payload: samplePayload("x"), baseChartId: null });
    expect(postRes.status).toBe(404);
    expect(await chartCount(disabledPatient.id)).toBe(0);
  });

  it("karta hali yo'q -> { chart: null }", async () => {
    const res = await get(patient.id, doctorCookie);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ chart: null });
  });

  let firstId: string;
  let secondId: string;

  it("shifokor birinchi kartani saqlaydi, GET aynan shu tarkibni qaytaradi", async () => {
    const payload = samplePayload("birinchi");
    const res = await post(patient.id, doctorCookie, { payload, baseChartId: null });
    expect(res.status).toBe(201);
    const saved = (await res.json()) as SavedDentalChart;
    expect(saved.patientId).toBe(patient.id);
    expect(saved.payloadVersion).toBe("2.22");
    expect(saved.createdByName).toBe("Dr Karimova");
    expect(saved).not.toHaveProperty("payload");
    firstId = saved.id;

    const body = (await (await get(patient.id, doctorCookie)).json()) as DentalChartResponse;
    expect(body.chart?.id).toBe(firstId);
    expect(body.chart?.payload).toEqual(payload);
    expect(body.chart?.createdByName).toBe("Dr Karimova");
  });

  it("keyingi saqlash yangi versiya — eskisi o'zgarmaydi, GET oxirgisini beradi", async () => {
    const res = await post(patient.id, ownerCookie, { payload: samplePayload("ikkinchi"), baseChartId: firstId });
    expect(res.status).toBe(201);
    secondId = ((await res.json()) as SavedDentalChart).id;

    const body = (await (await get(patient.id, doctorCookie)).json()) as DentalChartResponse;
    expect(body.chart?.id).toBe(secondId);
    expect((body.chart?.payload.teeth["16"] as { note: string }).note).toBe("ikkinchi");

    const [first] = await db.select().from(dentalCharts).where(eq(dentalCharts.id, firstId));
    expect(((first.payload as { teeth: Record<string, { note?: string }> }).teeth["16"]).note).toBe("birinchi");
    expect(await chartCount(patient.id)).toBe(2);
  });

  it("eski versiya ustida saqlash -> 409, yangi qator yozilmaydi (lost update yo'q)", async () => {
    const res = await post(patient.id, doctorCookie, { payload: samplePayload("eskidan"), baseChartId: firstId });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toContain("yangilang");
    expect(await chartCount(patient.id)).toBe(2);
  });

  it("karta mavjud, lekin mijoz bo'sh holatdan (null) saqlasa -> 409", async () => {
    const res = await post(patient.id, doctorCookie, { payload: samplePayload("nulldan"), baseChartId: null });
    expect(res.status).toBe(409);
  });

  it("bir vaqtda ikkita saqlash bir xil versiyadan -> faqat bittasi o'tadi", async () => {
    const [a, b] = await Promise.all([
      post(patient.id, doctorCookie, { payload: samplePayload("parallel-a"), baseChartId: secondId }),
      post(patient.id, ownerCookie, { payload: samplePayload("parallel-b"), baseChartId: secondId }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(await chartCount(patient.id)).toBe(3);

    const winner = (await (a.status === 201 ? a : b).json()) as SavedDentalChart;
    const body = (await (await get(patient.id, doctorCookie)).json()) as DentalChartResponse;
    expect(body.chart?.id).toBe(winner.id);
    secondId = winner.id;
  });

  it("bir xil Idempotency-Key bilan qayta yuborish -> bitta yozuv, bir xil javob", async () => {
    const key = crypto.randomUUID();
    const body = { payload: samplePayload("idem"), baseChartId: secondId };
    const first = await post(patient.id, doctorCookie, body, key);
    const retry = await post(patient.id, doctorCookie, body, key);
    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    const firstSaved = (await first.json()) as SavedDentalChart;
    expect(((await retry.json()) as SavedDentalChart).id).toBe(firstSaved.id);
    expect(await chartCount(patient.id)).toBe(4);
    secondId = firstSaved.id;
  });

  it("audit_log yoziladi — karta tanasisiz (faqat metama'lumot)", async () => {
    const rows = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entity, "dental_charts"), eq(auditLog.entityId, firstId)));
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe("create");
    const value = rows[0].newValue as Record<string, unknown>;
    expect(value.patientId).toBe(patient.id);
    expect(value.baseChartId).toBeNull();
    expect(typeof value.bytes).toBe("number");
    expect(value).not.toHaveProperty("payload");
  });

  it("rollar: admin ko'radi, lekin saqlay olmaydi; kassir umuman kirmaydi", async () => {
    expect((await get(patient.id, adminCookie)).status).toBe(200);
    expect((await post(patient.id, adminCookie, { payload: samplePayload("admin"), baseChartId: secondId })).status).toBe(403);
    expect((await get(patient.id, cashierCookie)).status).toBe(403);
    expect((await post(patient.id, cashierCookie, { payload: samplePayload("kassir"), baseChartId: secondId })).status).toBe(403);
  });

  it("boshqa klinika shifokori bu bemor kartasini ko'rmaydi va yozolmaydi -> 404", async () => {
    expect((await get(patient.id, otherDoctorCookie)).status).toBe(404);
    const res = await post(patient.id, otherDoctorCookie, { payload: samplePayload("begona"), baseChartId: null });
    expect(res.status).toBe(404);
    expect(await chartCount(patient.id)).toBe(4);
  });

  it("noto'g'ri bemor ID -> 400 (500 emas)", async () => {
    const res = await get("not-a-uuid", doctorCookie);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("Bemor ID noto'g'ri");
  });

  it("yaroqsiz tish raqami -> 400, xabar tuzatish yo'lini aytadi", async () => {
    const res = await post(patient.id, doctorCookie, { payload: { version: "2.22", teeth: { "99": {} } }, baseChartId: secondId });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain("11–48");
  });

  it("juda katta karta -> 413", async () => {
    const payload = samplePayload("x".repeat(600 * 1024));
    const res = await post(patient.id, doctorCookie, { payload, baseChartId: secondId });
    expect(res.status).toBe(413);
    expect(((await res.json()) as { error: string }).error).toContain("KB");
    expect(await chartCount(patient.id)).toBe(4);
  });

  it("o'chirilgan bemor -> 404", async () => {
    const gone = await createTestPatient(clinic.id);
    await db.update(patients).set({ deletedAt: new Date() }).where(eq(patients.id, gone.id));
    expect((await get(gone.id, doctorCookie)).status).toBe(404);
    expect((await post(gone.id, doctorCookie, { payload: samplePayload("x"), baseChartId: null })).status).toBe(404);
  });
});
