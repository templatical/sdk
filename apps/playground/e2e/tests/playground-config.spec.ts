import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS, configTab, configPanel } from "../helpers/selectors";

test.describe("Playground config & export", () => {
  test("config modal opens with 5 tabs", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.openConfig();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    const tabs = ["options", "content", "theme", "defaults", "callbacks"];
    for (const tab of tabs) {
      await expect(page.locator(configTab(tab))).toBeVisible();
    }
  });

  test("each tab switches panel", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.openConfig();
    const tabs = ["options", "content", "theme", "defaults", "callbacks"];
    for (const tab of tabs) {
      await page.locator(configTab(tab)).click();
      await expect(page.locator(configTab(tab))).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expect(page.locator(configPanel(tab))).toBeVisible();
    }
  });

  test("arrow keys navigate tabs", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.openConfig();
    // Focus first tab
    await page.locator(configTab("options")).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(configTab("content"))).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("defaults tab shows preset selector", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.openConfig();
    await page.locator(configTab("defaults")).click();
    const panel = page.locator(configPanel("defaults"));
    // Should have a select element for presets
    const select = panel.locator("select");
    await expect(select.first()).toBeVisible();
  });

  test("cancel closes config without applying", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.openConfig();
    const dialog = page.locator('[aria-label="Editor Configuration"]');
    await expect(dialog).toBeVisible();
    // Click cancel button within the config dialog
    await dialog.getByRole("button", { name: /cancel/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("export modal opens with MJML as default tab", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.openExport();
    await expect(page.locator(SELECTORS.exportModal)).toBeVisible();
    await expect(page.locator(SELECTORS.exportTabMjml)).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("export modal closes on Escape", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.openExport();
    await expect(page.locator(SELECTORS.exportModal)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(SELECTORS.exportModal)).toHaveCount(0);
  });

  test("MJML tab shows compiled MJML source", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.openExport();
    await expect(page.locator(SELECTORS.exportModal)).toBeVisible();
    const content = await page.locator(".cm-content").first().textContent();
    expect(content).toContain("<mjml");
  });

  test("HTML tab compiles to email-ready HTML", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.openExport();
    await page.locator(SELECTORS.exportTabHtml).click();
    await expect(page.locator(SELECTORS.exportHtmlError)).toHaveCount(0);
    await expect
      .poll(async () =>
        page.locator(".cm-content").first().textContent(),
      )
      .toMatch(/<!doctype html|<html/i);
  });

  test("JSON tab shows template block JSON", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.openExport();
    await page.locator(SELECTORS.exportTabJson).click();
    const content = await page.locator(".cm-content").first().textContent();
    expect(content).toContain('"blocks"');
  });

  test("MJML download triggers with valid content", async ({
    editorReady: { editorPage },
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
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.openExport();
    await page.locator(SELECTORS.exportTabJson).click();
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
    editorReady: { editorPage },
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
