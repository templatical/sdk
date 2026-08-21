import { expect } from "@playwright/test";
import { test } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

/**
 * Issue #568 — clicking a palette item always appended to the end of the
 * template. On anything long the new block landed far below the fold and the
 * canvas never moved, so the click read as a no-op.
 *
 * Product Launch is the fixture on purpose: `selectFirstTemplate()` opens it,
 * it is several screens tall, and it contains a section with column children,
 * which is what exercises the nested branches.
 */
test.describe("palette insert position", () => {
  test("inserts directly below the selected top-level block", async ({
    editorReady,
  }) => {
    const { editorPage } = editorReady;
    const typesBefore = await editorPage.getTopLevelBlockTypes();
    // A block near the top, so an appended block would be far off-screen.
    const anchorIndex = 3;
    await editorPage.getTopLevelBlocks().nth(anchorIndex).click();
    await editorPage.page.locator(SELECTORS.blockSelected).waitFor();

    await editorPage.clickPaletteItem("divider");

    const typesAfter = await editorPage.getTopLevelBlockTypes();
    expect(typesAfter).toHaveLength(typesBefore.length + 1);
    expect(typesAfter[anchorIndex + 1]).toBe("divider");
    // The rest of the template is untouched around the insertion point.
    expect(typesAfter.slice(0, anchorIndex + 1)).toEqual(
      typesBefore.slice(0, anchorIndex + 1),
    );
    expect(typesAfter.slice(anchorIndex + 2)).toEqual(
      typesBefore.slice(anchorIndex + 1),
    );
  });

  test("leaves the inserted block visible on the canvas", async ({
    editorReady,
  }) => {
    // The reported symptom: the block was created and selected but sat below
    // the fold with the canvas unmoved, so nothing appeared to happen.
    const { editorPage } = editorReady;
    await editorPage.getTopLevelBlocks().nth(3).click();
    await editorPage.page.locator(SELECTORS.blockSelected).waitFor();

    await editorPage.clickPaletteItem("divider");

    const insertedId = await editorPage.page
      .locator(SELECTORS.blockSelected)
      .getAttribute("data-block-id");
    expect(insertedId).toBeTruthy();
    await expect
      .poll(() => editorPage.isBlockVisibleInCanvas(insertedId!), {
        timeout: 5000,
      })
      .toBe(true);
  });

  test("appends at the end with nothing selected, and scrolls there", async ({
    editorReady,
  }) => {
    // Appending is still right when there is no selection — but the canvas has
    // to follow, which is the half of the fix that covers this case.
    const { editorPage } = editorReady;
    await editorPage.page.keyboard.press("Escape");
    await expect(editorPage.page.locator(SELECTORS.blockSelected)).toHaveCount(
      0,
    );
    expect(await editorPage.getCanvasScrollTop()).toBe(0);
    const typesBefore = await editorPage.getTopLevelBlockTypes();

    await editorPage.clickPaletteItem("spacer");

    const typesAfter = await editorPage.getTopLevelBlockTypes();
    expect(typesAfter).toHaveLength(typesBefore.length + 1);
    expect(typesAfter[typesAfter.length - 1]).toBe("spacer");
    await expect
      .poll(() => editorPage.getCanvasScrollTop(), { timeout: 5000 })
      .toBeGreaterThan(0);
  });

  test("inserts into the same section column below a nested selection", async ({
    editorReady,
  }) => {
    const { editorPage } = editorReady;
    const section = editorPage.page
      .locator(`${SELECTORS.block}[data-block-type="section"]`)
      .first();
    await section.waitFor();
    const nestedChild = section.locator(SELECTORS.block).first();
    const childId = await nestedChild.getAttribute("data-block-id");
    expect(childId).toBeTruthy();
    const siblingsBefore = await section.locator(SELECTORS.block).count();
    const topLevelBefore = await editorPage.getTopLevelBlocks().count();

    await nestedChild.click();
    await expect(
      editorPage.page.locator(
        `${SELECTORS.blockSelected}[data-block-id="${childId}"]`,
      ),
    ).toHaveCount(1);

    await editorPage.clickPaletteItem("paragraph");

    // The block joined the section rather than the top level.
    expect(await section.locator(SELECTORS.block).count()).toBe(
      siblingsBefore + 1,
    );
    expect(await editorPage.getTopLevelBlocks().count()).toBe(topLevelBefore);
    // And it landed immediately after the block that was selected.
    const ids = await section
      .locator(SELECTORS.block)
      .evaluateAll((els) =>
        els.map((el) => el.getAttribute("data-block-id") ?? ""),
      );
    const insertedId = await editorPage.page
      .locator(SELECTORS.blockSelected)
      .last()
      .getAttribute("data-block-id");
    expect(ids.indexOf(insertedId!)).toBe(ids.indexOf(childId!) + 1);
  });

  test("adds a section beside the parent when the selection is nested", async ({
    editorReady,
  }) => {
    // A section cannot live in a column — MJML forbids `mj-section` inside
    // `mj-column`, so the editor refuses that insert outright. Without the
    // top-level fallback this click would do nothing at all.
    const { editorPage } = editorReady;
    const section = editorPage.page
      .locator(`${SELECTORS.block}[data-block-type="section"]`)
      .first();
    await section.waitFor();
    const nestedChild = section.locator(SELECTORS.block).first();
    await nestedChild.click();
    await editorPage.page.locator(SELECTORS.blockSelected).waitFor();

    const idsBefore = await editorPage.getTopLevelBlockIds();
    const parentId = await section.getAttribute("data-block-id");
    const parentIndex = idsBefore.indexOf(parentId!);
    expect(parentIndex).toBeGreaterThan(-1);

    await editorPage.clickPaletteItem("section");

    // Asserted by id against an exact splice, not by the type at a position:
    // Product Launch has two adjacent sections, so "the type after the parent
    // is a section" is already true before the insert and stays true for an
    // append — an assertion like that passes on the unfixed code.
    const idsAfter = await editorPage.getTopLevelBlockIds();
    const insertedId = await editorPage.page
      .locator(SELECTORS.blockSelected)
      .getAttribute("data-block-id");
    expect(insertedId).toBeTruthy();
    expect(idsAfter.indexOf(insertedId!)).toBe(parentIndex + 1);

    const expected = [...idsBefore];
    expected.splice(parentIndex + 1, 0, insertedId!);
    expect(idsAfter).toEqual(expected);
    // Top level, not swallowed into the column the selection lives in.
    const typesAfter = await editorPage.getTopLevelBlockTypes();
    expect(typesAfter[parentIndex + 1]).toBe("section");
  });

  test("keyboard activation places the block by the same rule", async ({
    editorReady,
  }) => {
    // Enter/Space on a focused palette entry is the only pointer-free way to
    // add a block, so it must not keep the old append-at-the-end behaviour.
    const { editorPage } = editorReady;
    const typesBefore = await editorPage.getTopLevelBlockTypes();
    const anchorIndex = 2;
    await editorPage.getTopLevelBlocks().nth(anchorIndex).click();
    await editorPage.page.locator(SELECTORS.blockSelected).waitFor();

    const entry = editorPage.page
      .locator(SELECTORS.sidebarRail)
      .locator('[data-palette-type="divider"]');
    await entry.focus();
    await entry.press("Enter");

    await expect
      .poll(() => editorPage.getTopLevelBlocks().count(), { timeout: 5000 })
      .toBe(typesBefore.length + 1);
    const typesAfter = await editorPage.getTopLevelBlockTypes();
    expect(typesAfter[anchorIndex + 1]).toBe("divider");
  });
});
