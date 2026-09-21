import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

test.describe("Playground export", () => {
  test.beforeEach(async ({ scenePage, editorPage }) => {
    await scenePage.goto("example-launchpad-launch");
    await editorPage.waitForReady();
    await editorPage.closeCodeDrawer();
  });

  test("export modal opens with MJML as default tab", async ({
    editorPage,
    page,
  }) => {
    await editorPage.openExport();
    await expect(page.locator(SELECTORS.exportModal)).toBeVisible();
    await expect(page.locator(SELECTORS.exportTabMjml)).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("export modal closes on Escape", async ({ editorPage, page }) => {
    await editorPage.openExport();
    await expect(page.locator(SELECTORS.exportModal)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(SELECTORS.exportModal)).toHaveCount(0);
  });

  test("MJML tab shows compiled MJML source", async ({ editorPage, page }) => {
    await editorPage.openExport();
    await expect(page.locator(SELECTORS.exportModal)).toBeVisible();
    const content = await page.locator(".cm-content").first().textContent();
    expect(content).toContain("<mjml");
  });

  test("HTML tab compiles to email-ready HTML", async ({
    editorPage,
    page,
  }) => {
    await editorPage.openExport();
    await page.locator(SELECTORS.exportTabHtml).click();
    await expect(page.locator(SELECTORS.exportHtmlError)).toHaveCount(0);
    await expect
      .poll(async () => page.locator(".cm-content").first().textContent())
      .toMatch(/<!doctype html|<html/i);
  });

  test("JSON tab shows template block JSON", async ({ editorPage, page }) => {
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

  test("MJML download triggers with valid content", async ({
    editorPage,
    page,
  }) => {
    await editorPage.openExport();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator(SELECTORS.exportDownloadBtn).click(),
    ]);
    expect(download.suggestedFilename()).toBe("email-template.mjml");
    const content = await (await download.createReadStream()).toArray();
    const text = Buffer.concat(content).toString("utf-8");
    expect(text).toContain("<mjml");
  });

  test("JSON download triggers with valid content", async ({
    editorPage,
    page,
  }) => {
    await editorPage.openExport();
    await page.locator(SELECTORS.exportTabJson).click();
    await expect(page.locator(SELECTORS.exportTabJson)).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator(SELECTORS.exportDownloadBtn).click(),
    ]);
    expect(download.suggestedFilename()).toBe("email-template.json");
    const content = await (await download.createReadStream()).toArray();
    const text = Buffer.concat(content).toString("utf-8");
    const json = JSON.parse(text);
    expect(json).toHaveProperty("blocks");
  });

  test("HTML download triggers with valid content", async ({
    editorPage,
    page,
  }) => {
    await editorPage.openExport();
    await page.locator(SELECTORS.exportTabHtml).click();
    await expect(page.locator(SELECTORS.exportDownloadBtn)).toBeEnabled();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator(SELECTORS.exportDownloadBtn).click(),
    ]);
    expect(download.suggestedFilename()).toBe("email-template.html");
    const content = await (await download.createReadStream()).toArray();
    const text = Buffer.concat(content).toString("utf-8");
    expect(text.toLowerCase()).toContain("<html");
  });
});
