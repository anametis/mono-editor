import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "../../../tests/ui",
  outputDir: "../../../test-results/storybook",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  use: {
    baseURL: "http://127.0.0.1:4400",
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
  webServer: {
    command:
      "pnpm exec vite preview --outDir dist/storybook/ui --host 127.0.0.1 --port 4400 --strictPort",
    cwd: "../../..",
    url: "http://127.0.0.1:4400/index.json",
    reuseExistingServer: false,
    timeout: 60_000,
  },
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report/storybook", open: "never" }],
  ],
});
