import { defineConfig, devices } from "@playwright/test";

/**
 * Overridable because the port plus `reuseExistingServer` is a trap across git
 * worktrees: a second worktree running e2e finds 51730 already served by the
 * first, reuses it, and silently tests **the other branch's app** with this
 * branch's specs. That failure looks like unrelated specs breaking at once, not
 * like a port clash. `E2E_PORT=51731 pnpm run test:e2e` keeps runs isolated.
 */
const E2E_PORT = Number(process.env.E2E_PORT ?? 51730);

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
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    // Two projects, same specs. Light DOM (current default) and shadow
    // DOM (opt-in via the playground's `?shadowDom=1` URL param) — both
    // must pass before the SDK can flip its default in Phase 7.
    //
    // `metadata.shadowDom` is the contract every fixture / page-object
    // consults to decide whether to append the query string and whether
    // shadow-only assertions apply.
    {
      name: "chromium-light",
      use: { ...devices["Desktop Chrome"] },
      metadata: { shadowDom: false },
    },
    {
      name: "chromium-shadow",
      use: { ...devices["Desktop Chrome"] },
      metadata: { shadowDom: true },
    },
  ],
  webServer: {
    command: `pnpm --filter @templatical/playground run dev --port ${E2E_PORT} --strictPort`,
    url: `http://localhost:${E2E_PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
