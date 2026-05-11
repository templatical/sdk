import { test, expect } from "../fixtures/editor.fixture";
import { blockByType } from "../helpers/selectors";

/**
 * Cross-container and intra-section drag-and-drop coverage.
 *
 * Companion to `editor-drag-drop.spec.ts` (sidebar→canvas) and
 * `section-columns.spec.ts` (sidebar→section column). The scenarios here
 * exercise mid-template moves between containers — the riskiest path
 * during draggable-library swaps or Sortable.js upgrades, since group
 * semantics and pull/put callbacks are where behavior tends to drift.
 */
test.describe("Editor cross-container drag-and-drop", () => {
  test("reorder blocks within a single section column", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const sections = page.locator(blockByType("section"));
    if ((await sections.count()) === 0) {
      test.skip();
      return;
    }

    // Find a section column with at least 2 children to swap. Default to (0, 0)
    // if it qualifies; otherwise scan columns of the first section.
    let sectionIndex = 0;
    let colIndex = 0;
    let children = await editorPage
      .getSectionColumnBlocks(sectionIndex, colIndex)
      .count();
    if (children < 2) {
      const cols = await sections
        .first()
        .locator('[class*="tpl:min-h-"]')
        .count();
      let found = false;
      for (let c = 0; c < cols; c++) {
        const n = await editorPage
          .getSectionColumnBlocks(0, c)
          .count();
        if (n >= 2) {
          colIndex = c;
          children = n;
          found = true;
          break;
        }
      }
      if (!found) {
        // Plant two blocks into column 0 so the test has something to reorder.
        await editorPage.dragBlockFromSidebarToSection("divider", 0, 0);
        await editorPage.dragBlockFromSidebarToSection("spacer", 0, 0);
        children = await editorPage.getSectionColumnBlocks(0, 0).count();
      }
    }

    const idsBefore = await editorPage.getSectionColumnBlockIds(
      sectionIndex,
      colIndex,
    );
    expect(idsBefore.length).toBeGreaterThanOrEqual(2);

    await editorPage.reorderBlockWithinSection(
      sectionIndex,
      colIndex,
      0,
      1,
    );

    const idsAfter = await editorPage.getSectionColumnBlockIds(
      sectionIndex,
      colIndex,
    );
    expect(idsAfter[0]).toBe(idsBefore[1]);
    expect(idsAfter[1]).toBe(idsBefore[0]);
    // Block set unchanged — only order moved.
    expect(new Set(idsAfter)).toEqual(new Set(idsBefore));
  });

  // Known limitation: Sortable.js's `_onDragOver` hit-test for a target
  // column nested inside a sibling canvas item doesn't fire under
  // Playwright's synthetic pointer events when the source is a canvas-level
  // handle (.tpl-block-btn). Real-user drag works; manual mouse driving
  // does not. Exercise via manual QA; revisit if Playwright gains a more
  // native pointer-event mode.
  test.fixme("move block from canvas top-level into a section column", async ({
    blankEditorReady: { editorPage },
  }) => {
    // Build a minimal layout: a section at canvas[1], a title at canvas[0].
    // Drop the section first (lands as top-level on empty canvas), then
    // drop the title BEFORE it via the position helper so the title is
    // clearly top-level and not absorbed into the section's empty column.
    await editorPage.dragBlockFromSidebar("section");
    await editorPage.dragBlockFromSidebarToPosition("title", 0, "before");

    const topLevelIdsBefore = await editorPage.getTopLevelBlockIds();
    expect(topLevelIdsBefore).toHaveLength(2);
    const movedId = topLevelIdsBefore[0];
    expect((await editorPage.getTopLevelBlockTypes())[0]).toBe("title");

    const topLevelCountBefore = topLevelIdsBefore.length;
    const sectionColCountBefore = await editorPage
      .getSectionColumnBlocks(0, 0)
      .count();

    await editorPage.moveBlockFromCanvasToSection(0, 0, 0);

    expect(
      await editorPage.getSectionColumnBlocks(0, 0).count(),
    ).toBe(sectionColCountBefore + 1);
    expect(
      await editorPage.getSectionColumnBlockIds(0, 0),
    ).toContain(movedId);
    expect(await editorPage.getTopLevelBlocks().count()).toBe(
      topLevelCountBefore - 1,
    );
    expect(await editorPage.getTopLevelBlockIds()).not.toContain(movedId);
  });

  test("move child block from section column out to canvas top-level", async ({
    blankEditorReady: { editorPage },
  }) => {
    // Layout: a section at canvas[0], a title at canvas[1]. Plant a divider
    // inside section column 0; drag it OUT so it lands as a top-level block
    // after the title. Source (section child) and target (title's bottom
    // edge) sit adjacent in the viewport.
    await editorPage.dragBlockFromSidebar("section");
    await editorPage.dragBlockFromSidebarToPosition("title", 0, "after");
    await editorPage.dragBlockFromSidebarToSection("divider", 0, 0);

    const colIds = await editorPage.getSectionColumnBlockIds(0, 0);
    const movedId = colIds[colIds.length - 1];
    expect(movedId).toBeTruthy();

    const childIndex = colIds.length - 1;
    const topLevelCountBefore = await editorPage.getTopLevelBlocks().count();
    const targetCanvasIndex = topLevelCountBefore - 1;

    await editorPage.moveBlockFromSectionToCanvas(
      0,
      0,
      childIndex,
      targetCanvasIndex,
      "after",
    );

    expect(await editorPage.getTopLevelBlockIds()).toContain(movedId);
    expect(
      await editorPage.getSectionColumnBlockIds(0, 0),
    ).not.toContain(movedId);
    expect(await editorPage.getTopLevelBlocks().count()).toBe(
      topLevelCountBefore + 1,
    );
  });

  // Known limitation: drop into a SIBLING column of the same section
  // doesn't register under Playwright's synthetic pointer events even
  // though cross-section moves (test below) do. Manual QA covers it.
  test.fixme("move block between two columns of the same section", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const sections = page.locator(blockByType("section"));
    if ((await sections.count()) === 0) {
      test.skip();
      return;
    }

    // Find a section that actually has 2+ direct columns. The first section
    // in the loaded template may be 1-column (e.g. a header band).
    let sectionNth = -1;
    const sectionTotal = await sections.count();
    for (let s = 0; s < sectionTotal; s++) {
      const directCols = await sections
        .nth(s)
        .locator('div[class*="tpl:flex"][class*="tpl:gap-0"] > div')
        .count();
      if (directCols >= 2) {
        sectionNth = s;
        break;
      }
    }
    if (sectionNth < 0) {
      test.skip();
      return;
    }

    // Plant a divider in column 0 so the test is order-independent.
    await editorPage.dragBlockFromSidebarToSection("divider", sectionNth, 0);
    const col0Ids = await editorPage.getSectionColumnBlockIds(sectionNth, 0);
    const movedId = col0Ids[col0Ids.length - 1];
    expect(movedId).toBeTruthy();

    const col1CountBefore = await editorPage
      .getSectionColumnBlocks(sectionNth, 1)
      .count();

    await editorPage.moveBlockBetweenColumns(
      sectionNth,
      0,
      col0Ids.length - 1,
      1,
    );

    expect(
      await editorPage.getSectionColumnBlockIds(sectionNth, 1),
    ).toContain(movedId);
    expect(
      await editorPage.getSectionColumnBlocks(sectionNth, 1).count(),
    ).toBe(col1CountBefore + 1);
    expect(
      await editorPage.getSectionColumnBlockIds(sectionNth, 0),
    ).not.toContain(movedId);
  });

  test("move block between two different section components", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const sections = page.locator(blockByType("section"));
    if ((await sections.count()) < 2) {
      // Plant a second section so cross-section move has a target.
      await editorPage.dragBlockFromSidebar("section");
    }
    expect(await sections.count()).toBeGreaterThanOrEqual(2);

    // Plant a divider in section 0, column 0 so we have a known mover.
    await editorPage.dragBlockFromSidebarToSection("divider", 0, 0);
    const fromColIds = await editorPage.getSectionColumnBlockIds(0, 0);
    const movedId = fromColIds[fromColIds.length - 1];
    expect(movedId).toBeTruthy();

    const toCountBefore = await editorPage
      .getSectionColumnBlocks(1, 0)
      .count();

    await editorPage.moveBlockBetweenSections(
      0,
      0,
      fromColIds.length - 1,
      1,
      0,
    );

    expect(
      await editorPage.getSectionColumnBlockIds(1, 0),
    ).toContain(movedId);
    expect(
      await editorPage.getSectionColumnBlocks(1, 0).count(),
    ).toBe(toCountBefore + 1);
    expect(
      await editorPage.getSectionColumnBlockIds(0, 0),
    ).not.toContain(movedId);
  });
});
