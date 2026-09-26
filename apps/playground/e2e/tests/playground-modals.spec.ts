import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

test.describe("Playground modals", () => {
  test.beforeEach(async ({ scenePage, editorPage }) => {
    await scenePage.goto("example-launchpad-launch");
    await editorPage.waitForReady();
    await editorPage.closeCodeDrawer();
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
    await expect(page.locator(SELECTORS.exportTabJson)).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect
      .poll(async () =>
        page.locator(SELECTORS.exportModal).locator(".cm-editor").innerText(),
      )
      .toContain("blocks");
    const text = await page
      .locator(SELECTORS.exportModal)
      .locator(".cm-editor")
      .innerText();
    expect(text).toContain("type");
  });

  test("feature overlay does not render", async ({ page }) => {
    await expect(page.locator(SELECTORS.featureOverlay)).toHaveCount(0);
  });
});
