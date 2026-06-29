import { test, expect } from "../fixtures/editor.fixture";
import { blockByType } from "../helpers/selectors";

// #229 — drag an image file onto an image block to upload it. Runs in both the
// light-DOM and shadow-DOM projects, exercising the drop path across the
// shadow boundary.
test.describe("Image drag-and-drop upload (#229)", () => {
  test("dropping an image file onto an image block sets its src via onRequestMedia", async ({
    blankEditorReady: { editorPage },
    page,
  }) => {
    await editorPage.dragBlockFromSidebar("image");

    const imageBlock = page.locator(blockByType("image")).first();
    await expect(imageBlock).toBeVisible();

    const dropZone = imageBlock.locator('[data-testid="image-drop-zone"]');
    await expect(dropZone).toBeVisible();

    // Playwright's dragTo emits only HTML5 drag events to a single target and
    // can't carry a File. Dispatch a synthetic DataTransfer drop on the real
    // element instead (locator.evaluate resolves through the shadow root).
    await dropZone.evaluate((el) => {
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

    // The playground's onRequestMedia reads the dropped file into a data URL,
    // which becomes the image block's src.
    const img = imageBlock.locator("img");
    await expect(img).toHaveAttribute("src", /^data:image\/png/);
  });
});
