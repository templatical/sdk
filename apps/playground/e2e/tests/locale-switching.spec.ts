import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

test.describe("Locale switching", () => {
  test("editor toolbar has locale select with en and de", async ({
    editorReady,
    page,
  }) => {
    const select = page.locator(SELECTORS.localeSelect);
    await expect(select).toBeVisible();
    const options = select.locator("option");
    expect(await options.count()).toBe(2);
    await expect(options.nth(0)).toHaveText("EN");
    await expect(options.nth(1)).toHaveText("DE");
  });

  test("switching to German changes toolbar text", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const backBtn = page.locator(SELECTORS.backButton);
    const textBefore = (await backBtn.textContent())?.trim() ?? "";
    expect(textBefore.length).toBeGreaterThan(0);

    await page.locator(SELECTORS.localeSelect).selectOption("de");
    await editorPage.waitForReady();
    await expect(backBtn).not.toHaveText(textBefore);
  });

  test("switching back to English restores text", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const backBtn = page.locator(SELECTORS.backButton);
    const originalText = (await backBtn.textContent())?.trim() ?? "";
    expect(originalText.length).toBeGreaterThan(0);

    await page.locator(SELECTORS.localeSelect).selectOption("de");
    await editorPage.waitForReady();
    await expect(backBtn).not.toHaveText(originalText);

    await page.locator(SELECTORS.localeSelect).selectOption("en");
    await editorPage.waitForReady();
    await expect(backBtn).toHaveText(originalText);
  });
});
