import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./apps/playground/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined, // undefined = half CPU cores locally
  reporter: process.env.CI
    ? [["blob"], ["html", { open: "never" }]]
    : "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "bun run --filter '@templatical/playground' dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
