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

/** Ekran 8/9/10 — hisobotlar. Yangi domen mantiq yo'q, faqat agregatsiya. */
describe("Hisobotlar (ekran 8/9/10)", () => {
  let clinic: TestClinic;
  let ownerCookie: string;
  let adminCookie: string;
  let doctor: TestDoctor;
  let service: TestService;
  let patient: TestPatient;
  let visitId: string;
  const today = new Date().toISOString().slice(0, 10);

  function post(path: string, cookie: string, body: unknown) {
    return app.request(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        "Idempotency-Key": crypto.randomUUID(),
        ...TEST_ORIGIN_HEADERS,
      },
      body: JSON.stringify(body),
    });
  }

  beforeAll(async () => {
    clinic = await createTestClinic();
    const owner = await createTestUser(clinic.id, { role: "owner" });
    const admin = await createTestUser(clinic.id, { role: "admin" });
    ({ cookie: ownerCookie } = await loginAs(clinic.slug, owner.login, owner.password));
    ({ cookie: adminCookie } = await loginAs(clinic.slug, admin.login, admin.password));
    doctor = await createTestDoctor(clinic.id, { defaultPct: 40 });
    service = await createTestService(clinic.id, { price: 300_000, materialCost: 50_000 });
    patient = await createTestPatient(clinic.id);

    await post("/api/cash-sessions", ownerCookie, { openingFloat: 0 });
    const visitRes = await post("/api/visits", ownerCookie, { patientId: patient.id, doctorId: doctor.id });
    ({ id: visitId } = (await visitRes.json()) as { id: string });
    await post(`/api/visits/${visitId}/performed-services`, ownerCookie, {
      serviceId: service.id,
      discountType: "amount",
      discountValue: 0,
    });
    await post("/api/payments", ownerCookie, { patientId: patient.id, visitId, amount: 300_000, method: "cash" });
    await post("/api/expenses", ownerCookie, { category: "Materiallar", amount: 20_000, spentAt: new Date().toISOString() });
  });

  afterAll(async () => {
    await cleanupClinic(clinic.id);
  });

  it("admin hisobotlarga kira olmaydi (owner-only) -> 403", async () => {
    const res = await app.request(`/api/reports/daily?date=${today}`, { headers: { Cookie: adminCookie } });
    expect(res.status).toBe(403);
  });

  it("kunlik hisobot: tushum 300000, shifokor ulushi 120000 (40%), material 50000, marja 130000", async () => {
    const res = await app.request(`/api/reports/daily?date=${today}`, { headers: { Cookie: ownerCookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      revenue: number;
      doctorEarnings: number;
      materialCost: number;
      margin: number;
      totalPayments: number;
      expenses: number;
      visitsCount: number;
    };
    expect(body.revenue).toBe(300_000);
    expect(body.doctorEarnings).toBe(120_000);
    expect(body.materialCost).toBe(50_000);
    expect(body.margin).toBe(130_000);
    expect(body.totalPayments).toBe(300_000);
    expect(body.expenses).toBe(20_000);
    expect(body.visitsCount).toBe(1);
  });

  it("boshqa kunda hisobot bo'sh", async () => {
    const res = await app.request("/api/reports/daily?date=2020-01-01", { headers: { Cookie: ownerCookie } });
    const body = (await res.json()) as { revenue: number; visitsCount: number };
    expect(body.revenue).toBe(0);
    expect(body.visitsCount).toBe(0);
  });

  it("oylik marja: jami va sof foyda (marja - xarajat) to'g'ri", async () => {
    const from = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const to = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString();
    const res = await app.request(
      `/api/reports/margin?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { headers: { Cookie: ownerCookie } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { revenue: number; margin: number; expenses: number; netProfit: number };
    expect(body.revenue).toBe(300_000);
    expect(body.margin).toBe(130_000);
    expect(body.expenses).toBe(20_000);
    expect(body.netProfit).toBe(110_000);
  });

  it("shifokor hisoboti: bitta shifokor, 1 xizmat, tushum va ulush to'g'ri", async () => {
    const from = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const to = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString();
    const res = await app.request(
      `/api/reports/doctors?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { headers: { Cookie: ownerCookie } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ doctorId: string; servicesCount: number; revenue: number; doctorEarnings: number }>;
    const row = body.find((r) => r.doctorId === doctor.id);
    expect(row).toBeDefined();
    expect(row?.servicesCount).toBe(1);
    expect(row?.revenue).toBe(300_000);
    expect(row?.doctorEarnings).toBe(120_000);
  });
});
