import { defineConfig, devices } from "@playwright/test";

// packages/editor/scripts/examples-verify.mjs builds and serves the example
// and passes EXAMPLE_URL, so this config starts no server of its own.
export default defineConfig({
  testDir: "./packages/editor/tests/e2e-examples",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.EXAMPLE_URL,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
});
