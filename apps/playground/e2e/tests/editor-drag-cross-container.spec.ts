import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../fixtures/editor.fixture";
import type { EditorPage } from "../pages/editor.page";

/**
 * Cross-container and intra-section drag-and-drop coverage.
 *
 * Companion to `editor-drag-drop.spec.ts` (sidebar→canvas) and
 * `section-columns.spec.ts` (sidebar→section column). The scenarios here
 * exercise mid-template moves between containers — the riskiest path
 * during draggable-library swaps or Sortable.js upgrades, since group
 * semantics and pull/put callbacks are where behavior tends to drift.
 *
 * Every move drops between two blocks, never at a list's end, so the
 * asserted layout proves the insertion index and not only the container.
 */

const PADDING = { padding: { top: 10, right: 10, bottom: 10, left: 10 } };

const paragraph = (id: string) => ({
  id,
  type: "paragraph",
  content: `<p>${id}</p>`,
  styles: PADDING,
});

const section = (id: string, columns: string, children: unknown[][]) => ({
  id,
  type: "section",
  columns,
  styles: PADDING,
  children,
});

/**
 * head
 * two:  [left]  [upper, lower]
 * one:  [solo]
 * trio: [first, second, third]
 * tail
 */
const CONTENT = {
  settings: {
    width: 600,
    backgroundColor: "#ffffff",
    textColor: "#1a1a1a",
    fontFamily: "Arial",
    locale: "en",
  },
  blocks: [
    paragraph("head"),
    section("two", "2", [
      [paragraph("left")],
      [paragraph("upper"), paragraph("lower")],
    ]),
    section("one", "1", [[paragraph("solo")]]),
    section("trio", "1", [
      [paragraph("first"), paragraph("second"), paragraph("third")],
    ]),
    paragraph("tail"),
  ],
};

const START = {
  canvas: ["head", "two", "one", "trio", "tail"],
  two: [["left"], ["upper", "lower"]],
  one: [["solo"]],
  trio: [["first", "second", "third"]],
};

/** Top-level block ids, and each section's column block ids. */
async function layout(editorPage: EditorPage) {
  return {
    canvas: await editorPage.getTopLevelBlockIds(),
    two: [
      await editorPage.getSectionColumnBlockIds(0, 0),
      await editorPage.getSectionColumnBlockIds(0, 1),
    ],
    one: [await editorPage.getSectionColumnBlockIds(1, 0)],
    trio: [await editorPage.getSectionColumnBlockIds(2, 0)],
  };
}

const block = (page: Page, id: string) =>
  page.locator(`[data-block-id="${id}"]`);

/**
 * A column whose last block has been dragged out keeps its 60px drop height
 * for the rest of the drag, rather than collapsing under the pointer. Only a
 * one-column section shows it: in a multi-column section the row's other
 * columns stretch the source column whatever its own height.
 */
async function expectHoldsDropHeight(column: Locator) {
  // The drop line has left the column. All that stays inside is Sortable's
  // floating copy of the block, which takes no space.
  await expect(column.locator(".tpl-ghost")).toHaveCount(0);
  expect((await column.boundingBox())!.height).toBeGreaterThanOrEqual(60);
}

test.describe("Editor cross-container drag-and-drop", () => {
  test.beforeEach(async ({ editorPage, openSharedContent }) => {
    await openSharedContent("cross-container", CONTENT);
    await expect.poll(() => layout(editorPage)).toEqual(START);
  });

  test("reorder blocks within a single section column", async ({
    editorPage,
    page,
  }) => {
    await editorPage.dragBlockByGrip(
      block(page, "first"),
      block(page, "second"),
      "after",
    );

    await expect
      .poll(() => layout(editorPage))
      .toEqual({ ...START, trio: [["second", "first", "third"]] });
  });

  test("move block from canvas top-level into a section column", async ({
    editorPage,
    page,
  }) => {
    await editorPage.dragBlockByGrip(
      block(page, "head"),
      block(page, "first"),
      "after",
    );

    await expect
      .poll(() => layout(editorPage))
      .toEqual({
        ...START,
        canvas: ["two", "one", "trio", "tail"],
        trio: [["first", "head", "second", "third"]],
      });
  });

  test("move child block from section column out to canvas top-level", async ({
    editorPage,
    page,
  }) => {
    await editorPage.dragBlockByGrip(
      block(page, "solo"),
      block(page, "head"),
      "after",
      {
        beforeDrop: () =>
          expectHoldsDropHeight(editorPage.getSectionColumn(1, 0)),
      },
    );

    await expect
      .poll(() => layout(editorPage))
      .toEqual({
        ...START,
        canvas: ["head", "solo", "two", "one", "trio", "tail"],
        one: [[]],
      });
  });

  test("move block between two columns of the same section", async ({
    editorPage,
    page,
  }) => {
    await editorPage.dragBlockByGrip(
      block(page, "left"),
      block(page, "upper"),
      "after",
    );

    await expect
      .poll(() => layout(editorPage))
      .toEqual({ ...START, two: [[], ["upper", "left", "lower"]] });
  });

  test("move block between two different section components", async ({
    editorPage,
    page,
  }) => {
    await editorPage.dragBlockByGrip(
      block(page, "solo"),
      block(page, "second"),
      "before",
      {
        beforeDrop: () =>
          expectHoldsDropHeight(editorPage.getSectionColumn(1, 0)),
      },
    );

    await expect
      .poll(() => layout(editorPage))
      .toEqual({
        ...START,
        one: [[]],
        trio: [["first", "solo", "second", "third"]],
      });
  });
});
