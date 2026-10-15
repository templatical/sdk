import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS, blockByType } from "../helpers/selectors";
import type { Locator, Page } from "@playwright/test";

/**
 * `init({ onRequestMedia })` on `/scenes/media-on-request`: Browse calls the
 * host's callback, which opens the playground's own modal instead of the
 * editor's media library, and a drop hands the callback the file.
 *
 * Both Playwright projects pick this spec up; do not `forEach` DOM modes.
 */

const PICKED_ALT = "Sable Boom Speaker";
const PICKED_PATH = "/examples/sable/speaker.png";

/** Same synthetic DataTransfer as `media-library.spec.ts`. */
function dropPngOn(dropZone: Locator) {
  return dropZone.evaluate((el) => {
    const dt = new DataTransfer();
    dt.items.add(
      new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "e2e.png", {
        type: "image/png",
      }),
    );
    for (const type of ["dragenter", "dragover", "drop"]) {
      el.dispatchEvent(
        new DragEvent(type, {
          dataTransfer: dt,
          bubbles: true,
          cancelable: true,
        }),
      );
    }
  });
}

/** The host returns absolute URLs, so the src outlives this page. */
function pickedUrl(page: Page): string {
  return new URL(PICKED_PATH, page.url()).href;
}

test.describe("Media on request", () => {
  test.beforeEach(async ({ scenePage, editorPage }) => {
    await scenePage.goto("media-on-request");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
  });

  test("Browse opens the host picker, not the library, and a pick sets src and alt", async ({
    editorPage,
    page,
  }) => {
    await editorPage.clickPaletteItem("image");

    const imageBlock = page.locator(blockByType("image")).first();
    await expect(imageBlock).toBeVisible();
    await imageBlock.locator(SELECTORS.imageBrowseMedia).click();

    const modal = page.locator(SELECTORS.playgroundMediaModal);
    await expect(modal).toBeVisible();
    await expect(page.locator(SELECTORS.mediaLibraryModal)).toHaveCount(0);

    await modal.getByRole("button", { name: PICKED_ALT }).click();
    await expect(modal).toHaveCount(0);

    const img = imageBlock.locator("img");
    await expect(img).toHaveAttribute("src", pickedUrl(page));
    await expect(img).toHaveAttribute("alt", PICKED_ALT);
  });

  test("closing the host picker leaves the image as it was", async ({
    editorPage,
    page,
  }) => {
    await editorPage.clickPaletteItem("image");

    const imageBlock = page.locator(blockByType("image")).first();
    await imageBlock.locator(SELECTORS.imageBrowseMedia).click();
    const modal = page.locator(SELECTORS.playgroundMediaModal);
    await modal.getByRole("button", { name: PICKED_ALT }).click();

    const img = imageBlock.locator("img");
    await expect(img).toHaveAttribute("src", pickedUrl(page));

    // A filled block has no Browse of its own; the toolbar field keeps one.
    await editorPage.selectBlockByType("image");
    const browse = page
      .locator(SELECTORS.blockToolbar)
      .getByRole("button", { name: "Browse Media" });

    await browse.click();
    await expect(modal).toBeVisible();
    await modal.getByRole("button", { name: "Close" }).click();
    await expect(modal).toHaveCount(0);
    await expect(img).toHaveAttribute("src", pickedUrl(page));
    await expect(img).toHaveAttribute("alt", PICKED_ALT);

    await browse.click();
    await expect(modal).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(modal).toHaveCount(0);
    await expect(img).toHaveAttribute("src", pickedUrl(page));
  });

  test("dropping a PNG hands the file to the callback, which sets a data URL src", async ({
    editorPage,
    page,
  }) => {
    await editorPage.clickPaletteItem("image");

    const imageBlock = page.locator(blockByType("image")).first();
    const dropZone = imageBlock.locator(SELECTORS.imageDropZone);
    await expect(dropZone).toBeVisible();

    await dropPngOn(dropZone);

    await expect(imageBlock.locator("img")).toHaveAttribute(
      "src",
      /^data:image\/png/,
    );
    await expect(page.locator(SELECTORS.playgroundMediaModal)).toHaveCount(0);
  });
});
