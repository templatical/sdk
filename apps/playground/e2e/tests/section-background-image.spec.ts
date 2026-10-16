import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS, blockByType } from "../helpers/selectors";

const HERO = "https://cdn.test/hero.jpg";
const BAND = "https://cdn.test/band.jpg";

/**
 * How many `invert(1)` filters lie between the canvas and what `el` paints:
 * `colour` for its background colour and content, `photo` for its background
 * photo — painted by `el` itself or by its dark-preview `::before` layer
 * (`null` when nothing paints one). Odd shows inverted, even shows as it is.
 */
function inversions(el: Element): { colour: number; photo: number | null } {
  const inverts = (filter: string) =>
    (filter.match(/invert\(1\)/g) ?? []).length;
  let colour = 0;
  for (
    let node: Element | null = el;
    node;
    node =
      node.parentElement ?? ((node.getRootNode() as ShadowRoot).host ?? null)
  ) {
    colour += inverts(getComputedStyle(node).filter);
    if (node.classList.contains("tpl-canvas")) break;
  }
  const layer = getComputedStyle(el, "::before");
  const photo = getComputedStyle(el).backgroundImage.startsWith("url(")
    ? colour
    : layer.content !== "none" && layer.backgroundImage.startsWith("url(")
      ? colour + inverts(layer.filter)
      : null;
  return { colour, photo };
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

  test("dark preview inverts the frame with its section once, and leaves the photos as they are", async ({
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
    expect(await frame.evaluate(inversions)).toEqual({ colour: 0, photo: 0 });
    expect(await box.evaluate(inversions)).toEqual({ colour: 0, photo: 0 });

    await editorPage.toggleDarkMode();

    // The frame is the outermost surface, so it carries the one inversion
    // for itself and the section inside it. Each photo moves to a
    // counter-inverted layer, where two inversions cancel.
    await expect
      .poll(() => frame.evaluate(inversions))
      .toEqual({ colour: 1, photo: 2 });
    expect(await box.evaluate(inversions)).toEqual({ colour: 1, photo: 2 });
  });
});
