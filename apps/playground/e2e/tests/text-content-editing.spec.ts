import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS, blockByType } from "../helpers/selectors";

test.describe("Text content editing", () => {
  // Playwright limitation, not a real bug.
  //
  // Manual testing in Chromium (2026-05-12) confirms typing into a
  // shadow-mounted TipTap contenteditable works correctly — ProseMirror
  // auto-detects the shadow root via `view.root` and uses Chromium's
  // native `ShadowRoot.getSelection()`. The original "TipTap selection
  // can't pierce shadow boundary" diagnosis was wrong.
  //
  // The actual gap: `page.keyboard.type()` and `pressSequentially()`
  // don't reliably deliver synthetic keystrokes to contenteditables
  // inside a shadow root. The keys go to `document.activeElement`
  // (the shadow host), not the real focused element inside the shadow.
  // Tests in this file rely on those keyboard helpers, so they're
  // skipped in shadow mode. The behaviors themselves work for real
  // users.
  test.skip(
    ({ shadowDom }) => shadowDom,
    "Playwright keyboard.type doesn't reach shadow-mounted contenteditable; behavior verified manually",
  );


  test("typing in paragraph updates content", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.doubleClickBlock("paragraph");
    await expect(page.locator(SELECTORS.textToolbar)).toBeVisible();

    const editable = editorPage.getEditableFor("paragraph");
    await editable.click();

    await page.keyboard.press("ControlOrMeta+a");
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

    await page.keyboard.press("ControlOrMeta+a");
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

    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("Bold text");
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("ControlOrMeta+b");

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

    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type(testText);

    await editorPage.getBlockByType("title").first().click();
    await expect(
      page.locator(blockByType("paragraph")).first(),
    ).toContainText(testText);

    await editorPage.openExportMenu();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator(SELECTORS.exportJsonItem).click(),
    ]);
    const content = await (await download.createReadStream()).toArray();
    const json = Buffer.concat(content).toString("utf-8");
    expect(json).toContain(testText);
  });
});
