import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";
import { ScenePage, skipNotes } from "../pages/scene.page";

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
    await expect(page.locator('[data-testid="catalog-rail"]')).toBeVisible();
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
    await expect(page.locator(SELECTORS.codeDrawer)).toBeVisible();
    await expect(page.locator(SELECTORS.codeDrawer)).toContainText("init(");
  });

  test("shadow-dom-off snippet contains shadowDom: false", async ({
    page,
    shadowDom,
  }) => {
    const scenePage = new ScenePage(page, { shadowDom });
    await scenePage.goto("shadow-dom-off");
    await page.locator(SELECTORS.toolbarCode).click();
    await expect(page.locator(SELECTORS.codeDrawer)).toContainText(
      "shadowDom: false",
    );
  });

  test("shadow-dom-off mounts in light DOM unless the URL pins a mode", async ({
    page,
  }) => {
    // Straight to the URL, not the page object: it always pins ?shadowDom=,
    // which is exactly the case that hid the scene mounting in shadow DOM.
    await skipNotes(page);
    const mountsShadow = async (id: string) => {
      await page.goto(`/scenes/${id}`);
      await page.waitForSelector(
        '[data-testid="scene-host"][data-scene-ready="true"]',
      );
      return page
        .locator(SELECTORS.editorContainer)
        .evaluate((el) => el.shadowRoot !== null);
    };
    expect(await mountsShadow("shadow-dom-off")).toBe(false);
    expect(await mountsShadow("fonts")).toBe(true);
  });

  // A constructed sheet drops each `@import` and warns on the host page, so
  // the editor's own CSS and every document style the dev mirror copies must
  // reach the shadow root with none left.
  test("a shadow mount logs no @import warnings", async ({
    page,
    scenePage,
    editorPage,
    shadowDom,
  }) => {
    test.skip(!shadowDom, "only a shadow mount builds constructed sheets");
    const warnings: string[] = [];
    page.on("console", (message) => {
      if (message.text().includes("@import")) warnings.push(message.text());
    });
    await scenePage.goto("fonts");
    await editorPage.waitForReady();
    expect(warnings).toEqual([]);
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
    await page.locator('[data-testid="toolbar-back"]').click();
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

  test("the settings menu switches the playground theme", async ({
    chooserPage,
    editorPage,
    page,
  }) => {
    await chooserPage.goto();
    await page
      .locator('[data-testid="scene-link-example-launchpad-launch"]')
      .click();
    await editorPage.waitForReady();
    await expect(page.locator("html")).not.toHaveClass(/(^|\s)dark(\s|$)/);
    await editorPage.chooseTheme("dark");
    await expect(page.locator("html")).toHaveClass(/(^|\s)dark(\s|$)/);
  });
});
