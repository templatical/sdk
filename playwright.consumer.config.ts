import { defineConfig, devices } from "@playwright/test";

/**
 * Real-browser smoke against the editor's packed-and-installed tarball, served
 * by an ephemeral vanilla-HTML consumer materialized into
 * `node_modules/.cache/e2e-consumer/` at run time from fixtures under
 * `packages/editor/tests/e2e-fixtures/vanilla-consumer/`.
 *
 * Why a separate config from playwright.config.ts:
 *   The default e2e suite targets the playground app, which consumes the
 *   editor via the pnpm workspace (`workspace:*`) — single Vue runtime, single
 *   reactivity instance, no chance to catch the duplicate-instance class of
 *   bug. This config installs the editor as a real consumer would: from a
 *   tarball into a fresh project's node_modules. That's the only place where
 *   a regression like "@templatical/core leaked back as an external" actually
 *   manifests.
 *
 * Pre-flight (build + pack + install) is handled by
 * `packages/editor/scripts/e2e-consumer-prepare.mjs`, invoked by the webServer
 * command before vite starts.
 */

const PORT = 51731;
const CONSUMER_ROOT = "node_modules/.cache/e2e-consumer";

export default defineConfig({
  testDir: "./packages/editor/tests/e2e-consumer",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["blob"], ["html", { open: "never" }]]
    : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `node ./packages/editor/scripts/e2e-consumer-prepare.mjs && pnpm --dir ${CONSUMER_ROOT} exec vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    // Pack + install can take 30–60s on a cold cache.
    timeout: 180_000,
  },
});
