import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["testes/integracao/**/*.test.ts"], testTimeout: 120_000, hookTimeout: 300_000, fileParallelism: false },
});
