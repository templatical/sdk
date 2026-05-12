import { test, expect } from "@playwright/test";

/**
 * Phase 6.4 — host-level CSS custom property theming.
 *
 * Supported theming protocol for shadow-mode (and light-mode) embeds is
 * the `--tpl-user-*` override namespace. The editor's stylesheet
 * declares each token as `--tpl-primary: var(--tpl-user-primary,
 * <default>)`, so a consumer setting `--tpl-user-primary` on the host
 * element (or any ancestor) inherits the value into the editor's themed
 * root and wins. Works identically in both modes because CSS custom
 * properties cross the shadow boundary via inheritance.
 *
 * The spec targets the `#multi` playground route specifically: it mounts
 * two shadow editors WITHOUT a `theme` config option, so no inline
 * `--tpl-*` values pin the cascade. The default `#` route's App.vue
 * eagerly inlines its own defaultTheme (playground's config-editor
 * default state), which would defeat the protocol — not because the
 * protocol is broken, but because that consumer chose to pin every value
 * inline. The protocol works for consumers that DON'T pass a `theme`
 * config (or only pass partial overrides).
 */
test.describe("Host-level CSS custom property theming", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
      localStorage.setItem("tpl-playground-features-dismissed", "true");
    });
    await page.goto("/#multi");
    await page.locator('[data-testid="multi-instance-screen"]').waitFor();
    await page.waitForFunction(() => {
      const a = document.querySelector(
        '[data-testid="multi-editor-a"]',
      ) as HTMLElement | null;
      return Boolean(a?.shadowRoot);
    });
  });

  test("--tpl-user-primary override on the host element cascades into shadow root", async ({
    page,
  }) => {
    // Set the user-namespace override on editor A's container. A
    // deeply-saturated lightness so the diff is unambiguous and unlikely
    // to match any built-in token by coincidence.
    const OVERRIDE_COLOR = "oklch(50% 0.2 0)";
    await page.addStyleTag({
      content: `
        [data-testid="multi-editor-a"] {
          --tpl-user-primary: ${OVERRIDE_COLOR};
        }
      `,
    });

    // Read --tpl-primary on the editor's themed `.tpl` root inside the
    // shadow tree. `.tpl` declares `--tpl-primary: var(--tpl-user-primary,
    // <default>)`, so the inherited override should resolve.
    const observed = await page.evaluate(() => {
      const a = document.querySelector(
        '[data-testid="multi-editor-a"]',
      ) as HTMLElement | null;
      const shadow = a?.shadowRoot;
      const root = shadow?.querySelector(".tpl") as HTMLElement | null;
      if (!root) return null;
      return getComputedStyle(root).getPropertyValue("--tpl-primary").trim();
    });

    expect(observed).toContain("oklch(50%");
  });

  test("editor B without override keeps its default --tpl-primary", async ({
    page,
  }) => {
    // Sanity check that the previous test's override scoping holds —
    // setting --tpl-user-primary on editor A's container must NOT leak
    // into editor B's shadow root. Per-editor isolation is the
    // protocol's actual promise.
    await page.addStyleTag({
      content: `
        [data-testid="multi-editor-a"] {
          --tpl-user-primary: oklch(50% 0.2 0);
        }
      `,
    });

    const observed = await page.evaluate(() => {
      const b = document.querySelector(
        '[data-testid="multi-editor-b"]',
      ) as HTMLElement | null;
      const shadow = b?.shadowRoot;
      const root = shadow?.querySelector(".tpl") as HTMLElement | null;
      if (!root) return null;
      return getComputedStyle(root).getPropertyValue("--tpl-primary").trim();
    });

    // Default light-theme primary.
    expect(observed).toContain("oklch(70%");
  });
});
