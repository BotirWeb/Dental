# Tuzatishlar: 2026-09-22 tahlilidagi ochiq masalalar

> Manba: `docs/tahlil/2026-09-22-tahlil-va-ai-yordamchi.md`
> Qoidalar: `CLAUDE.md`
> Hajm: T0–T2 ~6–8 soat, T3–T4 ~8–12 soat.
> Bu fayldan keyin: 2, 4, 5-ekranlar (alohida spec). 12 ekrandan 2 tasi bor —
> tuzatishlar mahsulotni kechiktirmasligi kerak.

## Claude Code'ga birinchi xabar

```
CLAUDE.md va docs/tasks/2026-09-22-tuzatishlar.md ni o'qi.
T0 dan boshla. Har vazifadan oldin qisqa reja ber va tasdiqimni kut.
Vazifa oxirida: test va typecheck natijasi, commit, shu faylda holatni yangila.
```

## Holat

| # | Vazifa | Tahlildagi kod | Qachon | Holat |
|---|---|---|---|---|
| T0 | Joriy holatni tekshirish | — | hozir | ✅ (2026-09-22 — hisobot quyida) |
| T1 | Hujjatni kodga moslash | 3.2, 3.3, M3 | hozir | ✅ (2026-09-22 — `docs/prd-v1.md`, `docs/tahlil/`, `docs/talablar.md` noldan yaratildi) |
| T2 | Login klinika ichida unique | C4 | hozir | ✅ (2026-09-22 — hisobot quyida) |
| T3 | Xavfsizlik | D2 | pilotdan oldin | ✅ (2026-09-22 — hisobot quyida) |
| T4 | Tarmoq uzilishiga chidamlilik | M1 | 6-ekran bilan | ✅ (2026-09-22 — hisobot quyida) |
| — | Ega uchun mobil dizayn | M2 | 8–10-ekranlar bilan | CLAUDE.md qoidasi |

### T0 hisoboti (2026-09-22)

- Repo toza, remote `BotirWeb/Dental` ga mos. `pnpm -r typecheck` — 3/3 paket
  yashil. `pnpm -r test` — **66/66** test o'tdi. Migratsiya (`0000_wild_sphinx`,
  `0001_friendly_pestilence`) yangi, bo'sh Postgres 16 bazaga muvaffaqiyatli
  qo'llandi.
- Route/frontend chaqiruv solishtiruvi: to'liq mos (`/api/health`,
  `/api/auth/{login,logout,me}`, `/api/patients/{GET ?q=, GET :id, POST}`).
  Orfan chaqiruv yo'q.
- **`/api/services` va `/api/doctors` 401 masalasi** — joriy kodda bu
  route'lar umuman yo'q (na backend, na frontend chaqiruv) — `/services` va
  `/reports/doctors` faqat `status: "todo"` UI yo'llari. Route yo'q bo'lsa
  Hono `404` qaytaradi, `401` emas. Batafsil:
  `docs/tahlil/2026-09-22-tahlil-va-ai-yordamchi.md` oxiri.
- **Manba hujjatlari topilmadi:** `docs/prd-v1.md` va
  `docs/tahlil/2026-09-22-tahlil-va-ai-yordamchi.md` repoda ham, kompyuterda
  qidirilganda ham yo'q edi. Foydalanuvchi bilan kelishilgach — ikkalasi ham
  kod, kod izohlari va shu fayl asosida noldan tiklandi (T1).
- CLAUDE.md "Buyruqlar" bo'limi haqiqiy skript nomlari bilan to'ldirildi.

## Kelishilgan qarorlar

| Masala | Qaror | Sabab |
|---|---|---|
| C4 | Klinika kodi + login; login klinika ichida unique | Bir shifokor ikki klinikada ishlashi mumkin; har klinikada `admin` bo'lishi kerak; xodimlarning ko'pida email yo'q |
| D2 sessiya | Idle 12 soat, absolyut 7 kun, env orqali | Bitta smena sig'adi; ketgan xodim ertasiga kira olmaydi |
| M1 | To'liq oflayn rejim hozir yo'q. Idempotentlik + aniq indikator | Oflayn to'lov yozish — ikki marta hisoblash riski. Outbox 6-ekran real ishlagandan keyin loyihalanadi |
| M3 | `docs/talablar.md` + klinikaga xos narsa faqat sozlama orqali | `doctor_pct_basis` allaqachon shu namunada |

