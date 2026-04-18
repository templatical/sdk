import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS, blockByType } from "../helpers/selectors";

test.describe("Text content editing", () => {
  test("typing in paragraph updates content", async ({
    editorReady: { editorPage },
    page,
  }) => {
    // Double-click paragraph to enter edit mode
    await editorPage.doubleClickBlock("paragraph");
    await expect(page.locator(SELECTORS.textToolbar)).toBeVisible();

    // Click inside the TipTap contenteditable to ensure focus
    const tiptap = page.locator(
      `${blockByType("paragraph")} .tiptap, ${blockByType("paragraph")} [contenteditable="true"]`,
    );
    await tiptap.first().click();

    // Select all and type new content
    await page.keyboard.press("Meta+a");
    await page.keyboard.type("Hello E2E Test", { delay: 20 });

    // Exit edit mode by clicking a different block
    await editorPage.getBlockByType("title").first().click();
    await page.waitForTimeout(300);

    // Paragraph should show the typed text
    const paragraph = page.locator(blockByType("paragraph")).first();
    const text = await paragraph.textContent();
    expect(text).toContain("Hello E2E Test");
  });

  test("typing in title updates content", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.doubleClickBlock("title");
    await expect(page.locator(SELECTORS.textToolbar)).toBeVisible();

    const tiptap = page.locator(
      `${blockByType("title")} .tiptap, ${blockByType("title")} [contenteditable="true"]`,
    );
    await tiptap.first().click();

    await page.keyboard.press("Meta+a");
    await page.keyboard.type("New Title Text", { delay: 20 });

    await editorPage.getBlockByType("paragraph").first().click();
    await page.waitForTimeout(300);

    const title = page.locator(blockByType("title")).first();
    const text = await title.textContent();
    expect(text).toContain("New Title Text");
  });

  test("bold formatting persists after exiting edit mode", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.doubleClickBlock("paragraph");
    const tiptap = page.locator(
      `${blockByType("paragraph")} .tiptap, ${blockByType("paragraph")} [contenteditable="true"]`,
    );
    await tiptap.first().click();

    // Type text, select all, bold it
    await page.keyboard.press("Meta+a");
    await page.keyboard.type("Bold text", { delay: 20 });
    await page.keyboard.press("Meta+a");
    await page.keyboard.press("Meta+b");

    // Exit edit mode
    await editorPage.getBlockByType("title").first().click();
    await page.waitForTimeout(300);

    // Check the paragraph contains bold formatting
    const paragraph = page.locator(blockByType("paragraph")).first();
    const html = await paragraph.innerHTML();
    expect(html).toMatch(/<(strong|b)[^>]*>/);
  });

  test("typed content persists in JSON export", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const testText = "UniqueE2EContent";

    await editorPage.doubleClickBlock("paragraph");
    const tiptap = page.locator(
      `${blockByType("paragraph")} .tiptap, ${blockByType("paragraph")} [contenteditable="true"]`,
    );
    await tiptap.first().click();

    await page.keyboard.press("Meta+a");
    await page.keyboard.type(testText, { delay: 20 });

    // Exit edit mode
    await editorPage.getBlockByType("title").first().click();
    await page.waitForTimeout(300);

    // Export JSON and verify the typed text is in the download content
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
