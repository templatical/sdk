import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

/**
 * The image toolbar's aspect-ratio lock, against a real file the editor has to
 * measure: the playground's `dashboard.png` is 1120 × 600, and the block
 * stores no natural size. A top-level image in a 600px body with 10px of side
 * padding has 580px of room.
 */

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
      id: "lock-image",
      type: "image",
      src: "/examples/launchpad/dashboard.png",
      alt: "Dashboard",
      width: 300,
      align: "center",
      styles: { padding: { top: 10, right: 10, bottom: 10, left: 10 } },
    },
  ],
};

async function canvasImageSize(page: Page): Promise<[number, number]> {
  const box = await page
    .locator('[data-block-id="lock-image"] img[alt="Dashboard"]')
    .boundingBox();
  return box ? [Math.round(box.width), Math.round(box.height)] : [0, 0];
}

async function openLockedImage(
  openSharedContent: (id: string, content: unknown) => Promise<void>,
  editorPage: { selectBlockByType: (type: string) => Promise<void> },
  page: Page,
) {
  await openSharedContent("image-aspect-lock", CONTENT);
  await editorPage.selectBlockByType("image");
  // The lock appears once the editor has measured the file.
  await expect(page.locator(SELECTORS.imageAspectLock)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
}

test.describe("image aspect-ratio lock", () => {
  test("measures the file and shows the height its width gives", async ({
    openSharedContent,
    editorPage,
    page,
  }) => {
    await openLockedImage(openSharedContent, editorPage, page);

    // 300 × 600 / 1120 = 160.7.
    await expect(page.locator(SELECTORS.imageLockedHeightInput)).toHaveValue(
      "161",
    );
    await expect(page.locator(SELECTORS.imageHeightMode)).toHaveCount(0);
    await expect.poll(() => canvasImageSize(page)).toEqual([300, 161]);
  });

  test("a typed height sets the width and the canvas keeps the file's ratio", async ({
    openSharedContent,
    editorPage,
    page,
  }) => {
    await openLockedImage(openSharedContent, editorPage, page);

    await page.locator(SELECTORS.imageLockedHeightInput).fill("120");

    await expect(page.locator(SELECTORS.imageWidthMode)).toHaveValue("custom");
    await expect(page.locator(SELECTORS.imageWidthInput)).toHaveValue("224");
    await expect.poll(() => canvasImageSize(page)).toEqual([224, 120]);
    await expect(page.locator(SELECTORS.imageHeightCapped)).toHaveCount(0);
  });

  test("a height that would overflow the column caps the image at Full width", async ({
    openSharedContent,
    editorPage,
    page,
  }) => {
    await openLockedImage(openSharedContent, editorPage, page);

    // 400 × 1120 / 600 = 747, wider than the 580px of room.
    await page.locator(SELECTORS.imageLockedHeightInput).fill("400");

    await expect(page.locator(SELECTORS.imageWidthMode)).toHaveValue("full");
    await expect(page.locator(SELECTORS.imageHeightCapped)).toHaveText(
      "Capped at the column width, 311px tall",
    );
    await expect.poll(() => canvasImageSize(page)).toEqual([580, 311]);
  });

  // The reason the lock stores no height: in a column narrower than the image
  // (a phone), a stored height stays put while the width shrinks, so the image
  // squashes even when the stored height matched the ratio.
  test("keeps the file's ratio in the mobile preview", async ({
    openSharedContent,
    editorPage,
    page,
  }) => {
    await openLockedImage(openSharedContent, editorPage, page);

    // 200 × 1120 / 600 = 373: under the 580px room, wider than a phone.
    await page.locator(SELECTORS.imageLockedHeightInput).fill("200");
    await expect(page.locator(SELECTORS.imageWidthInput)).toHaveValue("373");
    await expect.poll(() => canvasImageSize(page)).toEqual([373, 200]);

    await editorPage.switchViewport("Mobile");

    // 375 less 20px of padding is 355 wide; 355 × 600 / 1120 = 190.
    await expect.poll(() => canvasImageSize(page)).toEqual([355, 190]);
  });

  test("turning the lock off brings back the Auto / Custom height controls", async ({
    openSharedContent,
    editorPage,
    page,
  }) => {
    await openLockedImage(openSharedContent, editorPage, page);

    await page.locator(SELECTORS.imageAspectLock).click();

    await expect(page.locator(SELECTORS.imageAspectLock)).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(page.locator(SELECTORS.imageHeightMode)).toHaveValue("auto");
    await expect(page.locator(SELECTORS.imageLockedHeightInput)).toHaveCount(0);
    await expect.poll(() => canvasImageSize(page)).toEqual([300, 161]);
  });
});
