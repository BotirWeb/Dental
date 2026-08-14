# DIQQAT: sinovdan o'tkazilmagan (izoh uchun apps/api/Dockerfile'ga qarang).
FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @dental/web build

# Statik fayllar Caddy orqali beriladi — bir vaqtning o'zida frontend va
# /api uchun reverse-proxy (qollanma bo'lim 3: "Docker Compose + Caddy").
FROM caddy:2-alpine
COPY --from=build /repo/apps/web/dist /srv
COPY apps/web/Caddyfile /etc/caddy/Caddyfile
