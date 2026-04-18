import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

test.describe("Undo and redo", () => {
  test("undo after deleting block restores it", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const countBefore = await editorPage.getBlockCount();
    const typesBefore = await editorPage.getBlockTypes();

    // Select and delete first block
    await editorPage.selectBlock(0);
    await editorPage.deleteSelectedBlock();
    await page.waitForTimeout(300);

    const countAfterDelete = await editorPage.getBlockCount();
    expect(countAfterDelete).toBe(countBefore - 1);

    // Undo — block should reappear
    await page.keyboard.press("Meta+z");
    await page.waitForTimeout(500);

    const countAfterUndo = await editorPage.getBlockCount();
    expect(countAfterUndo).toBe(countBefore);
  });

  test("redo after undo re-applies deletion", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const countBefore = await editorPage.getBlockCount();

    // Delete a block
    await editorPage.selectBlock(0);
    await editorPage.deleteSelectedBlock();
    await page.waitForTimeout(300);

    // Undo
    await page.keyboard.press("Meta+z");
    await page.waitForTimeout(500);
    expect(await editorPage.getBlockCount()).toBe(countBefore);

    // Redo — deletion should re-apply
    await page.keyboard.press("Meta+Shift+z");
    await page.waitForTimeout(500);
    expect(await editorPage.getBlockCount()).toBe(countBefore - 1);
  });

  test("undo after duplicate removes the duplicate", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const countBefore = await editorPage.getBlockCount();

    // Duplicate first block
    await editorPage.selectBlock(0);
    await editorPage.duplicateSelectedBlock();
    await page.waitForTimeout(300);
    expect(await editorPage.getBlockCount()).toBe(countBefore + 1);

    // Undo — duplicate should be removed
    await page.keyboard.press("Meta+z");
    await page.waitForTimeout(500);
    expect(await editorPage.getBlockCount()).toBe(countBefore);
  });

  test("multiple undos work sequentially", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const countBefore = await editorPage.getBlockCount();

    // Delete two blocks
    await editorPage.selectBlock(0);
    await editorPage.deleteSelectedBlock();
    await page.waitForTimeout(300);

    await editorPage.selectBlock(0);
    await editorPage.deleteSelectedBlock();
    await page.waitForTimeout(300);
    expect(await editorPage.getBlockCount()).toBe(countBefore - 2);

    // Undo first deletion
    await page.keyboard.press("Meta+z");
    await page.waitForTimeout(500);
    expect(await editorPage.getBlockCount()).toBe(countBefore - 1);

    // Undo second deletion
    await page.keyboard.press("Meta+z");
    await page.waitForTimeout(500);
    expect(await editorPage.getBlockCount()).toBe(countBefore);
  });
});
