import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS, blockByType } from "../helpers/selectors";

const HERO = "https://cdn.test/hero.jpg";
const BAND = "https://cdn.test/band.jpg";

/**
 * How many `invert(1)` filters lie between the canvas and whatever paints
 * `el`'s background photo — `el` itself, or its dark-preview `::before` layer.
 * Even means the photo shows as it is; `null` means nothing paints it.
 */
function photoInversions(el: Element): number | null {
  const inverts = (filter: string) =>
    (filter.match(/invert\(1\)/g) ?? []).length;
  let count = 0;
  for (
    let node: Element | null = el;
    node;
    node =
      node.parentElement ?? ((node.getRootNode() as ShadowRoot).host ?? null)
  ) {
    count += inverts(getComputedStyle(node).filter);
    if (node.classList.contains("tpl-canvas")) break;
  }
  if (getComputedStyle(el).backgroundImage.startsWith("url(")) return count;
  const layer = getComputedStyle(el, "::before");
  if (layer.content !== "none" && layer.backgroundImage.startsWith("url(")) {
    return count + inverts(layer.filter);
  }
  return null;
}

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

  test("dark preview leaves the photos un-inverted, like an image", async ({
    blankEditorReady: { editorPage },
    page,
  }) => {
    await editorPage.clickPaletteItem("section");
    await editorPage.selectBlockByType("section");

    const panel = page.locator(SELECTORS.rightPanelContent);
    await panel.locator('[data-testid="block-settings-background"]').click();
    await panel.locator('[data-testid="section-bg-url"] input').fill(HERO);
    await panel.getByRole("switch", { name: "Add wrapper" }).click();
    await panel
      .locator('[data-testid="section-wrapper-bg-url"] input')
      .fill(BAND);

    const section = page.locator(blockByType("section")).first();
    const box = section.locator(".tpl-block-content").first();
    const frame = section.locator(".tpl-section-wrapper");
    await expect(box).toHaveAttribute(
      "style",
      /url\("https:\/\/cdn\.test\/hero\.jpg"\)/,
    );
    await expect(frame).toHaveAttribute(
      "style",
      /url\("https:\/\/cdn\.test\/band\.jpg"\)/,
    );
    expect(await box.evaluate(photoInversions)).toBe(0);
    expect(await frame.evaluate(photoInversions)).toBe(0);

    await editorPage.toggleDarkMode();

    // The box is the filter target, so its photo moves to a counter-inverted
    // layer: two inversions cancel. The frame sits outside the filter and
    // keeps painting its own photo, never inverted.
    await expect.poll(() => box.evaluate(photoInversions)).toBe(2);
    expect(await frame.evaluate(photoInversions)).toBe(0);
  });
});
