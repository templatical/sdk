import type { BrowserContext, Page } from "@playwright/test";
import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";
import { EditorPage } from "../pages/editor.page";
import { ScenePage } from "../pages/scene.page";

function watchVueWarnings(page: Page, warnings: string[]) {
  page.on("console", (message) => {
    if (message.text().includes("[Vue warn]")) warnings.push(message.text());
  });
}

async function selectLanguage(page: Page, locale: string) {
  await page.getByTestId("language-menu").click();
  await page.getByTestId(`language-option-${locale}`).click();
}

test.describe("language versions", () => {
  let vueWarnings: string[];

  test.beforeEach(async ({ page }) => {
    vueWarnings = [];
    watchVueWarnings(page, vueWarnings);
  });

  test.afterEach(() => {
    expect(vueWarnings, "page console must contain no Vue warnings").toEqual(
      [],
    );
  });

  test("switches text, hero and hidden ghost to German with coverage", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await page.getByTestId("language-menu").click();
    const german = page.getByTestId("language-option-de");
    await expect(german).toContainText("Deutsch");
    await expect(german).toContainText("1 not translated");
    await expect(german).toContainText("1 out of date");
    await german.click();
    await expect(page.getByTestId("language-menu")).toContainText("Deutsch");
    await expect(page.getByTestId("language-menu")).toContainText("2/4");
    await expect(
      page.locator('[data-block-id="languages-title"]'),
    ).toContainText("Willkommen zur Herbstkollektion");
    await expect(
      page.locator('[data-block-id="languages-hero"] img'),
    ).toHaveAttribute("src", "/examples/sable/buds.png");
    const hidden = page.locator('[data-block-id="languages-us-only"]');
    await expect(hidden).toHaveClass(/tpl-block--locale-hidden/);
    await expect(hidden.getByTestId("locale-marker-hidden")).toContainText(
      "Hidden in Deutsch",
    );
    await editorPage.togglePreview();
    await expect(hidden).toHaveCount(0);
  });

  test("edits German text while the English view stays unchanged", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await selectLanguage(page, "de");
    await editorPage.doubleClickBlock("paragraph");
    await editorPage.focusTextEditableAtEnd("paragraph");
    await page.keyboard.type(" Nur auf Deutsch.");
    await editorPage.deselectBlock();
    const copy = page.locator('[data-block-id="languages-copy"]');
    await expect(copy).toContainText("Nur auf Deutsch.");
    await selectLanguage(page, "en");
    await expect(copy).toContainText("Discover our new collection.");
    await expect(copy).not.toContainText("Nur auf Deutsch.");
    await selectLanguage(page, "de");
    await expect(copy).toContainText("Nur auf Deutsch.");
  });

  test("keeps a stale value and clears its marker", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await selectLanguage(page, "de");
    const stale = page.locator('[data-block-id="languages-stale"]');
    await expect(stale.getByTestId("locale-marker-stale")).toContainText(
      "Out of date",
    );
    await stale.getByTestId("locale-keep").click();
    await expect(stale.getByTestId("locale-marker-stale")).toHaveCount(0);
    await expect(stale).toContainText("Das Angebot endet am Donnerstag.");
    await expect(page.getByTestId("language-menu")).toContainText("3/4");
  });

  test("keeps a translation after the default converges to it", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await editorPage.doubleClickBlock("title");
    // The outer .tpl-text-editable also exists while TipTap is loading.
    // Wait for and focus its actual contenteditable before sending keys.
    const editable = await editorPage.focusTextEditableAtEnd("title");
    await expect(editable).toBeEditable();
    await editable.press("ControlOrMeta+a");
    await page.keyboard.type("Willkommen zur Herbstkollektion");
    await expect(editable).toHaveText("Willkommen zur Herbstkollektion");
    const title = page.locator('[data-block-id="languages-title"]');
    await expect(title.getByTestId("locale-marker-stale")).toContainText(
      "Translations out of date: 1",
    );
    await editorPage.deselectBlock();
    await selectLanguage(page, "de");
    await expect(title.getByTestId("locale-marker-stale")).toBeVisible();
    await title.getByTestId("locale-keep").click();
    await expect(title.getByTestId("locale-marker-stale")).toHaveCount(0);
    await expect(title.getByTestId("locale-marker-untranslated")).toHaveCount(
      0,
    );
    await expect(page.getByTestId("language-menu")).toContainText("2/4");
    await selectLanguage(page, "en");
    await selectLanguage(page, "de");
    await expect(title.getByTestId("locale-marker-untranslated")).toHaveCount(
      0,
    );
    await expect(title).toContainText("Willkommen zur Herbstkollektion");
  });

  test("adds French from Add language", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await page.getByTestId("language-menu").click();
    await expect(page.getByRole("menu")).toContainText("Add language");
    await expect(page.getByTestId("language-option-fr")).toHaveCount(0);
    await page.getByTestId("language-add-fr").click();
    await page.getByTestId("language-menu").click();
    await expect(page.getByTestId("language-option-fr")).toContainText(
      "Français",
    );
  });

  test("renders the Arabic canvas right to left", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await selectLanguage(page, "ar");
    await expect(page.locator(SELECTORS.canvas)).toHaveAttribute("dir", "rtl");
    await expect(page.locator(SELECTORS.canvas)).toHaveAttribute("lang", "ar");
  });

  test("exports German MJML through the editor with an explicit locale", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    const mjml = await page.evaluate(() =>
      (
        window as {
          __tplPlaygroundGetMjml?: (options?: {
            locale?: string;
          }) => Promise<string>;
        }
      ).__tplPlaygroundGetMjml!({ locale: "de" }),
    );
    expect(mjml).toContain('lang="de"');
    expect(mjml).toContain("Willkommen zur Herbstkollektion");
    expect(mjml).toContain("/examples/sable/buds.png");
    expect(mjml).not.toContain("Free shipping in the United States.");
  });

  test("holds German and French locks on the same block in two tabs", async ({
    context,
    shadowDom,
  }) => {
    async function openTab(context: BrowserContext, user: string) {
      const page = await context.newPage();
      watchVueWarnings(page, vueWarnings);
      const editor = new EditorPage(page);
      await new ScenePage(page, { shadowDom }).goto("languages", {
        collaboration: "1",
        user,
      });
      await editor.waitForReady();
      await editor.dismissOverlays();
      return { page, editor };
    }
    const ada = await openTab(context, "Ada");
    const grace = await openTab(context, "Grace");
    await expect(ada.page.getByTestId("collaborator-avatar")).toHaveAttribute(
      "title",
      "Grace",
    );
    await selectLanguage(ada.page, "de");
    await grace.page.getByTestId("language-menu").click();
    await grace.page.getByTestId("language-add-fr").click();
    await selectLanguage(grace.page, "fr");
    await ada.editor.doubleClickBlock("paragraph");
    await ada.editor.focusTextEditableAtEnd("paragraph");
    await ada.page.keyboard.type(" Von Ada.");
    await grace.editor.doubleClickBlock("paragraph");
    await grace.editor.focusTextEditableAtEnd("paragraph");
    await grace.page.keyboard.type(" Par Grace.");
    for (const tab of [ada, grace]) {
      await expect(
        tab.page.locator('[data-block-id="languages-copy"]'),
      ).toHaveClass(/tpl-block--selected/);
      await expect(
        tab.page
          .locator('[data-block-id="languages-copy"]')
          .getByTestId("block-lock"),
      ).toHaveCount(0);
    }
    // Read the backend's lock snapshot without switching either editing tab's view.
    await expect
      .poll(() =>
        ada.page.evaluate(async (url) => {
          const { languages } = await import(/* @vite-ignore */ url);
          const config = languages.config({
            search: new URLSearchParams("collaboration=1"),
          });
          const template = await config.templates.load("playground-languages");
          return template.locks
            .map(
              (lock: {
                blockId: string;
                locale?: string;
                holder: { name?: string };
              }) => ({
                blockId: lock.blockId,
                locale: lock.locale,
                name: lock.holder.name,
              }),
            )
            .sort((a: { locale: string }, b: { locale: string }) =>
              a.locale.localeCompare(b.locale),
            );
        }, "/src/scenes/author/languages.ts"),
      )
      .toEqual([
        { blockId: "languages-copy", locale: "de", name: "Ada" },
        { blockId: "languages-copy", locale: "fr", name: "Grace" },
      ]);
    await expect(
      ada.page.locator('[data-block-id="languages-copy"]'),
    ).toContainText("Von Ada.");
    await expect(
      ada.page.locator('[data-block-id="languages-copy"]'),
    ).not.toContainText("Par Grace.");
    await expect(
      grace.page.locator('[data-block-id="languages-copy"]'),
    ).toContainText("Par Grace.");
    await expect(
      grace.page.locator('[data-block-id="languages-copy"]'),
    ).not.toContainText("Von Ada.");
  });
});
