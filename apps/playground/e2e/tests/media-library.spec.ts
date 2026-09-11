import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS, blockByType } from "../helpers/selectors";
import type { Locator, Page } from "@playwright/test";
import { ChooserPage } from "../pages/chooser.page";
import { EditorPage } from "../pages/editor.page";

/**
 * BYO media library in the OSS editor, backed by the playground's
 * `createLocalStorageMediaProvider({ key: "templatical:media" })`.
 *
 * Media is on unless `tpl-playground-media` is `"false"`. The first open of
 * an absent store seeds three Unsplash HTTPS assets; this spec reads that
 * seed rather than writing its own. Drop uses the same synthetic DataTransfer
 * as `imageDropUpload.spec.ts` — Playwright's `dragTo` cannot carry a File.
 *
 * Both Playwright projects pick this spec up; do not `forEach` DOM modes.
 *
 * Read-only (`create: false`) is not wired in the playground — unit tests
 * cover that branch.
 */

const FIRST_SEED_URL =
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80";

/**
 * Tiny PNG header. Enough for `image/png` MIME filtering and a FileReader
 * data URL; the canvas never has to decode it.
 */
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

/**
 * Media-off must be set before navigation — `blankEditorReady` goes to the
 * chooser first, and the flag is read once at `init()`. Same shape as
 * `settings-visibility.spec.ts`.
 */
async function openBlankEditorMediaOff(page: Page, shadowDom: boolean) {
  const chooserPage = new ChooserPage(page, { shadowDom });
  const editorPage = new EditorPage(page);
  await page.addInitScript(() => {
    localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
    localStorage.setItem("tpl-playground-features-dismissed", "true");
    localStorage.setItem("tpl-playground-media", "false");
  });
  await chooserPage.goto();
  await chooserPage.selectBlankTemplate();
  await editorPage.waitForReady();
  await editorPage.dismissOverlays();
  return editorPage;
}

test.describe("Media library", () => {
  test("Browse picks the first seeded asset onto the image block", async ({
    blankEditorReady: { editorPage },
    page,
  }) => {
    await editorPage.clickPaletteItem("image");

    const imageBlock = page.locator(blockByType("image")).first();
    await expect(imageBlock).toBeVisible();
    await imageBlock.locator(SELECTORS.imageBrowseMedia).click();

    const modal = page.locator(SELECTORS.mediaLibraryModal);
    await expect(modal).toBeVisible();

    const firstItem = modal.locator(SELECTORS.mediaLibraryItem).first();
    await expect(firstItem).toBeVisible();
    await expect(firstItem).toHaveAttribute(
      "data-media-id",
      "seed-product-shot",
    );
    await firstItem.click();

    const confirm = page.locator(SELECTORS.mediaConfirm);
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(modal).toBeHidden();

    await expect(imageBlock.locator("img")).toHaveAttribute(
      "src",
      FIRST_SEED_URL,
    );
  });

  test("dropping a PNG onto an image block sets a data URL src", async ({
    blankEditorReady: { editorPage },
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
  });

  test("media disabled: no Browse, drop ignored, URL field still there", async ({
    page,
    shadowDom,
  }) => {
    const editorPage = await openBlankEditorMediaOff(page, shadowDom);
    await editorPage.clickPaletteItem("image");

    const imageBlock = page.locator(blockByType("image")).first();
    await expect(imageBlock).toBeVisible();

    await expect(page.locator(SELECTORS.imageBrowseMedia)).toHaveCount(0);
    await expect(imageBlock.getByText("Click to add image URL")).toBeVisible();

    const dropZone = imageBlock.locator(SELECTORS.imageDropZone);
    await expect(dropZone).toBeVisible();
    await dropPngOn(dropZone);

    // Drop is gated synchronously on `canBrowseMedia`; nothing is queued, so
    // the empty-state copy staying put is the drop-ignored assertion.
    await expect(imageBlock.locator("img")).toHaveCount(0);
    await expect(imageBlock.getByText("Click to add image URL")).toBeVisible();

    await editorPage.selectBlockByType("image");
    const panel = page.locator(SELECTORS.rightPanelContent);
    await expect(panel.getByText("Image URL", { exact: true })).toBeVisible();
    // Image URL and Link URL share this placeholder; both must remain.
    await expect(panel.getByPlaceholder("https://...")).toHaveCount(2);
  });
});
