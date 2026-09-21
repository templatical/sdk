import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";
import { ScenePage } from "../pages/scene.page";

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

  test("minimum scene URL mounts an empty editor", async ({
    page,
    shadowDom,
  }) => {
    const scenePage = new ScenePage(page, { shadowDom });
    await scenePage.goto("minimum");
    await expect(page.locator('[data-testid="scene-host"]')).toBeVisible();
    await expect(page.locator('[data-testid="code-drawer"]')).toBeVisible();
  });

  test("blank template shows empty canvas", async ({
    blankEditorReady,
    page,
  }) => {
    await expect(page.locator(SELECTORS.editorContainer)).toBeVisible();
  });

  test("non-blank template has blocks in canvas", async ({
    editorReady: { editorPage },
  }) => {
    const count = await editorPage.getBlockCount();
    expect(count).toBeGreaterThan(0);
  });

  test("can navigate back to template chooser", async ({
    editorReady,
    page,
  }) => {
    void editorReady;
    await page.locator('[data-testid="scene-host"] a[href="/"]').click();
    await expect(page.locator(SELECTORS.chooserScreen)).toBeVisible();
  });

  test("export modal shows JSON tab content", async ({
    chooserPage,
    editorPage,
    page,
  }) => {
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();
    await editorPage.openExport();
    await page.locator(SELECTORS.exportTabJson).click();
    const content = await page.locator(".cm-content").first().textContent();
    expect(content).toContain('"blocks"');
  });

  test("theme toggle works", async ({ chooserPage, editorPage, page }) => {
    await chooserPage.goto();
    await chooserPage.selectFirstTemplate();
    await editorPage.waitForReady();
    const root = page.locator("html");
    const classBefore = await root.getAttribute("class");
    await editorPage.clickThemeToggle();
    // Theme should have changed — class attribute should differ
    await expect(root).not.toHaveAttribute("class", classBefore ?? "");
  });
});