---

## T0 — Joriy holatni tekshirish

Kod o'zgarmaydi (CLAUDE.md "Buyruqlar" bo'limidan tashqari).

1. `git status`, `git remote -v`, `git log --oneline -10` — ish daraxti toza, remote `BotirWeb/Dental`.
2. O'rnatish, testlar (66 ta kutiladi), typecheck, migratsiyani toza bazaga qo'llash.
3. API'dagi barcha route'lar ro'yxati va `apps/web` dagi barcha `/api/...` chaqiruvlar ro'yxati.
   Mos kelmaganlarini ko'rsat.
4. Alohida: tish formulasi bo'limida `/api/services` va `/api/doctors` 401 qaytargani qayd etilgan,
   `/api/auth/me` esa 200. Aniqla: route mavjudmi, qaysi middleware ortida, cookie yetib boradimi
   (Vite proxy orqalimi yoki to'g'ridan-to'g'ri portgami), sababi nima. **Faqat aniqla, tuzatma.**
5. CLAUDE.md "Buyruqlar" bo'limini haqiqiy script nomlari bilan to'ldir.

**Natija:** 10–15 qatorlik hisobot.
**TO'XTA:** testlar o'tmasa yoki holat tahlil faylidan farq qilsa — davom etma, hisobot ber.

---

## T1 — Hujjatni kodga moslash

Kod o'zgarmaydi.

1. **Joylashtirish** (agar hali yo'q bo'lsa): loyiha qo'llanmasi → `docs/prd-v1.md`,
   tahlil → `docs/tahlil/2026-09-22-tahlil-va-ai-yordamchi.md`.
