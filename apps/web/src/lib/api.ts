import { reportNetworkError } from "./networkSignal";

const BASE = "/api";
const IDEMPOTENCY_HEADER = "Idempotency-Key";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Barcha so'rovlar shu orqali. `credentials: "include"` — session cookie
 * har doim yuborilishi uchun shart (qollanma bo'lim 3: session cookie auth).
 * BASE = "/api" — Vite dev-proksi (vite.config.ts) va prod'da Caddy shu
 * prefiksni backendga yo'naltiradi, shuning uchun bu yerda to'liq domen
 * yozilmaydi.
 */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch (err) {
    // HTTP javob umuman kelmadi — internet yo'q yoki server o'lik (T4:
    // "Manba: ... + fetch tarmoq xatosi"). NetworkContext shuni ushlab,
    // holatni qayta tekshiradi.
    reportNetworkError();
    throw err;
  }

  if (!res.ok) {
    let message = `So'rov xato bilan tugadi (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // javob tanasi JSON emas — default xabar qoladi
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  /**
   * Pul yoki vizit yaratuvchi so'rovlar uchun — T4 (tahlil M1). `idempotencyKey`
   * forma ochilganda yaratiladi, qayta urinishda O'SHA kalit yuboriladi,
   * muvaffaqiyatdan keyin chaqiruvchi tomon yangisini generatsiya qiladi
   * (masalan `apps/web/src/routes/PatientsPage.tsx`).
   */
  postIdempotent: <T>(path: string, body: unknown, idempotencyKey: string) =>
    request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { [IDEMPOTENCY_HEADER]: idempotencyKey },
    }),
};
