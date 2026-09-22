import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../app";
import {
  TEST_ORIGIN_HEADERS,
  cleanupClinic,
  createTestClinic,
  createTestDoctor,
  createTestPatient,
  createTestService,
  createTestUser,
  loginAs,
  type TestClinic,
  type TestDoctor,
  type TestPatient,
  type TestService,
} from "../../testing/helpers";

/**
 * Ekran 6 "Kassa / vizit yakuni" — to'liq oqim: smena -> vizit -> xizmat
 * (chegirma bilan) -> to'lov -> bekor qilish -> smenani yopish. Har bir
 * hisob-kitob (chegirma, bemor balansi, kassa farqi) oldin qo'lda curl bilan
 * tekshirilgan edi (docs/tasks/2026-09-22-tuzatishlar.md T5 hisoboti),
 * bu yerda avtomatlashtirilgan.
 */
describe("Kassa oqimi (ekran 6)", () => {
  let clinic: TestClinic;
  let ownerCookie: string;
  let doctor: TestDoctor;
  let service: TestService;
  let patient: TestPatient;

  beforeAll(async () => {
    clinic = await createTestClinic();
    const owner = await createTestUser(clinic.id, { role: "owner" });
    ({ cookie: ownerCookie } = await loginAs(clinic.slug, owner.login, owner.password));
    doctor = await createTestDoctor(clinic.id, { defaultPct: 40 });
    service = await createTestService(clinic.id, { price: 350_000, materialCost: 40_000 });
    patient = await createTestPatient(clinic.id);
  });

  afterAll(async () => {
    await cleanupClinic(clinic.id);
  });

  function post(path: string, body: unknown, idempotencyKey = crypto.randomUUID()) {
    return app.request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: ownerCookie, "Idempotency-Key": idempotencyKey, ...TEST_ORIGIN_HEADERS },
      body: JSON.stringify(body),
    });
  }

  it("smena ochilmasdan naqd to'lov -> 409", async () => {
    const res = await post("/api/payments", { patientId: patient.id, amount: 10_000, method: "cash" });
    expect(res.status).toBe(409);
  });

  let sessionId: string;

  it("smena ochiladi", async () => {
    const res = await post("/api/cash-sessions", { openingFloat: 100_000 });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    sessionId = body.id;
  });

  it("ikkinchi marta ochish -> 409", async () => {
    const res = await post("/api/cash-sessions", { openingFloat: 50_000 });
    expect(res.status).toBe(409);
  });

  let visitId: string;

  it("vizit boshlanadi", async () => {
    const res = await post("/api/visits", { patientId: patient.id, doctorId: doctor.id });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    visitId = body.id;
  });

  it("xizmat qo'shiladi — 20% chegirma, snapshot to'g'ri hisoblanadi", async () => {
    const res = await post(`/api/visits/${visitId}/performed-services`, {
      serviceId: service.id,
      tooth: 26,
      discountType: "percent",
      discountValue: 20,
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, string>;
    // 350000 * 20% = 70000
    expect(body.discountAmount).toBe("70000");
    expect(body.priceSnapshot).toBe("350000");
    expect(body.doctorPctSnapshot).toBe("40.00");
  });

  let firstPaymentId: string;

  it("naqd to'lov (100000) qabul qilinadi", async () => {
    const res = await post("/api/payments", { patientId: patient.id, visitId, amount: 100_000, method: "cash" });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; cashSessionId: string };
    firstPaymentId = body.id;
    expect(body.cashSessionId).toBe(sessionId);
  });

  it("bemor balansi to'g'ri: hisoblandi 280000, to'landi 100000, qarz 180000", async () => {
    const res = await app.request(`/api/patients/${patient.id}/balance`, { headers: { Cookie: ownerCookie } });
    const body = (await res.json()) as { charged: number; paid: number; debt: number };
    expect(body).toEqual({ charged: 280_000, paid: 100_000, balance: 180_000, debt: 180_000, advance: 0 });
  });

  it("to'lov bekor qilinadi (tuzatuvchi yozuv) — kanonik qoida: qarz asl holatga qaytadi", async () => {
    const res = await post(`/api/payments/${firstPaymentId}/void`, { reason: "xato kiritildi" });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { amount: string; reversalOfId: string };
    expect(body.amount).toBe("-100000");
    expect(body.reversalOfId).toBe(firstPaymentId);

    const balRes = await app.request(`/api/patients/${patient.id}/balance`, { headers: { Cookie: ownerCookie } });
    const bal = (await balRes.json()) as { paid: number; debt: number };
    expect(bal.paid).toBe(0);
    expect(bal.debt).toBe(280_000);
  });

  it("ikkinchi marta bekor qilishga urinish -> 400", async () => {
    const res = await post(`/api/payments/${firstPaymentId}/void`, { reason: "yana urinish" });
    expect(res.status).toBe(400);
  });

  it("yangi naqd to'lov (200000)", async () => {
    const res = await post("/api/payments", { patientId: patient.id, visitId, amount: 200_000, method: "cash" });
    expect(res.status).toBe(201);
  });

  it("vizit yakunlanadi", async () => {
    const res = await app.request(`/api/visits/${visitId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: ownerCookie, ...TEST_ORIGIN_HEADERS },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
  });

  it(
    "smena yopiladi — expectedCash voided to'lovni FILTRLAMAYDI " +
      "(100000 ochilish + [100000 asl (hali live) - 100000 tuzatuvchi + 200000 yangi] = 300000)",
    async () => {
      const res = await app.request(`/api/cash-sessions/${sessionId}/close`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: ownerCookie, ...TEST_ORIGIN_HEADERS },
        body: JSON.stringify({ countedCash: 295_000 }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { expectedCash: string; countedCash: string; diff: string };
      expect(body.expectedCash).toBe("300000");
      expect(body.countedCash).toBe("295000");
      expect(body.diff).toBe("-5000");
    },
  );
});

describe("Kassa oqimi — rol cheklovlari", () => {
  let clinic: TestClinic;
  let doctorUserCookie: string;
  let cashierCookie: string;
  let patient: TestPatient;

  beforeAll(async () => {
    clinic = await createTestClinic();
    const doctorUser = await createTestUser(clinic.id, { role: "doctor" });
    const cashierUser = await createTestUser(clinic.id, { role: "cashier" });
    ({ cookie: doctorUserCookie } = await loginAs(clinic.slug, doctorUser.login, doctorUser.password));
    ({ cookie: cashierCookie } = await loginAs(clinic.slug, cashierUser.login, cashierUser.password));
    patient = await createTestPatient(clinic.id);
  });

  afterAll(async () => {
    await cleanupClinic(clinic.id);
  });

  it("shifokor to'lov qabul qila olmaydi (ekran 6 roli emas) -> 403", async () => {
    const res = await app.request("/api/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: doctorUserCookie,
        "Idempotency-Key": crypto.randomUUID(),
        ...TEST_ORIGIN_HEADERS,
      },
      body: JSON.stringify({ patientId: patient.id, amount: 10_000, method: "card" }),
    });
    expect(res.status).toBe(403);
  });

  it("kassir to'lovni bekor qila olmaydi (faqat owner/admin) -> 403", async () => {
    const res = await app.request("/api/payments/00000000-0000-0000-0000-000000000000/void", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cashierCookie, ...TEST_ORIGIN_HEADERS },
      body: JSON.stringify({ reason: "test uchun" }),
    });
    expect(res.status).toBe(403);
  });
});
