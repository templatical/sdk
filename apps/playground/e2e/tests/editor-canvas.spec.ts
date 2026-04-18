import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

test.describe("Editor canvas", () => {
  test("blank template shows empty state", async ({
    blankEditorReady,
    page,
  }) => {
    await expect(page.locator(SELECTORS.canvasEmpty)).toBeVisible();
  });

  test("empty state has icon and message", async ({
    blankEditorReady,
    page,
  }) => {
    await expect(page.locator(SELECTORS.canvasEmptyIcon)).toBeVisible();
    await expect(page.locator(SELECTORS.canvasEmptyTitle)).toBeVisible();
  });

  test("non-blank template has blocks", async ({
    editorReady: { editorPage },
  }) => {
    const count = await editorPage.getBlockCount();
    expect(count).toBeGreaterThan(0);
  });

  test("viewport toggle shows 3 options", async ({
    editorReady,
    page,
  }) => {
    const group = page.locator(SELECTORS.viewportGroup);
    await expect(group).toBeVisible();
    const radios = page.locator('[role="radio"]');
    expect(await radios.count()).toBe(3);
  });

  test("desktop viewport is default", async ({ editorReady, page }) => {
    await expect(page.locator(SELECTORS.viewportDesktop)).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("mobile viewport narrows canvas", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const desktopWidth = await editorPage.getCanvasWrapperWidth();
    await editorPage.switchViewport("Mobile");
    const mobileWidth = await editorPage.getCanvasWrapperWidth();
    expect(mobileWidth).toBeLessThan(desktopWidth);
    expect(mobileWidth).toBeLessThanOrEqual(400);
  });

  test("tablet viewport sets intermediate width", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.switchViewport("Mobile");
    const mobileWidth = await editorPage.getCanvasWrapperWidth();
    await editorPage.switchViewport("Tablet");
    const tabletWidth = await editorPage.getCanvasWrapperWidth();
    // Tablet should be wider than mobile
    expect(tabletWidth).toBeGreaterThan(mobileWidth);
  });

  test("desktop viewport restores width", async ({
    editorReady: { editorPage },
  }) => {
    const originalWidth = await editorPage.getCanvasWrapperWidth();
    await editorPage.switchViewport("Mobile");
    await editorPage.switchViewport("Desktop");
    const restoredWidth = await editorPage.getCanvasWrapperWidth();
    expect(restoredWidth).toBe(originalWidth);
  });

  test("dark mode toggle works", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const toggle = page.locator(SELECTORS.darkModeToggle);
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await editorPage.toggleDarkMode();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  test("preview mode toggle works", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const toggle = page.locator(SELECTORS.previewToggle);
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await editorPage.togglePreview();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
  });
});
