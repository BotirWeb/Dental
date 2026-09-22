# Dental — klinika boshqaruv tizimi

Stomatologiya klinikalari uchun web tizim. Bu repo — **Faza 1 skeleton**
(qollanma bo'lim 7: hafta 1-2 "Skelet: repo, Docker, DB migratsiya, auth,
rollar, audit"), to'liq mahsulot emas.

> **Muhim:** loyihaning to'liq spetsifikatsiyasi — biznes konteksti, rad
> etilgan qarorlar, ma'lumotlar modeli, ochiq savollar — ushbu kod bilan
> birga YURMAYDI, alohida "loyiha qo'llanmasi" hujjatida saqlanadi. Yangi
> ishni boshlashdan oldin albatta o'sha hujjatni o'qing — bu yerda faqat
> KOD haqida ma'lumot bor.

## Nima ishlaydi hozir

- **Auth**: session cookie + argon2 — login/logout/me.
- **Rollar**: owner / admin / doctor / cashier — middleware bilan.
- **clinic_id qamrovi** va **audit_log** — har bir yozuv kim/qachon/nima
  o'zgargani bilan qayd etiladi.
- **Bemorlar** (ekran 3) — qidirish + yaratish, to'liq ishlaydi.
- **Shifokor foizi / marja hisobi** — sof funksiyalar, unit test bilan,
  hisoblash asosi (`gross` / `after_material`) klinika darajasida
  SOZLANADIGAN (hardcode emas — sabab: hujjat bo'lim 13 ochiq savoli).
- **Frontend** — React Router SPA: sahifalar orasida o'tishda **hech qachon
  to'liq refresh bo'lmaydi**. `apps/web/e2e/smoke.mjs` shuni tekshiradi.
- Qolgan 8 ekran (Jadval, Kassa, Xarajat, Hisobotlar, ...) — rol asosida
  ko'rinadigan, lekin ichi bo'sh "todo" sahifalar. Keyingi ish shular.

## Papka tuzilishi

```
apps/api/          Hono + TypeScript + Drizzle + PostgreSQL
  src/db/          sxema, migratsiya, seed
  src/domain/      sof biznes logika (HTTP/DB'dan ajratilgan)
  src/api/         route'lar, middleware (auth, rol), audit
  src/adapters/    tashqi xizmatlar interfeysi (hozircha faqat telefoniya stub)
  src/jobs/        cron uchun bo'sh joy (Faza 3)
apps/web/          React + TypeScript + Vite + Tailwind + PWA
  src/routes/      sahifalar (screens.ts — nav+route'lar shu yerdan generatsiya bo'ladi)
  src/state/       AuthContext
  src/lib/         API klient, vaqt formatlash
  e2e/smoke.mjs    ixtiyoriy Playwright smoke-test
packages/shared/   ikkala tomon ishlatadigan zod sxema/enum/tip'lar
docker-compose.yml + Dockerfile'lar + Caddyfile   (VPS deploy uchun, SINALMAGAN)
```

## Talab qilinadigan vositalar

- Node.js 22+, pnpm 10+ (`corepack enable` yetarli)
- PostgreSQL 16 (lokal yoki Docker)

## Lokal ishga tushirish (Docker'siz)

```bash
pnpm install

# 1) Postgres'da baza va foydalanuvchi yarating (bir marta):
#    CREATE ROLE dental_app WITH LOGIN PASSWORD '...';
#    CREATE DATABASE dental_dev OWNER dental_app;

# 2) .env sozlang:
cp apps/api/.env.example apps/api/.env
# DATABASE_URL'ni to'g'rilang

# 3) Migratsiya + boshlang'ich ma'lumot:
pnpm db:migrate
pnpm db:seed

# 4) Ikkita terminalda:
pnpm dev:api     # http://localhost:3000
pnpm dev:web     # http://localhost:5173  (— shu yerni oching)
```

`db:seed` quyidagi test hisoblarini yaratadi (bitta "Namuna Klinika" ichida):

| login | parol | rol |
|---|---|---|
| owner | owner12345 | owner |
| admin | admin12345 | admin |
| doctor | doctor12345 | doctor |
| cashier | cashier12345 | cashier |

**Bular faqat lokal dev uchun — prodga hech qachon shu parollar bilan chiqmang.**

## Docker Compose (VPS uchun — sinalmagan)

```bash
cp .env.example .env   # DB_PASSWORD'ni o'zgartiring
docker compose up -d --build
docker compose run --rm api pnpm db:migrate
docker compose run --rm api pnpm db:seed   # faqat birinchi safar / dev
```

`apps/web/Caddyfile` hozircha domensiz (`:80`) sozlangan. Real domen
bo'lganda faylning ichidagi izohga qarab almashtiring — Caddy TLS'ni
avtomatik oladi.

## Tekshirish

```bash
pnpm typecheck   # barcha paketlar
pnpm test        # domain unit testlar (vitest, DB'siz, har doim tez)
pnpm build       # api typecheck + web production build
```

DB-bog'liq integratsiya testlar (T2/T3/T4 — klinika izolyatsiyasi, sessiya
muddati, idempotentlik) alohida, haqiqiy Postgres talab qiladi:

```bash
cp apps/api/.env.test.example apps/api/.env.test   # DATABASE_URL'ni sozlang — nomida "test" bo'lsin
pnpm test:integration
```

Frontend uchun ixtiyoriy end-to-end smoke-test (Playwright talab qiladi,
alohida o'rnatiladi — sabab `apps/web/e2e/smoke.mjs` ichida):

```bash
npm i -D playwright && npx playwright install --with-deps chromium
# api va web dev-serverlari ishlab turgan bo'lishi kerak
node apps/web/e2e/smoke.mjs
```

## Muhim texnik qarorlar (nega shunday)

- **Pul — `numeric(14,0)`** (qollanma bo'lim 9, qoida 3). Drizzle'da bu
  ustunlar JS tomonida STRING sifatida keladi (float xatosidan qochish
  uchun) — `src/db/columns.ts`dagi `toMoneyInput`/`fromMoney` orqali
  DB chegarasida `number`ga aylantiriladi. Domain qatlami (`src/domain`)
  har doim oddiy `number` bilan ishlaydi.
- **API `/api` prefiksi ostida.** Dev'da Vite proksi, prod'da Caddy —
  ikkalasida ham frontend bitta origin'dan so'raydi, shuning uchun CORS
  umuman kerak emas, cookie har doim "same-origin".
- **TypeScript ESM + `moduleResolution: "Bundler"`, `tsx` orqali ishga
  tushirish** (na `ts-node`, na `tsc` bilan `dist/` kompilyatsiya). Sabab:
  Node'ning `NodeNext` rejimi har bir nisbiy import'ga `.js` qo'shishni
  talab qiladi — bu monorepo'da (packages/shared xom `.ts` manba sifatida
  import qilinganda) qo'shimcha ishqalanish yaratardi. Kelajakda haqiqiy
  `dist/` build kerak bo'lsa (masalan image hajmini kichraytirish uchun),
  shu yerga qaytib, `NodeNext` + `.js` kengaytmalarga o'tish variant.

## Keyingi qadam

Ikkitadan biri — tanlov foydalanuvchida (loyiha qo'llanmasi bo'lim 15'ga
qarang):

1. **Loyiha qo'llanmasi bo'lim 12** — "Birinchi hafta" dala ishi (klinikaga
   borish, qo'ng'iroq jurnali, xarajat shabloni). Hujjat buni birinchi
   deb hisoblaydi.
2. **Faza 1, hafta 3-4** — Jadval (ekran 2) va Bemor kartasi (ekran 4)ni
   to'liq qurish, `apps/api/src/api/routes/patients.ts` dagi naqshni
   takrorlab.