2. **Bo'lim 5 ↔ Drizzle sxema.** Joriy sxemani o'qib, bo'lim 5 ni unga moslashtir. Kamida:
   - `clinics.doctor_pct_basis`
   - `sessions` jadvali; login rate limit jadvali (agar DB da bo'lsa)
   - `deleted_at`: `visits`, `performed_services`, `payments`, `expenses`
   - `payments`: `voided_at`, `voided_by`, `void_reason`, `reversal_of_id`, `cash_session_id`, `created_at`
   - `cash_sessions` jadvali
   - `performed_services`: `discount_type`, `discount_value`, `discount_amount`
   - `patients.phone_normalized`

   Ro'yxatda yo'q boshqa farq topilsa — uni ham qo'sh va hisobotda ko'rsat.
3. **Bo'lim 5 tamoyillariga qo'shish:**
   - To'lov tahrirlanmaydi: xato → void + reversal yozuvi.
   - Moliyaviy hisobot filtri `deleted_at IS NULL`; `voided_at` filtrda emas.
     Sababi tahlildagi misol: 500 000 to'g'ri, −4 500 000 xato.
   - Bemor balansi formulasi — `domain/patientBalance.ts` dagini so'z bilan.
   - Telefon: `phone_normalized` (9 raqam). Dublikat — ogohlantirish, UNIQUE emas: oila bitta raqamdan foydalanadi.
4. **Bo'lim 1 va 7 — muddat.** Bitta raqam: 18–24 oy. Bo'lim 7 dagi soatlar qoladi,
   "Kuniga 3 soat" ustuniga izoh: amalda reja 40–60% bajariladi.
5. **Bo'lim 1 — break-even.** "~10 mln so'm/oy — bu tushum, foyda emas" deb aniq yoz.
   Ostiga xarajat jadvali: VPS, domen, zaxira joyi, SMS, to'lov komissiyasi, qo'llab-quvvatlash vaqti.
   Summa ustuni `___`. **Raqam to'qima.**
6. **Bo'lim 11 — yangi risklar:**
   - Internet uzilishi → admin daftarga qaytadi. Yuqori. Yechim: T4 + klinikada zaxira 4G.
   - Bitta klinikaga moslashib qolish. Yuqori. Yechim: `docs/talablar.md` + sozlama orqali.
7. **`docs/talablar.md` yaratish.** Ustunlar: sana | kimdan | talab | [U]/[K]/[?] | qaror | kodda qayerda.
   Boshlang'ich yozuvlar:
   - shifokor foizi asosi (`doctor_pct_basis`) — [?], sozlanadigan
   - chegirma so'mda yoki foizda — [U], ikkalasi qo'llab-quvvatlanadi
   - kafolat vizitida shifokor komissiyasi 0 — [?], FARAZ, dala ishida tasdiqlanadi
8. **Bo'lim 15** ga 2026-09-22 yozuvi: tahlil o'tkazildi, A1–D1 bajarildi, shu vazifalar fayli ochildi.

**Qabul:** Drizzle sxemadagi har jadval va ustun bo'lim 5 da bor — Claude Code solishtirma ro'yxatini ko'rsatadi.

---

## T2 — Login klinika ichida unique (C4)

Hozir qilinadi, chunki birinchi real foydalanuvchi kirishidan oldin login tartibini o'zgartirish eng arzon.

**DB:**
- `clinics.slug` — text, NOT NULL, UNIQUE, format `^[a-z0-9-]{3,32}$`.
  Mavjud qatorlarga vaqtinchalik slug (masalan `clinic1`), seed'da aniq qiymat.
- `users.login` saqlashda trim + lowercase. Global unique olib tashlanadi →
  unique `(clinic_id, login) WHERE deleted_at IS NULL`.
- **TO'XTA:** mavjud loginlar lowercase qilinganda to'qnashuv chiqsa.

**API:**
- `POST /api/auth/login` kirishi `{ clinic?, login, password }`, zod sxema `packages/shared` da.
- `clinic` bo'sh → `DEFAULT_CLINIC_SLUG` env → ikkalasi ham yo'q → 400.
- Noma'lum klinika, noma'lum login, noto'g'ri parol — bir xil status va bir xil javob tanasi.
  Noma'lum holatlarda ham dummy hash bilan argon2 verify bajariladi (vaqt farqi bo'lmasin).
- Rate limit kaliti: `ip + clinic + login`. Faqat IP bo'yicha umumiy chegara bo'lsa — saqlanadi.
- `/api/auth/me` javobiga `clinic: { slug, name }`.

**Web:**
- Login ekranida "Klinika kodi" maydoni. Muvaffaqiyatli kirishdan keyin shu qurilmada eslab qolinadi
  va keyingi safar oldindan to'ldiriladi; yonida "o'zgartirish" havolasi.
- Seed va `e2e/smoke.mjs` yangilanadi.

**Testlar:**
- Ikki klinika, ikkalasida `admin` → har biri o'z klinikasiga kiradi; boshqa klinika bemorini
  qidiruvda ham, (mavjud bo'lsa) ID bo'yicha so'rovda ham ko'rmaydi.
- O'chirilgan foydalanuvchining logini yangi foydalanuvchiga beriladi.
- Uch xato holatda javob tanasi bir xil.
- A klinika `admin` bloklanishi B klinika `admin` ga ta'sir qilmaydi.

**Qilinmaydi:** subdomen orqali klinikani aniqlash — Faza 4.

### T2 hisoboti (2026-09-22)

**DB:** `clinics.slug` (UNIQUE, CHECK `^[a-z0-9-]{3,32}$`) qo'shildi;
`users.login` global unique olib tashlandi → `(clinic_id, login) WHERE
deleted_at IS NULL`. Migratsiya `0002_t2_clinic_slug_login_unique.sql` mavjud
qatorlarga `clinic1`, `clinic2`, ... backfill qiladi va login'larni
trim+lowercase qiladi. **TO'XTA sharti sinaldi:** real Postgres'da bitta
klinika ichida ikkita to'qnashuvchi login (`"Owner"`/`"owner"`) bilan
migratsiyani ishga tushirdim — kutilganidek `23505` xato bilan to'xtadi va
BUTUN migratsiya (yangi `slug` ustuni ham) tranzaksiya ichida orqaga qaytdi,
DB oldingi holatida qoldi. Bu safar to'qnashuv chiqmadi (seed'dagi loginlar
allaqachon lowercase), shuning uchun davom etdim.

