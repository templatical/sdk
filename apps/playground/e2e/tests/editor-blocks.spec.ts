import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

test.describe("Editor blocks", () => {
  test("sidebar shows all built-in block types", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.hoverSidebar();
    const sidebar = page.locator(SELECTORS.sidebarRail);
    const expectedTypes = [
      "Section",
      "Image",
      "Title",
      "Paragraph",
      "Button",
      "Divider",
      "Spacer",
      "HTML",
    ];
    for (const type of expectedTypes) {
      await expect(sidebar.getByText(type, { exact: true })).toBeVisible();
    }
  });

  test("add block via drag from sidebar to canvas", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const countBefore = await editorPage.getBlockCount();
    await editorPage.dragBlockFromSidebar("Spacer");
    // Wait for block to appear
    await page.waitForTimeout(500);
    const countAfter = await editorPage.getBlockCount();
    expect(countAfter).toBe(countBefore + 1);
  });

  test("click block selects it", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.selectBlock(0);
    await expect(page.locator(SELECTORS.blockSelected)).toBeVisible();
  });

  test("selected block shows floating action bar", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.selectBlock(0);
    const actions = page.locator(SELECTORS.blockActions);
    await expect(actions).toBeVisible();
    // Should have drag handle, duplicate, and delete buttons
    const buttons = actions.locator(".tpl-block-action-btn");
    expect(await buttons.count()).toBeGreaterThanOrEqual(3);
  });

  test("clicking canvas background deselects block", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.selectBlock(0);
    await expect(page.locator(SELECTORS.blockSelected)).toBeVisible();
    await editorPage.deselectBlock();
    await expect(page.locator(SELECTORS.blockSelected)).toHaveCount(0);
  });

  test("duplicate block increases count", async ({
    editorReady: { editorPage },
  }) => {
    const countBefore = await editorPage.getBlockCount();
    await editorPage.selectBlock(0);
    await editorPage.duplicateSelectedBlock();
    const countAfter = await editorPage.getBlockCount();
    expect(countAfter).toBe(countBefore + 1);
  });

  test("delete block decreases count", async ({
    editorReady: { editorPage },
  }) => {
    const countBefore = await editorPage.getBlockCount();
    await editorPage.selectBlock(0);
    await editorPage.deleteSelectedBlock();
    const countAfter = await editorPage.getBlockCount();
    expect(countAfter).toBe(countBefore - 1);
  });

  test("all blocks have data-block-type attribute", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const blocks = editorPage.getBlocks();
    const count = await blocks.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const type = await blocks.nth(i).getAttribute("data-block-type");
      expect(type).toBeTruthy();
    }
  });

  test("all blocks have unique data-block-id", async ({
    editorReady: { editorPage },
  }) => {
    const blocks = editorPage.getBlocks();
    const count = await blocks.count();
    const ids = new Set<string>();
    for (let i = 0; i < count; i++) {
      const id = await blocks.nth(i).getAttribute("data-block-id");
      expect(id).toBeTruthy();
      expect(ids.has(id!)).toBe(false);
      ids.add(id!);
    }
    expect(ids.size).toBe(count);
  });
});
