import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS, blockByType } from "../helpers/selectors";

/**
 * A full-width band is `width: 100cqw` plus
 * `margin-inline: calc(50% - 50cqw)` on a `container-type: inline-size`
 * pane. happy-dom drops `100cqw` from the serialized style, so only a
 * browser can show that the band meets the pane and the frame stays at
 * the email width.
 */

const EMAIL_WIDTH = 600;
const BAND_HEX = "#1c25ff";
const BAND_RGB = "rgb(28, 37, 255)";

type Box = { x: number; y: number; width: number; height: number };

type BandBoxes = {
  band: Box;
  frame: Box;
  pane: Box;
};

async function readBand(
  page: Page,
  section: Locator,
): Promise<BandBoxes | null> {
  const band = await section.locator(".tpl-section-wrapper").boundingBox();
  const frame = await section
    .locator(".tpl-section-wrapper > .tpl-band-frame")
    .boundingBox();
  const pane = await page.locator(".tpl-main").boundingBox();
  if (!band || !frame || !pane) return null;
  return { band, frame, pane };
}

/** True when `actual` is within 1px of `expected`. */
function near(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) <= 1;
}

test.describe("full-width section band", () => {
  test("bleeds to the canvas pane and returns to the email width", async ({
    editorReady,
    page,
  }) => {
    await expect(page.locator(blockByType("section"))).toHaveCount(2);
    await expect(page.locator(SELECTORS.viewportDesktop)).toHaveAttribute(
      "aria-checked",
      "true",
    );

    // A pointer click on a populated section lands on a column child
    // (`stopPropagation`), so the click is dispatched on the section.
    // The Launchpad sample's two-column feature section.
    const section = page
      .locator(blockByType("section"))
      .filter({ hasText: "Redesigned Dashboard" });
    await section.scrollIntoViewIfNeeded();
    await section.dispatchEvent("click");
    await expect(section).toHaveClass(/tpl-block--selected/);
    await page.locator(SELECTORS.blockToolbar).waitFor();
    await expect(
      page.getByRole("switch", { name: "Stack on mobile" }),
    ).toBeVisible();

    await page.locator(SELECTORS.blockSettingsBackground).click();
    const toggle = page
      .locator(SELECTORS.sectionBackgroundFullWidth)
      .getByRole("switch");
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(section.locator(".tpl-band-frame")).toBeVisible();

    await expect
      .poll(async () => {
        const boxes = await readBand(page, section);
        if (!boxes) return null;
        const { band, frame, pane } = boxes;
        const frameCenter = frame.x + frame.width / 2;
        const paneCenter = pane.x + pane.width / 2;
        return {
          bandX: near(band.x, pane.x),
          bandWidth: near(band.width, pane.width),
          frameWidth: near(frame.width, EMAIL_WIDTH),
          frameCenter: near(frameCenter, paneCenter),
          // The pane has to be wider than the email, or a band that
          // matches the pane would not be a bleed.
          paneWider: pane.width > EMAIL_WIDTH + 1,
          bandXPx: band.x,
          paneXPx: pane.x,
          bandWidthPx: band.width,
          paneWidthPx: pane.width,
          frameWidthPx: frame.width,
          frameCenterPx: frameCenter,
          paneCenterPx: paneCenter,
        };
      })
      .toEqual(
        expect.objectContaining({
          bandX: true,
          bandWidth: true,
          frameWidth: true,
          frameCenter: true,
          paneWider: true,
        }),
      );

    // The band colour in the Background panel; the Wrapper panel shows the
    // same field.
    const hex = page
      .locator(SELECTORS.blockSettingsBackgroundContent)
      .locator(SELECTORS.wrapperBackgroundColorInput);
    await hex.fill(BAND_HEX);
    const band = section.locator(".tpl-section-wrapper");
    await expect
      .poll(() => band.evaluate((el) => getComputedStyle(el).backgroundColor))
      .toBe(BAND_RGB);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(page.locator(".tpl-band-frame")).toHaveCount(0);
    await expect
      .poll(async () => {
        const box = await section.boundingBox();
        if (!box) return null;
        return { width: near(box.width, EMAIL_WIDTH), widthPx: box.width };
      })
      .toEqual(expect.objectContaining({ width: true }));
  });
});
