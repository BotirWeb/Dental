const BASE = "/api";

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
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

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
};
