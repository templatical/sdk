import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

test.describe("Editor right sidebar", () => {
  test("right sidebar visible", async ({ editorReady, page }) => {
    await expect(page.locator(SELECTORS.rightSidebar)).toBeVisible();
  });

  test("two tabs exist (Content, Settings)", async ({
    editorReady,
    page,
  }) => {
    await expect(page.locator(SELECTORS.rightTabContent)).toBeVisible();
    await expect(page.locator(SELECTORS.rightTabSettings)).toBeVisible();
  });

  test("content tab active by default", async ({ editorReady, page }) => {
    await expect(page.locator(SELECTORS.rightTabContent)).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("no block selected shows empty state", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.deselectBlock();
    const panel = page.locator(SELECTORS.rightPanelContent);
    await expect(panel).toBeVisible();
    // No block selected — panel should have less content than when a block is selected
    // Specifically, there should be no block action buttons (duplicate/delete in toolbar header)
    const actionBar = panel.locator(SELECTORS.blockActions);
    expect(await actionBar.count()).toBe(0);
  });

  test("selecting block shows toolbar in content panel", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.selectBlock(0);
    await expect(page.locator(SELECTORS.blockToolbar)).toBeVisible();
  });

  test("toolbar header shows block type label", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.selectBlock(0);
    const toolbar = page.locator(SELECTORS.blockToolbar);
    await expect(toolbar).toBeVisible();
    const panelText = await toolbar.textContent();
    expect(panelText!.length).toBeGreaterThan(0);
  });

  test("toolbar has duplicate and delete in header", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.selectBlock(0);
    const panel = page.locator(SELECTORS.rightPanelContent);
    await expect(
      panel.getByRole("button", { name: /duplicate/i }),
    ).toBeVisible();
    await expect(panel.getByRole("button", { name: /delete/i })).toBeVisible();
  });

  test("settings tab switches panel", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.openSettingsTab();
    await expect(page.locator(SELECTORS.rightTabSettings)).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.locator(SELECTORS.rightTabContent)).toHaveAttribute(
      "aria-selected",
      "false",
    );
    await expect(page.locator(SELECTORS.rightPanelSettings)).toBeVisible();
  });

  test("settings panel shows template controls", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.openSettingsTab();
    const panel = page.locator(SELECTORS.templateSettings);
    await expect(panel).toBeVisible();
    const controls = panel.locator("input, button, select");
    await expect.poll(() => controls.count()).toBeGreaterThan(0);
  });

  test("switching back to content tab preserves selection", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.selectBlock(0);
    const selectedId = await page
      .locator(SELECTORS.blockSelected)
      .first()
      .getAttribute("data-block-id");

    await editorPage.openSettingsTab();
    await page.locator(SELECTORS.rightTabContent).click();
    await expect(page.locator(SELECTORS.rightPanelContent)).toBeVisible();

    const stillSelected = await page
      .locator(SELECTORS.blockSelected)
      .first()
      .getAttribute("data-block-id");
    expect(stillSelected).toBe(selectedId);
  });
});
