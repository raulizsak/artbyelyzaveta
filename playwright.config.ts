import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./test-results/storefront",
  fullyParallel: false,
  workers: 2,
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    command: "npm run dev:next",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    env: {
      ALLOW_LOCAL_CATALOGUE_FIXTURE: "true",
      PAYMENT_MODE: "test",
      ENABLE_TEST_CHECKOUT: "false",
      ENABLE_LIVE_CHECKOUT: "false",
      ENABLE_DEMO_CHECKOUT: "false",
      PREVIEW_GATE_ENABLED: "false",
    },
    timeout: 120_000,
  },
});
