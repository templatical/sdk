import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

/**
 * Visual regression baseline for the Shadow DOM migration (Phase 0.2).
 *
 * Captures pixel-level snapshots of canonical editor chrome states so each
 * subsequent migration phase can diff against the baseline and surface
 * unintended visual drift (popover stacking changes, padding shifts when
 * teleport targets move, etc.).
 *
 * Scope is intentionally strategic, not exhaustive. The full matrix of
 * "14 block types × 5 sidebar tabs × every modal × mobile/desktop × dark/light"
 * is too brittle for screenshot diffing across machines; behavioral tests
 * cover most of that ground separately. This file focuses on the chrome
 * surfaces where Shadow DOM has the highest pixel-shift risk:
 *
 *   1. Editor chrome layout (sidebar + toolbar + canvas frame)
 *   2. Modal teleport surfaces (JSON modal — same Teleport pattern the 4
 *      shadow-DOM-affected popups use)
 *   3. Right sidebar tab content
 *   4. Mobile viewport rendering
 *   5. Dark theme
 *
 * First run materializes baselines; CI thereafter compares.
 */

// Allow ~1% pixel difference per snapshot — covers font subpixel rendering
// drift across machines without admitting real regressions.
const DIFF_OPTIONS = {
  maxDiffPixelRatio: 0.01,
  animations: "disabled" as const,
  // Mask elements that legitimately vary between runs (none today; placeholder
  // for future use).
  mask: [] as never[],
};

test.describe("visual regression baseline (Phase 0.2)", () => {
  test("blank editor — empty canvas + sidebar rail", async ({
    blankEditorReady: { editorPage },
    page,
  }) => {
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    // Wait for the canvas empty-state to be present so the screenshot is stable.
    await page.locator(SELECTORS.canvasEmpty).waitFor();
    await expect(page).toHaveScreenshot("blank-editor.png", DIFF_OPTIONS);
  });

  test("editor with sample template loaded", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    // At least one block rendered.
    await page.locator(SELECTORS.block).first().waitFor();
    await expect(page).toHaveScreenshot("editor-with-template.png", DIFF_OPTIONS);
  });

  test("editor in mobile viewport", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await page.locator(SELECTORS.viewportMobile).click();
    // Wait for layout to settle after viewport swap.
    await page.waitForFunction(
      () =>
        document
          .querySelector('[role="radio"][aria-label="Mobile"]')
          ?.getAttribute("aria-checked") === "true",
    );
    await expect(page).toHaveScreenshot("editor-mobile-viewport.png", DIFF_OPTIONS);
  });

  test("editor with dark mode toggled", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    const root = page.locator("html");
    const classBefore = await root.getAttribute("class");
    await editorPage.clickThemeToggle();
    await expect(root).not.toHaveAttribute("class", classBefore ?? "");
    await expect(page).toHaveScreenshot("editor-dark-mode.png", DIFF_OPTIONS);
  });

  test("JSON modal open — Teleport-rendered overlay", async ({
    editorReady: { editorPage },
    page,
  }) => {
    // The JSON modal uses the same Teleport-to-body pattern that the four
    // shadow-DOM-affected popups use. Pixel-stability here is the canary for
    // teleport-target rewrites in Phase 2.
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await editorPage.openJson();
    await page.locator(SELECTORS.jsonModal).waitFor();
    await expect(page).toHaveScreenshot("json-modal-open.png", DIFF_OPTIONS);
  });

  test("right sidebar — block selected", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    // Select first block on canvas. The right sidebar shows whichever tab is
    // active by default — capturing it as baseline is the goal, not asserting
    // which tab.
    await editorPage.selectBlock(0);
    await page.locator(SELECTORS.rightSidebar).waitFor();
    await page.locator(SELECTORS.rightTabContent).waitFor();
    await expect(page).toHaveScreenshot("right-sidebar-block-selected.png", DIFF_OPTIONS);
  });
});
