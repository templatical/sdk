import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../fixtures/editor.fixture";

/**
 * A title or paragraph enters editing where it already is (#930). The edit
 * surface used to add a border and padding, which narrowed the text column by
 * 18px and moved its line breaks, and a title switched to a taller line
 * height. The text box must be identical in view and edit mode.
 */

const PADDING = { padding: { top: 10, right: 10, bottom: 10, left: 10 } };

const LONG =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod " +
  "tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim " +
  "veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea " +
  "commodo consequat. Duis aute irure dolor in reprehenderit in voluptate.";

const CONTENT = {
  settings: {
    width: 600,
    backgroundColor: "#ffffff",
    textColor: "#1a1a1a",
    fontFamily: "Arial, sans-serif",
    locale: "en",
  },
  blocks: [
    {
      id: "in-place-title",
      type: "title",
      content: `<p>${LONG.slice(0, 150)}</p>`,
      level: 2,
      textAlign: "left",
      styles: PADDING,
    },
    {
      id: "in-place-paragraph",
      type: "paragraph",
      content: `<p>${LONG}</p>`,
      styles: PADDING,
    },
  ],
};

interface TextBox {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Distinct line-box tops, so a rewrap shows up even at equal height. */
  lines: number;
}

/** The box of an element's text, plus how many lines it wraps onto. */
const textBox = (element: Locator): Promise<TextBox> =>
  element.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const range = el.ownerDocument.createRange();
    range.selectNodeContents(el);
    const tops = new Set(
      [...range.getClientRects()].map((rect) => Math.round(rect.top)),
    );
    return {
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      lines: tops.size,
    };
  });

const block = (page: Page, id: string) =>
  page.locator(`[data-block-id="${id}"]`);

async function viewAndEditBoxes(
  page: Page,
  id: string,
  viewText: string,
): Promise<{ view: TextBox; edit: TextBox }> {
  const view = await textBox(block(page, id).locator(viewText));
  await block(page, id).dblclick();
  const editText = block(page, id).locator(".tiptap p").first();
  await editText.waitFor();
  return { view, edit: await textBox(editText) };
}

function expectSameBox(edit: TextBox, view: TextBox): void {
  expect(view.lines).toBeGreaterThan(1);
  expect(edit.lines).toBe(view.lines);
  expect(edit.x).toBeCloseTo(view.x, 1);
  expect(edit.y).toBeCloseTo(view.y, 1);
  expect(edit.width).toBeCloseTo(view.width, 1);
  expect(edit.height).toBeCloseTo(view.height, 1);
}

test.describe("text blocks edit in place", () => {
  test("a paragraph keeps its text box when editing starts", async ({
    openSharedContent,
    page,
  }) => {
    await openSharedContent("text-edit-in-place", CONTENT);
    const { view, edit } = await viewAndEditBoxes(
      page,
      "in-place-paragraph",
      ".tpl-text-content p",
    );
    expectSameBox(edit, view);
  });

  test("a title keeps its text box and line height when editing starts", async ({
    openSharedContent,
    page,
  }) => {
    await openSharedContent("text-edit-in-place", CONTENT);
    const { view, edit } = await viewAndEditBoxes(
      page,
      "in-place-title",
      ".tpl-text-content",
    );
    expectSameBox(edit, view);
  });

  test("the editing ring is an outline outside the text", async ({
    openSharedContent,
    page,
  }) => {
    await openSharedContent("text-edit-in-place", CONTENT);
    await block(page, "in-place-paragraph").dblclick();
    const surface = block(page, "in-place-paragraph").locator(
      ".tpl-text-editable",
    );
    await surface.locator(".tiptap").waitFor();
    const style = await surface.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        padding: cs.padding,
        border: cs.borderTopWidth,
        outlineStyle: cs.outlineStyle,
        outlineOffset: cs.outlineOffset,
      };
    });
    expect(style).toEqual({
      padding: "0px",
      border: "0px",
      outlineStyle: "dashed",
      outlineOffset: "4px",
    });
  });
});
