import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS, blockByType } from "../helpers/selectors";

test.describe("Block-specific settings", () => {
  test("image block shows URL and alt text inputs", async ({
    editorReady: { editorPage },
    page,
  }) => {
    // Select an image block
    await editorPage.selectBlockByType("image");
    const panel = page.locator(SELECTORS.rightPanelContent);
    await expect(panel).toBeVisible();

    // Image toolbar should have inputs (MergeTagInput renders input or role=button)
    const inputs = panel.locator('input, [role="button"][tabindex="0"]');
    expect(await inputs.count()).toBeGreaterThanOrEqual(1);
  });

  test("image block shows width select", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.selectBlockByType("image");
    const panel = page.locator(SELECTORS.rightPanelContent);

    // Width select should exist
    const selects = panel.locator("select");
    expect(await selects.count()).toBeGreaterThanOrEqual(1);
  });

  test("image block shows alignment options", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.selectBlockByType("image");
    const panel = page.locator(SELECTORS.rightPanelContent);

    // Alignment is a SlidingPillSelect with radio buttons
    const alignButtons = panel.locator('[role="radio"]');
    // Should have left, center, right options
    expect(await alignButtons.count()).toBe(3);
  });

  test("button block shows text and URL inputs", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.selectBlockByType("button");
    const panel = page.locator(SELECTORS.rightPanelContent);
    await expect(panel).toBeVisible();

    // Should have inputs for text and URL
    const inputs = panel.locator('input, [role="button"][tabindex="0"]');
    expect(await inputs.count()).toBeGreaterThanOrEqual(2);
  });

  test("button block shows color pickers", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.selectBlockByType("button");
    const panel = page.locator(SELECTORS.rightPanelContent);

    // Color pickers use text inputs with # prefix for hex values
    // Look for inputs that have color-like values or color picker triggers
    const textInputs = panel.locator('input[type="text"]');
    expect(await textInputs.count()).toBeGreaterThanOrEqual(2);
  });

  test("button block shows border radius and font size", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.selectBlockByType("button");
    const panel = page.locator(SELECTORS.rightPanelContent);

    // Number inputs for border radius and font size
    const numberInputs = panel.locator('input[type="number"]');
    expect(await numberInputs.count()).toBeGreaterThanOrEqual(2);
  });

  test("changing button border radius updates value", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.selectBlockByType("button");
    const panel = page.locator(SELECTORS.rightPanelContent);

    const radiusInput = panel.locator('input[type="number"]').first();
    await radiusInput.fill("20");
    await radiusInput.press("Tab");
    await page.waitForTimeout(300);

    // Value should persist
    const value = await radiusInput.inputValue();
    expect(value).toBe("20");
  });

  test("selecting different block types shows different toolbars", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const panel = page.locator(SELECTORS.rightPanelContent);

    // Select image block
    await editorPage.selectBlockByType("image");
    const imageHtml = await panel.innerHTML();

    // Select button block
    await editorPage.selectBlockByType("button");
    const buttonHtml = await panel.innerHTML();

    // Different block types should show different toolbar content
    expect(imageHtml).not.toBe(buttonHtml);
  });
});
