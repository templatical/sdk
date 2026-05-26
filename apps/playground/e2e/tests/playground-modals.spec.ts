import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

test.describe("Playground modals", () => {
  test("export modal shows MJML on open", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.openExport();
    const modal = page.locator(SELECTORS.exportModal);
    await expect(modal).toBeVisible();
    const cmEditor = modal.locator(".cm-editor");
    await expect(cmEditor).toBeVisible();
    const text = await cmEditor.innerText();
    expect(text.length).toBeGreaterThan(10);
    expect(text).toContain("<mjml");
  });

  test("export copy button works", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.openExport();
    const copyBtn = page.locator(SELECTORS.exportCopyBtn);
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();
    await expect(copyBtn).toBeVisible();
  });

  test("export modal closes on Escape", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.openExport();
    await expect(page.locator(SELECTORS.exportModal)).toBeVisible();
    await page.locator(SELECTORS.modalBackdrop).focus();
    await page.keyboard.press("Escape");
    await expect(page.locator(SELECTORS.exportModal)).not.toBeVisible();
  });

  test("export modal closes on backdrop click", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.openExport();
    await expect(page.locator(SELECTORS.exportModal)).toBeVisible();
    await page.locator(SELECTORS.modalBackdrop).click({
      position: { x: 10, y: 10 },
    });
    await expect(page.locator(SELECTORS.exportModal)).toHaveCount(0);
  });

  test("export JSON tab reflects template content", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const canvasBlockCount = await editorPage.getBlockCount();
    expect(canvasBlockCount).toBeGreaterThan(0);

    await editorPage.openExport();
    await page.locator(SELECTORS.exportTabJson).click();
    const text = await page
      .locator(SELECTORS.exportModal)
      .locator(".cm-editor")
      .innerText();
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
