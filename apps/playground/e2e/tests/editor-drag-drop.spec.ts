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
    // `dragBlockFromSidebarToSection` now drives the mouse manually
    // (every Sortable runs in force-fallback mode; Playwright's `dragTo`
    // can't exercise fallback Sortables because it emits HTML5 drag
    // events only).
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

  test("block dragged to canvas end appears near the end at top-level", async ({
    editorReady: { editorPage },
  }) => {
    // `dragBlockFromSidebar` aims at the last top-level block's center.
    // Sortable's force-fallback `_onDragOver` for a cross-list drop
    // places the new block either at the last block's old position
    // (swap) or just after it — both keep the dragged block at
    // top-level. Strict "appears at index N" assertions are fragile
    // because the precise position depends on Sortable's
    // direction/swap math against the targeted item's geometry. The
    // robust contract is: (1) top-level count grows by one, (2) the
    // new block IS at top-level (not absorbed into a section), and
    // (3) the new block is at or near the end (last or second-to-last).
    const topLevelCountBefore = await editorPage.getTopLevelBlocks().count();

    await editorPage.dragBlockFromSidebar("divider");

    const newTopLevelTypes = await editorPage.getTopLevelBlockTypes();
    expect(newTopLevelTypes).toHaveLength(topLevelCountBefore + 1);
    // The new divider must be at top-level (the count check above
    // guarantees one of these positions IS a divider, but make sure
    // it's at or near the end specifically).
    const lastTwoTypes = newTopLevelTypes.slice(-2);
    expect(lastTwoTypes).toContain("divider");
  });
});
