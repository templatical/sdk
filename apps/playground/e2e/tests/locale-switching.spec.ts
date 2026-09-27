import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

/**
 * The editor's locales, read from its locale files the way the editor finds
 * them itself: a locale a contributor adds must reach the picker unaided.
 */
const EDITOR_LOCALES = readdirSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../packages/editor/src/i18n/locales",
  ),
)
  .filter((name) => name.endsWith(".ts"))
  .map((name) => name.slice(0, -".ts".length))
  .sort();

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

  test("the locale chip offers every editor locale, by its own name", async ({
    scenePage,
    page,
  }) => {
    await scenePage.goto("i18n");
    const picker = page.getByTestId("scene-value-picker");
    const values = await picker
      .locator("option")
      .evaluateAll((options) =>
        options.map((option) => (option as HTMLOptionElement).value),
      );
    expect([...values].sort()).toEqual(EDITOR_LOCALES);
    await expect(picker.locator('option[value="fr"]')).toHaveText(
      "fr · Français",
    );
    await expect(picker).toHaveAccessibleName("Choose locale");
  });

  test("picking a locale remounts the editor in it, and the snippet follows", async ({
    scenePage,
    editorPage,
    page,
  }) => {
    await scenePage.goto("i18n");
    await editorPage.waitForReady();
    const chip = page.getByTestId("scene-init-key").locator("code");
    await expect(chip).toHaveText('locale: "de"');

    await page.getByTestId("scene-value-picker").selectOption("fr");
    await expect(page).toHaveURL(/[?&]locale=fr(&|$)/);
    await expect(chip).toHaveText('locale: "fr"');
    await expect(page.locator(SELECTORS.previewToggle)).toHaveAttribute(
      "aria-label",
      "Mode aperçu",
    );
    await page.locator(SELECTORS.toolbarCode).click();
    await expect(page.locator(SELECTORS.codeDrawer)).toContainText(
      'locale: "fr"',
    );

    await page.goBack();
    await expect(chip).toHaveText('locale: "de"');
    await expect(page.locator(SELECTORS.previewToggle)).toHaveAttribute(
      "aria-label",
      "Vorschaumodus",
    );
    await expect(page.locator(SELECTORS.codeDrawer)).toContainText(
      'locale: "de"',
    );
  });

  test("picking the default locale leaves it out of the URL", async ({
    scenePage,
    page,
  }) => {
    await scenePage.goto("i18n", { locale: "fr" });
    await page.getByTestId("scene-value-picker").selectOption("de");
    await expect(page.getByTestId("scene-init-key").locator("code")).toHaveText(
      'locale: "de"',
    );
    expect(new URL(page.url()).searchParams.has("locale")).toBe(false);
  });
});
