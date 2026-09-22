import { createHash } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { db } from "../../db/client";
import { idempotencyKeys } from "../../db/schema";
import { decideIdempotency, isValidIdempotencyKey } from "../../domain/idempotency";
import type { AppVariables } from "../context";

export const IDEMPOTENCY_HEADER = "Idempotency-Key";

/** 48 soatdan eski kalitlar tozalanadi (T4) — rateLimit.ts'dagi "sweep" naqshi. */
const MAX_KEY_AGE_MS = 48 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 60_000;
let lastSweep = 0;

async function sweepExpiredKeys(): Promise<void> {
  const now = Date.now();
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  await db.delete(idempotencyKeys).where(lt(idempotencyKeys.createdAt, new Date(now - MAX_KEY_AGE_MS)));
}

function hashBody(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

/**
 * Pul yoki vizit yaratuvchi endpoint'larga qo'llanadi (CLAUDE.md qoida 12).
 * Hozircha faqat `POST /patients` (bemor yaratish) — to'lov/void/kassa
 * smenasi endpoint'lari hali qurilmagan (ekran 6, todo); ular yozilganda
 * shu middleware ular ustiga ham qo'shiladi. Izoh: `src/domain/idempotency.ts`.
 *
 * MUHIM: `requireAuth`dan KEYIN turishi shart (`c.get("user").clinicId`
 * kerak).
 */
export function idempotency() {
  return createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
    void sweepExpiredKeys();

    const key = c.req.header(IDEMPOTENCY_HEADER);
    if (!isValidIdempotencyKey(key)) {
      return c.json({ error: `${IDEMPOTENCY_HEADER} header (UUID) talab qilinadi` }, 400);
    }

    const clinicId = c.get("user").clinicId;
    const bodyText = await c.req.raw.clone().text();
    const requestHash = hashBody(bodyText);

    const existingRows = await db
      .select({
        requestHash: idempotencyKeys.requestHash,
        statusCode: idempotencyKeys.statusCode,
        responseBody: idempotencyKeys.responseBody,
      })
      .from(idempotencyKeys)
      .where(and(eq(idempotencyKeys.clinicId, clinicId), eq(idempotencyKeys.key, key)))
      .limit(1);

    const decision = decideIdempotency(existingRows[0], requestHash);

    if (decision.kind === "conflict") {
      return c.json({ error: "Idempotency-Key boshqa so'rov tanasi bilan allaqachon ishlatilgan" }, 422);
    }
    if (decision.kind === "in_progress") {
      return c.json({ error: "Bu so'rov allaqachon bajarilmoqda, biroz kuting" }, 409);
    }
    if (decision.kind === "replay") {
      return new Response(decision.responseBody, {
        status: decision.statusCode,
        headers: { "Content-Type": "application/json" },
      });
    }

    // claim: (clinic_id, key) UNIQUE — parallel ikkinchi so'rov shu yerda
    // to'qnashadi va "in_progress" bilan rad etiladi (yuqoridagi decision
    // logikasi navbatdagi so'rovda ishga tushadi).
    try {
      await db.insert(idempotencyKeys).values({ clinicId, key, requestHash, statusCode: null, responseBody: null });
    } catch {
      return c.json({ error: "Bu so'rov allaqachon bajarilmoqda, biroz kuting" }, 409);
    }

    try {
      await next();
    } catch (err) {
      // Handler xato tashladi — band qilingan kalit BO'SHATILADI, aks holda
      // mijoz shu kalit bilan hech qachon qayta urinib bo'lmas edi.
      await db.delete(idempotencyKeys).where(and(eq(idempotencyKeys.clinicId, clinicId), eq(idempotencyKeys.key, key)));
      throw err;
    }

    const responseBody = await c.res.clone().text();
    await db
      .update(idempotencyKeys)
      .set({ statusCode: c.res.status, responseBody })
      .where(and(eq(idempotencyKeys.clinicId, clinicId), eq(idempotencyKeys.key, key)));
  });
}
