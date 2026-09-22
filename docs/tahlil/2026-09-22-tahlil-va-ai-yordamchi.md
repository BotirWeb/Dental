# Tahlil — 2026-09-22: moliyaviy yaxlitlik, qidiruv, xavfsizlik va AI yordamchi

> **Kelib chiqishi:** bu fayl `docs/tasks/2026-09-22-tuzatishlar.md`da "Manba" sifatida
> ko'rsatilgan, lekin repoda yoki topilgan boshqa joyda asli saqlanmagan edi (T0
> hisobotida qayd etilgan). Quyidagi matn kod ichidagi `tahlil A2`, `tahlil B1`
> kabi izohlar, commit `8deff00` xabari va `docs/tasks/2026-09-22-tuzatishlar.md`
> asosida **qayta tiklangan** — original formulировкалар emas, balki topilgan xulq va
> qarorlarning izohi. Aniqlik darajasi past bo'lgan joylar shunday belgilangan.

Ikki qism: **A–D** — commit `8deff00` bilan bajarilgan tuzatishlar (moliyaviy
yaxlitlik, qidiruv, xavfsizlik boshlanishi). **M** — hali ochiq, keng qamrovli
masalalar (`docs/tasks/2026-09-22-tuzatishlar.md`da T2–T4 sifatida rejalashtirilgan).

---

## A — Moliyaviy yozuvlarni o'chirmaslik va tuzatish

**A1.** Aniq matni tiklanmadi (kodda maxsus izoh topilmadi). Ehtimol: asosiy
`clinic_id` qamrovi va `audit_log` infratuzilmasi — bular Faza 1 skeletida
(`b15b482`) allaqachon bor edi, shuning uchun alohida "tahlil A1" izohi kodda
qolmagan bo'lishi mumkin. **Tekshirilmagan faraz — ishonch bilan tasdiqlanmaydi.**

**A2. Muammo:** moliyaviy va tibbiy yozuvlar (`visits`, `performed_services`,
`payments`, `expenses`) qattiq o'chirilishi mumkin edi — bu revizor uchun izsiz
yo'qolish degani.
**Yechim:** har birida `deleted_at` (yumshoq o'chirish). Hisobot kanonik filtri —
`deleted_at IS NULL`. Ko'ring: `docs/prd-v1.md` bo'lim 5.1 (tamoyil 4).

**A3. Muammo:** admin 500 000 o'rniga 5 000 000 kiritsa, tuzatish yo'li yo'q edi.
**Yechim:** ikki mexanizm — tuzatuvchi yozuv (manfiy summali, `reversal_of_id`) +
bekor belgisi (`voided_at`/`voided_by`/`void_reason`, faqat UI uchun). Kanonik
qoida: hisobot `voided_at`ni FILTRDA ishlatmaydi, faqat `deleted_at IS NULL`.
Ko'ring: `src/domain/payments.ts`, `docs/prd-v1.md` bo'lim 5.5.
**Misol (tuzatishlar faylida keltirilgan):** asl 500 000 + tuzatuvchi −500 000 =
0 (to'g'ri). `voided_at IS NULL` ham filtrga qo'shilsa → faqat −4 500 000 qoladi
(XATO — ikki marta ayirilgan).

---

## B — Kassa, chegirma, bemor balansi

**B1. Muammo:** kunlik hisobot faqat HISOBLANGAN edi — tizim "bugun 4 200 000
so'm naqd tushdi" deydi, lekin kassada haqiqatan shuncha bormi, hech kim
tekshirmaydi.
**Yechim:** `cash_sessions` jadvali — smena ochilganda naqd to'lovlar unga
bog'lanadi, yopilganda `expected_cash` (tizim) va `counted_cash` (qo'lda sanalgan)
solishtiriladi, `diff` ko'rsatiladi. Ko'ring: `src/domain/cashSession.ts`,
`docs/prd-v1.md` bo'lim 5.7.

**B2. Muammo:** `performed_services.discount` bitta ustun edi, "so'mmi yoki
foizmi" hech qayerda yozilmagan — kodda "FARAZ QILINDI" deb belgilangan edi.
Noto'g'ri talqin qilinsa marja va shifokor foizi ham noto'g'ri chiqadi.
**Yechim:** uchta ustun — `discount_type`, `discount_value`, `discount_amount`
(hisoblangan, snapshot). Chegirma har doim satr jamisiga, donaga emas. Yaroqsiz
chegirma jimgina tuzatilmaydi — xato tashlanadi (400). Ko'ring:
`src/domain/discount.ts`, `docs/prd-v1.md` bo'lim 5.3.

**B3. Muammo:** 4-ekranda "qarz" ko'rsatiladi, lekin formula yozilmagan edi —
avans, chegirma, kafolat, tuzatuvchi to'lov aralashganda har kim har xil
tushunishi, ikki ekran ikki xil raqam ko'rsatishi mumkin edi.
**Yechim:** kanonik formula bitta joyda (`src/domain/patientBalance.ts`):
`balans = hisoblandi − to'landi`. Ko'ring: `docs/prd-v1.md` bo'lim 5.6.

---

## C — Bemor qidiruvi va telefon

