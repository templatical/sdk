import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";
import type { Page } from "@playwright/test";
import { EditorPage } from "../pages/editor.page";
import { ScenePage } from "../pages/scene.page";

/**
 * `templateSettings.fields` — the allowlist that decides which template
 * settings the Settings panel exposes (issue #674).
 *
 * Driven by the e2e-only `?settingsFields=` query overlay. Absent means the
 * key is omitted entirely (SDK default: every setting editable). `none` is
 * `fields: false`. Must not appear in scene snippets.
 */
async function openEditorWith(
  page: Page,
  shadowDom: boolean,
  settingsFields: string | null,
) {
  const scenePage = new ScenePage(page, { shadowDom });
  const editorPage = new EditorPage(page);
  const query = settingsFields === null ? {} : { settingsFields };
  await scenePage.goto("example-launchpad-launch", query);
  await editorPage.waitForReady();
  await editorPage.closeCodeDrawer();
  return editorPage;
}

async function openSettingsTab(page: Page) {
  const tab = page.locator(SELECTORS.rightTabSettings);
  await expect(tab).toBeVisible();
  await tab.click();
  const panel = page.locator(SELECTORS.templateSettings);
  await expect(panel).toBeVisible();
  return panel;
}

test.describe("templateSettings.fields", () => {
  test("exposes every setting when the key is omitted", async ({
    page,
    shadowDom,
  }) => {
    await openEditorWith(page, shadowDom, null);
    const panel = await openSettingsTab(page);

    for (const card of ["layout", "appearance", "language", "preheader"]) {
      await expect(
        panel.locator(SELECTORS.templateSettingsCard(card)),
        card,
      ).toBeVisible();
    }
    await expect(panel.locator(SELECTORS.templateSettingsLocale)).toBeVisible();
    await expect(
      panel.locator(SELECTORS.templateSettingsPreheader),
    ).toBeVisible();
  });

  test("hides the Language and Preheader cards the reporter asked about", async ({
    page,
    shadowDom,
  }) => {
    await openEditorWith(
      page,
      shadowDom,
      "width,backgroundColor,textColor,linkColor,linkUnderline,fontFamily",
    );
    const panel = await openSettingsTab(page);

    await expect(
      panel.locator(SELECTORS.templateSettingsCard("language")),
    ).toHaveCount(0);
    await expect(
      panel.locator(SELECTORS.templateSettingsCard("preheader")),
    ).toHaveCount(0);
    await expect(
      panel.locator(SELECTORS.templateSettingsCard("layout")),
    ).toBeVisible();
    await expect(
      panel.locator(SELECTORS.templateSettingsCard("appearance")),
    ).toBeVisible();
    await expect(
      panel.locator(SELECTORS.templateSettingsFontFamily),
    ).toBeVisible();
  });

  test("drops a single control without dropping its card", async ({
    page,
    shadowDom,
  }) => {
    await openEditorWith(page, shadowDom, "backgroundColor,textColor");
    const panel = await openSettingsTab(page);

    await expect(
      panel.locator(SELECTORS.templateSettingsCard("appearance")),
    ).toBeVisible();
    await expect(
      panel.locator(SELECTORS.templateSettingsBackground),
    ).toBeVisible();
    await expect(
      panel.locator(SELECTORS.templateSettingsTextColor),
    ).toBeVisible();
    await expect(
      panel.locator(SELECTORS.templateSettingsLinkColor),
    ).toHaveCount(0);
    await expect(
      panel.locator(SELECTORS.templateSettingsFontFamily),
    ).toHaveCount(0);
    await expect(
      panel.locator(SELECTORS.templateSettingsCard("layout")),
    ).toHaveCount(0);
  });

  test("leaves no trailing gap under the last surviving field", async ({
    page,
    shadowDom,
  }) => {
    await openEditorWith(page, shadowDom, "backgroundColor,textColor");
    const panel = await openSettingsTab(page);
    const card = panel.locator(SELECTORS.templateSettingsCard("appearance"));
    const last = panel.locator(SELECTORS.templateSettingsTextColor);

    const gap = await card.evaluate((cardEl, lastSelector) => {
      const lastEl = cardEl.querySelector(lastSelector as string);
      if (!lastEl) throw new Error("last field not found");
      const padding = parseFloat(getComputedStyle(cardEl).paddingBottom);
      return (
        cardEl.getBoundingClientRect().bottom -
        lastEl.getBoundingClientRect().bottom -
        padding
      );
    }, SELECTORS.templateSettingsTextColor);

    expect(Math.abs(gap)).toBeLessThan(1.5);
    await expect(last).toBeVisible();
  });

  test("removes the Settings tab entirely for `none`", async ({
    page,
    shadowDom,
  }) => {
    await openEditorWith(page, shadowDom, "none");

    await expect(page.locator(SELECTORS.rightTabSettings)).toHaveCount(0);
    await expect(page.locator(SELECTORS.rightPanelSettings)).toHaveCount(0);
    await expect(page.locator(SELECTORS.rightTabContent)).toBeVisible();
    await expect(page.locator(SELECTORS.rightPanelContent)).toBeVisible();
  });

  test("keeps the hidden values in the template", async ({
    page,
    shadowDom,
  }) => {
    await openEditorWith(page, shadowDom, "width");
    const panel = await openSettingsTab(page);
    await expect(
      panel.locator(SELECTORS.templateSettingsCard("language")),
    ).toHaveCount(0);
    await expect(
      panel.locator(SELECTORS.templateSettingsCard("preheader")),
    ).toHaveCount(0);

    const mjml = await page.evaluate(() =>
      (
        window as unknown as { __tplPlaygroundGetMjml: () => Promise<string> }
      ).__tplPlaygroundGetMjml(),
    );
    expect(mjml).toContain('<mjml lang="en"');
    expect(mjml).toContain("mj-preview");
  });
});
