import { defineConfig, devices } from "@playwright/test";

const ci = !!process.env.CI;
export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "test-results/publishing",
  fullyParallel: false,
  // The real database/SMTP journey owns fixed local ports; do not shard it yet.
  workers: 1,
  forbidOnly: ci,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:4200",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.PLAYWRIGHT_CHANNEL,
      },
    },
  ],
  webServer: [
    {
      command: ci
        ? "node --env-file=.env dist/apps/api/main.mjs"
        : "pnpm dev:api",
      url: "http://localhost:4000/health/ready",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: ci
        ? "pnpm exec vite preview --config apps/admin/vite.config.ts --port 4200 --strictPort"
        : "pnpm dev:admin",
      url: "http://localhost:4200",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: ci ? "node tools/next.mjs start" : "pnpm dev:web",
      url: "http://localhost:3000",
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report/publishing", open: "never" }],
  ],
});
