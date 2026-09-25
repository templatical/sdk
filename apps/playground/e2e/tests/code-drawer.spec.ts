import { test, expect } from "../fixtures/editor.fixture";
import { freezeMotion } from "../helpers/motion";
import { SELECTORS } from "../helpers/selectors";

const height = (el: Element) => Math.round(el.getBoundingClientRect().height);

test.describe("Code drawer", () => {
  test.beforeEach(async ({ scenePage, editorPage }) => {
    await scenePage.goto("fonts");
    await editorPage.waitForReady();
  });

  test("opens under the editor, not over it", async ({ page }) => {
    const code = page.locator(SELECTORS.toolbarCode);
    const drawer = page.locator(SELECTORS.codeDrawer);
    await expect(code).toHaveAttribute("aria-expanded", "false");

    await code.click();
    await expect(drawer).toContainText("builtIns");
    await expect(code).toHaveAttribute("aria-expanded", "true");
    const stage = (await page.locator(SELECTORS.editorStage).boundingBox())!;
    const box = (await drawer.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(stage.y + stage.height);

    await code.click();
    await expect(drawer).toHaveCount(0);
  });

  test("grows out of the stage instead of popping in", async ({ page }) => {
    const stage = page.locator(SELECTORS.editorStage);
    const slot = page.locator(".pg-code-drawer-slot");
    const before = await stage.evaluate(height);

    const resume = await freezeMotion(page);
    await page.locator(SELECTORS.toolbarCode).click();
    await expect(slot).toHaveCount(1);
    expect(await slot.evaluate(height)).toBe(0);
    expect(await stage.evaluate(height)).toBe(before);

    await resume();
    await expect.poll(() => slot.evaluate(height)).toBeGreaterThan(200);
    expect(await stage.evaluate(height)).toBeLessThan(before - 200);
  });

  test("stays open across a reload and a scene switch, and closed once closed", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    const drawer = page.locator(SELECTORS.codeDrawer);
    await page.locator(SELECTORS.toolbarCode).click();
    await expect(drawer).toContainText("builtIns");

    await page.reload();
    await editorPage.waitForReady();
    await expect(drawer).toContainText("builtIns");

    await scenePage.goto("theming");
    await editorPage.waitForReady();
    await expect(drawer).toContainText("theme:");

    await page.locator(SELECTORS.codeDrawerClose).click();
    await page.reload();
    await editorPage.waitForReady();
    await expect(drawer).toHaveCount(0);
  });

  test("Escape inside it closes it and returns focus to Code", async ({
    page,
  }) => {
    await page.locator(SELECTORS.toolbarCode).click();
    await page.locator(SELECTORS.codeDrawerCopy).focus();
    await page.keyboard.press("Escape");
    await expect(page.locator(SELECTORS.codeDrawer)).toHaveCount(0);
    await expect(page.locator(SELECTORS.toolbarCode)).toBeFocused();
  });

  test("Copy copies the whole snippet", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.locator(SELECTORS.toolbarCode).click();
    await page.locator(SELECTORS.codeDrawerCopy).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('import { init } from "@templatical/editor";');
    expect(copied).toContain("builtIns");
  });
});
