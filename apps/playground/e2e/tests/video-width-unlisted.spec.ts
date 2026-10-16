import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

/**
 * A video whose width the toolbar's presets don't list (an import's 600px,
 * an agent's arbitrary integer) reads as Custom with that width in the px
 * input, instead of a blank select that overwrites the width when touched.
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
      id: "unlisted-video",
      type: "video",
      url: "",
      thumbnailUrl: "https://cdn.test/video-thumb.jpg",
      alt: "Video",
      width: 600,
      align: "center",
      styles: { padding: { top: 10, right: 10, bottom: 10, left: 10 } },
    },
  ],
};

function canvasThumbnailWidth(page: Page) {
  return page
    .locator('[data-block-id="unlisted-video"] img[alt="Video"]')
    .locator("xpath=..")
    .evaluate((el: HTMLElement) => el.style.width);
}

test.describe("video toolbar with an unlisted width", () => {
  test("the Width control reads Custom with the block's width", async ({
    openSharedContent,
    editorPage,
    page,
  }) => {
    await openSharedContent("unlisted-video-width", CONTENT);
    await editorPage.selectBlockByType("video");

    await expect(page.locator(SELECTORS.videoWidthMode)).toHaveValue("custom");
    await expect(page.locator(SELECTORS.videoWidthInput)).toHaveValue("600");
  });

  test("choosing Custom again keeps the width, and typing one resizes the video", async ({
    openSharedContent,
    editorPage,
    page,
  }) => {
    await openSharedContent("unlisted-video-width", CONTENT);
    await editorPage.selectBlockByType("video");

    await page.locator(SELECTORS.videoWidthMode).selectOption("custom");
    await expect(page.locator(SELECTORS.videoWidthInput)).toHaveValue("600");
    await expect.poll(() => canvasThumbnailWidth(page)).toBe("600px");

    await page.locator(SELECTORS.videoWidthInput).fill("450");
    await expect.poll(() => canvasThumbnailWidth(page)).toBe("450px");
    await expect(page.locator(SELECTORS.videoWidthMode)).toHaveValue("custom");
  });
});
