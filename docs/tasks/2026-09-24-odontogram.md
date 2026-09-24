# T5: Tish kartasi (odontogramma) — Faza 2 ning birinchi qismi

> Manba: foydalanuvchi so'rovi (2026-09-24) — https://github.com/ZoliQua/React-Advanced-Odontogram
> tish sxemasini loyihaga integratsiya qilish, `odontogram` branchida.
> Qoidalar: `CLAUDE.md`. Spetsifikatsiya: `docs/prd-v1.md` bo'lim 5.2 (`dental_charts`,
> `clinics.features`), 6.2 (ekran 4a), 7 (Faza 2).

## Holat

| # | Vazifa | Holat |
|---|---|---|
| T5 | Tish kartasi: kutubxona, backend saqlash, ekran | ✅ (2026-09-24 — hisobot quyida) |

## Kelishilgan qarorlar (foydalanuvchi bilan, reja bosqichida)

| Masala | Qaror | Sabab |
|---|---|---|
| Kutubxonani qanday olish | npm'dagi **2.5.0**, lekin `vendor/` ga tarball sifatida (sha512 npm bilan bir xil) | GitHub'dagi 2.6.0 hali npm'da yo'q. Paket 2026-08 da chiqqan, bitta muallif — npm'dan o'chirilsa `pnpm install`/deploy buzilmasin (`vendor/README.md`). Manba kodini ko'chirish (63 MB, Tailwind v3) rad etildi |
| Til | Karta ichi **rus tilida** (vaqtincha), atrofdagi UI o'zbekcha | Kutubxonada o'zbek tili yo'q, tashqaridan tarjima qo'shish API'si yo'q (til ro'yxati yopiq). 3 MB bundle'ni yamash mo'rt. O'zbek tarjimasi — keyin upstream PR |
| Rollar | Tahrirlaydi: `doctor`, `owner`. Faqat ko'radi: `admin`. `cashier` — kirmaydi | Tibbiy yozuv |
| Qamrov | Faqat holat (status) kartasi. Reja (plan) rejimi va parodont kartasi — yo'q | Reja — Faza 2 `treatment_plans` bilan (narx/bosqich) |
| Saqlash | Har saqlash — yangi versiya (qator), avtosaqlash yo'q, "Saqlash" tugmasi | Tibbiy yozuv tarixi; `deleted_at` tamoyili |
| Feature flag | `clinics.features.odontogram`, default o'chiq | CLAUDE.md qoida 7 — loyihadagi birinchi flag mexanizmi |

## Qabul mezonlari

- [x] Bemor kartasida "Tish kartasi" tugmasi (faqat modul yoqilgan klinikada) → `/patients/:id/chart`.
- [x] Karta serverga saqlanadi va qayta ochilganda aynan tiklanadi.
- [x] Modul yoqilmagan klinikada API 404, UI tushuntirish matni.
- [x] Rollar: admin faqat ko'radi (readOnly, "Saqlash" yo'q), kassir kirmaydi (API 403, UI "ruxsat yo'q").
- [x] Boshqa klinika bemori — 404; noto'g'ri ID — 400 (500 emas).
- [x] Ikki kishi bir vaqtda saqlasa — ikkinchisi 409 va "Kartani yangilash" tugmasi; parallel so'rovlardan faqat bittasi o'tadi.
- [x] Takroriy `Idempotency-Key` — bitta yozuv.
- [x] `audit_log` — har saqlash (tanasiz metama'lumot).
- [x] Bo'sh holat: bitta jumla nima qilishni aytadi; xato xabarlari tuzatish yo'lini aytadi.
- [x] Kutubxona boshqa ekranlar bundle'iga kirmaydi (lazy chunk).
- [x] Unit + integratsiya + typecheck + lint + build yashil.

## Ehtimoliy xatolar va ularning yopilishi

| Xavf | Yechim | Tekshiruv |
|---|---|---|
| Engine singleton — bemor A holati B da qolishi | `key={patientId}` → unmount'da `destroyOdontogram` | e2e: to'g'ridan-to'g'ri va SPA ichida A→B |
| Import vaqti: ichki effekt tashqidan oldin; 2.5.0 da `initOdontogram` asinxron; StrictMode | Import o'rovchi komponent effektida; `buildGrid` joriy holatni chizadi (manba o'qildi) | e2e: saqlangan holat qayta ochilganda tiklanadi |
| `importStatus` "o'zgardi" hodisasi → soxta "saqlanmagan" | Dirty = `getStatusChart()` JSON ≠ asos | e2e: ochilganda va tanlashda dirty yo'q |
| Lost update (ikki kishi) | `baseChartId` + bemor qatori `FOR UPDATE` + `clock_timestamp()` | integratsiya: parallel test (qulfsiz holatda yiqilishi tasdiqlandi) |
| Kutubxona CSS'i global (`body` foni, `select`, `:root`) va SPA'da qolib ketishi | `?inline` + `scopeOdontogramCss` + `<style>` faqat sahifa ochiqda | e2e: body foni o'zgarmaydi, chiqqanda `<style>` olib tashlanadi |
| Tailwind preflight kutubxonani buzishi | `img{max-width:none}` (ikonka 0px bo'lib qolgan edi) | screenshot |
| 2.6 MB chunk — workbox 2 MiB chegarasi build'ni to'xtatdi | Chunk precache'dan chiqarildi (`globIgnores`) | `pnpm build` yashil, `sw.js`da chunk yo'q |
| Deploy'dan keyin eski chunk topilmasligi | `ChunkErrorBoundary` — "yuklanmadi, sahifani yangilang" | chunk so'rovi bloklab tekshirildi |
| Saqlamasdan chiqib ketish | `useUnsavedChangesGuard`: `beforeunload` + havola bosilishida `confirm` | e2e: sidebar bosilganda dialog |
| Katta/yaroqsiz karta | zod qobiq (FDI 11–48), `bodyLimit` + 512 KB → 413 | integratsiya |
| Kutubxona o'chib ketishi | `vendor/` tarball, MIT | `pnpm install --frozen-lockfile` tarball'dan |

## Hisobot (2026-09-24)

- **Backend:** migratsiya `0005_t5_dental_charts` (`clinics.features`, `dental_charts`),
  `GET/POST /api/patients/:patientId/dental-chart` (`routes/dentalCharts.ts`),
  `middleware/features.ts`, `domain/dentalChart.ts`, `domain/clinicFeatures.ts`.
  Seed'dagi `namuna-klinika` da modul yoqilgan.
- **Web:** `routes/DentalChartPage.tsx`, `components/odontogram/DentalChartEditor.tsx`
  (lazy), `scopeOdontogramCss.ts`, `ChunkErrorBoundary.tsx`, `lib/useUnsavedChangesGuard.ts`.
- **Testlar:** unit 102 → **135** (+33), integratsiya 52 → **68** (+16, real Postgres 16),
  typecheck 3/3, oxlint (faqat avvaldan bor 2 ta ogohlantirish), `pnpm -r build` yashil.
- **Brauzer:** `apps/web/e2e/dental-chart.mjs` — 33 tekshiruv, dev (Vite) va prod
  (`vite preview` + service worker) ikkalasida yashil; screenshotlar 1440px va 390px.
- **Yo'l-yo'lakay:** `e2e/smoke.mjs` sintaksis xatosi tuzatildi (`'text=Internet yo'q'`
  — apostrof satrni yopib qo'yardi, T4 dan beri lint qizil edi).

## Qilinmagan / keyingi

1. **O'zbek tarjimasi** — kutubxonaga `uz` locale (≈1015 kalit) upstream PR; stomatolog
   atamalarni ko'rib chiqishi kerak. Qabul qilingach — vendor yangilanadi, `language="uz"`.
2. **Kutubxona 2.6.0** npm'ga chiqqach — asosiy chunk ~1.8 MB ga tushadi
   (`setToothAnatomy` async bo'lgan — biz ishlatmaymiz). Tartib: `vendor/README.md`.
3. **Modulni yoqish UI'i** yo'q — real klinikada hozircha SQL:
   `UPDATE clinics SET features = features || '{"odontogram": true}' WHERE slug = '...';`
   (API darhol ko'radi — `features` har so'rovda sessiya bilan o'qiladi; UI tugmasi sahifa
   yangilanganda chiqadi, qayta login shart emas).
4. **Versiyalar tarixi UI'i** — ma'lumot saqlanadi (`dental_charts`), ko'rish ekrani yo'q.
5. **`performed_services.tooth` bilan bog'lash** (kassada kiritilgan xizmat kartada ko'rinishi) — yo'q.
6. **Brauzerning "orqaga" tugmasi** saqlanmagan o'zgarishda to'xtatilmaydi
   (`BrowserRouter`da imkonsiz; `createBrowserRouter`ga o'tish alohida ish).
7. **Mobil (390px):** ilova qobig'i (`Shell.tsx`) 256px qattiq sidebar bilan — har qanday
   sahifada kontentga ~134px qoladi. Bu T5 dan oldin ham bor, 8/9/10-ekranlarga ham
   ta'sir qiladi — alohida vazifa.
