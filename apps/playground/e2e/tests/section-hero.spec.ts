import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures/editor.fixture";
import type { EditorPage } from "../pages/editor.page";
import { SELECTORS, blockByType, paletteByType } from "../helpers/selectors";

const HERO = "https://cdn.test/hero.svg";
const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#334155"/></svg>';

/**
 * The Hero entry inserts a section with a title, paragraph and button, so the
 * one-block check in `clickPaletteItem` doesn't fit it.
 */
async function insertHero(page: Page, editorPage: EditorPage): Promise<void> {
  const before = await editorPage.getBlocks().count();
  await page
    .locator(SELECTORS.sidebarRail)
    .locator(paletteByType("hero"))
    .click();
  await expect
    .poll(() => editorPage.getBlocks().count(), { timeout: 5000 })
    .toBe(before + 4);
}

/**
 * A click at a populated section's centre lands on a child block, so aim at
 * the middle of its top padding, which only the section covers. The middle is
 * also clear of the palette rail, which overlays the canvas's left edge while
 * the pointer is on it.
 */
async function selectSection(page: Page): Promise<void> {
  const section = page.locator(blockByType("section")).first();
  const box = await section.boundingBox();
  if (!box) throw new Error("Section not found");
  await section.click({ position: { x: box.width / 2, y: 5 } });
  await expect(section).toHaveClass(/tpl-block--selected/);
  await page.locator(SELECTORS.blockToolbar).waitFor();
}

test.describe("section hero", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(HERO, (route) =>
      route.fulfill({ contentType: "image/svg+xml", body: SVG }),
    );
  });

  test("the Hero shortcut becomes an mj-hero once it has an image", async ({
    blankEditorReady: { editorPage },
    page,
  }) => {
    await insertHero(page, editorPage);
    const section = page.locator(blockByType("section")).first();
    await expect(section.getByTestId("hero-image-hint")).toBeVisible();

    await selectSection(page);
    const panel = page.locator(SELECTORS.rightPanelContent);
    await panel.locator('[data-testid="block-settings-background"]').click();
    await panel.locator('[data-testid="section-bg-url"] input').fill(HERO);

    // Measured after typing settles: a 600px body draws the 1200×800 image
    // 400px tall, and the box takes that height.
    const box = section.locator(".tpl-block-content").first();
    await expect(box).toHaveAttribute("style", /min-height: 400px/);
    await expect(section.getByTestId("hero-image-hint")).toHaveCount(0);

    // A fixed height classic Outlook keeps: 400 less the 48px top and bottom
    // padding, with the image drawn at its own 600×400.
    await editorPage.openExport();
    const frame = page.locator(SELECTORS.exportPreviewFrame);
    await expect(frame).toHaveAttribute("srcdoc", /height="304"/);
    await expect(frame).toHaveAttribute(
      "srcdoc",
      /<v:image style="border:0;height:400px;[^"]*width:600px;/,
    );
  });

  test("Fixed starts at the height the image shows at", async ({
    blankEditorReady: { editorPage },
    page,
  }) => {
    await insertHero(page, editorPage);
    await selectSection(page);
    const panel = page.locator(SELECTORS.rightPanelContent);
    await panel.locator('[data-testid="block-settings-background"]').click();
    await panel.locator('[data-testid="section-bg-url"] input').fill(HERO);
    const box = page
      .locator(blockByType("section"))
      .first()
      .locator(".tpl-block-content")
      .first();
    await expect(box).toHaveAttribute("style", /min-height: 400px/);

    await panel
      .locator('[data-testid="section-hero-height"]')
      .getByRole("radio", { name: "Fixed" })
      .click();
    // A 600px body draws a 1200×800 image 400px tall.
    await expect(
      panel.locator('[data-testid="section-hero-height-px"]'),
    ).toHaveValue("400");
    await expect(box).toHaveAttribute("style", /min-height: 400px/);
  });

  test("two columns explain why the hero is off", async ({
    blankEditorReady: { editorPage },
    page,
  }) => {
    await insertHero(page, editorPage);
    await selectSection(page);
    const panel = page.locator(SELECTORS.rightPanelContent);
    await panel.locator("select").first().selectOption("2");
    await panel.locator('[data-testid="block-settings-background"]').click();
    await expect(
      panel.locator('[data-testid="section-hero-columns-note"]'),
    ).toBeVisible();
  });
});
