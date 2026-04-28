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

  // Regression: header had `overflow-x-auto` which clipped the absolute
  // dropdown to the 48px header height, making items invisible despite the
  // DOM saying otherwise. `toBeVisible()` doesn't catch ancestor clipping —
  // assert the menu items render below the header bottom and that
  // elementFromPoint at each item's center hits the item itself.
  test("export dropdown items are not clipped by header", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.openExportMenu();

    const headerBottom = await page
      .locator("header")
      .first()
      .evaluate((el) => el.getBoundingClientRect().bottom);

    const items = page.locator(SELECTORS.exportMenuItem);
    const count = await items.count();
    expect(count).toBe(2);

    for (let i = 0; i < count; i++) {
      const item = items.nth(i);
      const box = await item.boundingBox();
      expect(box, `menu item #${i} has no box`).not.toBeNull();
      expect(box!.height).toBeGreaterThan(0);
      expect(box!.width).toBeGreaterThan(0);
      expect(box!.y + box!.height).toBeGreaterThan(headerBottom);

      const hit = await page.evaluate(
        ({ x, y }) => {
          const el = document.elementFromPoint(x, y);
          return el?.closest('[role="menuitem"]')?.getAttribute("data-testid");
        },
        { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 },
      );
      expect(hit, `item #${i} is occluded — clipped by ancestor`).toBe(
        await item.getAttribute("data-testid"),
      );
    }
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
      page.locator(SELECTORS.exportJsonItem).click(),
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
      page.locator(SELECTORS.exportMjmlItem).click(),
    ]);
    expect(download.suggestedFilename()).toContain(".mjml");
    const content = await (await download.createReadStream()).toArray();
    const text = Buffer.concat(content).toString("utf-8");
    expect(text).toContain("<mjml");
  });
});
