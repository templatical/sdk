import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";
import type { Page } from "@playwright/test";
import { ChooserPage } from "../pages/chooser.page";
import { EditorPage } from "../pages/editor.page";

/**
 * `templateSettings.fields` — the allowlist that decides which template
 * settings the Settings panel exposes (issue #674).
 *
 * Driven by the playground's `tpl-playground-settings-fields` storage flag: a
 * comma-separated allowlist, or `none` for `fields: false`. Set through
 * `addInitScript` because the config is read once, before the first `init()` —
 * writing it after `goto()` races the app's mount-time read.
 *
 * This is the layer that proves the config survives the whole trip from
 * `init()` to the DOM in a real browser. The unit suite
 * (`packages/editor/tests/templateSettingsVisibility.test.ts`) owns the
 * resolver's own cases and the ones no playground flag can express.
 */
async function openEditorWith(
  page: Page,
  shadowDom: boolean,
  flag: string | null,
) {
  const chooserPage = new ChooserPage(page, { shadowDom });
  const editorPage = new EditorPage(page);
  await page.addInitScript((value) => {
    localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
    localStorage.setItem("tpl-playground-features-dismissed", "true");
    if (value === null) {
      localStorage.removeItem("tpl-playground-settings-fields");
    } else {
      localStorage.setItem("tpl-playground-settings-fields", value);
    }
  }, flag);
  await chooserPage.goto();
  await chooserPage.selectFirstTemplate();
  await editorPage.waitForReady();
  await editorPage.dismissOverlays();
  return editorPage;
}

async function openSettingsTab(page: Page) {
  const tab = page.locator(SELECTORS.rightTabSettings);
  await expect(tab).toBeVisible();
  await tab.click();
  const panel = page.locator(SELECTORS.rightPanelSettings);
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
    // The exact case from #674: locale comes from the host's business logic and
    // the preheader from a field next to the subject line, so neither belongs
    // in the editor.
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
    // What remains is untouched.
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
    // Layout's only field is excluded, so its card goes with it.
    await expect(
      panel.locator(SELECTORS.templateSettingsCard("layout")),
    ).toHaveCount(0);
  });

  test("leaves no trailing gap under the last surviving field", async ({
    page,
    shadowDom,
  }) => {
    // Cards space their contents with a flex gap rather than a bottom margin on
    // every child but the last, because which field is last depends on the
    // consumer's allowlist. Measured as the distance from the last control's
    // bottom edge to the card's padding box.
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

    // Sub-pixel tolerance only: a reintroduced `mb-3.5` would read ~14px here.
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
    // The Content tab is the one that must survive — losing it would leave the
    // sidebar with no way to edit a block.
    await expect(page.locator(SELECTORS.rightTabContent)).toBeVisible();
    await expect(page.locator(SELECTORS.rightPanelContent)).toBeVisible();
  });

  test("keeps the hidden values in the template", async ({
    page,
    shadowDom,
  }) => {
    // Presentation only: hiding a setting must not clear it. The template's own
    // locale and preheader have to survive into the export with the panel gone.
    await openEditorWith(page, shadowDom, "width");
    const panel = await openSettingsTab(page);
    // Both cards really are gone, so the export assertions below can't be
    // satisfied by a config that never took effect.
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
