# dental-web — Claude Code uchun qoidalar

O'zbekistondagi xususiy stomatologiya klinikalari uchun boshqaruv tizimi.
Spetsifikatsiya: `docs/prd-v1.md`. Joriy vazifalar: `docs/tasks/`.

## Struktura

- `apps/api` — Hono + Drizzle + PostgreSQL 16
- `apps/web` — React + Vite + Tailwind v4, PWA
- `packages/shared` — zod sxema va enum'lar, ikki tomon uchun yagona manba

## Buyruqlar

Barchasi repo ildizidan, pnpm workspace orqali (`pnpm -r` = har uch paket):

- O'rnatish: `pnpm install`
- Test: `pnpm -r test` (api: vitest, sof funksiya testlari, DB'siz, har doim tez/yashil; web: hozircha unit test yo'q — no-op)
- Integratsiya test (DB kerak): `pnpm test:integration` — `apps/api/.env.test` (`.env.test.example` asosida, nomida "test" so'zi bor DATABASE_URL) kerak. Qollanma bo'lim 9.2.
- Typecheck: `pnpm -r typecheck`
- Migratsiya generatsiyasi (sxema o'zgargach): `pnpm db:generate` (= `apps/api` da `drizzle-kit generate`)
- Migratsiyani qo'llash: `pnpm db:migrate` (= `apps/api` da `tsx src/db/migrate.ts`, `DATABASE_URL` env kerak)
- Seed (dastlabki ma'lumot): `pnpm db:seed`
- Dev server: `pnpm dev:api` (port 3000) va `pnpm dev:web` (Vite, `/api` ni 3000 ga proksi qiladi) — ikkalasi alohida terminalda parallel
- E2E smoke: `node apps/web/e2e/smoke.mjs` (ishlab turgan api+web talab qiladi — alohida skript nomi `package.json` da yo'q)
- Web lint: `pnpm --filter @dental/web lint` (oxlint)
- Build: `pnpm -r build`

Lokal Postgres uchun tayyor npm skripti yo'q — `docker-compose.yml` (`docker compose up -d db`) yoki
mahalliy Postgres 16 + `apps/api/.env` dagi `DATABASE_URL`.

## Yopiq qarorlar

`docs/prd-v1.md` bo'lim 2 dagi "Rad etilgan" ro'yxatini qayta ochma, bo'lim 2 ni tahrirlama.
Vazifa rad etilgan qarorga zid kelsa — to'xta va so'ra.

## Kod qoidalari

1. Domen logikasi `apps/api/src/domain/` da, sof funksiya, HTTP va DB dan ajratilgan.
2. Har API kirishi zod bilan validatsiya qilinadi.
3. Pul — so'mda integer, `numeric(14,0)`. Float ishlatilmaydi.
4. Vaqt UTC da saqlanadi, `Asia/Tashkent` da ko'rsatiladi.
5. Migratsiya faqat oldinga. Mavjud migratsiya fayli tahrirlanmaydi — yangisi yoziladi.
6. Kassa, marja, shifokor foizi, bemor balansi — unit test majburiy.
7. Yangi modul feature flag ortida.
8. `.env` repo'ga tushmaydi.
9. Har o'zgartirish `audit_log` ga yoziladi.
10. Hech narsa o'chirilmaydi — `deleted_at`. Moliyaviy hisobotning kanonik filtri
    `deleted_at IS NULL`. `voided_at` hisobot filtrida ishlatilmaydi (`payments.test.ts` qulflaydi).
11. `clinic_id` hech qachon client'dan olinmaydi — faqat sessiyadan.
12. Pul yoki vizit yaratuvchi har endpoint `Idempotency-Key` middleware bilan (T4 dan keyin).

## Sxema = hujjat

Sxema o'zgargan commit'da `docs/prd-v1.md` bo'lim 5 ham yangilanadi.
Busiz commit tugallanmagan hisoblanadi.

## Klinikaga xos talablar

Pilot klinikaning o'ziga xos talabi hardcode qilinmaydi — faqat `clinics` sozlamasi yoki
feature flag orqali (namuna: `clinics.doctor_pct_basis`).
Har yangi talab `docs/talablar.md` ga [U] universal / [K] klinikaga xos / [?] noaniq belgisi bilan yoziladi.

## UI qoidalari

Onboarding alohida ish emas — har ekran bilan birga yoziladi.

- UI matni o'zbek tilida, lotin yozuvida.
- Bo'sh holat: nima bo'lishini tushuntiruvchi bitta jumla + bitta harakat tugmasi.
- Ma'nosi aniq bo'lmagan maydon yonida qisqa izoh — nega kerakligi.
- Xato xabari tuzatish yo'lini aytadi: "Telefon 9 xonali bo'lsin: 90 123 45 67", "Noto'g'ri" emas.
- Yangi yozuv yaratish ≤3 bosish.
- 8, 9, 10-ekranlar mobil-birinchi: 360px kenglikda to'liq ishlaydi,
  Playwright 390×844 viewport'da tekshiriladi.

## Maxfiylik

- Loglarga F.I.Sh, telefon, JShShIR yozilmaydi — faqat ID. Query string va so'rov tanasi ham.
- Tashqi LLM/AI API'ga bemor ma'lumoti yuborilmaydi (O'RQ-1115).
- Bemorga ketadigan xabarda tashxis va davolash ma'lumoti bo'lmaydi.
- Service worker `/api/*` javoblarini keshlamaydi.

## Ish tartibi

1. Vazifani `docs/tasks/` dan o'qi.
2. Kod yozishdan oldin qisqa reja ber: qaysi fayllar, qanday yondashuv, qaysi qabul mezonlari. Tasdiqni kut.
3. Qur → test → typecheck. Hammasi yashil bo'lmasa, vazifa tugamagan.
4. Commit xabari vazifa raqami bilan: `T2: login klinika ichida unique`.
5. Vazifa oxirida: task faylida holatni ✅ qil, `docs/prd-v1.md` bo'lim 15 ga 2–3 qator.
6. Faraz qilsang — kodda `// FARAZ:` izohi va bo'lim 15 da qayd.
7. **TO'XTA** belgisi bor joyda — to'xta va so'ra. Raqam, narx, klinika ma'lumotini to'qima.
