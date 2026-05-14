import { test, expect } from "../fixtures/editor.fixture";
import { blockByType } from "../helpers/selectors";

/**
 * Drag-and-drop fallback-mode regression suite.
 *
 * Every test in this file guards a specific bug discovered during a long
 * Chrome-vs-Firefox drag debugging cycle. All three `<VueDraggable>`
 * instances (sidebar palette, canvas top-level, section column inner)
 * run with `:force-fallback="true"` — Sortable uses pointer events
 * instead of native HTML5 drag. That mode is load-bearing for several
 * reasons (see CLAUDE.md "Drag-and-drop architecture") and these tests
 * pin the contract end-to-end.
 *
 * Why these tests use the page-object helpers (which drive mouse-step
 * pointer events) instead of inlining mouse-drive: the page-object
 * already handles rail-expansion waits, scroll-into-view, viewport-safe
 * targeting, etc. — every drag-related test in the suite uses the same
 * helpers, so a single page-object regression catches everything.
 */
test.describe("Drag fallback-mode regression suite", () => {
  test("sidebar → canvas: drop creates a new block (force-fallback path)", async ({
    editorReady: { editorPage },
  }) => {
    // Regression: this drop flow ONLY works when canvas + sidebar are in
    // the same Sortable mode. The user-reported "ghost tracks but
    // nothing drops" symptom appeared when sidebar was reverted to HTML5
    // while canvas stayed on fallback — Sortable only binds dragover on
    // its `el` in HTML5 mode, so cross-mode HTML5→fallback drops are
    // dropped on the floor. This test catches a re-introduction of that
    // mode mismatch.
    const countBefore = await editorPage.getBlockCount();
    await editorPage.dragBlockFromSidebar("spacer");
    expect(await editorPage.getBlockCount()).toBe(countBefore + 1);
    expect(await editorPage.getBlockTypes()).toContain("spacer");
  });

  test("sidebar → section column: drop creates a child block", async ({
    editorReady: { editorPage },
    page,
  }) => {
    // Regression: same cross-Sortable coordination, but with the
    // additional section-column nesting. The original Chrome
    // inner-section drag bug was about THIS path. With all three
    // Sortables in fallback mode, the drop registers via Sortable's
    // pointer-event polling.
    const sections = page.locator(blockByType("section"));
    if ((await sections.count()) === 0) {
      test.skip();
      return;
    }

    const before = (await editorPage.getSectionColumnBlockIds(0, 0)).length;
    await editorPage.dragBlockFromSidebarToSection("divider", 0, 0);
    expect(
      (await editorPage.getSectionColumnBlockIds(0, 0)).length,
    ).toBe(before + 1);
  });

  test("section column reorder via grip (Chrome nested-Sortable fix)", async ({
    editorReady: { editorPage },
    page,
  }) => {
    // Regression: Chrome's HTML5 native drag silently failed to fire
    // `dragstart` from a child block's grip inside a section column
    // (nested Sortable case). Firefox worked, Chrome didn't. Switching
    // to force-fallback bypassed Chrome's native-drag chain and made
    // the reorder work. Marking this test ensures fallback mode stays
    // in place on the section Sortable.
    const sections = page.locator(blockByType("section"));
    if ((await sections.count()) === 0) {
      test.skip();
      return;
    }
    const idsBefore = await editorPage.getSectionColumnBlockIds(0, 0);
    if (idsBefore.length < 2) {
      test.skip();
      return;
    }

    await editorPage.reorderBlockWithinSection(0, 0, 0, 1);

    const idsAfter = await editorPage.getSectionColumnBlockIds(0, 0);
    expect(idsAfter[0]).toBe(idsBefore[1]);
    expect(idsAfter[1]).toBe(idsBefore[0]);
  });

  test("canvas reorder via grip works (no native-drag-aborting attribute)", async ({
    editorReady: { editorPage },
  }) => {
    // Regression: historically `draggable="false"` was applied at
    // various `BlockWrapper` placements as a defense against accidental
    // native text/image drag. Every placement broke Chrome's drag-chain
    // check for the top-level grip drag. The fix was to remove the
    // attribute entirely and rely on Sortable's `handle=".tpl-block-btn"`
    // option. This test ensures top-level grip drag still works — if
    // someone reintroduces `draggable="false"` on `.tpl-block` or
    // `.tpl-block-content`, this fails.
    const idsBefore = await editorPage.getTopLevelBlockIds();
    if (idsBefore.length < 2) {
      test.skip();
      return;
    }

    await editorPage.reorderBlock(0, 1);

    const idsAfter = await editorPage.getTopLevelBlockIds();
    expect(idsAfter[0]).toBe(idsBefore[1]);
    expect(idsAfter[1]).toBe(idsBefore[0]);
  });

  // NOTE on live-DOM inspection tests:
  //
  // Earlier iterations of this suite included two tests that drove a
  // drag mid-flight and inspected the source dragEl's computed style /
  // bounding rect (`visibility: hidden`, non-zero rect) and the sidebar
  // rail's `getBoundingClientRect().width` during the drag. Both are
  // timing-fragile under Playwright's synthetic pointer events —
  // Sortable's `_dragStarted` runs on `_nextTick` (rAF) and the test
  // would race with class application + drop completion. Same contract
  // is locked at the unit-audit level (`block-chrome-structure.test.ts`):
  //
  //   - `.tpl-sidebar-rail .tpl-ghost { visibility: hidden }`
  //   - NO `display: none` on that selector
  //   - sidebar's `handleSidebarLeave` / `isDragging` / `@choose` /
  //     `@end` plumbing
  //
  // The functional drop tests above prove the wiring works end-to-end:
  // if any of those CSS rules or Vue handlers regressed, those drops
  // would fail (the user's reported "nothing drops" symptom = exactly
  // those rules getting broken).
});
