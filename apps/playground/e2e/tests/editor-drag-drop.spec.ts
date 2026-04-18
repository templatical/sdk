import { test, expect } from "../fixtures/editor.fixture";
import { blockByType } from "../helpers/selectors";

test.describe("Editor drag and drop", () => {
  test("drag block from sidebar adds it to canvas", async ({
    editorReady: { editorPage },
  }) => {
    const countBefore = await editorPage.getBlockCount();
    await editorPage.dragBlockFromSidebar("spacer");

    expect(await editorPage.getBlockCount()).toBe(countBefore + 1);
    expect(await editorPage.getBlockTypes()).toContain("spacer");
  });

  test("drag block to before first block places it near top", async ({
    editorReady: { editorPage },
  }) => {
    const countBefore = await editorPage.getBlockCount();

    await editorPage.dragBlockFromSidebarToPosition("divider", 0, "before");

    expect(await editorPage.getBlockCount()).toBe(countBefore + 1);
    const types = await editorPage.getBlockTypes();
    expect(types.slice(0, 2)).toContain("divider");
  });

  test("drag block after existing block increases count", async ({
    editorReady: { editorPage },
  }) => {
    const countBefore = await editorPage.getBlockCount();

    await editorPage.dragBlockFromSidebarToPosition("spacer", 1, "after");

    expect(await editorPage.getBlockCount()).toBe(countBefore + 1);
    expect(await editorPage.getBlockTypes()).toContain("spacer");
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

    await editorPage.dragBlockFromSidebarToSection("divider", 0, 0);
    // dragBlockFromSidebarToSection already asserts the column grew by one.
    expect(
      await sectionBlocks.first().locator(blockByType("divider")).count(),
    ).toBeGreaterThanOrEqual(1);
  });

  test("reorder blocks by dragging handle", async ({
    editorReady: { editorPage },
  }) => {
    const typesBefore = await editorPage.getBlockTypes();
    const idsBefore = await editorPage.getBlockIds();
    expect(typesBefore.length).toBeGreaterThanOrEqual(3);

    await editorPage.reorderBlock(0, 1);

    const idsAfter = await editorPage.getBlockIds();
    expect(idsAfter[0]).toBe(idsBefore[1]);
    expect(idsAfter[1]).toBe(idsBefore[0]);
  });

  test("dragged blocks get unique IDs", async ({
    editorReady: { editorPage },
  }) => {
    const idsBefore = new Set(await editorPage.getBlockIds());
    const countBefore = idsBefore.size;

    await editorPage.dragBlockFromSidebarToPosition(
      "spacer",
      countBefore - 1,
      "after",
    );

    const idsAfter = await editorPage.getBlockIds();
    expect(idsAfter.length).toBe(countBefore + 1);
    expect(new Set(idsAfter).size).toBe(countBefore + 1);

    const newIds = idsAfter.filter((id) => !idsBefore.has(id));
    expect(newIds).toHaveLength(1);
  });

  test("block dragged to after last block appears at end", async ({
    editorReady: { editorPage },
  }) => {
    const countBefore = await editorPage.getBlockCount();

    await editorPage.dragBlockFromSidebarToPosition(
      "divider",
      countBefore - 1,
      "after",
    );

    expect(await editorPage.getBlockCount()).toBe(countBefore + 1);
    expect(await editorPage.getBlockTypeAt(countBefore)).toBe("divider");
  });
});
