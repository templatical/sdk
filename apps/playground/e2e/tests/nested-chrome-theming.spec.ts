import { test, expect } from "../fixtures/editor.fixture";
import type { Page } from "@playwright/test";

/**
 * Nested block chrome must follow the editor's UI theme, not the email's.
 *
 * `.tpl[data-tpl-theme="dark"] .tpl-block-content` re-declares theme tokens so
 * email content always renders light. A section's children render INSIDE that
 * wrapper, so their chrome (action bar, badges, indicators) used to inherit the
 * light values and paint near-white in an otherwise dark editor.
 *
 * The fix is the `--tpl-chrome-*` alias set, declared on `.tpl` so its computed
 * value is substituted at that level and can't be shadowed by a descendant.
 * This spec is the behavioural proof: a section child's action bar must match a
 * top-level block's, and neither may match the (light) email content.
 */

async function bootDarkEditor(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
    localStorage.setItem("tpl-playground-features-dismissed", "true");
    // Raw string, not JSON — VueUse's useLocalStorage uses the string serializer.
    localStorage.setItem("tpl-playground-theme", "dark");
  });
}

/** Background of the currently-visible action bar, plus whether it's nested. */
async function readActionBar(
  page: Page,
): Promise<{ bg: string; insideBlockContent: boolean } | null> {
  return page.evaluate(() => {
    const host = Array.from(document.querySelectorAll("*")).find(
      (el) => (el as HTMLElement).shadowRoot,
    ) as HTMLElement | undefined;
    const root: Document | ShadowRoot = host?.shadowRoot ?? document;
    const bar = root.querySelector(".tpl-block-actions") as HTMLElement | null;
    if (!bar) return null;
    return {
      bg: getComputedStyle(bar).backgroundColor,
      insideBlockContent: !!bar.closest(".tpl-block-content"),
    };
  });
}

test.describe("nested block chrome theming (dark UI)", () => {
  test("a section child's action bar matches a top-level block's", async ({
    page,
    chooserPage,
    editorPage,
  }) => {
    await bootDarkEditor(page);
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();

    // Confirm the editor really is in dark UI theme, or the whole test is moot.
    const theme = await page.evaluate(() => {
      const host = Array.from(document.querySelectorAll("*")).find(
        (el) => (el as HTMLElement).shadowRoot,
      ) as HTMLElement | undefined;
      const root: Document | ShadowRoot = host?.shadowRoot ?? document;
      return root.querySelector(".tpl")?.getAttribute("data-tpl-theme") ?? null;
    });
    expect(theme).toBe("dark");

    // --- top-level block ---
    const topLevel = page
      .locator(".tpl-block")
      .filter({ has: page.locator(":scope > .tpl-block-content") })
      .first();
    await topLevel.click({ position: { x: 5, y: 5 } });
    const topBar = await readActionBar(page);
    expect(topBar).not.toBe(null);
    expect(topBar!.insideBlockContent).toBe(false);

    // --- section child ---
    const nested = page
      .locator('[data-block-type="section"] .tpl-block-content .tpl-block')
      .first();
    await nested.click({ position: { x: 5, y: 5 } });
    const nestedBar = await readActionBar(page);
    expect(nestedBar).not.toBe(null);
    // Precondition for the regression: this bar really is inside email content.
    expect(nestedBar!.insideBlockContent).toBe(true);

    // The fix: identical chrome background despite the nesting.
    expect(nestedBar!.bg).toBe(topBar!.bg);
  });

  test("nested chrome does not inherit the email content's light background", async ({
    page,
    chooserPage,
    editorPage,
  }) => {
    await bootDarkEditor(page);
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();

    const nested = page
      .locator('[data-block-type="section"] .tpl-block-content .tpl-block')
      .first();
    await nested.click({ position: { x: 5, y: 5 } });

    const probe = await page.evaluate(() => {
      const host = Array.from(document.querySelectorAll("*")).find(
        (el) => (el as HTMLElement).shadowRoot,
      ) as HTMLElement | undefined;
      const root: Document | ShadowRoot = host?.shadowRoot ?? document;
      const tpl = root.querySelector(".tpl") as HTMLElement;
      const bar = root.querySelector(".tpl-block-actions") as HTMLElement;
      const barCs = getComputedStyle(bar);
      return {
        // What the editor UI theme says chrome should be.
        rootElevated: getComputedStyle(tpl)
          .getPropertyValue("--tpl-bg-elevated")
          .trim(),
        // What the email-content override forces locally.
        contentElevated: barCs.getPropertyValue("--tpl-bg-elevated").trim(),
        // What chrome actually resolves to.
        chromeElevated: barCs
          .getPropertyValue("--tpl-chrome-bg-elevated")
          .trim(),
      };
    });

    // The content override IS in effect at the bar's position...
    expect(probe.contentElevated).not.toBe(probe.rootElevated);
    // ...yet the chrome alias still carries the editor's dark UI value. This is
    // the property the fix relies on: the alias is substituted on `.tpl`, so a
    // descendant redefining `--tpl-bg-elevated` cannot reach it.
    expect(probe.chromeElevated).toBe(probe.rootElevated);
  });
});
