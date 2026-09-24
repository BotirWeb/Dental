/**
 * T5 "Tish kartasi" — real brauzer tekshiruvi (ixtiyoriy, `smoke.mjs` kabi).
 * `docs/tasks/2026-09-24-odontogram.md` qabul mezonlarini tekshiradi:
 * bo'sh holat, soxta "saqlanmagan" belgisi yo'qligi, saqlash/qayta ochish,
 * bemorlar orasida holat oqmasligi, CSS izolyatsiyasi, saqlanmagan
 * o'zgarish ogohlantirishi, 409 to'qnashuv, rollar, 390px.
 *
 * Ishga tushirish (seed qilingan baza, `namuna-klinika` + odontogram yoqilgan):
 *   (1) pnpm dev:api   (2) pnpm dev:web   (3) node apps/web/e2e/dental-chart.mjs
 * Har yurish 6 marta login qiladi — login rate-limit (15 daqiqada 10 ta)
 * sabab ketma-ket ko'p yurishda API'ni qayta ishga tushiring.
 * Screenshotlar: E2E_SHOTS_DIR (default: apps/web/e2e/.shots/, gitignore'da).
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:5173";
const SHOTS = (process.env.E2E_SHOTS_DIR ?? new URL("./.shots/", import.meta.url).pathname).replace(/\/?$/, "/");
mkdirSync(SHOTS, { recursive: true });

let failures = 0;
function check(label, ok, extra = "") {
  console.log(`${ok ? "✅" : "❌"} ${label}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
}

const browser = await chromium.launch();

async function newSession(login, password, viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const consoleMsgs = [];
  page.on("console", (m) => { if (["error", "warning"].includes(m.type())) consoleMsgs.push(`${m.type()}: ${m.text()}`); });
  page.on("pageerror", (e) => consoleMsgs.push(`pageerror: ${e.message}`));
  await page.goto(`${BASE}/login`);
  const inputs = page.locator("form input");
  const n = await inputs.count();
  // Login formasi: [klinika kodi], login, parol
  if (n >= 3) {
    await inputs.nth(0).fill("namuna-klinika");
    await inputs.nth(1).fill(login);
    await inputs.nth(2).fill(password);
  } else {
    await inputs.nth(0).fill(login);
    await inputs.nth(1).fill(password);
  }
  await page.click('form button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 10000 });
  return { context, page, consoleMsgs };
}

async function createPatient(page, name) {
  const res = await page.request.post(`${BASE}/api/patients`, {
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), "sec-fetch-site": "same-origin" },
    data: { fullName: name, phone: `+99890${Math.floor(1000000 + Math.random() * 8999999)}`, consentData: true, consentMessaging: false },
  });
  if (res.status() !== 201) throw new Error(`bemor yaratilmadi: ${res.status()} ${await res.text()}`);
  return (await res.json()).id;
}

async function waitChart(page) {
  await page.waitForSelector('.tooth-tile.side-view[data-tooth="16"]', { timeout: 20000 });
  await page.waitForTimeout(500);
}

const bodyBg = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundImage + " | " + getComputedStyle(document.body).backgroundColor);

// ---------------------------------------------------------------- admin: bemorlar
const admin = await newSession("admin", "admin12345");
const p1 = await createPatient(admin.page, "Karta Sinov Birinchi");
const p2 = await createPatient(admin.page, "Karta Sinov Ikkinchi");
check("admin ikki bemor yaratdi", Boolean(p1 && p2), `${p1} ${p2}`);

// ---------------------------------------------------------------- doctor
const doc = await newSession("doctor", "doctor12345");
const { page } = doc;
await page.goto(`${BASE}/patients/${p1}`);
const bgBefore = await bodyBg(page);
await page.click('a:has-text("Tish kartasi")');
await page.waitForURL(`**/patients/${p1}/chart`);
await waitChart(page);
check("bemor kartasidan «Tish kartasi» tugmasi orqali o'tildi", true);
check("bo'sh holat matni ko'rinadi", await page.locator("text=Bu bemorda hali tish kartasi yo'q").isVisible());
check("ochilganda «Saqlanmagan» belgisi YO'Q (soxta dirty yo'q)", !(await page.locator("text=Saqlanmagan o'zgarishlar bor").isVisible()));
check("«Saqlash» tugmasi o'zgarishsiz o'chiq", await page.locator('button:has-text("Saqlash")').isDisabled());
check("karta ichi rus tilida", (await page.locator(".odon-host").innerText()).match(/[а-яА-Я]{4,}/) !== null);
check("reja (plan) rejimi tugmasi yo'q", (await page.locator("#chartModeToggle").count()) === 0);
check("GitHub/eksport paneli yo'q", (await page.locator("#btnGithubLink").count()) === 0);
const bgOnChart = await bodyBg(page);
check("karta sahifasida body foni o'zgarmadi", bgOnChart === bgBefore, bgOnChart);
check("<style data-odontogram> qo'yilgan", (await page.locator("style[data-odontogram]").count()) === 1);
await page.screenshot({ path: `${SHOTS}01-empty-chart-1440.png`, fullPage: true });

// Tanlash — faqat tanlash dirty qilmasligi kerak
await page.click('.tooth-tile.side-view[data-tooth="16"]');
await page.waitForTimeout(300);
check("tishni faqat tanlash dirty qilmaydi", !(await page.locator("text=Saqlanmagan o'zgarishlar bor").isVisible()));

// 16 — yo'q tish, 21 — plomba
await page.selectOption("#toothSelect", "none");
await page.waitForTimeout(300);
check("o'zgarishdan keyin «Saqlanmagan o'zgarishlar bor»", await page.locator("text=Saqlanmagan o'zgarishlar bor").isVisible());
check("«Saqlash» yoqildi", await page.locator('button:has-text("Saqlash")').isEnabled());
await page.screenshot({ path: `${SHOTS}02-dirty-1440.png`, fullPage: true });

// Saqlanmagan o'zgarish bilan sidebar havolasi -> confirm
let dialogSeen = "";
page.once("dialog", async (d) => { dialogSeen = d.message(); await d.dismiss(); });
await page.click('nav a:has-text("Bemorlar")');
await page.waitForTimeout(400);
check("sidebar bosilganda ogohlantirish chiqdi", dialogSeen.includes("saqlanmagan"), dialogSeen);
check("«Yo'q» bosilganda sahifada qolindi", page.url().endsWith(`/patients/${p1}/chart`));

await page.click('button:has-text("Saqlash")');
await page.waitForSelector("text=Saqlandi", { timeout: 10000 });
check("saqlandi", true);
check("saqlagandan keyin dirty yo'q", !(await page.locator("text=Saqlanmagan o'zgarishlar bor").isVisible()));
check("«Oxirgi saqlangan: … · Shifokor Aliyev»", await page.locator("text=Shifokor Aliyev").first().isVisible());

// Qayta yuklash — saqlangan holat tiklanadimi
await page.reload();
await waitChart(page);
const payloadRes = await page.request.get(`${BASE}/api/patients/${p1}/dental-chart`);
const saved = await payloadRes.json();
check("serverdagi karta: 16 — yo'q tish", saved.chart?.payload?.teeth?.["16"]?.toothSelection === "none", JSON.stringify(saved.chart?.payload?.teeth?.["16"]));
check("qayta ochilganda soxta dirty yo'q", !(await page.locator("text=Saqlanmagan o'zgarishlar bor").isVisible()));
await page.click('.tooth-tile.side-view[data-tooth="16"]');
await page.waitForTimeout(300);
check("qayta ochilganda 16 holati tiklangan (select = none)", (await page.inputValue("#toothSelect")) === "none");

// Bemor A -> bemor B to'g'ridan-to'g'ri (engine singleton oqib o'tmasligi)
await page.goto(`${BASE}/patients/${p2}/chart`);
await waitChart(page);
await page.click('.tooth-tile.side-view[data-tooth="16"]');
await page.waitForTimeout(300);
check("bemor B kartasida A ning holati YO'Q (16 = doimiy tish)", (await page.inputValue("#toothSelect")) !== "none", await page.inputValue("#toothSelect"));

// SPA ichida A -> B (URL almashtirish, route o'sha) — history.pushState orqali
await page.goto(`${BASE}/patients/${p1}/chart`);
await waitChart(page);
await page.evaluate((id) => { window.history.pushState({}, "", `/patients/${id}/chart`); window.dispatchEvent(new PopStateEvent("popstate")); }, p2);
await waitChart(page);
await page.waitForTimeout(800);
await page.click('.tooth-tile.side-view[data-tooth="16"]');
await page.waitForTimeout(300);
check("SPA ichida A->B o'tishda ham holat oqmadi", (await page.inputValue("#toothSelect")) !== "none");

// Sahifadan chiqish — CSS olib tashlanadimi
await page.goto(`${BASE}/patients/${p1}/chart`);
await waitChart(page);
await page.click('nav a:has-text("Bemorlar")');
await page.waitForURL("**/patients");
// React Router navigatsiyani startTransition bilan qiladi — URL oldin almashadi, unmount keyin.
const styleGone = await page.waitForFunction(() => !document.querySelector("style[data-odontogram]"), null, { timeout: 5000 }).then(() => true, () => false);
check("chiqqandan keyin <style data-odontogram> olib tashlandi", styleGone);
check("chiqqandan keyin body foni asl holatda", (await bodyBg(page)) === bgBefore);

// ---------------------------------------------------------------- 409: ikki kishi bir vaqtda
const owner = await newSession("owner", "owner12345");
await page.goto(`${BASE}/patients/${p1}/chart`);
await waitChart(page);
await owner.page.goto(`${BASE}/patients/${p1}/chart`);
await waitChart(owner.page);
await owner.page.click('.tooth-tile.side-view[data-tooth="21"]');
await owner.page.selectOption("#toothSelect", "implant");
await owner.page.click('button:has-text("Saqlash")');
await owner.page.waitForSelector("text=Saqlandi", { timeout: 10000 });
await page.click('.tooth-tile.side-view[data-tooth="11"]');
await page.selectOption("#toothSelect", "none");
await page.click('button:has-text("Saqlash")');
await page.waitForSelector("text=boshqa foydalanuvchi tomonidan saqlangan", { timeout: 10000 });
check("ikkinchi saqlovchi 409 xabarini ko'rdi", true);
await page.screenshot({ path: `${SHOTS}03-conflict-1440.png`, fullPage: false });
await page.click('button:has-text("Kartani yangilash")');
await waitChart(page);
await page.click('.tooth-tile.side-view[data-tooth="21"]');
await page.waitForTimeout(300);
check("yangilangandan keyin owner'ning o'zgarishi ko'rinadi (21 = implant)", (await page.inputValue("#toothSelect")) === "implant");

// ---------------------------------------------------------------- admin: faqat ko'rish
await admin.page.goto(`${BASE}/patients/${p1}/chart`);
await waitChart(admin.page);
check("admin: «Saqlash» tugmasi yo'q", (await admin.page.locator('button:has-text("Saqlash")').count()) === 0);
check("admin: «faqat ko'rasiz» izohi", await admin.page.locator("text=faqat ko'rasiz").isVisible());
check("admin: grid read-only klassi", await admin.page.locator("#toothGrid.read-only").count() === 1);
await admin.page.screenshot({ path: `${SHOTS}04-admin-readonly-1440.png`, fullPage: true });

// ---------------------------------------------------------------- kassir: kirmaydi
const cashier = await newSession("cashier", "cashier12345");
await cashier.page.goto(`${BASE}/patients/${p1}/chart`);
await cashier.page.waitForTimeout(800);
check("kassir: ruxsat yo'q ekrani", await cashier.page.locator("text=ruxsatingiz yo'q").isVisible());

// ---------------------------------------------------------------- mobil 390x844
const mobile = await newSession("doctor", "doctor12345", { width: 390, height: 844 });
await mobile.page.goto(`${BASE}/patients/${p1}/chart`);
await waitChart(mobile.page);
const overflow = await mobile.page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: window.innerWidth }));
check("390px: sahifa gorizontal scroll'siz (document)", overflow.doc <= overflow.win, JSON.stringify(overflow));
await mobile.page.screenshot({ path: `${SHOTS}05-mobile-390.png`, fullPage: true });

// ---------------------------------------------------------------- konsol
for (const s of [doc, owner, admin, cashier, mobile]) {
  const relevant = s.consoleMsgs.filter((m) => !m.includes("Download the React DevTools"));
  if (relevant.length) console.log("konsol:", relevant.slice(0, 10));
}
const cssWarn = [doc, owner, admin, mobile].some((s) => s.consoleMsgs.some((m) => m.includes("odontogram CSS")));
check("CSS scope ogohlantirishi yo'q (5 naqsh topildi)", !cssWarn);

await browser.close();
console.log(failures === 0 ? "\nHAMMASI O'TDI" : `\n${failures} ta tekshiruv O'TMADI`);
process.exit(failures === 0 ? 0 : 1);
