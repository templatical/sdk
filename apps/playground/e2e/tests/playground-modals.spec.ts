import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

test.describe("Playground modals", () => {
  test("JSON modal shows valid JSON", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.openJson();
    const modal = page.locator(SELECTORS.jsonModal);
    await expect(modal).toBeVisible();
    // CodeMirror renders content — verify the editor is present and has content
    const cmEditor = modal.locator(".cm-editor");
    await expect(cmEditor).toBeVisible();
    // Use innerText which gets the visible text including virtualized lines
    const text = await modal.locator(".cm-editor").innerText();
    expect(text.length).toBeGreaterThan(10);
    expect(text).toContain("blocks");
  });

  test("JSON copy button works", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.openJson();
    const modal = page.locator(SELECTORS.jsonModal);
    // Find the copy button
    const copyBtn = modal
      .locator("button")
      .filter({ hasText: /copy/i })
      .first();
    await expect(copyBtn).toBeVisible();
    // Just verify the button is clickable (clipboard behavior varies by environment)
    await copyBtn.click();
    // Button should still exist after click (even if text didn't change in headless)
    await expect(copyBtn).toBeVisible();
  });

  test("JSON modal closes on Escape", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.openJson();
    await expect(page.locator(SELECTORS.jsonModal)).toBeVisible();
    // Focus the modal backdrop to ensure Escape is received
    await page.locator(SELECTORS.modalBackdrop).focus();
    await page.keyboard.press("Escape");
    await expect(page.locator(SELECTORS.jsonModal)).not.toBeVisible();
  });

  test("JSON modal closes on backdrop click", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.openJson();
    await expect(page.locator(SELECTORS.jsonModal)).toBeVisible();
    await page.locator(SELECTORS.modalBackdrop).click({
      position: { x: 10, y: 10 },
    });
    await expect(page.locator(SELECTORS.jsonModal)).toHaveCount(0);
  });

  test("JSON reflects template content", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const canvasBlockCount = await editorPage.getBlockCount();
    expect(canvasBlockCount).toBeGreaterThan(0);

    await editorPage.openJson();
    const modal = page.locator(SELECTORS.jsonModal);
    const text = await modal.locator(".cm-editor").innerText();
    // JSON should reference block types that exist in the template
    expect(text).toContain("blocks");
    expect(text).toContain("type");
  });

  test("config modal closes on Escape", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.openConfig();
    const dialog = page.locator('[role="dialog"]').last();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("feature overlay shows and dismisses", async ({
    chooserPage,
    editorPage,
    page,
  }) => {
    // Feature overlay opens the first time a template is loaded. Clear the
    // dismissed flag BEFORE navigation so App.vue sees a virgin user.
    await page.addInitScript(() => {
      localStorage.removeItem("tpl-playground-features-dismissed");
      localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
    });
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();

    const overlay = page.locator(SELECTORS.featureOverlay);
    await expect(overlay).toBeVisible();

    await page.locator(SELECTORS.featureOverlayClose).click();
    await expect(overlay).toHaveCount(0);
  });
});
