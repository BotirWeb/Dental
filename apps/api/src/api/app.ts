import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { authRoutes } from "./routes/auth";
import { patientRoutes } from "./routes/patients";
import { healthRoutes } from "./routes/health";
import { doctorRoutes } from "./routes/doctors";
import { chairRoutes } from "./routes/chairs";
import { appointmentRoutes } from "./routes/appointments";
import { serviceRoutes } from "./routes/services";
import { cashSessionRoutes } from "./routes/cashSessions";
import { visitRoutes } from "./routes/visits";
import { paymentRoutes } from "./routes/payments";
import { expenseRoutes } from "./routes/expenses";
import { serviceCategoryRoutes } from "./routes/serviceCategories";
import { reportRoutes } from "./routes/reports";
import { csrfProtection } from "./middleware/csrf";
import type { AppVariables } from "./context";

export const app = new Hono<{ Variables: AppVariables }>();

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

/** Xavfsizlik headerlari — tahlil D2 / T3. Caddy'da EMAS, shu yerda — ikkalasida qo'shilib ketmasin. */
app.use(
  "*",
  secureHeaders({
    xFrameOptions: "DENY",
    contentSecurityPolicy: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  }),
);

/** Holat o'zgartiruvchi so'rovlarda Origin tekshiruvi — tahlil D2 / T3, izoh: `middleware/csrf.ts`. */
app.use("/api/*", csrfProtection({ allowedOrigins }));

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
api.route("/doctors", doctorRoutes);
api.route("/chairs", chairRoutes);
api.route("/appointments", appointmentRoutes);
api.route("/services", serviceRoutes);
api.route("/cash-sessions", cashSessionRoutes);
api.route("/visits", visitRoutes);
api.route("/payments", paymentRoutes);
api.route("/expenses", expenseRoutes);
api.route("/service-categories", serviceCategoryRoutes);
api.route("/reports", reportRoutes);

app.route("/api", api);

app.notFound((c) => c.json({ error: "Topilmadi" }, 404));

/**
 * Maxfiylik (bo'lim 8, T3): bu yerda FAQAT xato obyekti loglanadi — so'rov
 * query string'i yoki tanasi HECH QACHON qo'shilmaydi (bemor telefoni,
 * F.I.Sh shu yo'l bilan logga tushishi mumkin edi). Alohida so'rov logeri
 * (masalan `hono/logger`) ataylab ulanmagan — aks holda maskalash kerak bo'lardi.
 */
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Server xatosi" }, 500);
});
