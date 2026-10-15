import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS, blockByType } from "../helpers/selectors";

const HERO = "https://cdn.test/hero.jpg";

test.describe("Section background image", () => {
  test("paints on the canvas and exports as an MJML background", async ({
    blankEditorReady: { editorPage },
    page,
  }) => {
    await editorPage.clickPaletteItem("section");
    await editorPage.selectBlockByType("section");

    const panel = page.locator(SELECTORS.rightPanelContent);
    await panel.locator('[data-testid="block-settings-background"]').click();
    await panel.locator('[data-testid="section-bg-url"] input').fill(HERO);

    const box = page
      .locator(blockByType("section"))
      .first()
      .locator(".tpl-block-content")
      .first();
    await expect(box).toHaveAttribute(
      "style",
      /background-image: url\("https:\/\/cdn\.test\/hero\.jpg"\)/,
    );
    await expect(box).toHaveAttribute("style", /background-size: cover/);

    await editorPage.openExport();
    await expect(page.locator(SELECTORS.exportPreviewFrame)).toHaveAttribute(
      "srcdoc",
      /url\('https:\/\/cdn\.test\/hero\.jpg'\) center center \/ cover no-repeat/,
    );
  });
});
