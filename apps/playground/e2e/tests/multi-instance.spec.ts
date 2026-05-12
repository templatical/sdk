import { test, expect } from "@playwright/test";

/**
 * Phase 6.3 — multi-instance shadow-DOM isolation.
 *
 * Targets the `#multi` playground route which mounts two editors side by
 * side, both with `shadowDom: true`. The point of these tests isn't that
 * the editor renders — that's covered by the smoke suite — but that two
 * editors can coexist on the page without leaking state between them.
 *
 * Runs in both Playwright projects (light + shadow) since the multi page
 * always mounts shadow editors regardless of the URL flag. The query
 * param exists only to satisfy the existing dual-mode contract; #multi
 * ignores it.
 */
test.describe("Multi-instance shadow isolation", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
      localStorage.setItem("tpl-playground-features-dismissed", "true");
    });
    await page.goto("/#multi");
    await page
      .locator('[data-testid="multi-instance-screen"]')
      .waitFor();
    // Both editor containers must attach their own shadow root before
    // assertions run.
    await page.waitForFunction(() => {
      const a = document.querySelector(
        '[data-testid="multi-editor-a"]',
      ) as HTMLElement | null;
      const b = document.querySelector(
        '[data-testid="multi-editor-b"]',
      ) as HTMLElement | null;
      return Boolean(a?.shadowRoot && b?.shadowRoot);
    });
  });

  test("each editor mounts its own shadow root with adopted styles", async ({
    page,
  }) => {
    const stats = await page.evaluate(() => {
      const a = (
        document.querySelector(
          '[data-testid="multi-editor-a"]',
        ) as HTMLElement
      ).shadowRoot!;
      const b = (
        document.querySelector(
          '[data-testid="multi-editor-b"]',
        ) as HTMLElement
      ).shadowRoot!;
      return {
        sameRoot: a === b,
        aAdopted: a.adoptedStyleSheets.length,
        bAdopted: b.adoptedStyleSheets.length,
        // Sharing the same CSSStyleSheet instance across roots is the
        // intended optimization (one module-level sheet, zero per-instance
        // CSS cost) — verify the contract.
        sharedSheet:
          a.adoptedStyleSheets[0] === b.adoptedStyleSheets[0],
      };
    });
    expect(stats.sameRoot).toBe(false);
    expect(stats.aAdopted).toBeGreaterThan(0);
    expect(stats.bAdopted).toBeGreaterThan(0);
    expect(stats.sharedSheet).toBe(true);
  });

  test("seed content lands in the correct editor (no cross-mount)", async ({
    page,
  }) => {
    const texts = await page.evaluate(() => {
      const a = (
        document.querySelector(
          '[data-testid="multi-editor-a"]',
        ) as HTMLElement
      ).shadowRoot!;
      const b = (
        document.querySelector(
          '[data-testid="multi-editor-b"]',
        ) as HTMLElement
      ).shadowRoot!;
      const aTitle = a.querySelector(".tpl-block")?.textContent ?? "";
      const bTitle = b.querySelector(".tpl-block")?.textContent ?? "";
      return { aTitle: aTitle.trim(), bTitle: bTitle.trim() };
    });
    expect(texts.aTitle).toContain("Instance A");
    expect(texts.bTitle).toContain("Instance B");
  });

  test("selecting a block in A does not select anything in B", async ({
    page,
  }) => {
    // Reach into editor A's shadow root via locator's auto-piercing.
    const containerA = page.locator('[data-testid="multi-editor-a"]');
    const blockA = containerA.locator(".tpl-block").first();
    await blockA.click();
    await containerA.locator(".tpl-block--selected").waitFor();

    const selectedInB = await page.evaluate(() => {
      const b = (
        document.querySelector(
          '[data-testid="multi-editor-b"]',
        ) as HTMLElement
      ).shadowRoot!;
      return b.querySelectorAll(".tpl-block--selected").length;
    });
    expect(selectedInB).toBe(0);
  });
});
