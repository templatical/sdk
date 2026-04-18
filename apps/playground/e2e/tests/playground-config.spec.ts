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

  test("export dropdown opens", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.openExportMenu();
    await expect(page.locator(SELECTORS.exportMenu)).toBeVisible();
  });

  test("export dropdown has JSON and MJML items", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.openExportMenu();
    const items = page.locator(SELECTORS.exportMenuItem);
    expect(await items.count()).toBe(2);
  });

  test("export dropdown closes on Escape", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.openExportMenu();
    await expect(page.locator(SELECTORS.exportMenu)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(SELECTORS.exportMenu)).toHaveCount(0);
  });

  test("JSON download triggers with valid content", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.openExportMenu();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator(SELECTORS.exportMenuItem).first().click(),
    ]);
    expect(download.suggestedFilename()).toContain(".json");
    const content = await (await download.createReadStream()).toArray();
    const text = Buffer.concat(content).toString("utf-8");
    const json = JSON.parse(text);
    expect(json).toHaveProperty("blocks");
  });

  test("MJML download triggers with valid content", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.openExportMenu();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator(SELECTORS.exportMenuItem).nth(1).click(),
    ]);
    expect(download.suggestedFilename()).toContain(".mjml");
    const content = await (await download.createReadStream()).toArray();
    const text = Buffer.concat(content).toString("utf-8");
    expect(text).toContain("<mjml");
  });
});
