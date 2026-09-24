# vendor/ — repo ichida saqlanadigan tashqi paketlar

Bu yerdagi fayllar npm registry'ga bog'liq bo'lmasligi uchun repo'ning o'zida
saqlanadi. `pnpm install --frozen-lockfile` (Docker build ham) ularni shu
yerdan oladi, internetdan emas.

## react-advanced-odontogram-2.5.0.tgz

Tish kartasi (odontogramma) — T5, `docs/tasks/2026-09-24-odontogram.md`.

| | |
|---|---|
| Manba | npm `react-advanced-odontogram@2.5.0` (`npm pack` bilan olingan, o'zgartirilmagan) |
| Kod | https://github.com/ZoliQua/React-Advanced-Odontogram |
| Litsenziya | MIT © 2026 Zoltán Dul — to'liq matn tarball ichida (`package/LICENSE`) |
| sha512 (npm `dist.integrity`) | `sha512-H9oGcl2pUcob+GnZwpsf7G3FTalfxJwJSFMINuY5YmSIjPqWG8JClCl6bhL9n0daWivPcZvKbxlkh7T/Dxjn+w==` |

**Nega npm'dan to'g'ridan-to'g'ri emas:** paket 2026-08 da birinchi marta
chiqqan, bitta muallif yuritadi. Kam yuklanadigan paketni muallif npm'dan
o'chirib yuborishi mumkin — shunda `pnpm install` (va deploy) buziladi.
Tarball shu yerda turgani uchun bu xavf yo'q. MIT litsenziya shu nusxa uchun
qaytarib olinmaydi — loyiha keyin o'chsa ham, bu versiyani ishlatish va
o'zgartirish huquqi saqlanadi.

**Paketning o'z bog'liqliklari** (`jspdf`, `dompurify`) hali npm'dan keladi —
ular keng tarqalgan, yuzlab paketlar bog'langan, o'chib ketish xavfi amalda yo'q.

**Yangilash tartibi:**

1. `npm pack react-advanced-odontogram@X.Y.Z` → yangi `.tgz` shu papkaga.
2. `npm view react-advanced-odontogram@X.Y.Z dist.integrity` bilan
   `pnpm-lock.yaml`dagi `integrity` bir xilligini tekshiring.
3. `apps/web/package.json`dagi yo'lni yangilang, `pnpm install`.
4. CHANGELOG'ni o'qing — ayniqsa saqlangan karta formati (`payload.version`)
   va API o'zgarishlari (masalan 2.6.0 da `setToothAnatomy()` async bo'lgan).
5. Eski `.tgz` ni o'chiring.
