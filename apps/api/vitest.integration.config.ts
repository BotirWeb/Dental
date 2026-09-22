import { defineConfig } from "vitest/config";

/**
 * DB-bog'liq integratsiya testlar — oddiy `pnpm test`dan ATAYLAB alohida
 * (u DB'siz, har doim tez va yashil qoladi, qollanma bo'lim 9.2/talablar.md).
 * Haqiqiy Postgres kerak — `src/testing/setupIntegration.ts` xavfsizlik
 * qulfi va migratsiyani bajaradi.
 *
 * `singleFork: true` — testlar bitta jarayonda ketma-ket ishlaydi: bir xil
 * baza ustida parallel worker'lar bir-birining ma'lumotini buzmasin.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    setupFiles: ["./src/testing/setupIntegration.ts"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
