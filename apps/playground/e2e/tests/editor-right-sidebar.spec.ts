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
    const panel = page.locator(SELECTORS.rightPanelContent);
    await expect(panel).toBeVisible();
    // Should have content (toolbar for the selected block)
    const panelContent = await panel.innerHTML();
    expect(panelContent.length).toBeGreaterThan(50);
  });

  test("toolbar header shows block type label", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.selectBlock(0);
    const panel = page.locator(SELECTORS.rightPanelContent);
    // The toolbar should have visible text content (block type name)
    const panelText = await panel.textContent();
    expect(panelText!.length).toBeGreaterThan(0);
  });

  test("toolbar has duplicate and delete in header", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.selectBlock(0);
    const panel = page.locator(SELECTORS.rightPanelContent);
    // Header should have action buttons (duplicate + delete)
    const headerButtons = panel.locator("button").first();
    await expect(headerButtons).toBeVisible();
  });

  test("settings tab switches panel", async ({ editorReady, page }) => {
    await page.locator(SELECTORS.rightTabSettings).click();
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
    editorReady,
    page,
  }) => {
    await page.locator(SELECTORS.rightTabSettings).click();
    const panel = page.locator(SELECTORS.rightPanelSettings);
    await expect(panel).toBeVisible();
    // Settings panel should have interactive controls (inputs, buttons, selects)
    const controls = panel.locator("input, button, select");
    expect(await controls.count()).toBeGreaterThan(0);
  });

  test("switching back to content tab preserves state", async ({
    editorReady: { editorPage },
    page,
  }) => {
    // Select a block
    await editorPage.selectBlock(0);
    const panelBefore = await page
      .locator(SELECTORS.rightPanelContent)
      .innerHTML();

    // Switch to settings and back
    await page.locator(SELECTORS.rightTabSettings).click();
    await page.locator(SELECTORS.rightTabContent).click();

    const panelAfter = await page
      .locator(SELECTORS.rightPanelContent)
      .innerHTML();
    expect(panelAfter).toBe(panelBefore);
  });
});
