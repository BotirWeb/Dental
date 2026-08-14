import { Hono } from "hono";
import { authRoutes } from "./routes/auth";
import { patientRoutes } from "./routes/patients";
import { healthRoutes } from "./routes/health";
import type { AppVariables } from "./context";

export const app = new Hono<{ Variables: AppVariables }>();

/**
 * Hamma route /api ostida. Shu tufayli frontend HAR DOIM bir xil origin'dan
 * so'raydi:
 *   - dev'da: Vite dev-server "/api" so'rovlarini localhost:3000'ga proksi
 *     qiladi (apps/web/vite.config.ts).
 *   - prod'da: Caddy statik frontendni beradi va "/api/*" ni shu serverga
 *     yo'naltiradi (qollanma bo'lim 3, Deploy).
 * Natijada CORS umuman kerak emas — cookie har doim "same-origin" sifatida
 * ko'rinadi. Agar kelajakda frontend chinakam boshqa domenda tursa, shu
 * yerga qaytadan `hono/cors` qo'shiladi.
 */
const api = new Hono<{ Variables: AppVariables }>();
api.route("/health", healthRoutes);
api.route("/auth", authRoutes);
api.route("/patients", patientRoutes);

app.route("/api", api);

app.notFound((c) => c.json({ error: "Topilmadi" }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Server xatosi" }, 500);
});
