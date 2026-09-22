import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../app";
import { TEST_ORIGIN_HEADERS, cleanupClinic, createTestClinic, createTestUser, loginAs, type TestClinic } from "../../testing/helpers";

/** Ekran 7 "Xarajatlar" va ekran 11 "Xizmat va narxlar" — oddiy CRUD, avvaldan sinalgan domen mantiq yo'q. */
describe("Xarajatlar va xizmatlar (ekran 7/11)", () => {
  let clinic: TestClinic;
  let ownerCookie: string;
  let adminCookie: string;

  beforeAll(async () => {
    clinic = await createTestClinic();
    const owner = await createTestUser(clinic.id, { role: "owner" });
    const admin = await createTestUser(clinic.id, { role: "admin" });
    ({ cookie: ownerCookie } = await loginAs(clinic.slug, owner.login, owner.password));
    ({ cookie: adminCookie } = await loginAs(clinic.slug, admin.login, admin.password));
  });

  afterAll(async () => {
    await cleanupClinic(clinic.id);
  });

  function req(method: string, path: string, cookie: string, body?: unknown) {
    return app.request(path, {
      method,
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        "Idempotency-Key": crypto.randomUUID(),
        ...TEST_ORIGIN_HEADERS,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  it("admin xarajat qo'sha oladi, ro'yxatda ko'rinadi", async () => {
    const res = await req("POST", "/api/expenses", adminCookie, {
      category: "Materiallar",
      amount: 250_000,
      spentAt: new Date().toISOString(),
    });
    expect(res.status).toBe(201);

    const listRes = await app.request("/api/expenses", { headers: { Cookie: adminCookie } });
    const list = (await listRes.json()) as Array<{ category: string }>;
    expect(list.some((e) => e.category === "Materiallar")).toBe(true);
  });

  let categoryId: string;

  it("owner kategoriya qo'sha oladi", async () => {
    const res = await req("POST", "/api/service-categories", ownerCookie, { name: "Terapiya", defaultDoctorPct: 35 });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    categoryId = body.id;
  });

  it("admin kategoriya qo'sha olmaydi (owner-only) -> 403", async () => {
    const res = await req("POST", "/api/service-categories", adminCookie, { name: "Boshqa", defaultDoctorPct: 0 });
    expect(res.status).toBe(403);
  });

  let serviceId: string;

  it("owner xizmat yaratadi", async () => {
    const res = await req("POST", "/api/services", ownerCookie, {
      categoryId,
      name: "Toza tozalash",
      price: 150_000,
      materialCost: 10_000,
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; price: string };
    serviceId = body.id;
    expect(body.price).toBe("150000");
  });

  it("admin xizmat yarata olmaydi -> 403", async () => {
    const res = await req("POST", "/api/services", adminCookie, { name: "X", price: 1000, materialCost: 0 });
    expect(res.status).toBe(403);
  });

  it("narx tahrirlanadi — eski qatorlarga ta'sir qilmasligi (snapshot) alohida tekshirilgan, bu yerda faqat yangilanish", async () => {
    const res = await app.request(`/api/services/${serviceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: ownerCookie, ...TEST_ORIGIN_HEADERS },
      body: JSON.stringify({ price: 180_000 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { price: string };
    expect(body.price).toBe("180000");
  });

  it("xizmat faolsizlantiriladi — standart GET (?includeInactive yo'q) uni qaytarmaydi", async () => {
    await app.request(`/api/services/${serviceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: ownerCookie, ...TEST_ORIGIN_HEADERS },
      body: JSON.stringify({ isActive: false }),
    });

    const activeOnly = (await (await app.request("/api/services", { headers: { Cookie: ownerCookie } })).json()) as Array<{
      id: string;
    }>;
    expect(activeOnly.some((s) => s.id === serviceId)).toBe(false);

    const withInactive = (await (
      await app.request("/api/services?includeInactive=true", { headers: { Cookie: ownerCookie } })
    ).json()) as Array<{ id: string }>;
    expect(withInactive.some((s) => s.id === serviceId)).toBe(true);
  });
});
