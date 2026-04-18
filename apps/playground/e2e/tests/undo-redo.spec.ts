import { test, expect } from "../fixtures/editor.fixture";

test.describe("Undo and redo", () => {
  test("undo after deleting block restores it", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const countBefore = await editorPage.getBlockCount();

    await editorPage.selectBlock(0);
    await editorPage.deleteSelectedBlock();
    await expect
      .poll(() => editorPage.getBlockCount())
      .toBe(countBefore - 1);

    await page.keyboard.press("Meta+z");
    await expect.poll(() => editorPage.getBlockCount()).toBe(countBefore);
  });

  test("redo after undo re-applies deletion", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const countBefore = await editorPage.getBlockCount();

    await editorPage.selectBlock(0);
    await editorPage.deleteSelectedBlock();
    await expect
      .poll(() => editorPage.getBlockCount())
      .toBe(countBefore - 1);

    await page.keyboard.press("Meta+z");
    await expect.poll(() => editorPage.getBlockCount()).toBe(countBefore);

    await page.keyboard.press("Meta+Shift+z");
    await expect
      .poll(() => editorPage.getBlockCount())
      .toBe(countBefore - 1);
  });

  test("undo after duplicate removes the duplicate", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const countBefore = await editorPage.getBlockCount();

    await editorPage.selectBlock(0);
    await editorPage.duplicateSelectedBlock();
    await expect
      .poll(() => editorPage.getBlockCount())
      .toBe(countBefore + 1);

    await page.keyboard.press("Meta+z");
    await expect.poll(() => editorPage.getBlockCount()).toBe(countBefore);
  });

  test("multiple undos work sequentially", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const countBefore = await editorPage.getBlockCount();

    await editorPage.selectBlock(0);
    await editorPage.deleteSelectedBlock();
    await expect
      .poll(() => editorPage.getBlockCount())
      .toBe(countBefore - 1);

    await editorPage.selectBlock(0);
    await editorPage.deleteSelectedBlock();
    await expect
      .poll(() => editorPage.getBlockCount())
      .toBe(countBefore - 2);

    await page.keyboard.press("Meta+z");
    await expect
      .poll(() => editorPage.getBlockCount())
      .toBe(countBefore - 1);

    await page.keyboard.press("Meta+z");
    await expect.poll(() => editorPage.getBlockCount()).toBe(countBefore);
  });
});
