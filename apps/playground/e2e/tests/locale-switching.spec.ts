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
    // Capture English toolbar text
    const backBtn = page.locator(SELECTORS.backButton);
    const textBefore = await backBtn.textContent();

    // Switch to German
    await page.locator(SELECTORS.localeSelect).selectOption("de");
    // Editor reinitializes on locale change — wait for it
    await page.waitForTimeout(1000);
    await editorPage.waitForReady();

    // Toolbar text should now be in German
    const backBtnAfter = page.locator(SELECTORS.backButton);
    const textAfter = await backBtnAfter.textContent();
    expect(textAfter).not.toBe(textBefore);
  });

  test("switching back to English restores text", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const backBtn = page.locator(SELECTORS.backButton);
    const originalText = await backBtn.textContent();

    // Switch to German — editor re-inits. Wait for toolbar text to change
    // before proceeding rather than relying on a fixed timeout.
    await page.locator(SELECTORS.localeSelect).selectOption("de");
    await editorPage.waitForReady();
    await expect(backBtn).not.toHaveText(originalText ?? "");

    // Switch back to English and wait for text to restore
    await page.locator(SELECTORS.localeSelect).selectOption("en");
    await editorPage.waitForReady();
    await expect(backBtn).toHaveText(originalText ?? "");
  });
});
