import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS, paletteByType } from "../helpers/selectors";
import type { EditorPage } from "../pages/editor.page";

/**
 * A section column fills its row, so the whitespace under a short column's
 * last block is that column's drop area. A palette block brought in sideways
 * over a taller neighbor and dropped there lands at the end of the short
 * column.
 */

const PADDING = { padding: { top: 10, right: 10, bottom: 10, left: 10 } };
const TALL_IMAGE =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#cbd5e1"/></svg>',
  );

const CONTENT = {
  settings: {
    width: 600,
    backgroundColor: "#ffffff",
    textColor: "#1a1a1a",
    fontFamily: "Arial",
    locale: "en",
  },
  blocks: [
    {
      id: "section",
      type: "section",
      columns: "2",
      styles: PADDING,
      children: [
        [
          {
            id: "image",
            type: "image",
            src: TALL_IMAGE,
            alt: "",
            width: "full",
            height: 300,
            align: "center",
            styles: PADDING,
          },
        ],
        [
          {
            id: "text",
            type: "paragraph",
            content: "<p>Short text</p>",
            styles: PADDING,
          },
        ],
      ],
    },
  ],
};

/** Top-level and column block ids, with the dropped block's id as "dropped". */
async function layout(editorPage: EditorPage) {
  const name = (id: string) =>
    ["section", "image", "text"].includes(id) ? id : "dropped";
  return {
    canvas: (await editorPage.getTopLevelBlockIds()).map(name),
    columns: [
      (await editorPage.getSectionColumnBlockIds(0, 0)).map(name),
      (await editorPage.getSectionColumnBlockIds(0, 1)).map(name),
    ],
  };
}

test.describe("Section column drop area", () => {
  for (const gap of [12, 150]) {
    test(`a palette drop ${gap}px below a short column's block lands after it`, async ({
      editorPage,
      openSharedContent,
      page,
    }) => {
      await openSharedContent("column-drop-area", CONTENT);

      const imageColumnBox = (await editorPage
        .getSectionColumn(0, 0)
        .boundingBox())!;
      const textBox = (await page
        .locator('[data-block-id="text"]')
        .boundingBox())!;
      const textColumnBox = (await editorPage
        .getSectionColumn(0, 1)
        .boundingBox())!;
      const y = textBox.y + textBox.height + gap;
      expect(y).toBeLessThan(imageColumnBox.y + imageColumnBox.height - 20);

      await editorPage.hoverSidebar();
      const item = page
        .locator(SELECTORS.sidebarRail)
        .locator(paletteByType("divider"));
      const itemBox = (await item.boundingBox())!;
      const startX = itemBox.x + itemBox.width / 2;
      const startY = itemBox.y + itemBox.height / 2;
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      // Clears the palette's 4px drag-start tolerance.
      await page.mouse.move(startX + 4, startY + 4);

      // Over the image column at the target height, then sideways into the
      // whitespace below the text.
      const x = textColumnBox.x + textColumnBox.width / 2;
      await page.mouse.move(imageColumnBox.x + imageColumnBox.width / 2, y, {
        steps: 20,
      });
      await page.mouse.move(x, y, { steps: 10 });
      // Settle frames for Sortable's 50ms drag-over interval.
      await page.mouse.move(x, y);
      await page.mouse.move(x, y);
      await page.mouse.up();

      await expect
        .poll(() => layout(editorPage))
        .toEqual({
          canvas: ["section"],
          columns: [["image"], ["text", "dropped"]],
        });
    });
  }
});
