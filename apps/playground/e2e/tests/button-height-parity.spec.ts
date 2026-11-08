import { createButtonBlock } from "@templatical/types";
import { test, expect } from "../fixtures/editor.fixture";
import { animationsFinished } from "../helpers/motion";
import { SELECTORS } from "../helpers/selectors";

const CONTENT = {
  settings: {
    width: 600,
    backgroundColor: "#ffffff",
    textColor: "#1a1a1a",
    fontFamily: "Arial, sans-serif",
    locale: "en",
  },
  blocks: [
    createButtonBlock({
      id: "height-parity-button",
      text: "Height parity",
      url: "https://example.com",
      fontSize: 16,
      buttonPadding: { top: 18, right: 40, bottom: 18, left: 40 },
      styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    }),
  ],
};

test("button height matches the exported preview at 55px", async ({
  openSharedContent,
  editorPage,
  page,
}) => {
  await openSharedContent("button-height-parity", CONTENT);
  const canvasAnchor = page.locator('[data-block-id="height-parity-button"] a');
  await expect(canvasAnchor).toBeVisible();
  await animationsFinished(canvasAnchor);
  const canvasHeight = await canvasAnchor.evaluate(
    (anchor: HTMLElement) => anchor.offsetHeight,
  );

  await editorPage.closeCodeDrawer();
  await editorPage.openExport();
  await expect(page.locator(SELECTORS.exportPreviewFrame)).toHaveAttribute(
    "srcdoc",
    /^<!doctype html>/i,
  );
  const previewAnchor = page
    .frameLocator(SELECTORS.exportPreviewFrame)
    .getByRole("link", { name: "Height parity" });
  await expect(previewAnchor).toBeVisible();
  const previewHeight = await previewAnchor.evaluate(
    (anchor: HTMLElement) => anchor.offsetHeight,
  );

  expect(Math.abs(canvasHeight - 55)).toBeLessThanOrEqual(1);
  expect(Math.abs(previewHeight - 55)).toBeLessThanOrEqual(1);
  expect(Math.abs(canvasHeight - previewHeight)).toBeLessThanOrEqual(1);
});
