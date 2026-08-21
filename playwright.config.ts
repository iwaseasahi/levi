import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  outputDir: "test-results/playwright",
  reporter: [
    ["line"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["junit", { outputFile: "test-results/e2e.xml" }],
  ],
  retries: 0,
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:3100",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "pnpm dev --port 3100",
    reuseExistingServer: false,
    timeout: 120_000,
    url: "http://127.0.0.1:3100/api/health",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
