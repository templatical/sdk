import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

/**
 * The canvas previews a font with the fallbacks the email gets. A family the
 * browser doesn't have is followed by the default fallback (`Arial,
 * sans-serif` with no fonts config), as the renderer emits it, so the canvas
 * doesn't drop to the browser's default serif while the email shows Arial.
 */

const PADDING = { padding: { top: 10, right: 10, bottom: 10, left: 10 } };

function title(id: string, fontFamily: string) {
  return {
    id,
    type: "title",
    content: "<p>Heading</p>",
    level: 2,
    textAlign: "left",
    styles: PADDING,
    fontFamily,
  };
}

const CONTENT = {
  settings: {
    width: 600,
    backgroundColor: "#ffffff",
    textColor: "#1a1a1a",
    fontFamily: "Imaginary Serif",
    locale: "en",
  },
  blocks: [
    title("unknown-title", "Imaginary Sans"),
    title("built-in-title", "georgia"),
    {
      id: "body",
      type: "paragraph",
      content: "<p>Body text</p>",
      styles: PADDING,
    },
  ],
};

/** The computed `font-family` as family names, quotes dropped. */
const families = (element: Locator) =>
  element.evaluate((el) =>
    getComputedStyle(el)
      .fontFamily.split(",")
      .map((family) => family.trim().replace(/^["']|["']$/g, "")),
  );

const titleFont = (page: Page, id: string) =>
  page.locator(`[data-block-id="${id}"] [style*="font-family"]`).first();

test.describe("canvas font fallback", () => {
  test("a title in an unknown font falls back as the email does", async ({
    openSharedContent,
    page,
  }) => {
    await openSharedContent("canvas-font-fallback", CONTENT);

    await expect
      .poll(() => families(titleFont(page, "unknown-title")))
      .toEqual(["Imaginary Sans", "Arial", "sans-serif"]);
  });

  test("a title in a built-in font gets its stack", async ({
    openSharedContent,
    page,
  }) => {
    await openSharedContent("canvas-font-fallback", CONTENT);

    await expect
      .poll(() => families(titleFont(page, "built-in-title")))
      .toEqual(["Georgia", "serif"]);
  });

  test("the template font falls back as <mj-all> does", async ({
    openSharedContent,
    page,
  }) => {
    await openSharedContent("canvas-font-fallback", CONTENT);

    await expect
      .poll(() => families(page.locator(SELECTORS.canvas).first()))
      .toEqual(["Imaginary Serif", "Arial", "sans-serif"]);
  });
});
