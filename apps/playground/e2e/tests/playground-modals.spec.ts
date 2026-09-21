import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

test.describe("Playground modals", () => {
  test.beforeEach(async ({ chooserPage, editorPage }) => {
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();
  });

  test("export modal shows MJML on open", async ({ editorPage, page }) => {
    await editorPage.openExport();
    const modal = page.locator(SELECTORS.exportModal);
    await expect(modal).toBeVisible();
    const cmEditor = modal.locator(".cm-editor");
    await expect(cmEditor).toBeVisible();
    const text = await cmEditor.innerText();
    expect(text.length).toBeGreaterThan(10);
    expect(text).toContain("<mjml");
  });

  test("export copy button works", async ({ editorPage, page }) => {
    await editorPage.openExport();
    const copyBtn = page.locator(SELECTORS.exportCopyBtn);
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();
    await expect(copyBtn).toBeVisible();
  });

  test("export modal closes on Escape", async ({ editorPage, page }) => {
    await editorPage.openExport();
    await expect(page.locator(SELECTORS.exportModal)).toBeVisible();
    await page.locator(SELECTORS.modalBackdrop).focus();
    await page.keyboard.press("Escape");
    await expect(page.locator(SELECTORS.exportModal)).not.toBeVisible();
  });

  test("export modal closes on backdrop click", async ({
    editorPage,
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
    editorPage,
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

  test("config modal closes on Escape", async ({ editorPage, page }) => {
    await editorPage.openConfig();
    const dialog = page.getByRole("dialog", { name: "Editor Configuration" });
    await expect(dialog).toBeVisible();
    // Options tab is a CodeMirror; a focused editor swallows Escape. Fire the
    // key on the playground backdrop, which is where `@keydown.escape` is bound.
    await page.locator(SELECTORS.modalBackdrop).evaluate((el) => {
      el.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    await expect(dialog).toBeHidden();
  });

  test("feature overlay does not render", async ({ page }) => {
    await expect(page.locator(SELECTORS.featureOverlay)).toHaveCount(0);
  });
});
