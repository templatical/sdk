import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS, blockByType } from "../helpers/selectors";

test.describe("Editor drag and drop", () => {
  test("drag block from sidebar adds it to canvas", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const countBefore = await editorPage.getBlockCount();
    await editorPage.dragBlockFromSidebar("Spacer");
    await page.waitForTimeout(500);

    const countAfter = await editorPage.getBlockCount();
    expect(countAfter).toBe(countBefore + 1);

    const types = await editorPage.getBlockTypes();
    expect(types).toContain("spacer");
  });

  test("drag block to before first block places it near top", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const countBefore = await editorPage.getBlockCount();

    await editorPage.dragBlockFromSidebarToPosition("Divider", 0, "before");
    await page.waitForTimeout(500);

    const countAfter = await editorPage.getBlockCount();
    expect(countAfter).toBe(countBefore + 1);

    // Divider should exist in the canvas
    const types = await editorPage.getBlockTypes();
    expect(types).toContain("divider");
    // It should be near the top (index 0 or 1)
    const dividerIndex = types.indexOf("divider");
    expect(dividerIndex).toBeLessThanOrEqual(1);
  });

  test("drag block after existing block increases count", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const countBefore = await editorPage.getBlockCount();

    await editorPage.dragBlockFromSidebarToPosition("Spacer", 1, "after");
    await page.waitForTimeout(500);

    const countAfter = await editorPage.getBlockCount();
    expect(countAfter).toBe(countBefore + 1);
    const types = await editorPage.getBlockTypes();
    expect(types).toContain("spacer");
  });

  test("drag block into section column", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const sectionBlocks = page.locator(blockByType("section"));
    const sectionCount = await sectionBlocks.count();

    if (sectionCount === 0) {
      test.skip();
      return;
    }

    const firstSection = sectionBlocks.first();
    const columnBlocks = firstSection.locator(
      "> div > div:first-child .tpl-block",
    );
    const childCountBefore = await columnBlocks.count().catch(() => 0);

    await editorPage.dragBlockFromSidebarToSection("Divider", 0, 0);
    await page.waitForTimeout(500);

    const childCountAfter = await columnBlocks.count().catch(() => 0);
    expect(childCountAfter).toBe(childCountBefore + 1);
  });

  test("reorder blocks by dragging handle", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const typesBefore = await editorPage.getBlockTypes();
    expect(typesBefore.length).toBeGreaterThanOrEqual(3);

    const firstType = typesBefore[0];

    await editorPage.reorderBlock(0, 1);
    await page.waitForTimeout(500);

    const typesAfter = await editorPage.getBlockTypes();
    // Order should have changed
    expect(typesAfter[0]).not.toBe(firstType);
  });

  test("dragged blocks get unique IDs", async ({
    editorReady: { editorPage },
    page,
  }) => {
    // Collect IDs before
    const blocksBefore = editorPage.getBlocks();
    const countBefore = await blocksBefore.count();
    const idsBefore = new Set<string>();
    for (let i = 0; i < countBefore; i++) {
      const id = await blocksBefore.nth(i).getAttribute("data-block-id");
      if (id) idsBefore.add(id);
    }

    // Drag one block to a specific position (more reliable than center drop)
    await editorPage.dragBlockFromSidebarToPosition(
      "Spacer",
      countBefore - 1,
      "after",
    );
    await page.waitForTimeout(500);

    // Verify all IDs still unique
    const blocksAfter = editorPage.getBlocks();
    const countAfter = await blocksAfter.count();
    expect(countAfter).toBe(countBefore + 1);

    const idsAfter = new Set<string>();
    for (let i = 0; i < countAfter; i++) {
      const id = await blocksAfter.nth(i).getAttribute("data-block-id");
      expect(id).toBeTruthy();
      idsAfter.add(id!);
    }
    // All unique
    expect(idsAfter.size).toBe(countAfter);
    // One new ID
    const newIds = [...idsAfter].filter((id) => !idsBefore.has(id));
    expect(newIds.length).toBe(1);
  });

  test("block dragged to after last block appears at end", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const countBefore = await editorPage.getBlockCount();

    await editorPage.dragBlockFromSidebarToPosition(
      "Divider",
      countBefore - 1,
      "after",
    );
    await page.waitForTimeout(500);

    const countAfter = await editorPage.getBlockCount();
    expect(countAfter).toBe(countBefore + 1);

    const lastType = await editorPage.getBlockTypeAt(countAfter - 1);
    expect(lastType).toBe("divider");
  });
});
