import { expect } from "@playwright/test";
import { test } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

/**
 * Content direction — the email stage (canvas + export) follows
 * `settings.direction`, independently of the editor chrome and of the host
 * page. Arabic Invitation is the fixture that actually sets `dir="rtl"`.
 */

const SCENE = "example-northstage-ar";

async function openArabicInvitation(
  scenePage: import("../pages/scene.page").ScenePage,
  editorPage: {
    waitForReady(): Promise<void>;
    dismissOverlays(): Promise<void>;
  },
) {
  await scenePage.goto(SCENE);
  await editorPage.waitForReady();
  await editorPage.dismissOverlays();
}

async function getMjml(page: import("@playwright/test").Page): Promise<string> {
  await page.waitForFunction(
    () =>
      typeof (window as { __tplPlaygroundGetMjml?: () => Promise<string> })
        .__tplPlaygroundGetMjml === "function",
  );
  return page.evaluate(() =>
    (window as { __tplPlaygroundGetMjml?: () => Promise<string> })
      .__tplPlaygroundGetMjml!(),
  );
}

test.describe("content direction", () => {
  test("the Arabic template paints the canvas rtl", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await openArabicInvitation(scenePage, editorPage);
    await expect(page.locator(SELECTORS.canvas)).toHaveAttribute("dir", "rtl");
  });

  test("column 0 sits on the right of a two-column section", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await openArabicInvitation(scenePage, editorPage);
    const startCol = page.getByText("عمود البداية", { exact: false }).first();
    const image = page.locator('img[alt="صورة توضيحية للحدث"]');
    await expect(startCol).toBeVisible();
    await expect(image).toBeVisible();
    const startBox = await startCol.boundingBox();
    const imageBox = await image.boundingBox();
    expect(startBox).not.toBeNull();
    expect(imageBox).not.toBeNull();
    expect(startBox!.x).toBeGreaterThan(imageBox!.x);
  });

  test("exported MJML carries dir=rtl", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await openArabicInvitation(scenePage, editorPage);
    const mjml = await getMjml(page);
    expect(mjml).toContain('<mjml lang="ar" dir="rtl">');
    expect(mjml).toContain('direction="rtl"');
  });

  test("the settings toggle writes ltr and the canvas follows", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await openArabicInvitation(scenePage, editorPage);
    await expect(page.locator(SELECTORS.canvas)).toHaveAttribute("dir", "rtl");

    await editorPage.openSettingsTab();
    const toggle = page
      .locator(SELECTORS.templateSettingsDirection)
      .getByRole("switch");
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(page.locator(SELECTORS.canvas)).toHaveAttribute("dir", "ltr");

    const mjml = await getMjml(page);
    expect(mjml).toContain('<mjml lang="ar" dir="ltr">');
  });
});