**API:** `/api/auth/login` kirishi `{ clinic?, login, password }`; `clinic`
bo'sh → `DEFAULT_CLINIC_SLUG`; ikkalasi ham yo'q → 400. Uch xato holat (noma'lum
klinika, noma'lum login, noto'g'ri parol) — real curl bilan tekshirildi, bir
xil `401` + bir xil javob tanasi; noma'lum holatda ham DUMMY argon2 hash bilan
verify ishlaydi. `/api/auth/me` va login javobida `clinic: {slug, name}`.
Rate-limit kaliti `ip` + `clinic:login` ga kengaytirildi.

**Web:** Login ekraniga "Klinika kodi" maydoni — muvaffaqiyatli kirishdan
keyin `localStorage`da eslab qolinadi, "o'zgartirish" havolasi bilan qayta
tahrirlanadi. Seed va `e2e/smoke.mjs` yangilandi (`namuna-klinika`).

**Testlar:** `apps/api/src/domain/auth.ts` (`resolveClinicSlug`) — 6 unit
test. **DIQQAT:** "ikki klinika/ikkalasida admin — bir-birini ko'rmaydi",
"o'chirilgan login qayta beriladi" kabi DB-bog'liq stsenariylar qo'lda (real
Postgres'da, yuqoridagi izoh) tekshirildi, lekin **avtomatik integratsiya
test sifatida yozilmadi** — bu repoda hozircha DB'ga ulanadigan test
infratuzilmasi yo'q (barcha 72 test — sof funksiya, DB'siz). Buni qo'shish
alohida qaror talab qiladi (pastga qarang).

**Qaror (2026-09-22):** DB'ga bog'liq route-darajasidagi testlar (integratsiya
test qatlami — `DATABASE_URL` talab qiladigan `*.integration.test.ts`)
hozircha QO'SHILMAYDI — foydalanuvchi bilan kelishilgan holda **T4 bilan
birga** qayta ko'riladi (T4 ham DB-bog'liq: idempotentlik middleware). Shu
choragacha DB-bog'liq stsenariylar qo'lda (real Postgres) tekshiriladi va
vazifa hisobotida qayd etiladi — xuddi yuqoridagi T2 sinovlari kabi.

**Yangilanish (2026-09-22, T4'dan keyin):** foydalanuvchi bilan kelishilgach,
integratsiya test qatlami qo'shildi (`pnpm test:integration`, tafsilot —
`docs/prd-v1.md` bo'lim 9.2 oxiri). Birinchi ishga tushirishda **shu T2 uchun
haqiqiy xato topildi**: `POST /api/auth/login` `deleted_at IS NULL` filtrisiz
SELECT qilgani sabab, "o'chirilgan foydalanuvchining logini yangi
foydalanuvchiga berish" qabul mezoni ba'zan buzilishi mumkin edi (qo'lda
sinovda tasodifan uchramagan). Tuzatildi: `src/api/routes/auth.ts`.

---

## T3 — Xavfsizlik (D2)

Pilot klinikaga real bemor ma'lumoti kirishidan oldin tugashi shart.

**Kodda:**
1. Sessiya: idle 12 soat, absolyut 7 kun — `SESSION_IDLE_HOURS`, `SESSION_MAX_DAYS`.
   Faollik vaqti DB da har so'rovda emas, ≥5 daqiqada bir yangilanadi.
2. Foydalanuvchi deaktivatsiya yoki soft-delete qilinsa — barcha sessiyalari darhol o'chadi.
   Parol o'zgarsa — joriydan boshqa barcha sessiyalar o'chadi.
