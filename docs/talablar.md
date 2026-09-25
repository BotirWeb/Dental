# Talablar jurnali

Har yangi talab shu yerga qo'shiladi — nima so'ralgan, kimdan, umumiymi yoki
bitta klinikaga xosmi, qanday hal qilindi, kodda qayerda. Maqsad: pilot
klinikaning o'ziga xos talabi kodga hardcode bo'lib qolmasligi
(`docs/prd-v1.md` bo'lim 11 "Bitta klinikaga moslashib qolish" xavfi).

Belgilar: **[U]** universal — har qanday klinikaga tegishli. **[K]** klinikaga
xos — faqat sozlama/feature flag orqali qo'llanadi, hech qachon hardcode
qilinmaydi. **[?]** noaniq — hali universal yoki klinikaga xosligi
aniqlanmagan, dala ishida hal qilinadi.

| Sana | Kimdan | Talab | U/K/? | Qaror | Kodda qayerda |
|---|---|---|---|---|---|
| 2026-09-22 | Tahlil (`docs/tahlil/2026-09-22-tahlil-va-ai-yordamchi.md`) | Shifokor foizi asosi — tushumdanmi yoki material ayirilgandan keyinmi | [?] | Sozlanadigan qilib qo'yildi, javob dala ishida aniqlanadi | `clinics.doctor_pct_basis`, `src/domain/doctorEarnings.ts` |
| 2026-09-22 | Tahlil (B2) | Chegirma so'mda yoki foizda kiritilishi kerak | [U] | Ikkalasi ham qo'llab-quvvatlanadi | `performed_services.discount_type`, `src/domain/discount.ts` |
| 2026-09-22 | Tahlil (doctorEarnings.ts izohi) | Kafolat vizitida shifokor komissiyasi 0 bo'lishi kerakmi | [?] | FARAZ qilindi (0), dala ishida tasdiqlanadi | `performed_services.is_warranty`, `src/domain/doctorEarnings.ts` |
| 2026-09-22 | Tuzatishlar T2 (C4) | Login klinika ichida unique bo'lishi, klinika kodi bilan kirish | [U] | Kelishildi va amalga oshirildi (2026-09-22) — klinika kodi + login, login klinika ichida unique. Sabab: bitta shifokor ikki klinikada ishlashi mumkin, har klinikada `admin` bo'lishi kerak, xodimlarning ko'pida email yo'q. | `clinics.slug`, `users.login` unique `(clinic_id, login) WHERE deleted_at IS NULL`, `apps/api/src/api/routes/auth.ts`, `apps/api/src/domain/auth.ts` |
| 2026-09-22 | Tuzatishlar T3 (D2) | Sessiya muddati qancha bo'lishi kerak | [U] | Kelishildi — idle 12 soat, absolyut 7 kun, env orqali. Hali amalga oshirilmagan (T3). | `sessions.expires_at`, `SESSION_TTL_HOURS` (hozirgi, o'zgaradi) |
| 2026-09-22 | Ekran 2 "Jadval" qurilishi | Klinika ish soati qancha (jadval grid qaysi soatlardan boshlanadi/tugaydi) | [?] | FARAZ qilindi — 08:00-20:00 qattiq belgilandi, dala ishida tasdiqlanadi yoki sozlamaga ko'chiriladi | `apps/web/src/routes/SchedulePage.tsx` (`DAY_START_HOUR`/`DAY_END_HOUR`, `// FARAZ:` izohi) |
| 2026-09-22 | Ekran 6 "Kassa" qurilishi | Vizit boshlash/xizmat yozish/to'lov — qaysi rollar bajaradi? | [?] | FARAZ qilindi — `screens.ts` ekran 6 ro'yxatiga moslashtirildi: owner/admin/cashier hammasini kiritadi (registratura), `doctor` bu ekranga kirmaydi. Dala ishida tasdiqlanadi — ba'zi klinikada shifokor o'zi yozishi mumkin. | `apps/api/src/api/routes/visits.ts`, `payments.ts` (`requireRole`) |
| 2026-09-22 | Ekran 6 "Kassa" qurilishi | Bitta bemorning ikkinchi (avvalgisi yakunlanmagan) vizitini davom ettirish | [?] | Qamrovga kiritilmadi — MVP'da har "vizit boshlash" yangi qator yaratadi, oldingi tugallanmagan vizitni UI orqali qayta ochib bo'lmaydi (bemor balansiga baribir hisoblanadi, faqat interfeys ko'rsatmaydi). Real foydalanishda muammo bo'lsa, keyingi ishga qaytariladi. | `apps/web/src/routes/CashierPage.tsx` |
| 2026-09-24 | Foydalanuvchi (T5) | Tish kartasi (odontogramma) — tishlar holatini grafik belgilash va bemorga saqlash | [U] | Amalga oshirildi — `react-advanced-odontogram` 2.5.0 (MIT, `vendor/`), har saqlash yangi versiya. Modul `clinics.features.odontogram` flag ortida, default o'chiq (CLAUDE.md qoida 7) | `dental_charts`, `apps/api/src/api/routes/dentalCharts.ts`, `apps/web/src/routes/DentalChartPage.tsx` |
| 2026-09-24 | Foydalanuvchi (T5) | Karta ichidagi matnlar tili | [?] | Kutubxonada o'zbek tili yo'q — foydalanuvchi qarori bilan vaqtincha rus tili; atrofdagi UI o'zbekcha. O'zbek tarjimasi — kutubxonaga upstream PR (bo'lim 13, #6) | `apps/web/src/components/odontogram/DentalChartEditor.tsx` (`language="ru"`) |
| 2026-09-24 | Foydalanuvchi (T5) | Tish kartasini kim ko'radi va kim o'zgartiradi | [?] | Kelishildi — tahrir: doctor/owner; admin faqat ko'radi; cashier kirmaydi. Dala ishida tasdiqlanadi (assistent kiritishi mumkin) — o'zgarsa bitta joy | `DENTAL_CHART_VIEW_ROLES`/`DENTAL_CHART_EDIT_ROLES` (`packages/shared/src/dto/dentalCharts.ts`) |
| 2026-09-24 | Foydalanuvchi (T5) | Reja (plan) rejimi va parodont kartasi | [U] | v1 da o'chiq — faqat holat kartasi. Reja Faza 2 `treatment_plans` bilan (narx/bosqich) | `DentalChartEditor.tsx` (`StatusOnlyMode`) |
| 2026-09-25 | Foydalanuvchi | Sana brauzerda "2026 M09 24" ko'rinishida chiqmasin | [U] | Bajarildi — `24.09.2026` / `24.09.2026 14:30` / `14:30`, har brauzerda bir xil (Intl'ning `uz-UZ` uslubiga tayanilmaydi) | `apps/web/src/lib/time.ts` |
