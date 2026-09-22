import type { Context, MiddlewareHandler } from "hono";

/**
 * LOGIN URINISHLARINI CHEKLASH — tahlil D1.
 *
 * Muammo: `/auth/login` da hech qanday cheklov yo'q edi — parolni cheksiz
 * marta sinab ko'rish mumkin. Tibbiy ma'lumot bazasi uchun bu jiddiy.
 *
 * Yechim: ikki o'lchov bo'yicha oyna (sliding window):
 *   1. IP bo'yicha  — bitta manbadan kelgan hujum,
 *   2. login bo'yicha — bitta hisobni nishonga olish (IP almashtirilsa ham).
 *
 * CHEKLOV: bu — jarayon xotirasidagi hisoblagich. Bitta VPS, bitta Node
 * jarayoni uchun yetarli (qollanma bo'lim 3: Docker Compose + Caddy).
 * Bir nechta nusxa (replica) paydo bo'lsa, hisoblagich Redis'ga yoki
 * DB jadvaliga ko'chirilishi kerak — o'shanda bu fayl almashtiriladi,
 * chaqiruvchi kod o'zgarmaydi.
 */

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

/** Xotira o'smasin: eskirgan kalitlar vaqti-vaqti bilan tozalanadi. */
let lastSweep = Date.now();
const SWEEP_INTERVAL_MS = 5 * 60_000;

function sweep(now: number, windowMs: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
    if (bucket.hits.length === 0) buckets.delete(key);
  }
}

export interface RateLimitOptions {
  /** Oyna uzunligi. */
  windowMs: number;
  /** Oyna ichida ruxsat etilgan urinishlar soni. */
  max: number;
  /** So'rovdan cheklov kalitlarini chiqaradi (bir nechta bo'lishi mumkin). */
  keys: (c: Context) => Promise<string[]> | string[];
}

/** Mijoz IP manzili. Caddy ortida `X-Forwarded-For` keladi. */
export function clientIp(c: Context): string {
  const fwd = c.req.header("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return c.req.header("x-real-ip") ?? "unknown";
}

function hit(key: string, now: number, windowMs: number, max: number): number | null {
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= max) {
    const oldest = bucket.hits[0];
    buckets.set(key, bucket);
    return Math.ceil((windowMs - (now - oldest)) / 1000); // necha soniyadan keyin
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return null;
}

export function rateLimit(opts: RateLimitOptions): MiddlewareHandler {
  return async (c, next) => {
    const now = Date.now();
    sweep(now, opts.windowMs);

    const keys = await opts.keys(c);
    for (const key of keys) {
      const retryAfter = hit(key, now, opts.windowMs, opts.max);
      if (retryAfter !== null) {
        c.header("Retry-After", String(retryAfter));
        return c.json(
          {
            error: `Juda ko'p urinish. ${retryAfter} soniyadan keyin qayta urinib ko'ring.`,
          },
          429,
        );
      }
    }

    await next();
  };
}

/** Testlar uchun: hisoblagichni tozalash. */
export function resetRateLimit(): void {
  buckets.clear();
  lastSweep = Date.now();
}