3. Parol: kamida 10 belgi; login bilan bir xil emas; kichik taqiq ro'yxati
   (`12345678`, `qwerty123`, `password`, klinika slug'i va h.k.). Katta harf/belgi talabi yo'q.
4. CSRF: holat o'zgartiruvchi so'rovlarda Origin tekshiruvi (`hono/csrf`), ruxsat etilgan origin env'dan.
5. Xavfsizlik headerlari: `nosniff`, `frame-ancestors 'none'`, Referrer-Policy, asosiy CSP.
   Caddy'da yoki `hono/secure-headers` da — bittasida, ikkalasida emas.
6. Loglar: so'rov logida query string va tana yozilmaydi yoki maskalanadi.
   Sabab: bemor qidiruvi `?q=901234567` — telefon access log'ga tushadi.
   Xato stack trace'larida ham so'rov tanasi bo'lmasin.

**Testlar:** deaktivatsiyadan keyin eski cookie → 401; idle muddat o'tgach → 401 (vaqt mock);
begona Origin'dan POST → 403; test telefon raqami log chiqishida yo'q.

**Hujjatda** — `docs/prd-v1.md` ga yangi "9.1 Xavfsizlik" bo'limi: yuqoridagi 6 band, plyus:
- Ega uchun 2FA (TOTP) — Faza 4.
- Zaxira: `pg_dump` → shifrlash (`age`) → alohida joy. Shifr kaliti serverda saqlanmaydi.
- VPS: faqat SSH kalit, root login yo'q, ochiq portlar faqat 22/80/443, Postgres tashqariga ochilmaydi,
  avtomatik xavfsizlik yangilanishlari.
- `audit_log` ni faqat owner ko'radi.
- VPS'ga kirish huquqi kimda — ro'yxat (hozircha bitta odam).

### T3 hisoboti (2026-09-22)

**Bajarildi (kodda):**
1. Sessiya idle (12s) + absolyut (7k) muddati, `sessions.last_activity_at`
   (migratsiya `0003_t3_session_last_activity`), ≥5 daqiqada bir yangilanadi.
   Sof funksiyalar `src/domain/sessionExpiry.ts` — 7 unit test.
2. Deaktivatsiya/soft-delete → eski cookie 401: mavjud tekshiruv edi
   (`getUserBySessionToken`), qayta tasdiqlandi. `deleteAllSessionsForUser`
   helper qo'shildi (kelajakdagi deaktivatsiya/parol endpoint'i uchun).