**C1. Muammo:** telefon bo'yicha qidiruv `ILIKE '%...%'` bilan ishlardi —
boshidagi `%` sababli btree indeks umuman ishlamas edi, har qidiruvda to'liq
jadval skani ketardi (ekran 3 talabi "tez" bajarilmaydi).
**Yechim:** `patients.phone_normalized` ustunida PREFIKS qidiruv,
`text_pattern_ops` indeks bilan. Lokal Postgres 16'da EXPLAIN bilan
tekshirilgan: `text_pattern_ops`siz → Seq Scan, u bilan → Index Scan (20 000
bemorlik test ma'lumotida).

**C2. Muammo:** bitta odam bazaga uch xil yozilishi mumkin edi
("+998901234567", "901234567", "90 123 45 67").
**Yechim:** `normalizePhone` — kanonik 9 raqamli shakl, backend ham frontend ham
bir xil natija beradi (`packages/shared/src/phone.ts`).

**C3. Muammo:** dublikat bemor yozuvlari — ikkita karta, tarix bo'linishi.
**Yechim:** qattiq UNIQUE cheklov qo'yilmadi (oila a'zolari bitta raqamdan
foydalanadi), o'rniga yozuv qo'shishda `duplicates` ro'yxati qaytariladi,
interfeys ogohlantiradi, admin qaror qiladi.

---

## D — Xavfsizlik (boshlanishi)

**D1. Muammo:** `/auth/login`da hech qanday cheklov yo'q edi — parolni cheksiz
marta sinab ko'rish mumkin edi. Tibbiy ma'lumot bazasi uchun bu jiddiy.
**Yechim:** `rateLimit` middleware — 15 daqiqada 10 urinish, IP va login bo'yicha
ikki alohida oyna (sliding window). Jarayon xotirasida (bitta VPS/Node instance
uchun yetarli; replikalar bo'lsa DB/Redis'ga ko'chiriladi). Ko'ring:
`apps/api/src/api/middleware/rateLimit.ts`.

**D2. Ochiq, T3 ishi (hali bajarilmagan):** sessiya muddati, deaktivatsiyada
sessiyani darhol o'chirish, parol siyosati, CSRF, xavfsizlik headerlari, log
maskalash. To'liq ro'yxat — `docs/tasks/2026-09-22-tuzatishlar.md` T3.

---

## M — Keng qamrovli ochiq masalalar

**M1. To'liq oflayn rejim.** Hozircha yo'q. Sekin internetda admin tugmani ikki
marta bossa yoki so'rov timeout'dan keyin qayta yuborilsa — ikki marta to'lov
yozilishi mumkin (bu oflayn rejimsiz ham real xato). Birinchi qism (T4):
idempotentlik middleware + tarmoq holati indikatori. To'liq IndexedDB outbox —
keyinroq, 6-ekran (Kassa) real ishlagandan keyin loyihalanadi.

**M2. Ega uchun mobil dizayn.** 8, 9, 10-ekranlar (hisobotlar) mobil-birinchi
bo'lishi kerak — owner ko'pincha telefondan kiradi. Alohida vazifa emas,
CLAUDE.md UI qoidasi sifatida har ekran bilan birga bajariladi (360px kenglik,
Playwright 390×844 viewport).

**M3. Hujjat = kod muvofiqligi.** `docs/prd-v1.md` bo'lim 5 Drizzle sxemadan
orqada qolib ketishi mumkin edi (masalan bu tahlil vaqtida hujjatning o'zi
umuman yo'q edi — T0 hisobotiga qarang). Yechim: `docs/talablar.md` — har yangi
talab [U]/[K]/[?] belgisi bilan qayd etiladi, klinikaga xos narsa faqat sozlama
orqali (`doctor_pct_basis` namunasi).

---

## Tish formulasi bo'limi — `/api/services`, `/api/doctors` 401 haqida eslatma

Ushbu tahlilning asl matnida (topilmagan) tish formulasi ekrani tekshirilganda
`/api/services` va `/api/doctors` 401 qaytargani, `/api/auth/me` esa 200
qaytargani qayd etilgan edi (`docs/tasks/2026-09-22-tuzatishlar.md` T0.4).

**T0 tekshiruvida aniqlandi:** joriy kodda bu ikki route — na backend'da
(`apps/api/src/api/app.ts` faqat `/health`, `/auth`, `/patients`ni ro'yxatga
oladi), na frontend'da (`apps/web/src`da `/api/services` yoki `/api/doctors`ga
hech qanday `fetch`/`api.*` chaqiruvi yo'q) — mavjud emas. `/services` va
`/reports/doctors` faqat `screens.ts`dagi UI yo'llari, ikkalasi ham
`status: "todo"` (hali qurilmagan). Route umuman bo'lmasa, Hono `404`
(`app.notFound`) qaytaradi, `401` emas.

**Xulosa:** bu kuzatuv joriy kod holatiga mos kelmaydi — ehtimol boshqa
branch/versiyada yoki keyingi bosqichda (ekranlar qurilgandan keyin) tekshirilgan
bo'lishi mumkin. Hozircha amal qiladigan xulosa yo'q; ekran 10/11 qurilganda
(bo'lim 7, hafta 7-8/9-11) auth middleware to'g'ri ulanganini alohida tekshirish
kerak.
