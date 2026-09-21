import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

test.describe("Locale switching", () => {
  test("i18n scene mounts the editor in German", async ({
    scenePage,
    editorPage,
    page,
  }) => {
    await scenePage.goto("i18n");
    await editorPage.waitForReady();
    await expect(page.locator(SELECTORS.previewToggle)).toHaveAttribute(
      "aria-label",
      "Vorschaumodus",
    );
  });

  test("?locale=en overrides the live editor to English", async ({
    scenePage,
    editorPage,
    page,
  }) => {
    await scenePage.goto("i18n", { locale: "en" });
    await editorPage.waitForReady();
    await expect(page.locator(SELECTORS.previewToggle)).toHaveAttribute(
      "aria-label",
      "Preview Mode",
    );
  });

  test("full navigation from German to English restores English chrome", async ({
    scenePage,
    editorPage,
    page,
  }) => {
    await scenePage.goto("i18n");
    await editorPage.waitForReady();
    await expect(page.locator(SELECTORS.previewToggle)).toHaveAttribute(
      "aria-label",
      "Vorschaumodus",
    );

    await scenePage.goto("i18n", { locale: "en" });
    await editorPage.waitForReady();
    await expect(page.locator(SELECTORS.previewToggle)).toHaveAttribute(
      "aria-label",
      "Preview Mode",
    );
  });
});
