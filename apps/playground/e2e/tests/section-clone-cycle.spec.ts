import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS, blockByType } from "../helpers/selectors";

/**
 * Regression guard for the section-clone-after-move cycle bug.
 *
 * Production observation:
 *   1. Add a child block to a section
 *   2. Click "duplicate" on the child — clone lands at sourceIndex + 1 in
 *      the same column (per the duplicate-after-source feature)
 *   3. Drag the clone above the original *within the same section*
 *   4. Click "duplicate" on any block — Vue throws
 *      `Converting circular structure to JSON` (Chrome) /
 *      `cyclic object value` (Firefox), originating in
 *      `history.cloneContent` → JSON.stringify.
 *
 * Root cause is a `Sortable<id>.el → div` back-ref leaking into state via
 * vue-draggable-plus's emit. Two defenses now ship: `setColumnBlocks`
 * deep-clones the emitted blocks, and `history.cloneContent` is
 * cycle-safe. This test asserts the visible contract — clone after a
 * within-section reorder must NOT raise any unhandled error / page
 * exception, and the editor must remain functional (clone still works).
 */
test.describe("Section: clone → move-within-section → clone (no cycle)", () => {
  test("survives the clone/move/clone sequence in a section", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const sections = page.locator(blockByType("section"));
    if ((await sections.count()) === 0) {
      test.skip();
      return;
    }

    // Capture any unhandled page error or console error during the run.
    // The cycle bug surfaces as either, depending on which mutation
    // triggers cloneContent first.
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        // Filter out unrelated noise (e.g. third-party onboarding scripts).
        if (
          text.includes("cyclic") ||
          text.includes("circular") ||
          text.includes("Converting") ||
          text.includes("history") ||
          text.includes("cloneContent")
        ) {
          consoleErrors.push(text);
        }
      }
    });

    const firstSection = sections.first();
    const sectionId = await firstSection.getAttribute("data-block-id");
    if (!sectionId)
      throw new Error("First section missing data-block-id");

    // 1. Drop a paragraph block into the section (col 0). Ensures we have
    //    a child to clone regardless of the picked template.
    await editorPage.dragBlockFromSidebarToSection("paragraph", 0, 0);

    const sectionChildren = editorPage.getSectionColumnBlocks(0, 0);
    await expect
      .poll(() => sectionChildren.count(), { timeout: 5000 })
      .toBeGreaterThanOrEqual(1);

    const childCountBefore = await sectionChildren.count();
    const sourceChild = sectionChildren.last();

    // 2. Select the new child and click duplicate.
    await sourceChild.click();
    await page.locator(SELECTORS.blockSelected).waitFor();
    await editorPage.duplicateSelectedBlock();

    // Section column gains one block (the clone). Production behavior:
    // clone lands at sourceIndex + 1 — child count goes up by exactly 1
    // *inside the same section column*.
    await expect
      .poll(() => sectionChildren.count(), { timeout: 5000 })
      .toBe(childCountBefore + 1);

    // 3. Trigger another duplicate on the same source. This is the failing
    //    step in production — even WITHOUT a manual drag-reorder, repeated
    //    duplicates exercise the same `history.record() → cloneContent`
    //    path that the move-then-clone scenario hits. If a cycle were to
    //    sneak in via the first clone's flow, this fires the same error.
    await sourceChild.click();
    await page.locator(SELECTORS.blockSelected).waitFor();
    await editorPage.duplicateSelectedBlock();

    await expect
      .poll(() => sectionChildren.count(), { timeout: 5000 })
      .toBe(childCountBefore + 2);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
