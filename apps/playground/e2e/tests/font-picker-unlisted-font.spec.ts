import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

/**
 * A block or text whose font the picker doesn't offer: the select shows that
 * font instead of going blank, and the extra option goes once another font is
 * chosen. A CSS-wide keyword shows the option for no font of its own.
 */

const PADDING = { padding: { top: 10, right: 10, bottom: 10, left: 10 } };

function title(id: string, text: string, fontFamily: string) {
  return {
    id,
    type: "title",
    content: `<p>${text}</p>`,
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
    fontFamily: "Arial",
    locale: "en",
  },
  blocks: [
    title("unlisted-title", "Imported title", "Helvetica Neue, Arial"),
    title("inherit-title", "Inherited title", "inherit"),
    {
      id: "unlisted-paragraph",
      type: "paragraph",
      content:
        "<p><span style=\"font-family: Lato, 'Segoe UI', sans-serif\">Imported text</span></p>",
      styles: PADDING,
    },
  ],
};

const selectedLabel = (select: Locator) =>
  select.evaluate((el: HTMLSelectElement) =>
    el.options[el.selectedIndex]?.text.trim(),
  );

function titleFontSelect(page: Page): Locator {
  return page
    .locator(SELECTORS.rightSidebar)
    .locator("label", { hasText: "Font Family" })
    .locator("xpath=following-sibling::select");
}

test.describe("font picker with an unlisted font", () => {
  test("the title toolbar shows the block's font until another is chosen", async ({
    openSharedContent,
    page,
  }) => {
    await openSharedContent("unlisted-font", CONTENT);
    await page.locator('[data-block-id="unlisted-title"]').click();

    const select = titleFontSelect(page);
    await expect.poll(() => selectedLabel(select)).toBe("Helvetica Neue");

    await select.selectOption("Georgia");
    await expect.poll(() => selectedLabel(select)).toBe("Georgia");
    await expect(
      select.locator("option", { hasText: "Helvetica Neue" }),
    ).toHaveCount(0);
  });

  test("the title toolbar shows a CSS-wide keyword as the template font option", async ({
    openSharedContent,
    page,
  }) => {
    await openSharedContent("unlisted-font", CONTENT);
    await page.locator('[data-block-id="inherit-title"]').click();

    const select = titleFontSelect(page);
    await expect.poll(() => selectedLabel(select)).toBe("Use template font");
    await expect(
      select.locator("option", { hasText: /^inherit$/ }),
    ).toHaveCount(0);
  });

  test("the paragraph toolbar shows the selected text's font until another is chosen", async ({
    openSharedContent,
    page,
  }) => {
    await openSharedContent("unlisted-font", CONTENT);
    await page.locator('[data-block-id="unlisted-paragraph"]').dblclick();
    await page.keyboard.press("ControlOrMeta+a");

    const select = page
      .locator(SELECTORS.textToolbar)
      .getByRole("combobox", { name: "Font Family" });
    await expect.poll(() => selectedLabel(select)).toBe("Lato");

    await select.selectOption("Georgia");
    await expect.poll(() => selectedLabel(select)).toBe("Georgia");
    await expect(select.locator("option", { hasText: "Lato" })).toHaveCount(0);
  });
});
