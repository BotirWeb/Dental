# Loyiha qo'llanmasi (PRD) — v1

**Loyiha:** Dental — O'zbekistondagi xususiy stomatologiya klinikalari uchun boshqaruv tizimi.
**Kod bilan aloqasi:** bu hujjat — spetsifikatsiya. Kod qoidalari (qanday yozish) uchun `CLAUDE.md`.
Joriy/tugallangan vazifalar — `docs/tasks/`. Talablar jurnali — `docs/talablar.md`.

> **Kelib chiqishi (2026-09-22):** bu fayl ilgari mavjud emas edi — kod va uning ichidagi
> izohlar (`qollanma bo'lim N` deb ishora qilingan joylar), `README.md` va
> `docs/tasks/2026-09-22-tuzatishlar.md` asosida qayta tiklandi. Raqamlar to'qilmagan —
> faqat kodda/tuzatishlar faylida aniq yozilgan joylarda ko'rsatilgan; noaniq joylar
> ochiq qoldirilgan yoki `___` bilan belgilangan (bo'lim 1.3, 13 ga qarang).

---

## 0. Pilot holati

"Pilot klinika" kim, qachon ishga tushishi, real bemor ma'lumoti qachon kiritilishi —
bu loyihaning eng muhim ochiq savoli, chunki bo'lim 7 (fazalar) va T3 (xavfsizlik)
muddatlari shunga bog'liq.

**TO'XTA — bu bo'lim Claude Code tomonidan to'ldirilmaydi.** Klinika nomi, manzili,
xodimlar soni yoki narx kabi haqiqiy ma'lumotlar to'qib yozilmaydi
(`docs/tasks/2026-09-22-tuzatishlar.md`, "Claude Code qilmaydi" jadvali).

---

## 1. Maqsad, qamrov, muddat

### 1.1 Maqsad

Xususiy stomatologiya klinikasi egasiga (**owner**) — kassa, shifokor foizi, marja va
bemor qarzi ustidan **haqiqiy, tekshirilgan** nazorat berish. Loyihaning asosiy
farqlanish nuqtasi: xizmat bo'yicha marja hisobi va kassa smenasi tekshiruvi — buni
"hech kim qilmaydi" (bozordagi oddiy jadval/CRM dasturlari faqat rejalashtiradi,
tekshirmaydi).

### 1.2 Qamrov va muddat

Umumiy loyiha muddati: **18–24 oy** (bo'lim 7 dagi haftalik/oylik jadval — ichki
tartib, yig'indi emas: amalda har kuni to'liq band bo'lmaydi, bo'lim 7 izohiga qarang).

### 1.3 Break-even

**~10 mln so'm/oy — bu TUSHUM, foyda emas.** Sof foydani hisoblash uchun quyidagi
doimiy xarajatlar ayiriladi (summalar hali aniqlanmagan — o'zboshimchalik bilan
to'ldirilmaydi, real narxlar kelib tushgach yoziladi):

| Xarajat | Summa/oy |
|---|---|
| VPS | ___ |
| Domen | ___ |
| Zaxira nusxa joyi | ___ |
| SMS (eslatma, Faza 3) | ___ |
| To'lov tizimi komissiyasi (Payme/Click) | ___ |
| Qo'llab-quvvatlash vaqti (soat × stavka) | ___ |
| **Jami** | **___** |

---

## 2. Rad etilgan qarorlar

> **QULFLANGAN BO'LIM.** Bu yerga faqat ega/jamoa bilan ochiq muhokamadan keyin,
> "rad etildi" deb aniq kelishilgan qarorlar yoziladi. Claude Code bu bo'limni
> qayta ochmaydi, mavjud qatorni o'chirmaydi/o'zgartirmaydi (`CLAUDE.md`). Vazifa
> shu yerdagi qarorga zid kelsa — to'xtaladi va so'raladi.

Hozircha bo'sh — loyihada hali rasman rad etilgan qaror yo'q. (Kechiktirilgan —
"Faza 2/3" — qarorlar bilan adashtirmaslik: kechiktirish rad etish emas, bo'lim 7 ga
qarang.)

| Sana | Masala | Qaror | Sabab | Kim tasdiqladi |
|---|---|---|---|---|
| — | — | — | — | — |

---

## 3. Arxitektura

### 3.1 Stack

- `apps/api` — Hono (Node.js) + Drizzle ORM + PostgreSQL 16, TypeScript ESM, `tsx` orqali ishga tushadi (build qadamisiz — sabab: monorepo'da `packages/shared` xom `.ts` sifatida import qilinadi, `NodeNext` + `.js` kengaytma talabidan qochish uchun).
- `apps/web` — React 19 + React Router 7 (SPA, to'liq sahifa refresh yo'q) + Vite + Tailwind v4 + PWA (`vite-plugin-pwa`).
- `packages/shared` — zod sxema, enum, DTO tiplar — backend va frontend BITTA manbadan oladi.

### 3.2 Auth

**Session cookie + argon2id (JWT kerak emas).** Login so'rovi `{ clinic?, login,
password }` (T2, tahlil C4): `clinic` — `clinics.slug` (login ekranidagi
"Klinika kodi"); bo'sh qoldirilsa `DEFAULT_CLINIC_SLUG` env ishlatiladi, ikkalasi
ham bo'lmasa 400 (`src/domain/auth.ts`, `resolveClinicSlug` — sof funksiya, test
bilan). Klinika + `(clinic_id, login)` bo'yicha foydalanuvchi topiladi, parol
argon2 bilan tekshiriladi. **Noma'lum klinika, noma'lum login va noto'g'ri
parol — UCHALASI HAM bir xil status (401) va bir xil javob tanasi** qaytaradi;
foydalanuvchi topilmagan holatda ham oldindan hisoblangan DUMMY hash bilan
argon2 verify ishga tushadi — vaqt farqidan login mavjudligini bilib olish
mumkin bo'lmasin. Muvaffaqiyatli kirishda: tasodifiy 32-baytli token
`sessions` jadvaliga yoziladi → `httpOnly` cookie sifatida yuboriladi
(`SameSite=Lax`, prodda `secure`). Har himoyalangan route `requireAuth`
middleware orqali o'tadi — u cookie'dagi tokenni sessiyaga aylantiradi va
`clinic_id`ni SHU YERDAN oladi (hech qachon so'rov tanasi/parametridan emas —
boshqa klinika ma'lumotini so'rashning oldini olish uchun).

Login urinishi cheklovi (`rateLimit` middleware): 15 daqiqada 10 urinish, IP va login
bo'yicha alohida hisoblagich. Hozircha jarayon xotirasida (bitta Node instance uchun
yetarli; bir nechta nusxa kerak bo'lsa, DB/Redis'ga ko'chiriladi).

### 3.3 Bir origin, CORS yo'q

Backend butunlay `/api` prefiksi ostida ishlaydi:
- dev: Vite dev-server `/api` so'rovlarini `localhost:3000`ga proksi qiladi.
- prod: Caddy statik frontendni beradi va `/api/*` ni backendga yo'naltiradi.

Natijada brauzer nuqtai nazaridan hammasi bitta origin — CORS umuman kerak emas,
cookie har doim "same-origin" sifatida ko'rinadi.

### 3.4 Deploy (SINALMAGAN — Docker daemon bu muhitda yo'q edi qurilganda)

Docker Compose: `db` (postgres:16-alpine) + `api` (Dockerfile, butun monorepo
nusxalanadi, `pnpm install --frozen-lockfile`) + Caddy (`apps/web/Caddyfile`,
hozircha domensiz `:80`, real domen bo'lganda avtomatik TLS uchun izohga qarab
almashtiriladi). VPS'ga birinchi marta chiqishdan oldin albatta qo'lda tekshiriladi.

### 3.5 Pul va vaqt (qisqacha — to'liq qoida CLAUDE.md'da)

Pul — `numeric(14,0)`, so'mda, butun son. Drizzle'da bu ustunlar JS tomonida STRING
sifatida keladi (float xatosidan qochish uchun) — `src/db/columns.ts`dagi
`toMoneyInput`/`fromMoney` orqali DB chegarasida `number`ga aylantiriladi; domain
qatlami (`src/domain`) har doim oddiy `number` bilan ishlaydi. Vaqt — `timestamptz`,
DB'da har doim UTC, frontendda ko'rsatishda BITTA joyda (`apps/web/src/lib/time.ts`)
`Asia/Tashkent`ga o'giriladi.

---

## 4. Adapter qoidasi

Har bir tashqi xizmat (telefoniya, SMS, to'lov, bot) **interfeys ortida** yoziladi —
`apps/api/src/adapters/`. Provayder almashsa, bitta implementatsiya fayli o'zgaradi,
uni chaqiruvchi kod emas.

Hozircha faqat `telephony.ts` — interfeys, real implementatsiya yo'q (Faza 3 ishi,
bo'lim 12 dala ishidan keyin: klinikaning telefoniya provayderi va uning API
imkoniyati aniqlanadi, shundan keyin bitta concrete fayl, masalan
`mango-office.ts`, shu interfeys ortida yoziladi).

---

## 5. Ma'lumotlar modeli

### 5.1 Besh tamoyil

1. **Reja va fakt alohida jadval.** `appointments` (reja/kelajak) va `visits`
   (fakt/o'tmish) ajratilgan. `visits.appointment_id` NULLABLE — oldindan yozuvsiz
   kelgan (walk-in) bemor ham vizit bo'la oladi.
2. **Narx snapshot majburiy.** `performed_services` `services`ga LIVE havola
   qilmaydi — narx, shifokor foizi, material narxi vizit vaqtidagi qiymat sifatida
   nusxalanadi. Sabab: `services.price` keyin o'zgarsa, o'tgan hisobot buzilmasin.
3. **To'lov vizitga 1:1 emas.** `payments.visit_id` NULLABLE — avans, bo'lib-bo'lib
   to'lov mumkin. Bemor balansi barcha vizit/to'lovlar yig'indisidan hisoblanadi
   (5.4).
4. **Hech narsa o'chirilmaydi.** Har jadvalda `deleted_at` (yumshoq o'chirish) +
   `audit_log` (kim/qachon/nima o'zgargani). Moliyaviy va tibbiy yozuvlar uchun bu
   ayniqsa qattiq: noto'g'ri to'lov ham o'chirilmaydi, **tuzatuvchi yozuv** yoziladi
   (5.5).
5. **`clinic_id` har jadvalda.** Istisno: `sessions` va `audit_log` — булар tizim
   jadvali, `user_id` orqali chiqariladi (audit_log'da `clinic_id` bor, lekin
   scoping asosiy jadvallardagidek emas).

### 5.2 Jadvallar

Quyidagi ro'yxat `apps/api/src/db/schema.ts`dagi joriy Drizzle sxemaga mos —
sxema o'zgarsa, shu ro'yxat ham SHU commit'da yangilanadi (CLAUDE.md "Sxema =
hujjat").

**`clinics`** — `id`, `name`, **`slug`** (login ekranidagi "Klinika kodi" — T2,
tahlil C4; UNIQUE, format `^[a-z0-9-]{3,32}$`, CHECK bilan majburlangan),
`timezone` (default `Asia/Tashkent`), `doctor_pct_basis` (enum
`gross`|`after_material`, default `gross` — ochiq savol, 5.4 va bo'lim 13 ga
qarang), `created_at`.

**`users`** — auth. `clinic_id`, `login` (klinika ICHIDA noyob — UNIQUE
`(clinic_id, login) WHERE deleted_at IS NULL`, global emas: bitta shifokor
ikki klinikada ishlashi mumkin, har klinikada o'z `admin`i bo'ladi; saqlashda
har doim trim+lowercase, T2/tahlil C4), `password_hash` (argon2), `full_name`,
`role` (enum `owner` `admin` `doctor` `cashier`), `is_active`, `created_at`,
`deleted_at`.

**`sessions`** — tizim jadvali. `id` (token, primary key), `user_id`,
`expires_at` (absolyut chegara, yaratilishda belgilanadi — `SESSION_MAX_DAYS`
env, default 7 kun), `last_activity_at` (idle chegara shundan hisoblanadi —
`SESSION_IDLE_HOURS` env, default 12 soat; ≥5 daqiqada bir yangilanadi, T3),
`created_at`.

**`doctors`** — `clinic_id`, `user_id` (nullable), `full_name`, `specialty`,
`default_pct` (asosiy foiz, `performed_services` yozilganda snapshot sifatida
nusxalanadi), `is_active`.

**`chairs`** — `clinic_id`, `name`, `is_active`.

**`patients`** — `clinic_id`, `full_name`, `phone` (foydalanuvchi kiritgan asl
matn), **`phone_normalized`** (kanonik 9 raqam, qidiruv/dublikat shu ustun
bo'yicha — 5.6), `birth_date`, `gender`, `source`, `telegram_chat_id` (Faza 3),
`consent_messaging`, `consent_data` (bo'lim 8), `notes`, `created_at`,
`deleted_at`. Indeks: `(clinic_id, phone_normalized text_pattern_ops)` — prefiks
qidiruv uchun `text_pattern_ops` MAJBURIY, aks holda Postgres 16 planner LIKE
prefiks shartida indeksdan foydalanmaydi (lokal EXPLAIN bilan tasdiqlangan).

**`appointments`** (REJA) — `clinic_id`, `patient_id`, `doctor_id`, `chair_id`,
`start_at`, `end_at`, `status` (enum: `planned` `confirmed` `arrived` `done`
`no_show` `cancelled_patient` `cancelled_clinic`), `note`, `created_by`,
`created_at`, `deleted_at`.

**`visits`** (FAKT) — `clinic_id`, `appointment_id` (nullable), `patient_id`,
`doctor_id`, `chair_id` (nullable), `started_at`, `finished_at` (nullable),
`note`, `created_at`, `deleted_at`.

**`service_categories`** — `clinic_id`, `name`, `default_doctor_pct`.

**`services`** — `clinic_id`, `category_id`, `code`, `name`, `price` (money),
`duration_min`, `material_cost` (money), `is_active`.

**`performed_services`** — `clinic_id`, `visit_id`, `service_id`, `doctor_id`,
`tooth` (FDI tish raqami: birinchi raqam — chorak, 1–4 doimiy tish, 5–8 sut tish;
ikkinchi raqam — o'rta chiziqdan sanoq 1–8; butun tishga bog'liq bo'lmagan xizmat
uchun NULL), `surfaces` (masalan `MOD`, nullable), `qty` (default 1),
`price_snapshot` (money), `discount_type` (enum `amount`|`percent`, default
`amount`), `discount_value` (foydalanuvchi kiritgan qiymat, o'sha birlikda),
`discount_amount` (HISOBLANGAN so'm, snapshot — hisobotlar shuni oladi),
`doctor_pct_snapshot` (percent), `material_cost_snapshot` (money), `lab_cost`
(money), `is_warranty` (bool — kafolat: tushum yo'q, xarajat bor), `created_at`,
`deleted_at`.

**`cash_sessions`** (KASSA SMENASI) — `clinic_id`, `opened_by`, `opened_at`,
`opening_float` (smena boshidagi mayda pul), `closed_by`, `closed_at`,
`expected_cash` (tizim hisoblagan: opening_float + smenadagi naqd to'lovlar),
`counted_cash` (admin qo'lda sanagan), `diff` (counted − expected, manfiy =
yetishmayapti), `note`, `created_at`, `deleted_at`.

**`payments`** — `clinic_id`, `patient_id`, `amount` (money), `method` (enum
`cash` `card` `payme` `click` `transfer`), `paid_at`, `visit_id` (nullable —
avans), `cash_session_id` (nullable — naqd bo'lmasa NULL), `created_by`, `note`,
**`reversal_of_id`** (bu qator qaysi to'lovni tuzatyapti — manfiy summali yangi
qator uchun), **`voided_at`/`voided_by`/`void_reason`** (asl yozuvda: qachon/kim
bekor qildi — FAQAT UI belgisi), `created_at`, `deleted_at`.

**`expenses`** — `clinic_id`, `category`, `amount` (money), `spent_at`,
`is_recurring`, `note`, `receipt_url`, `created_by`, `created_at`, `deleted_at`.

**`audit_log`** — `clinic_id`, `user_id` (nullable — tizim amali), `entity`,
`entity_id`, `action` (enum `create`|`update`|`delete`), `old_value` (jsonb),
`new_value` (jsonb), `created_at`.

**`idempotency_keys`** — tizim jadvali (T4, tahlil M1). Composite PRIMARY KEY
`(clinic_id, key)`, `request_hash`, `status_code`/`response_body` (ikkalasi
ham NULLABLE — "band qilish" holati: handler hali tugallanmagan), `created_at`
(48 soatdan eski yozuvlar tozalanadi). To'liq izoh —
`src/domain/idempotency.ts`, `src/api/middleware/idempotency.ts`.

**Hali DB'da yo'q:** login rate-limit hozircha jarayon xotirasida, DB jadvali
emas (3.2 ga qarang).

### 5.3 Chegirma hisobi

`discount_type` + `discount_value` → `discount_amount` (`src/domain/discount.ts`,
`computeDiscountAmount`). Chegirma har doim **SATR jamisiga** (`price_snapshot *
qty`) qo'llanadi, donaga emas. Yaroqsiz chegirma (manfiy, 100%dan katta foiz, satr
jamisidan katta so'm) JIMGINA tuzatilmaydi — xato tashlanadi, API 400 qaytaradi.

### 5.4 Shifokor foizi va marja

`src/domain/doctorEarnings.ts`. Tushum (`calculateRevenue`): kafolat bo'lsa 0,
aks holda `price_snapshot * qty − discount_amount`. Shifokor summasi
(`calculateDoctorEarning`): `basis = clinics.doctor_pct_basis` bo'yicha —
`"gross"` bo'lsa tushumning o'zidan, `"after_material"` bo'lsa
(tushum − `material_cost_snapshot`)dan `doctor_pct_snapshot` foiz olinadi.
Kafolatda komissiya 0 — **FARAZ**, dala ishida tasdiqlanishi kerak (bo'lim 13).
Klinika marjasi (`calculateServiceMargin`): `tushum − shifokor_summasi −
material_narxi − laboratoriya_narxi`. Material/lab xarajati kafolatda ham
hisoblanadi ("tushum yo'q, xarajat bor").

### 5.5 To'lovni tuzatish (kanonik qoida)

To'lov yozuvi **tahrirlanmaydi**. Xato kiritilsa (masalan 500 000 o'rniga
5 000 000) — ikki amal birga bajariladi (`src/domain/payments.ts`,
`buildReversal`):

1. **Tuzatuvchi yozuv** — asl summaga teskari (manfiy) summali YANGI qator,
   `reversal_of_id` asl yozuvga ishora qiladi. Asl yozuv o'zgarmaydi — revizor
   ikkalasini ham ko'radi.
2. **Bekor belgisi** — asl yozuvda `voided_at`/`voided_by`/`void_reason`
   qo'yiladi, interfeys uni chizib ko'rsatadi.

> **⚠️ KANONIK QOIDA (buzilmasin, `payments.test.ts` qulflaydi):** moliyaviy
> hisobot filtri — `deleted_at IS NULL` bo'lgan BARCHA qatorlarni qo'shish.
> Tuzatuvchi yozuv manfiy bo'lgani uchun o'zi nolga chiqaradi. **`voided_at` ni
> hisobot filtrida ishlatmang** — aks holda summa ikki marta ayriladi.
> Misol: asl 500 000 + tuzatuvchi −500 000 = 0 (to'g'ri). Agar `voided_at IS
> NULL` ham filtrga qo'shilsa: asl qator chiqarib tashlanadi, faqat −500 000
> qoladi → hisobotda −500 000 (XATO, ikki marta ayirilgan).

Allaqachon bekor qilingan, o'chirilgan yoki o'zi tuzatuvchi bo'lgan yozuvni qayta
tuzatib bo'lmaydi; sabab kamida 3 belgi bo'lishi shart.

### 5.6 Bemor balansi (kanonik formula)

`src/domain/patientBalance.ts`:

```
hisoblandi = Σ (price_snapshot * qty − discount_amount)  [kafolat bo'lsa 0]
to'landi   = Σ to'lovlar (tuzatuvchi manfiy qatorlar bilan birga, voidedAt e'tiborsiz)
balans     = hisoblandi − to'landi

balans > 0  → BEMOR QARZDOR
balans < 0  → AVANS (klinika qarzdor)
balans = 0  → hisob yopiq
```

### 5.7 Kassa smenasi

`src/domain/cashSession.ts`. Smena ochiladi → naqd to'lovlar unga bog'lanadi
(`payments.cash_session_id`) → yopilganda: `expected_cash = opening_float + shu
smenadagi naqd to'lovlar yig'indisi` (o'chirilgan/tuzatuvchi qatorlar hisobga
olingan holda), admin `counted_cash` kiritadi, `diff = counted − expected`. Farq
nolga teng bo'lishi SHART emas — muhimi, u ko'rinsin va izohlansin (bu — eganing
eng muhim raqami, avval umuman tekshirilmagan edi).

### 5.8 Telefon normalizatsiyasi

`packages/shared/src/phone.ts`. `patients.phone_normalized` — har doim 9 raqamli
kanonik shakl (`normalizePhone`): `+998901234567` / `998901234567` / `8 90 123 45
67` (eski prefiks) / `90 123 45 67` → hammasi `901234567`ga tushadi. Foydalanuvchi
kiritgan asl matn `phone`da saqlanadi. **UNIQUE EMAS — ataylab**: O'zbekistonda
oila a'zolari (ona-bola) bitta raqamdan foydalanadi. Dublikat qattiq
taqiqlanmaydi — yozuv qo'shishda `duplicates` ro'yxati qaytariladi, interfeys
ogohlantiradi, admin o'zi qaror qiladi.

---

## 6. Ekranlar va rollar

### 6.1 Rollar

| Rol | Ta'rifi |
|---|---|
| `owner` | Klinika egasi. Hammasini ko'radi — barcha ekran, barcha shifokor/kassa raqami. |
| `admin` | Registratura/administrator. Bemor, jadval, kassa, vizit yakuni. |
| `doctor` | Shifokor. O'z jadvali, o'z vizitlari; boshqa shifokorning moliyaviy raqamini ko'rmaydi (query darajasida cheklanadi, `requireRole` emas — `apps/api/src/api/middleware/roles.ts`). |
| `cashier` | Kassir. Kassa smenasi, to'lov qabul qilish. |

### 6.2 MVP qamrovi — ekranlar

`apps/web/src/routes/screens.ts` shu jadvalning kod ko'rinishi — navigatsiya va
route'lar SHU BITTA ro'yxatdan generatsiya bo'ladi.

| № | Ekran | Yo'l | Kim | Holat |
|---|---|---|---|---|
| 1 | Kirish (login) | `/login` | hammasi (rol-erkin) | ✅ tayyor |
| 2 | Jadval | `/schedule` | owner, admin, doctor | ✅ tayyor (2026-09-22) — kun ko'rinishi, kreslo × vaqt grid. Hafta ko'rinishi yo'q |
| 3 | Bemorlar (qidirish) | `/patients` | owner, admin, doctor | ✅ tayyor (namuna slice — qidirish + yaratish) |
| 4 | Bemor kartasi | `/patients/:id` | owner, admin, doctor | 🟡 asosiy ma'lumot + yozuvlar tarixi (2026-09-22). To'lov/qarz — ekran 6 bilan birga |
| 5 | Yozuv modal | (2-ekran ichida) | owner, admin | ✅ tayyor (2026-09-22) — mavjud bemor qidiriladi, yangi bemor bu yerda yaratilmaydi |
| 6 | Kassa / vizit yakuni | `/cashier` | owner, admin, cashier | ✅ tayyor (2026-09-22) — smena, vizit, xizmat, to'lov, bekor qilish |
| 7 | Xarajatlar | `/expenses` | owner, admin | ✅ tayyor (2026-09-22) — ro'yxat + qo'shish |
| 8 | Kunlik hisobot | `/reports/daily` | owner | ✅ tayyor (2026-09-22) |
| 9 | Oylik marja | `/reports/margin` | owner | ✅ tayyor (2026-09-22) — asosiy farqlanish nuqtasi (1.1) |
| 10 | Shifokor hisobi | `/reports/doctors` | owner | ✅ tayyor (2026-09-22) |
| 11 | Xizmat va narxlar | `/services` | owner | ✅ tayyor (2026-09-22) — xizmat/kategoriya CRUD, narx tahrirlash, faolsizlantirish |
| 12 | Foydalanuvchilar | `/users` | owner | ✅ tayyor (2026-09-22) — yaratish, rol/holat, parol tiklash |

**Barcha 12 ekran ✅ tayyor (2026-09-22).** `docs/tasks/2026-09-22-tuzatishlar.md`
yaratilgan kunda bu holat "12 ekrandan 2 tasi" edi — Faza 1 shundan buyon
to'liq bajarildi. Qolgan: Faza 2 (`treatment_plans`/`tooth_records`) va
Faza 3 (bot/eslatma/telefoniya) — bo'lim 7.

---

## 7. Fazalar va muddat

Umumiy muddat 18–24 oy (1.2). Quyidagi hafta raqamlari — Faza 1 ICHKI tartibi,
mutlaq taqvim emas.

| Faza | Ishlar | Hafta | Izoh |
|---|---|---|---|
| Faza 1 | Skelet: monorepo, DB sxema, auth, rollar, audit | 1–2 | ✅ bajarilgan (`b15b482`) |
| Faza 1 | Jadval (ekran 2) + Bemor kartasi (ekran 4) to'liq | 3–4 | `patients.ts` naqshini takrorlab |
| Faza 1 | Kassa / vizit yakuni (ekran 6) | 5–6 | ENG MUHIM ekran |
| Faza 1 | Xarajatlar (7) + Xizmat va narxlar (11) | 7–8 | |
| Faza 1 | Hisobotlar: Kunlik, Oylik marja, Shifokor (8, 9, 10) | 9–11 | |
| Faza 1 | Foydalanuvchilar (12) + T2/T3/T4 tuzatishlar | — | `docs/tasks/2026-09-22-tuzatishlar.md` |
| Faza 2 | `treatment_plans`, `tooth_records` — davolash rejasi/tish kartasi | — | hali loyihalanmagan |
| Faza 3 | Bot, eslatma (SMS/Telegram), telefoniya adapter concrete implementatsiya, `calls`/`messages` jadvali, cron (`src/jobs/`) | — | `adapters/telephony.ts` interfeysi tayyor, implementatsiya yo'q |
| Faza 4 | Ko'p klinika — subdomen orqali klinika aniqlash, owner uchun 2FA (TOTP) | — | T2/T3 hozircha klinika kodi + login bilan yechadi (bo'lim 13) |

**Izoh ("kuniga necha soat" haqida):** amalda reja kuniga to'liq band bo'lmagan
holda **40–60% bajariladi** — rejalashtirishda shu koeffitsientni hisobga oling.

---

## 8. Huquqiy va maxfiylik talablari

- Bemordan yozma rozilik olinadi va saqlanadi: `patients.consent_data` (ma'lumot
  ishlov berish), `patients.consent_messaging` (xabar yuborish).
- Loglarga F.I.Sh, telefon, JShShIR yozilmaydi — faqat ID (query string va so'rov
  tanasi ham). ✅ T3 (2026-09-22): alohida so'rov logeri yo'q, yagona log —
  xato obyekti (`app.onError`), so'rov tanasi/query hech qachon qo'shilmaydi.
  To'liq izoh — bo'lim 9.1, band 6.
- Tashqi LLM/AI API'ga bemor ma'lumoti yuborilmaydi (O'RQ-1115 — O'zbekiston
  shaxsiy ma'lumotlarni himoya qilish qonuni).
- Bemorga ketadigan xabarda tashxis va davolash ma'lumoti bo'lmaydi.
- Service worker `/api/*` javoblarini keshlamaydi — bemor ma'lumoti umumiy
  kompyuterda qolmasin (PWA sozlamasi T4 da tekshiriladi).
- `audit_log` ni faqat owner ko'radi (T3 bilan majburlanadi).

---

## 9. Kod qoidalari

To'liq va joriy ro'yxat — `CLAUDE.md` (repo ildizida). Bu yerda takrorlanmaydi,
CLAUDE.md yagona manba. Muhim eslatma: bo'lim 2 (Rad etilgan qarorlar) va bu
bo'lim CLAUDE.md qoidasi bo'yicha ikkalasi ham "qulflangan" — o'zgartirish
alohida muhokamani talab qiladi.

---

## 9.1 Xavfsizlik

T3 (2026-09-22, `docs/tasks/2026-09-22-tuzatishlar.md`) bilan kiritilgan.

1. **Sessiya muddati.** Ikki mustaqil chegara birga: **idle** (harakatsizlik,
   `SESSION_IDLE_HOURS`, default 12 soat — bitta smena sig'adi) va
   **absolyut** (`SESSION_MAX_DAYS`, default 7 kun — o'g'irlangan cookie
   abadiy ishlamasin). Qaysi biri oldin yetsa. Faollik vaqti (`sessions.
   last_activity_at`) DB'da har so'rovda emas, ≥5 daqiqada bir yangilanadi
   (yozuv yukini kamaytirish). Sof funksiyalar: `src/domain/sessionExpiry.ts`.
2. **Deaktivatsiya/soft-delete → darhol 401.** `getUserBySessionToken`
   (`src/api/auth/session.ts`) har so'rovda `users.is_active`/`deleted_at`ni
   tekshiradi — deaktivatsiya qilingan foydalanuvchining eski cookie'si
   keyingi so'rovda ishlamay qoladi. `deleteAllSessionsForUser` funksiyasi
   ham tayyor (deaktivatsiya/parol o'zgarish endpoint'i yozilganda chaqiriladi
   — bu endpoint hali qurilmagan, ekran 12).
3. **Parol siyosati** — `src/domain/password.ts` (`validatePassword`):
   kamida 10 belgi, login yoki klinika kodi bilan bir xil emas, kichik taqiq
   ro'yxati (`12345678`, `qwerty123`, `password` va h.k.). Katta harf/maxsus
   belgi talab qilinmaydi. **Hali hech qayerda chaqirilmaydi** — foydalanuvchi
   yaratish/parol o'zgartirish endpoint'i yo'q (ekran 12, todo); funksiya shu
   endpoint uchun oldindan tayyorlangan.
4. **CSRF/Origin tekshiruvi** — `src/api/middleware/csrf.ts` (`hono/csrf`
   emas — sabab shu faylning boshida izohlangan: `hono/csrf` faqat form-
   content-type so'rovlarni tekshiradi, bizning API butunlay JSON). Holat
   o'zgartiruvchi (GET/HEAD/OPTIONS'dan boshqa) har bir so'rovda
   `Sec-Fetch-Site: same-origin` YOKI `Origin` ruxsat etilgan ro'yxatda
   (`ALLOWED_ORIGINS` env, bo'sh bo'lsa faqat so'ralgan origin) bo'lishi
   shart — aks holda 403.
5. **Xavfsizlik headerlari** — `hono/secure-headers` orqali kodda (Caddy'da
   EMAS — ikkalasida qo'shilib ketmasin): `X-Content-Type-Options: nosniff`,
   `X-Frame-Options: DENY`, `Content-Security-Policy: default-src 'none';
   frame-ancestors 'none'`, `Referrer-Policy: no-referrer`.
6. **Log xavfsizligi** — hozircha alohida so'rov logeri (masalan
   `hono/logger`) ATAYLAB ulanmagan; yagona log — `app.onError`dagi xato
   obyekti, so'rov query string/tanasi hech qachon qo'shilmaydi
   (`src/api/app.ts`). Kelajakda so'rov logeri qo'shilsa, shu bandni qayta
   ko'rib chiqish shart.

**Kelajakda (bu vazifada emas):**
- Owner uchun 2FA (TOTP) — Faza 4.
- Zaxira: `pg_dump` → shifrlash (`age`) → alohida joy. Shifr kaliti serverda
  saqlanmaydi.
- VPS: faqat SSH kalit, root login yo'q, ochiq portlar faqat 22/80/443,
  Postgres tashqariga ochilmaydi, avtomatik xavfsizlik yangilanishlari.
- `audit_log`ni faqat owner ko'radi — hozircha alohida route/UI yo'q
  (audit_log ko'rish ekrani rejalashtirilmagan, faqat DB yozuvi ishlaydi).
- VPS'ga kirish huquqi kimda — ro'yxat (hozircha bitta odam, bo'lim 0/12).

---

## 9.2 Tarmoq uzilishiga chidamlilik

T4 (2026-09-22, tahlil M1 birinchi qism) bilan kiritilgan. **To'liq oflayn
rejim BU YERDA YO'Q** — faqat sekin/uzilib-ulanadigan internetda ikki marta
yozishning oldini olish.

1. **Idempotentlik middleware** — `src/api/middleware/idempotency.ts`,
   qaror mantig'i `src/domain/idempotency.ts` (sof funksiya, test bilan).
   `Idempotency-Key` header (UUID) majburiy. Uch holat: takroriy kalit + bir
   xil tana → saqlangan javob qaytadi (yangi yozuv yo'q); bir xil kalit +
   boshqa tana → 422; hali tugallanmagan (parallel) kalit → 409 ("biroz
   kuting"). Jadval — `idempotency_keys` (bo'lim 5.2), 48 soatdan eski
   yozuvlar tozalanadi.

   **Qamrov:** hozircha faqat `POST /patients` (bemor yaratish). To'lov/void/
   kassa smenasi endpoint'lari hali qurilmagan (ekran 6, todo) — ular
   yozilganda shu middleware ular ustiga ham qo'shiladi (CLAUDE.md qoida 12).

   **Real Postgres+serverga qarshi tekshirildi:** ketma-ket bir xil kalit →
   1 yozuv, bir vaqtda ikkita so'rov → 1 yozuv, boshqa tana → 422, band
   (in_progress) holat qo'lda simulyatsiya qilinib → 409 tasdiqlandi.

2. **Tarmoq holati indikatori** — `apps/web/src/state/NetworkContext.tsx`
   (`navigator.onLine` hodisalari + `/api/health` har 30s, faqat tab
   ko'rinib turganda + `lib/networkSignal.ts` orqali istalgan so'rovdagi
   tarmoq xatosi). Uch holat: `online` (banner yo'q), `offline` ("Internet
   yo'q..."), `server-down` ("Server javob bermayapti"). Banner —
   `components/NetworkBanner.tsx`, `App.tsx`da butun ilova ustida. Saqlash
   tugmalari `useNetworkStatus()` orqali `online`dan boshqa holatda
   o'chiriladi (hozircha `PatientsPage.tsx`dagi yagona saqlash tugmasida —
   kelajakdagi ekranlar shu naqshni takrorlaydi).

3. **Service worker** — tekshirildi (`pnpm build` + `dist/sw.js`): faqat
   ilova qobig'i (HTML/JS/CSS/manifest/ikonlar) `precacheAndRoute` orqali
   keshlanadi, `/api/*` uchun hech qanday `registerRoute`/runtime-caching
   YO'Q — talab allaqachon bajarilgan edi (`vite-plugin-pwa` default
   `generateSW` strategiyasi), o'zgartirish kerak bo'lmadi.

**Web forma naqshi** (`PatientsPage.tsx`ni takrorlang): kalit forma
ochilganda (`crypto.randomUUID()`) yaratiladi, qayta urinishda O'SHA kalit
yuboriladi (`api.postIdempotent`), muvaffaqiyatdan keyin yangisi.

**Keyin (bu vazifada emas):** 6-ekran (Kassa) uchun IndexedDB outbox — to'lovni
navbatga olib, shu idempotentlik kaliti bilan qayta yuborish.

### Integratsiya testlar (T2–T4 dan keyin, 2026-09-22)

T2, T3, T4 davomida DB-bog'liq xatti-harakatlar (klinika izolyatsiyasi,
sessiya muddati, idempotentlik) har safar qo'lda (curl + vaqtinchalik
Postgres) tekshirilgan edi. Keyinchalik shu tekshiruvlar doimiy, avtomatik
testga aylantirildi:

- `apps/api/vitest.integration.config.ts` + `pnpm test:integration` — oddiy
  `pnpm test`dan ATAYLAB alohida, chunki haqiqiy Postgres talab qiladi
  (`apps/api/.env.test`, DATABASE_URL nomida "test" so'zi bo'lishi shart —
  xavfsizlik qulfi, tasodifan dev/prod bazani tozalab qo'ymaslik uchun).
- Testlar `app.request()` (Hono'ning o'z test API'si) orqali — haqiqiy HTTP
  server ochilmaydi, lekin butun middleware/route zanjiri ishlaydi.
- Fayllar: `src/api/routes/auth.integration.test.ts` (T2, 5 test),
  `src/api/auth/session.integration.test.ts` (T3, 5 test),
  `src/api/routes/patients.integration.test.ts` (T4, 5 test). Yordamchilar —
  `src/testing/helpers.ts`, `src/testing/setupIntegration.ts`.

**Topilgan va tuzatilgan haqiqiy xato:** `POST /api/auth/login` foydalanuvchini
`(clinic_id, login)` bo'yicha qidirganda `deleted_at IS NULL` filtrini
qo'llamas edi. Bitta login'ga ikkita qator (eski o'chirilgan + yangi faol)
mos kelganda, SELECT ba'zan eski (o'chirilgan) qatorni qaytarib, YANGI faol
foydalanuvchi ham login qila olmay qolishi mumkin edi — T2'ning aynan shu
holat uchun qabul mezoni bor edi ("o'chirilgan foydalanuvchining logini
yangi foydalanuvchiga berish"), lekin qo'lda sinovda tasodifan bu holat
uchramagan edi. Integratsiya test yozilgach darhol aniqlandi. Tuzatildi:
`src/api/routes/auth.ts` login SELECT'iga `isNull(users.deletedAt)` qo'shildi.

---

## 10. AI yordamchi (kelajak, Faza 3+)

Pog'ona 1–3 (tur, qidiriladigan yordam, LLM) — ekranlar tayyor bo'lgach
loyihalanadi. Pog'ona 0 (bo'sh holat, izoh, xato matni) alohida vazifa emas —
CLAUDE.md "UI qoidalari" sifatida har ekranga yozish paytida kiritiladi.
Maxfiylik cheklovi — bo'lim 8 (tashqi LLM'ga bemor ma'lumoti yuborilmaydi).

---

## 11. Cheklovlar va ochiq xavflar

| Xavf | Daraja | Yechim |
|---|---|---|
| Internet uzilishi → admin qog'oz daftarga qaytadi | Yuqori | ✅ T4 (2026-09-22): idempotentlik + tarmoq holati indikatori — 9.2-bo'lim. + klinikada zaxira 4G modem (klinika tomoni, kodga aloqasi yo'q) |
| Bitta klinikaga (pilot) moslashib qolish — klinikaga xos talab hardcode bo'lib qolishi | Yuqori | `docs/talablar.md` + har klinikaga xos narsa faqat `clinics` sozlamasi/feature flag orqali (namuna: `doctor_pct_basis`) |
| To'liq oflayn rejim yo'q | O'rta | T4 birinchi qism (idempotentlik, ✅ 2026-09-22) hozir; to'liq outbox (IndexedDB navbat) — 6-ekran real ishlagandan keyin loyihalanadi |
| Docker/Compose sinalmagan | O'rta | VPS'ga birinchi chiqishda qo'lda tekshiriladi (bo'lim 3.4) |
| Shifokor foizi asosi va kafolat komissiyasi — hali faraz | O'rta | Bo'lim 13, dala ishida tasdiqlanadi |

---

## 12. "Birinchi hafta" — dala ishi

Kod bilan hal qilib bo'lmaydigan, klinikaga borib aniqlanadigan ishlar:

- Klinikaning telefoniya provayderi va uning API imkoniyati (bo'lim 4, Faza 3
  adapter implementatsiyasi shunga bog'liq).
- Qo'ng'iroq jurnali — real namuna.
- Xarajat shabloni — klinika qanday kategoriyalarda xarajat yozadi.
- Real domen (bo'lim 3.4, Caddy TLS shunga bog'liq).
- "Pilot" holatini aniqlashtirish (bo'lim 0).

---

## 13. Ochiq savollar

| # | Savol | Holat | Izoh |
|---|---|---|---|
| 1 | Shifokor foizi tushumdanmi (`gross`) yoki material ayirilgandan keyinmi (`after_material`)? | Ochiq, sozlanadigan | `clinics.doctor_pct_basis`, default `gross`. Kodga hardcode qilinmagan (bo'lim 5.4). |
| 2 | Kafolat vizitida shifokor komissiyasi 0mi? | FARAZ | `isWarranty` bo'lsa komissiya 0 — dala ishida tasdiqlanadi. |
| 3 | Chegirma so'mda yoki foizda? | ✅ Hal qilindi | Ikkalasi ham qo'llab-quvvatlanadi — `discount_type` (bo'lim 5.3). |
| 4 | Login qanday tuzilishi kerak (bir nechta klinika, bir xodim ikki klinikada)? | ✅ Amalga oshirildi (T2, 2026-09-22) | Klinika kodi + login; login klinika ichida unique (`clinics.slug`, `users.login` — 5.2 "clinics"/"users"). Sabab: bitta shifokor ikki klinikada ishlashi mumkin, har klinikada `admin` bo'lishi kerak, xodimlarning ko'pida email yo'q. |
| 5 | Sessiya muddati? | ✅ Amalga oshirildi (T3, 2026-09-22) | Idle 12 soat (`SESSION_IDLE_HOURS`), absolyut 7 kun (`SESSION_MAX_DAYS`), env orqali — 9.1-bo'lim. |

---

## 14. (band qilinmagan)

Kelajakda kerak bo'lsa ishlatiladi — hozircha bo'sh, raqamlashda uzilish
bo'lmasin (bo'lim 15 formatiga mos).

---

## 15. O'zgarishlar tarixi

| Sana | Nima qilindi |
|---|---|
| 2026-08-14 (taxminiy, `b15b482`) | Faza 1 skeleton: monorepo, DB sxema, auth, rollar, audit, bemorlar slice. |
| 2026-09-22, `8deff00` | Moliyaviy yaxlitlik va qidiruv tuzatishlari: A2 (deleted_at moliyaviy/tibbiy yozuvlarda), A3 (to'lov tuzatish — reversal+void), B1 (kassa smenasi), B2 (chegirma turi aniqlashtirildi), B3 (bemor balansi kanonik formula), C1–C3 (telefon normalizatsiyasi, indeks, dublikat ogohlantirish), D1 (login rate limit). |
| 2026-09-22 | Tahlil o'tkazildi, `docs/tasks/2026-09-22-tuzatishlar.md` (T0–T4) ochildi; T0 bajarildi (holat tekshiruvi — 66/66 test, migratsiya toza bazada ishladi, route/frontend chaqiruvlari mos). Ushbu hujjat (`docs/prd-v1.md`), `docs/tahlil/2026-09-22-tahlil-va-ai-yordamchi.md` va `docs/talablar.md` noldan, kod va uning izohlari asosida tiklandi (avval mavjud emas edi). |
| 2026-09-22 | T2 bajarildi: `clinics.slug` + `users.login` klinika ichida unique (migratsiya `0002_t2_clinic_slug_login_unique`, mavjud qatorlarga `clinicN` backfill, kolliziya bo'lsa migratsiya tranzaksiya ichida xato bilan to'xtaydi — real Postgres'da tekshirilgan). `/api/auth/login` — klinika kodi, uch xato holatda bir xil javob, dummy-hash timing-safety. Login ekraniga "Klinika kodi" maydoni (localStorage'da eslab qolinadi). 72/72 test (66 + 6 yangi `resolveClinicSlug`). DB-bog'liq integratsiya-test infratuzilmasi qo'shish qarori T4'ga qoldirildi (foydalanuvchi bilan kelishilgan). |
| 2026-09-22 | T3 bajarildi (bo'lim 9.1 "Xavfsizlik" yangi): sessiya idle(12s)/absolyut(7k) muddati (`sessions.last_activity_at`, ≥5 daqiqada bir yangilanadi), Origin/CSRF tekshiruvi (`hono/csrf` emas — JSON API uchun mos emas, qo'lda yozilgan `middleware/csrf.ts`), `hono/secure-headers` (CSP, nosniff, frame-ancestors none), parol siyosati (`domain/password.ts`, hali hech qayerga ulanmagan — endpoint yo'q). Hammasi real Postgres+server'ga qarshi qo'lda tekshirildi (idle/absolyut expiry, 403/200 origin holatlari, headerlar). 87/87 test (72 + 15 yangi). |
| 2026-09-22 | T4 bajarildi (bo'lim 9.2 "Tarmoq uzilishiga chidamlilik" yangi): idempotentlik middleware (`idempotency_keys` jadvali, claim/replay/conflict/in_progress mantig'i) `POST /patients`ga ulandi (to'lov/kassa endpoint'lari hali yo'q); tarmoq holati indikatori (`NetworkContext`, `NetworkBanner`) butun ilova ustida; service worker `/api/*`ni keshlamayotgani tasdiqlandi (o'zgartirish kerak bo'lmadi). Real Postgres+server'ga qarshi: ketma-ket/parallel bir xil kalit → 1 yozuv, boshqa tana → 422, band holat → 409. 94/94 test (87 + 7 yangi). |
| 2026-09-22 | Integratsiya test infratuzilmasi qo'shildi (`pnpm test:integration`, `apps/api/vitest.integration.config.ts`, bo'lim 9.2 oxiri) — T2/T3/T4'da qo'lda tekshirilgan DB-bog'liq xatti-harakatlar endi avtomatik (15 test). Shu jarayonda haqiqiy xato topildi va tuzatildi: `POST /api/auth/login` o'chirilgan foydalanuvchini SELECT'da filtrlamagani sabab, ba'zi holatlarda yangi faol foydalanuvchi ham (bir xil login bilan) kira olmay qolishi mumkin edi. Standart `pnpm test` (94/94, DB'siz) o'zgarishsiz qoldi. |
| 2026-09-22 | Ekran 2 "Jadval", 4 "Bemor kartasi" (yozuvlar bilan) va 5 "Yozuv modal" quruldi. Backend: `GET/POST /api/appointments` (vaqt to'qnashuvi tekshiruvi — `src/domain/appointments.ts`, sof funksiya, 8 test), `PATCH /api/appointments/:id` (holat), `GET /api/doctors`, `GET /api/chairs`. Web: kun ko'rinishi kreslo × vaqt grid (CSS Grid), bo'sh katakka bosilganda Yozuv modal (mavjud bemor qidiriladi), mavjud yozuvga bosilganda holat o'zgartirish. Real Postgres+server+brauzerga (Playwright, headless Chromium) qarshi to'liq tekshirildi: yaratish, to'qnashuv rad etilishi (409), holat o'zgartirish, bemor kartasida ko'rinishi — barchasi screenshot bilan tasdiqlandi. **FARAZ:** klinika ish soati (08:00–20:00) hech qayerda sozlanmagani uchun qattiq belgilandi (`docs/talablar.md`, `SchedulePage.tsx` `// FARAZ:`) — dala ishida tasdiqlanadi. 102/102 test (94 + 8 yangi). |
| 2026-09-22 | Ekran 6 "Kassa / vizit yakuni" quruldi — MVPning eng muhim ekrani. Backend: `POST/PATCH /api/cash-sessions` (smena — bir vaqtda faqat bitta ochiq, yopishda `closeCashSession` bilan kutilgan/sanalgan/farq), `POST/GET/PATCH /api/visits` (vizit boshlash/yakunlash), `POST /api/visits/:id/performed-services` (xizmat — narx/shifokor foizi snapshot, `computeDiscountAmount`), `POST /api/payments` + `POST /api/payments/:id/void` (`buildReversal`), `GET /api/patients/:id/balance` (`calculatePatientBalance`), `GET /api/services`. Rol: owner/admin/cashier (screens.ts'ga moslashtirildi — `doctor` bu ekranga kirmaydi, `docs/talablar.md`). Web: `CashierPage.tsx` — smena holati, bemor qidirib vizit boshlash, xizmat/to'lov formalari, bekor qilish (sabab bilan), balans ko'rsatish. Real Postgres+server+brauzerga qarshi to'liq tekshirildi (curl: rol cheklovlari, kanonik `voided_at`-ni-filtrlamaslik qoidasi aniq raqamlar bilan tasdiqlandi — masalan 300000 kutilgan naqd; Playwright: smena ochish→vizit→xizmat→to'lov→bekor qilish→yakunlash→smena yopish, screenshotlar bilan). Yangi integratsiya test fayli (`visits.integration.test.ts`, 14 test) — jami integratsiya 29/29. 102/102 unit test (o'zgarishsiz — yangi domen mantiq yo'q, mavjudlari ulandi). |
| 2026-09-22 | Ekran 7 "Xarajatlar" va Ekran 11 "Xizmat va narxlar" quruldi (bo'lim 7, hafta 7-8). Backend: `GET/POST /api/expenses` (rol: owner/admin), `GET/POST/PATCH /api/services` (narx tahrirlash o'tgan `performed_services.price_snapshot`ga ta'sir qilmaydi — Tamoyil #2; `?includeInactive=true` — ekran 11 uchun), `GET/POST /api/service-categories` (rol: owner). Yangi domen mantiq yo'q — oddiy CRUD. Web: `ExpensesPage.tsx` (ro'yxat + qo'shish, kategoriya erkin matn + taklif ro'yxati), `ServicesPage.tsx` (xizmat/kategoriya qo'shish, narxni joyida tahrirlash, faollashtirish/faolsizlantirish). Real Postgres+server+brauzerga qarshi to'liq tekshirildi (`expensesAndServices.integration.test.ts`, 7 test — jami integratsiya 36/36; Playwright screenshotlar bilan). 102/102 unit test (o'zgarishsiz). |
| 2026-09-22 | Ekran 8 "Kunlik hisobot", 9 "Oylik marja" (bo'lim 1: asosiy farqlanish nuqtasi) va 10 "Shifokor hisobi" quruldi (bo'lim 7, hafta 9-11) — faqat owner. Backend: `GET /api/reports/{daily,margin,doctors}` — yangi domen mantiq yo'q, mavjud `calculateRevenue`/`calculateDoctorEarning`/`calculateServiceMargin` (`src/domain/doctorEarnings.ts`) ustiga agregatsiya, `clinics.doctor_pct_basis` bilan. Kunlik: tushum/shifokor ulushi/material/marja, to'lovlar (usul bo'yicha), xarajatlar, vizitlar soni, kassa smenasi holati. Oylik marja: jami + kategoriya kesimida, sof foyda = marja − xarajat. Shifokor: har biri bo'yicha xizmatlar soni/tushum/ulush. Web: `DailyReportPage.tsx`, `MarginReportPage.tsx`, `DoctorReportPage.tsx` — sana/oy tanlagich + kartalar/jadval. Real Postgres+server+brauzerga qarshi to'liq tekshirildi (`reports.integration.test.ts`, 5 test, aniq raqamlar bilan — masalan 300000 tushum → 40% da 120000 shifokor ulushi; owner-only rol 403 bilan tasdiqlandi; Playwright screenshotlar bilan). Jami integratsiya 41/41. 102/102 unit test (o'zgarishsiz). |
| 2026-09-22 | Ekran 12 "Foydalanuvchilar" quruldi — **Faza 1ning oxirgi ekrani, barcha 12 ta ✅**. Backend: `GET/POST /api/users`, `PATCH /api/users/:id` (rol/holat), `POST /api/users/:id/reset-password` — faqat owner. T3'da tayyorlab qo'yilgan, lekin hech qayerdan chaqirilmagan ikkita narsa birinchi marta ishga tushdi: `validatePassword` (yaratish/parol tiklashda) va `deleteAllSessionsForUser` (deaktivatsiya/parol tiklashda — sessiyalar darhol o'chadi). O'zini faolsizlantirish taqiqlanadi. Web: `UsersPage.tsx`.

  **Shu jarayonda ikkita real xato topildi va tuzatildi (ikkalasi ham brauzer sinovida, kod o'qishda emas):**
  1. **Idempotentlik kaliti qayta ishlatilishi** — forma validatsiya xatosi bilan rad etilib, foydalanuvchi tuzatib qayta yuborsa, ESKI kalit bilan YANGI tana yuborilardi → idempotentlik middleware "boshqa tana" deb 422 qaytarardi. `PatientsPage.tsx`, `AppointmentModal.tsx`, `CashierPage.tsx` (3 joy), `ExpensesPage.tsx`, `UsersPage.tsx` — hammasida tuzatildi: server javob berganda (`ApiError`) kalit YANGILANADI, faqat tarmoq xatosida (server javob bermaganda) saqlanadi.
  2. **Validatsiya xatosi `[object Object]` ko'rinardi** — `@hono/zod-validator`ning standart xato javobi `{error: ZodError}` (obyekt, matn emas) edi, loyihaning qolgan qismi esa `{error: "matn"}` shartnomasiga amal qiladi. Yangi `src/api/validate.ts` (`zValidate`) — birinchi Zod xatosini matn qilib qaytaradi, BARCHA 11 route faylida `zValidator` o'rniga shu ishlatiladi endi.

  Real Postgres+server+brauzerga qarshi to'liq tekshirildi (`users.integration.test.ts`, 11 test — sessiya o'chishi haqiqiy DB qatoridan tasdiqlandi; Playwright: yaratish, zaif parol rad etilishi, faolsizlantirish, o'z-o'zini bloklay olmaslik). Jami integratsiya 52/52. 102/102 unit test (o'zgarishsiz). |
