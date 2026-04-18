import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

test.describe("Playground smoke tests", () => {
  test("playground loads and shows template chooser", async ({
    chooserPage,
    page,
  }) => {
    await chooserPage.goto();
    await expect(page.locator(SELECTORS.chooserScreen)).toBeVisible();
    const cards = chooserPage.getTemplateCards();
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test("selecting a template opens the editor", async ({
    chooserPage,
    editorPage,
    page,
  }) => {
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();
    await expect(page.locator(SELECTORS.editorScreen)).toBeVisible();
  });

  test("blank template shows empty canvas", async ({
    chooserPage,
    editorPage,
    page,
  }) => {
    await chooserPage.goto();
    await chooserPage.selectBlankTemplate();
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await expect(page.locator(SELECTORS.editorContainer)).toBeVisible();
  });

  test("non-blank template has blocks in canvas", async ({
    editorReady: { editorPage },
  }) => {
    const count = await editorPage.getBlockCount();
    expect(count).toBeGreaterThan(0);
  });

  test("can navigate back to template chooser", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.clickBack();
    await expect(page.locator(SELECTORS.chooserScreen)).toBeVisible();
  });

  test("JSON viewer shows template content", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.openJson();
    await expect(page.locator(SELECTORS.jsonModal)).toBeVisible();
    const content = page.locator(SELECTORS.jsonModalContent);
    await expect(content).toBeVisible();
  });

  test("theme toggle works", async ({ editorReady: { editorPage }, page }) => {
    const root = page.locator("html");
    const classBefore = await root.getAttribute("class");
    await editorPage.clickThemeToggle();
    // Theme should have changed — class attribute should differ
    await expect(root).not.toHaveAttribute("class", classBefore ?? "");
  });
});
