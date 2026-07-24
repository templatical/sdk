import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";
import type { Page } from "@playwright/test";
import type { EditorPage } from "../pages/editor.page";

// The ColorPicker swatch trigger carries the generic "Pick a color" aria-label
// (the toolbars don't set a custom one). The first one in a button's toolbar is
// the background-color picker.
const PICK_COLOR = 'button[aria-label="Pick a color"]';

/**
 * Select the first button block and open its background-color picker popover.
 * The popover teleports to the editor's popover root (Playwright pierces the
 * shadow root in shadow mode), so it's reachable via a document-level locator.
 */
async function openButtonColorPicker(editorPage: EditorPage, page: Page) {
  await editorPage.selectBlockByType("button");
  const panel = page.locator(SELECTORS.rightPanelContent);
  await expect(panel).toBeVisible();
  await panel.locator(PICK_COLOR).first().click();
  const popover = page.locator(".tpl-color-popover");
  await expect(popover).toBeVisible();
  return popover;
}

test.describe("Color presets — Event Invitation brand-locked palette", () => {
  // The Event Invitation template passes `colors: { presets, allowCustom: false }`
  // to init(), so every picker in it is a preset-only grid.
  test.beforeEach(async ({ page, chooserPage, editorPage }) => {
    await page.addInitScript(() => {
      localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
      localStorage.setItem("tpl-playground-features-dismissed", "true");
    });
    await chooserPage.goto();
    await chooserPage.selectTemplateByName("Event Invitation");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
  });

  test("renders the preset grid in a picker popover", async ({
    editorPage,
    page,
  }) => {
    const popover = await openButtonColorPicker(editorPage, page);
    const group = popover.locator('[role="radiogroup"]');
    await expect(group).toBeVisible();
    // Six brand presets plus the leading "no colour" chip (locked mode has no
    // other clear affordance).
    await expect(group.locator("button")).toHaveCount(7);
  });

  test("clicking a preset applies the colour", async ({ editorPage, page }) => {
    const popover = await openButtonColorPicker(editorPage, page);
    await popover.locator('button[aria-label="#ec4899"]').click();

    // The trigger swatch reflects the applied color (#ec4899 → rgb).
    const swatch = page
      .locator(SELECTORS.rightPanelContent)
      .locator(PICK_COLOR)
      .first()
      .locator("span");
    await expect(swatch).toHaveCSS("background-color", "rgb(236, 72, 153)");
  });

  test("the none chip clears back to the unset state", async ({
    editorPage,
    page,
  }) => {
    const popover = await openButtonColorPicker(editorPage, page);
    // Apply a preset, then clear it via the leading none chip. Its label is the
    // `colorPicker.clear` translation ("Clear color", from en.ts).
    await popover.locator('button[aria-label="#ec4899"]').click();
    await popover.locator('button[aria-label="Clear color"]').click();

    // The trigger swatch wears the unset diagonal-slash class again.
    const swatch = page
      .locator(SELECTORS.rightPanelContent)
      .locator(PICK_COLOR)
      .first()
      .locator("span");
    await expect(swatch).toHaveClass(/tpl-color-swatch-empty/);
  });

  test("a newly-added button starts on the on-brand default preset", async ({
    editorPage,
    page,
  }) => {
    // Drag in a fresh Button block. Its backgroundColor comes from the
    // template's on-brand `blockDefaults` (#7c3aed), which is one of the locked
    // presets — so the coordinated setup opens its picker with that chip already
    // checked, no off-palette default in sight.
    await editorPage.dragBlockFromSidebar("button");
    await editorPage.getBlockByType("button").last().click();
    await page.locator(SELECTORS.blockSelected).waitFor();

    const panel = page.locator(SELECTORS.rightPanelContent);
    await expect(panel).toBeVisible();
    await panel.locator(PICK_COLOR).first().click();
    const popover = page.locator(".tpl-color-popover");
    await expect(popover).toBeVisible();

    await expect(
      popover.locator('button[aria-label="#7c3aed"]'),
    ).toHaveAttribute("aria-checked", "true");
  });

  test("allowCustom:false hides the wheel and hex input", async ({
    editorPage,
    page,
  }) => {
    const popover = await openButtonColorPicker(editorPage, page);
    // Preset grid only — no colour wheel, no hex text field.
    await expect(popover.locator('[role="radiogroup"]')).toBeVisible();
    await expect(popover.locator("hex-color-picker")).toHaveCount(0);
    await expect(popover.locator('input[type="text"]')).toHaveCount(0);
  });
});

test.describe("Color presets — unconfigured picker is unchanged", () => {
  // `editorReady` opens the first template (Product Launch), which passes no
  // `colors` config, so its pickers keep the default wheel + hex input.
  test("shows the wheel and no preset grid on a template without `colors`", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const popover = await openButtonColorPicker(editorPage, page);
    await expect(popover.locator("hex-color-picker")).toBeVisible();
    await expect(popover.locator('[role="radiogroup"]')).toHaveCount(0);
  });
});
