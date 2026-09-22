import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";
import { ScenePage } from "../pages/scene.page";

test.describe("Playground smoke tests", () => {
  test("playground loads and shows catalog", async ({ chooserPage, page }) => {
    await chooserPage.goto();
    await expect(page.locator(SELECTORS.catalogScreen)).toBeVisible();
    await expect(
      page.locator('[data-testid="scene-link-minimum"]'),
    ).toBeVisible();
  });

  test("selecting an example scene opens the editor", async ({
    chooserPage,
    editorPage,
    page,
  }) => {
    await chooserPage.goto();
    await page
      .locator('[data-testid="scene-link-example-launchpad-launch"]')
      .click();
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
    await expect(page.locator(SELECTORS.editorStage)).toBeVisible();
    await expect(page.locator(SELECTORS.toolbarCode)).toBeVisible();
    await page.locator(SELECTORS.toolbarCode).click();
    await expect(page.locator(SELECTORS.codeDialog)).toBeVisible();
    await expect(page.locator(SELECTORS.codeDialog)).toContainText("init(");
  });

  test("shadow-dom-off snippet contains shadowDom: false", async ({
    page,
    shadowDom,
  }) => {
    const scenePage = new ScenePage(page, { shadowDom });
    await scenePage.goto("shadow-dom-off");
    await page.locator(SELECTORS.toolbarCode).click();
    await expect(page.locator(SELECTORS.codeDialog)).toContainText(
      "shadowDom: false",
    );
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
    await expect(page.locator(SELECTORS.catalogScreen)).toBeVisible();
  });

  test("export modal shows JSON tab content", async ({
    scenePage,
    editorPage,
    page,
  }) => {
    await scenePage.goto("example-launchpad-launch");
    await editorPage.waitForReady();
    await editorPage.closeCodeDrawer();
    await editorPage.openExport();
    await page.locator(SELECTORS.exportTabJson).click();
    await expect(page.locator(SELECTORS.exportTabJson)).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect
      .poll(async () => page.locator(".cm-content").first().textContent())
      .toContain('"blocks"');
  });

  test("unknown scene id shows not-found with recovery", async ({ page }) => {
    await page.goto("/scenes/nope");
    const notFound = page.locator(SELECTORS.sceneNotFound);
    await expect(notFound).toBeVisible();
    await expect(notFound.getByRole("heading", { level: 1 })).toContainText(
      "nope",
    );
    await expect(notFound.getByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  test("theme toggle works", async ({ chooserPage, editorPage, page }) => {
    await chooserPage.goto();
    await page
      .locator('[data-testid="scene-link-example-launchpad-launch"]')
      .click();
    await editorPage.waitForReady();
    const root = page.locator("html");
    const classBefore = await root.getAttribute("class");
    await editorPage.clickThemeToggle();
    // Theme should have changed — class attribute should differ
    await expect(root).not.toHaveAttribute("class", classBefore ?? "");
  });
});