3. Parol siyosati — `src/domain/password.ts`, 8 unit test.
4. CSRF/Origin — `src/api/middleware/csrf.ts` (o'z yozilgan, sabab faylning
   boshida: `hono/csrf` faqat form-content-type'ni tekshiradi, biz JSON).
5. `hono/secure-headers` — `src/api/app.ts`.
6. Log xavfsizligi — alohida so'rov logeri yo'q, tekshirildi.

**Real Postgres + serverga qarshi qo'lda tekshirildi (curl, DB'ni to'g'ridan
to'g'ri o'zgartirib):**
- 13 soat harakatsizlikdan keyin eski cookie → `401` (IDLE). ✅
- Doim faol, lekin `expires_at` o'tgan (8 kun) → `401` (ABSOLYUT). ✅
- Ketma-ket ikki so'rov (5 daqiqadan kam) → `last_activity_at` O'ZGARMADI
  (DB yozuvi tejaldi). ✅
- Begona `Origin` (Sec-Fetch-Site'siz) POST → `403`. ✅
- `Origin` umuman yo'q POST → `403`. ✅
- Mos `Origin` YOKI `Sec-Fetch-Site: same-origin` → `200`. ✅
- `GET /api/health` javobida `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Content-Security-Policy`,
  `Referrer-Policy: no-referrer` — bor. ✅

**Qilinmadi (ilgak yo'q — hypothetical route yaratmadim):**
- "Parol o'zgarsa boshqa sessiyalar o'chadi" — parol o'zgartirish endpoint'i
  hali qurilmagan (ekran 12). `deleteAllSessionsForUser` tayyor, chaqiriladigan
  joy yo'q.
- Parol siyosati (`validatePassword`) hech qayerdan chaqirilmaydi — xuddi shu
  sabab (foydalanuvchi yaratish endpoint'i yo'q).
- Zaxira (`pg_dump`+`age`), VPS SSH sozlamasi, VPS kirish ro'yxati — bular
  kod emas, infratuzilma/operatsion ish (`docs/prd-v1.md` 9.1 "Kelajakda"
  qismida hujjatlashtirildi, bajarilmadi).

**Test:** 87/87 (72 + 15 yangi: `sessionExpiry` 7, `password` 8). Typecheck —
3/3 yashil.

---

## T4 — Tarmoq uzilishiga chidamlilik (M1, birinchi qism)

To'liq oflayn rejim bu vazifada yo'q.

1. **Idempotentlik middleware.**
   - `Idempotency-Key` header (UUID). Jadval `idempotency_keys(clinic_id, key, request_hash,
     status_code, response_body, created_at)`, unique `(clinic_id, key)`.
   - Takroriy kalit + bir xil tana → saqlangan javob qaytadi, yangi yozuv yaratilmaydi.
     Bir xil kalit + boshqa tana → 422.
   - 48 soatdan eski kalitlar tozalanadi.
   - Qo'llanadi: bemor yaratish va hozir mavjud barcha to'lov, void, kassa smenasi endpoint'lari.
   - Web: forma ochilganda kalit yaratiladi, qayta urinishda o'sha kalit, muvaffaqiyatdan keyin yangisi.
   - Sabab: sekin internetda admin tugmani ikki marta bossa yoki so'rov timeout'dan keyin
     qayta yuborilsa — ikki marta to'lov. Bu oflayn rejimsiz ham real xato.
2. **Tarmoq holati indikatori.**
   - Manba: `navigator.onLine` + `/api/health` har 30 s (faqat tab ko'rinib turganda) + fetch tarmoq xatosi.
   - Oflayn: sahifa tepasida doimiy banner "Internet yo'q. O'zgarishlar saqlanmaydi —
     ulanish tiklanishini kuting." Saqlash tugmalari o'chiriladi, formadagi ma'lumot o'chmaydi.
   - Internet bor, server javob bermayapti (5xx/timeout) — alohida xabar: "Server javob bermayapti".
   - Tiklanganda banner yo'qoladi.
3. **Service worker:** faqat ilova qobig'i (HTML/JS/CSS) keshlanadi. `/api/*` keshlanmaydi —
   bemor ma'lumoti umumiy kompyuterda qolmasin. Mavjud PWA sozlamasini tekshir.

**Testlar:** bir xil kalit bilan ketma-ket 2 ta POST → 1 yozuv; parallel 2 ta → 1 yozuv;
boshqa tana → 422; Playwright `context.setOffline(true)` → banner chiqadi, tugma o'chadi,
forma ma'lumoti saqlanadi.

**Keyin (bu faylda emas):** 6-ekran uchun IndexedDB outbox — to'lovni navbatga olib,
shu idempotentlik kaliti bilan qayta yuborish.

### T4 hisoboti (2026-09-22)

**DB:** `idempotency_keys` (composite PK `(clinic_id, key)`, `request_hash`,
`status_code`/`response_body` NULLABLE — "band qilish" naqshi, migratsiya
`0004_t4_idempotency_keys`). Qaror mantig'i sof funksiya
`src/domain/idempotency.ts` (`decideIdempotency`) — 7 unit test.

**API:** `src/api/middleware/idempotency.ts` — `POST /patients`ga ulandi
(hozircha yagona pul/vizit yaratuvchi endpoint; to'lov/void/kassa smenasi
hali qurilmagan — ekran 6, ular yozilganda shu middleware ular ustiga ham
qo'shiladi). Real Postgres+serverga qarshi curl bilan tekshirildi:
- Ketma-ket bir xil kalit+tana → 2-so'rov saqlangan javobni qaytardi, DB'da
  **1 yozuv**. ✅
- Bir vaqtda (parallel, `&`+`wait`) ikkita bir xil so'rov → DB'da **1 yozuv**
  (ikkalasi ham 201 qaytardi — real vaqtda A to'liq tugab ulgurdi, lekin
  duplikat yozuv YO'Q, invariant saqlandi). ✅
- Bir xil kalit, boshqa tana → 422. ✅
- Kalit yo'q → 400. ✅
- "Band" (hali tugallanmagan) holat DB'da qo'lda simulyatsiya qilinib →
  409 "biroz kuting" — deterministik tasdiqlandi. ✅

**Web:** `state/NetworkContext.tsx` + `components/NetworkBanner.tsx`
(`App.tsx`da butun ilova ustida), `lib/networkSignal.ts` (fetch tarmoq
xatosini Context'ga ulash), `lib/api.ts` (`postIdempotent`),
`PatientsPage.tsx` (kalit forma ochilganda/muvaffaqiyatdan keyin
generatsiya, saqlash tugmasi oflaynda o'chadi).

**Service worker:** `pnpm build` bilan tekshirildi — `dist/sw.js`da faqat
ilova qobig'i precache qilingan, `/api/*` uchun runtime-caching YO'Q edi.
O'zgartirish shart bo'lmadi.

**Testlar:** 94/94 (87 + 7 yangi). `e2e/smoke.mjs`ga oflayn stsenariysi
qo'shildi (`context.setOffline(true)` → banner, tugma o'chishi, forma
ma'lumoti saqlanishi, tiklanganda banner yo'qolishi) — lekin bu skript
IXTIYORIY (Playwright talab qiladi, standart `pnpm test`ga kirmaydi) va bu
muhitda ishga tushirilmadi (Playwright o'rnatilmagan). Yozilgan, sinalmagan —
birinchi haqiqiy ishga tushirishda tekshiring.

### Integratsiya test infratuzilmasi (T4'dan keyin, 2026-09-22)

Foydalanuvchi bilan kelishilgach (T2 hisobotidagi ochiq savol), DB-bog'liq
integratsiya test qatlami qo'shildi:

- `pnpm test:integration` — `apps/api/vitest.integration.config.ts`,
  `apps/api/.env.test` (`.env.test.example` asosida) kerak.
- Xavfsizlik qulfi: `DATABASE_URL` nomida "test" so'zi bo'lmasa ishga
  tushmaydi (`src/testing/setupIntegration.ts`) — dev/prod baza tasodifan
  tozalanmasin.
- 15 test: T2 (klinika izolyatsiyasi, uch xato holat, o'chirilgan login,
  bloklash izolyatsiyasi) — 5, T3 (idle/absolyut muddat, deaktivatsiya,
  faollik throttle) — 5, T4 (ketma-ket/parallel/conflict/in_progress
  idempotentlik) — 5. Real Postgresda 3 marta ketma-ket ishga tushirildi —
  barqaror (flaky emas), tozalash to'g'ri ishlaydi.
- **Haqiqiy xato topildi va tuzatildi:** `POST /api/auth/login`da
  `deleted_at IS NULL` filtri yo'q edi — batafsil T2 hisobotida.
- Standart `pnpm test` (94/94, DB'siz, tez) O'ZGARMADI — integratsiya
  testlar butunlay alohida.

---

## Claude Code qilmaydi — siz

| Ish | Nega muhim |
|---|---|
| "Pilot" holatini aniqlashtirish (tahlil, 0-bo'lim) | Ekranlar tartibi va T3 muddati shunga bog'liq |
| Bo'lim 13 ochiq savollari — dala ishi | Kafolat komissiyasi, shifokor foizi asosi hali faraz |
| Narx modeli | Biznes qaror |
| Klinikada zaxira 4G modem | Eng arzon oflayn yechim |
| `~/AndroidStudioProjects/dental-web` ni o'chirish | Adashtirmasin |

## Bu faylda ataylab yo'q

- AI yordamchi pog'ona 1–3 (tur, qidiriladigan yordam, LLM) — ekranlar tayyor bo'lgach.
- Pog'ona 0 (bo'sh holat, izoh, xato matni) — alohida vazifa emas, CLAUDE.md UI qoidasi sifatida har ekranga kiradi.
- Rad etilgan davolash rejalari hisoboti — Faza 2.
