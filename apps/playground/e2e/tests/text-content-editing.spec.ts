import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS, blockByType } from "../helpers/selectors";

test.describe("Text content editing", () => {
  test("typing in paragraph updates content", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.doubleClickBlock("paragraph");
    await expect(page.locator(SELECTORS.textToolbar)).toBeVisible();

    const editable = editorPage.getEditableFor("paragraph");
    await editable.click();

    await page.keyboard.press("Meta+a");
    await page.keyboard.type("Hello E2E Test");

    // Exit edit mode — clicking another block commits the content.
    await editorPage.getBlockByType("title").first().click();

    const paragraph = page.locator(blockByType("paragraph")).first();
    await expect(paragraph).toContainText("Hello E2E Test");
  });

  test("typing in title updates content", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.doubleClickBlock("title");
    await expect(page.locator(SELECTORS.textToolbar)).toBeVisible();

    const editable = editorPage.getEditableFor("title");
    await editable.click();

    await page.keyboard.press("Meta+a");
    await page.keyboard.type("New Title Text");

    await editorPage.getBlockByType("paragraph").first().click();

    const title = page.locator(blockByType("title")).first();
    await expect(title).toContainText("New Title Text");
  });

  test("bold formatting persists after exiting edit mode", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.doubleClickBlock("paragraph");
    const editable = editorPage.getEditableFor("paragraph");
    await editable.click();

    await page.keyboard.press("Meta+a");
    await page.keyboard.type("Bold text");
    await page.keyboard.press("Meta+a");
    await page.keyboard.press("Meta+b");

    await editorPage.getBlockByType("title").first().click();

    const paragraph = page.locator(blockByType("paragraph")).first();
    await expect
      .poll(() => paragraph.innerHTML(), { timeout: 3000 })
      .toMatch(/<(strong|b)[^>]*>/);
  });

  test("typed content persists in JSON export", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const testText = "UniqueE2EContent";

    await editorPage.doubleClickBlock("paragraph");
    const editable = editorPage.getEditableFor("paragraph");
    await editable.click();

    await page.keyboard.press("Meta+a");
    await page.keyboard.type(testText);

    await editorPage.getBlockByType("title").first().click();
    await expect(
      page.locator(blockByType("paragraph")).first(),
    ).toContainText(testText);

    await editorPage.openExportMenu();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator(SELECTORS.exportMenuItem).first().click(),
    ]);
    const content = await (await download.createReadStream()).toArray();
    const json = Buffer.concat(content).toString("utf-8");
    expect(json).toContain(testText);
  });
});
