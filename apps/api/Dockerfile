# DIQQAT: bu Dockerfile ushbu ishlab chiqish muhitida (Docker daemon yo'q)
# sinovdan o'tkazilmagan. VPS'ga birinchi marta deploy qilishda albatta
# tekshirib chiqing (qollanma bo'lim 12 — "birinchi hafta" ishidan keyin).
FROM node:22-alpine
WORKDIR /repo
RUN corepack enable

# Butun monorepo nusxalanadi — workspace bog'lanishlari (@dental/shared)
# to'g'ri ishlashi uchun eng oddiy va ishonchli yo'l. Image hajmini
# kichraytirish kerak bo'lsa, keyinchalik `pnpm deploy --filter @dental/api`
# (standalone prune) ga o'tish mumkin.
COPY . .
RUN pnpm install --frozen-lockfile

WORKDIR /repo/apps/api
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "start"]
