import { defineConfig } from "vitest/config";

/**
 * Standart `pnpm test` — FAQAT DB'siz sof funksiya testlari, har doim tez va
 * yashil. DB'ga bog'liq integratsiya testlar ataylab bundan tashqarida
 * (`*.integration.test.ts` — ko'ring `vitest.integration.config.ts`,
 * `pnpm test:integration`, qollanma bo'lim 9.2).
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "src/**/*.integration.test.ts"],
  },
});
