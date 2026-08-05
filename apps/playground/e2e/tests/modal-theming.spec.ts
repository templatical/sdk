import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";
import type { Page } from "@playwright/test";

/**
 * Dialogs must render the consumer's `theme`, not the SDK's stock tokens.
 *
 * `theme` is applied as inline styles on the editor root. `TplModal`'s backdrop
 * carries the bare `tpl` class, which re-declares the whole `--tpl-*` set — and
 * a custom property declared on a descendant beats one inherited from an
 * ancestor, so every dialog teleported through that backdrop used to reset to
 * default colours inside an otherwise themed editor (issue #487).
 *
 * `tests/theme-token-scope.test.ts` in `@templatical/editor` enforces the rule
 * structurally. This spec is the behavioural proof: what the browser actually
 * computes inside a real dialog.
 */

/** Unmistakably not a stock token — the defaults are all `oklch(…)`. */
const THEMED_ELEVATED = "rgb(255, 0, 0)";

async function bootThemedEditor(page: Page): Promise<void> {
  await page.addInitScript((elevated) => {
    localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
    localStorage.setItem("tpl-playground-features-dismissed", "true");
    localStorage.setItem(
      "tpl-playground-theme-override",
      JSON.stringify({ bgElevated: elevated }),
    );
  }, THEMED_ELEVATED);
}

interface Probe {
  rootElevated: string;
  backdropElevated: string;
  backdropIsEditorRoot: boolean;
  dialogBg: string;
}

/**
 * Read the token the editor root resolves, the token the modal backdrop
 * resolves, and what the dialog actually paints — from the editor's effective
 * root, so the same spec covers both the light-DOM and shadow-DOM projects.
 */
async function probeDialog(
  page: Page,
  dialogSelector: string,
): Promise<Probe | null> {
  return page.evaluate((sel) => {
    const host = Array.from(document.querySelectorAll("*")).find(
      (el) => (el as HTMLElement).shadowRoot,
    ) as HTMLElement | undefined;
    const root: Document | ShadowRoot = host?.shadowRoot ?? document;
    // First `.tpl` in document order is the editor root; the backdrop is a
    // descendant of it and therefore comes later.
    const editorRoot = root.querySelector(".tpl") as HTMLElement | null;
    const dialog = root.querySelector(sel) as HTMLElement | null;
    if (!editorRoot || !dialog) return null;
    const backdrop = dialog.closest(".tpl") as HTMLElement | null;
    if (!backdrop) return null;
    return {
      rootElevated: getComputedStyle(editorRoot)
        .getPropertyValue("--tpl-bg-elevated")
        .trim(),
      backdropElevated: getComputedStyle(backdrop)
        .getPropertyValue("--tpl-bg-elevated")
        .trim(),
      backdropIsEditorRoot: backdrop === editorRoot,
      dialogBg: getComputedStyle(dialog).backgroundColor,
    };
  }, dialogSelector);
}

test.describe("modal theming", () => {
  test("the saved-blocks browser paints the configured theme", async ({
    page,
    chooserPage,
    editorPage,
  }) => {
    await bootThemedEditor(page);
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();

    await page.locator(SELECTORS.savedBlocksRailBtn).click();
    await expect(page.locator(SELECTORS.savedBlocksBrowser)).toBeVisible();

    const probe = await probeDialog(page, SELECTORS.savedBlocksBrowser);
    expect(probe).not.toBe(null);
    // Precondition: the theme really did reach the editor root, or the
    // assertion below would be testing nothing.
    expect(probe!.rootElevated).toBe(THEMED_ELEVATED);
    // The regression: the dialog painted the SDK default here.
    expect(probe!.dialogBg).toBe(THEMED_ELEVATED);
  });

  test("the test-email dialog paints the configured theme", async ({
    page,
    chooserPage,
    editorPage,
  }) => {
    await bootThemedEditor(page);
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();

    await page.locator(SELECTORS.testEmailTrigger).click();
    await expect(page.locator(SELECTORS.testEmailDialog)).toBeVisible();

    const probe = await probeDialog(page, SELECTORS.testEmailDialog);
    expect(probe).not.toBe(null);
    expect(probe!.rootElevated).toBe(THEMED_ELEVATED);
    expect(probe!.dialogBg).toBe(THEMED_ELEVATED);
  });

  test("the modal backdrop re-establishes the tokens rather than inheriting them", async ({
    page,
    chooserPage,
    editorPage,
  }) => {
    await bootThemedEditor(page);
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();

    await page.locator(SELECTORS.savedBlocksRailBtn).click();
    await expect(page.locator(SELECTORS.savedBlocksBrowser)).toBeVisible();

    const probe = await probeDialog(page, SELECTORS.savedBlocksBrowser);
    expect(probe).not.toBe(null);
    // The backdrop is a separate token root from the editor root — that is the
    // whole hazard, and it stays true after the fix. What changed is that it
    // now resolves to the same value instead of the stock default.
    expect(probe!.backdropIsEditorRoot).toBe(false);
    expect(probe!.backdropElevated).toBe(probe!.rootElevated);
  });
});
