import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

/**
 * A blank line between paragraphs is one line tall while editing, on the
 * canvas and in the compiled email (#930). TipTap stores it as `<p></p>`,
 * which has no height outside the edit surface unless it is filled.
 */

const PARAGRAPH_ID = "blank-line-paragraph";

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
      id: PARAGRAPH_ID,
      type: "paragraph",
      content:
        '<p style="text-align: left;">First line</p><p style="text-align: left;"></p><p style="text-align: left;">Second line</p>',
      styles: { padding: { top: 10, right: 10, bottom: 10, left: 10 } },
    },
  ],
};

/** Heights of the paragraphs inside `root`, in document order. */
const paragraphHeights = (root: Locator): Promise<number[]> =>
  root
    .locator("p")
    .evaluateAll((ps) => ps.map((p) => p.getBoundingClientRect().height));

const block = (page: Page) => page.locator(`[data-block-id="${PARAGRAPH_ID}"]`);

test.describe("blank lines in text blocks", () => {
  test("a blank line is one line tall on the canvas, as while editing", async ({
    openSharedContent,
    page,
  }) => {
    await openSharedContent("text-blank-lines", CONTENT);

    const view = await paragraphHeights(
      block(page).locator(SELECTORS.textContent),
    );
    expect(view).toHaveLength(3);
    expect(view[0]).toBeGreaterThan(0);
    expect(view[1]).toBeCloseTo(view[0], 1);

    await block(page).dblclick();
    const surface = block(page).locator(".tiptap");
    await surface.locator("p").first().waitFor();
    const edit = await paragraphHeights(surface);
    expect(edit).toHaveLength(3);
    expect(edit[1]).toBeCloseTo(view[1], 1);
  });

  test("the compiled email keeps the blank line", async ({
    openSharedContent,
    editorPage,
    page,
  }) => {
    await openSharedContent("text-blank-lines", CONTENT);
    const canvas = await paragraphHeights(
      block(page).locator(SELECTORS.textContent),
    );

    await editorPage.closeCodeDrawer();
    await editorPage.openExport();
    const frame = page.frameLocator(SELECTORS.exportPreviewFrame);
    const first = frame.locator("p", { hasText: "First line" });
    await first.waitFor();
    const email = await first
      .locator("xpath=..")
      .locator("p")
      .evaluateAll((ps) => ps.map((p) => p.getBoundingClientRect().height));

    expect(email).toHaveLength(3);
    expect(email[1]).toBeGreaterThan(0);
    expect(email[1]).toBeCloseTo(email[0], 1);
    expect(email[1]).toBeCloseTo(canvas[1], 1);
  });
});
