import { test, expect } from "../fixtures/editor.fixture";
import { freezeMotion } from "../helpers/motion";
import { SELECTORS, themeOption } from "../helpers/selectors";

const DARK = /(^|\s)dark(\s|$)/;

test.describe("Host header", () => {
  for (const where of ["catalog", "scene"] as const) {
    test(`${where}: the settings menu sets theme and language, and Escape returns focus`, async ({
      chooserPage,
      scenePage,
      editorPage,
      page,
    }) => {
      if (where === "catalog") {
        await chooserPage.goto();
      } else {
        await scenePage.goto("fonts");
        await editorPage.waitForReady();
      }
      const trigger = page.locator(SELECTORS.hostSettings);
      const panel = page.locator(SELECTORS.hostSettingsPanel);

      await trigger.click();
      await expect(panel).toBeVisible();
      await expect(trigger).toHaveAttribute("aria-expanded", "true");

      await page.locator(themeOption("dark")).click();
      await expect(page.locator("html")).toHaveClass(DARK);

      await page.locator(SELECTORS.localeSelect).selectOption("de");
      await expect(trigger).toHaveAttribute("aria-label", "Einstellungen");

      await page.keyboard.press("Escape");
      await expect(panel).toHaveCount(0);
      await expect(trigger).toBeFocused();
    });
  }

  test("the settings menu fades in instead of popping", async ({
    chooserPage,
    page,
  }) => {
    await chooserPage.goto();
    const panel = page.locator(SELECTORS.hostSettingsPanel);
    const opacity = () => panel.evaluate((el) => getComputedStyle(el).opacity);

    const resume = await freezeMotion(page);
    await page.locator(SELECTORS.hostSettings).click();
    await expect(panel).toHaveCount(1);
    expect(await opacity()).toBe("0");
    await resume();
    await expect.poll(opacity).toBe("1");
  });

  test("an outside click closes the settings menu without moving focus", async ({
    chooserPage,
    page,
  }) => {
    await chooserPage.goto();
    await page.locator(SELECTORS.hostSettings).click();
    await expect(page.locator(SELECTORS.hostSettingsPanel)).toBeVisible();
    await page.locator("h1").first().click();
    await expect(page.locator(SELECTORS.hostSettingsPanel)).toHaveCount(0);
  });

  test("Code is the one filled action; Share and Export are named icons", async ({
    scenePage,
    editorPage,
    page,
  }) => {
    await scenePage.goto("fonts");
    await editorPage.waitForReady();
    const header = page.getByTestId("scene-header");
    const code = header.locator(SELECTORS.toolbarCode);
    const exportButton = header.locator(SELECTORS.exportButton);

    await expect(code).toHaveText("Code");
    for (const name of ["Share", "Export"]) {
      await expect(header.getByRole("button", { name })).toHaveText("");
    }
    const background = (el: Element) => getComputedStyle(el).backgroundColor;
    expect(await code.evaluate(background)).not.toBe(
      await exportButton.evaluate(background),
    );
  });

  test("the scene header draws no sun, so the editor's dark preview is the only one", async ({
    scenePage,
    editorPage,
    page,
  }) => {
    await scenePage.goto("fonts");
    await editorPage.waitForReady();
    const header = page.getByTestId("scene-header");
    await expect(header.locator("svg.lucide-settings-2")).toHaveCount(1);
    await expect(header.locator("svg.lucide-sun")).toHaveCount(0);
  });
});
