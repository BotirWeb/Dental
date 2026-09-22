import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, count, eq } from "drizzle-orm";
import { app } from "../app";
import { db } from "../../db/client";
import { idempotencyKeys, patients } from "../../db/schema";
import { TEST_ORIGIN_HEADERS, cleanupClinic, createTestClinic, createTestUser, loginAs, type TestClinic } from "../../testing/helpers";

/**
 * T4 (tahlil M1): idempotentlik middleware. Qabul mezonlari —
 * `docs/tasks/2026-09-22-tuzatishlar.md` T4 "Testlar".
 */
describe("POST /patients — idempotentlik (T4)", () => {
  let clinic: TestClinic;
  let cookie: string;

  beforeAll(async () => {
    clinic = await createTestClinic();
    const admin = await createTestUser(clinic.id, { role: "admin" });
    const login = await loginAs(clinic.slug, admin.login, admin.password);
    cookie = login.cookie;
  });

  afterAll(async () => {
    await cleanupClinic(clinic.id);
  });

  function post(body: unknown, idempotencyKey: string | undefined) {
    return app.request("/api/patients", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        ...TEST_ORIGIN_HEADERS,
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify(body),
    });
  }

  async function patientCount(fullName: string): Promise<number> {
    const rows = await db
      .select({ n: count() })
      .from(patients)
      .where(and(eq(patients.clinicId, clinic.id), eq(patients.fullName, fullName)));
    return rows[0].n;
  }

  it("Idempotency-Key yo'q -> 400", async () => {
    const res = await post({ fullName: "Kalitsiz", phone: "900000001" }, undefined);
    expect(res.status).toBe(400);
  });

  it("ketma-ket bir xil kalit+tana -> 2-so'rov saqlangan javobni qaytaradi, DB'da 1 yozuv", async () => {
    const key = crypto.randomUUID();
    const body = { fullName: "Ketma Ket Test", phone: "900000002" };

    const first = await post(body, key);
    const second = await post(body, key);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const firstBody = (await first.json()) as { id: string };
    const secondBody = (await second.json()) as { id: string };
    expect(secondBody.id).toBe(firstBody.id);

    expect(await patientCount("Ketma Ket Test")).toBe(1);
  });

  it("bir vaqtda (parallel) bir xil kalit+tana -> DB'da faqat 1 yozuv", async () => {
    const key = crypto.randomUUID();
    const body = { fullName: "Parallel Integratsiya Test", phone: "900000003" };

    const [a, b] = await Promise.all([post(body, key), post(body, key)]);

    // Ikkalasi ham muvaffaqiyatli (replay) YOKI biri 409 ("band") bo'lishi
    // mumkin — vaqt kelishiga bog'liq. Yagona MUHIM invariant: duplikat DB
    // yozuvi yo'q.
    expect([200, 201, 409]).toContain(a.status);
    expect([200, 201, 409]).toContain(b.status);
    expect(a.status === 500 || b.status === 500).toBe(false);

    expect(await patientCount("Parallel Integratsiya Test")).toBe(1);
  });

  it("bir xil kalit, boshqa tana -> 422", async () => {
    const key = crypto.randomUUID();
    await post({ fullName: "Kalit Egasi", phone: "900000004" }, key);

    const conflict = await post({ fullName: "Butunlay Boshqa", phone: "900000005" }, key);
    expect(conflict.status).toBe(422);
  });

  it("kalit DB'da 'band' (hali tugallanmagan) holatda bo'lsa -> 409", async () => {
    const key = crypto.randomUUID();
    const bodyText = JSON.stringify({ fullName: "Band Holat Test", phone: "900000006" });
    const requestHash = createHash("sha256").update(bodyText).digest("hex");

    await db.insert(idempotencyKeys).values({
      clinicId: clinic.id,
      key,
      requestHash,
      statusCode: null,
      responseBody: null,
    });

    const res = await post(JSON.parse(bodyText), key);
    expect(res.status).toBe(409);
  });
});
