import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "testes/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["json", { outputFile: "relatorios/resultado.json" }],
    ["junit", { outputFile: "relatorios/junit.xml" }],
  ],
  use: {
    baseURL: "https://www.saucedemo.com",
    testIdAttribute: "data-test",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
