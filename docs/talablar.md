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
