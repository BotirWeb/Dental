/**
 * IXTIYORIY smoke-test — repo qismi, lekin default `pnpm install`'ga
 * kirmaydi (playwright og'ir, ~300MB browser yuklab oladi).
 *
 * Nima tekshiradi: login, rol bo'yicha ruxsat, va ENG MUHIMI — navigatsiya
 * paytida HECH QACHON yangi "document" so'rovi yuborilmasligi (ya'ni sahifa
 * hech qachon to'liq refresh bo'lmasligi — React SPA talabi).
 *
 * Ishga tushirish:
 *   npm i -D playwright && npx playwright install --with-deps chromium
 *   (1-terminal) pnpm --filter @dental/api start
 *   (2-terminal) pnpm --filter @dental/api db:seed   # faqat birinchi marta
 *   (3-terminal) pnpm --filter @dental/web dev
 *   (4-terminal) node apps/web/e2e/smoke.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:5173";
const documentRequests = [];

const browser = await chromium.launch();
const page = await browser.newPage();

page.on("request", (req) => {
  if (req.resourceType() === "document") {
    documentRequests.push(req.url());
  }
});

function log(label, ok) {
  console.log(`${ok ? "OK  " : "FAIL"} — ${label}`);
  if (!ok) process.exitCode = 1;
}

try {
  // 1) Auth qilinmagan holda / -> /login'ga yo'naltirilishi kerak
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForURL(/\/login$/, { timeout: 5000 });
  log("Auth qilinmaganda /login'ga yo'naltirdi", page.url().endsWith("/login"));

  // 2) Login formani to'ldirib yuborish (seed'dagi owner bilan)
  await page.fill("#login", "owner");
  await page.fill("#password", "owner12345");
  const docReqsBeforeLogin = documentRequests.length;
  await page.click('button[type="submit"]');
  await page.waitForSelector("text=Xush kelibsiz", { timeout: 5000 });
  log("Login muvaffaqiyatli, dashboard ko'rindi", true);
  log("Login submit qilinganda YANGI document so'rovi YO'Q (SPA)", documentRequests.length === docReqsBeforeLogin);

  // 3) Sidebar orqali Bemorlar sahifasiga o'tish — refresh bo'lmasligi kerak
  const docReqsBeforeNav = documentRequests.length;
  await page.click('a:has-text("Bemorlar")');
  await page.waitForURL(/\/patients$/, { timeout: 5000 });
  await page.waitForSelector("text=Aliyev Vali", { timeout: 5000 });
  log("Bemorlar sahifasiga o'tdi va seed qilingan bemorni ko'rsatdi", true);
  log(
    "Navigatsiya paytida YANGI document so'rovi YO'Q (to'liq refresh yo'q)",
    documentRequests.length === docReqsBeforeNav,
  );

  // 4) Yangi bemor qo'shish — sahifani qayta yuklamasdan ro'yxatga qo'shilishi kerak
  await page.click('button:has-text("Yangi bemor")');
  const uniquePhone = `+99890${Math.floor(1000000 + Math.random() * 8999999)}`;
  await page.fill('input[placeholder="+998 90 123 45 67"]', uniquePhone);
  await page.locator("form").locator("input").first().fill("E2E Test Bemor");
  const docReqsBeforeCreate = documentRequests.length;
  await page.click('form button[type="submit"]');
  await page.waitForSelector(`text=${uniquePhone}`, { timeout: 5000 });
  log("Yangi bemor ro'yxatda darhol ko'rindi (refreshsiz)", true);
  log("Bemor qo'shishda YANGI document so'rovi YO'Q", documentRequests.length === docReqsBeforeCreate);

  // 5) Rol bo'yicha cheklov: shifokor bemor qo'sha olmasligi kerak
  await page.click('button:has-text("Chiqish")');
  await page.waitForURL(/\/login$/, { timeout: 5000 });
  await page.fill("#login", "doctor");
  await page.fill("#password", "doctor12345");
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 5000 });
  await page.goto(`${BASE}/patients`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Aliyev Vali", { timeout: 5000 });
  const newPatientButtonCount = await page.locator('button:has-text("Yangi bemor")').count();
  log("Shifokor uchun 'Yangi bemor' tugmasi ko'rinmaydi", newPatientButtonCount === 0);

  // 6) Owner-only ekranga (masalan /users) shifokor kira olmasligi kerak
  await page.goto(`${BASE}/users`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=ruxsatingiz yo'q", { timeout: 5000 });
  log("Shifokor /users'ga kirsa 'ruxsat yo'q' ko'rsatildi", true);

  console.log(`\nJami document (to'liq sahifa) so'rovlari: ${documentRequests.length}`);
  console.log(documentRequests.map((u) => `  - ${u}`).join("\n"));
} catch (err) {
  console.error("XATO:", err);
  await page.screenshot({ path: "smoke-failure.png", fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
