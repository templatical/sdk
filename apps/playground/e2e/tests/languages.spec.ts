import type { BrowserContext, Page } from "@playwright/test";
import { test, expect } from "../fixtures/editor.fixture";
import { exportedParagraphAlignment } from "../helpers/exported-paragraph";
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

  test("previews and exports the German layout footer", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await selectLanguage(page, "de");
    await editorPage.togglePreview();
    await expect(
      page.locator(SELECTORS.canvas).getByText("Abmelden", { exact: true }),
    ).toBeVisible();
    await editorPage.openExport();
    await expect(page.locator(SELECTORS.exportPreviewFrame)).toHaveAttribute(
      "srcdoc",
      /Abmelden/,
    );
    await expect(
      page
        .frameLocator(SELECTORS.exportPreviewFrame)
        .getByText("Abmelden", { exact: true }),
    ).toBeVisible();
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
    await expect(stale).toContainText(
      "Das Angebot von Sable endet am Donnerstag.",
    );
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
    await page.locator('[data-block-id="languages-copy"] p').dblclick();
    await editorPage.focusTextEditableAtEnd("paragraph");
    await page.keyboard.type(" مرحبا.");
    await editorPage.deselectBlock();
    const mjml = await page.evaluate(() =>
      (
        window as {
          __tplPlaygroundGetMjml?: (options?: {
            locale?: string;
          }) => Promise<string>;
        }
      ).__tplPlaygroundGetMjml!({ locale: "ar" }),
    );
    const paragraph = [...mjml.matchAll(/<mj-text\b[^>]*>[\s\S]*?<\/mj-text>/g)]
      .map((match) => match[0])
      .find((element) => element.includes("مرحبا."));
    expect(paragraph).toBeDefined();
    expect(paragraph!.split(">")[0]).not.toContain('align="left"');
    expect(exportedParagraphAlignment(mjml, "مرحبا.")).not.toBe("left");
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
    // The untranslated marker's Translate button shifts the block's centre
    // into padding. Enter editing through the paragraph's text instead.
    await grace.page
      .locator('[data-block-id="languages-copy"] .tpl-text-content')
      .dblclick();
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

  test("keeps Sable in the German translation through the mock provider", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await selectLanguage(page, "de");
    const stale = page.locator('[data-block-id="languages-stale"]');
    await stale.getByTestId("locale-retranslate").click();
    await expect(stale).toContainText(
      "Das Angebot von Sable endet am Freitag.",
    );
    await expect(stale.getByTestId("locale-marker-stale")).toHaveCount(0);
  });

  test("translates the German gaps and reports the translated field count", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await selectLanguage(page, "de");
    await page.getByTestId("language-menu").click();
    await expect(page.getByTestId("translate-language")).toContainText(
      "Translate from English",
    );
    await expect(
      page.getByTestId("translate-language").locator("span").last(),
    ).toHaveText("2");
    await page.getByTestId("translate-language").click();
    await expect(page.getByTestId("translation-result")).toHaveText(
      "Translated 2 fields",
    );
    await expect(page.getByTestId("language-menu")).toContainText("4/4");
    await expect(
      page.locator('[data-block-id="languages-hero"] img'),
    ).toHaveAttribute("alt", "Ein tragbarer Lautsprecher");
    await expect(
      page.locator('[data-block-id="languages-stale"]'),
    ).toContainText("Das Angebot von Sable endet am Freitag.");
    await page.getByTestId("language-menu").click();
    await expect(page.getByTestId("language-option-de")).toContainText(
      "0 not translated",
    );
    await expect(page.getByTestId("language-option-de")).toContainText(
      "0 out of date",
    );
    await expect(page.getByTestId("translate-language")).toBeDisabled();
    await page.getByTestId("language-option-en").click();
    await expect(
      page.locator('[data-block-id="languages-stale"]'),
    ).toContainText("The Sable offer ends on Friday.");
    await page.getByTestId("translation-dismiss").click();
    await expect(page.getByTestId("translation-status")).toHaveCount(0);
  });

  test("keeps a field untranslated when its recorded translation drops a tag", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages", { translation: "tags-changed" });
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await selectLanguage(page, "de");
    const tagged = page.locator('[data-block-id="languages-tagged"]');
    await expect(
      tagged.getByTestId("locale-marker-untranslated"),
    ).toBeVisible();
    await page.getByTestId("language-menu").click();
    await page.getByTestId("translate-language").click();
    await expect(page.getByTestId("translation-result")).toHaveText(
      "Translated 2 fields · 1 kept their old text: tags changed",
    );
    await expect(tagged).toContainText("Hello");
    await expect(tagged).not.toContainText("Hallo");
    await expect(
      tagged.getByTestId("locale-marker-untranslated"),
    ).toBeVisible();
    await expect(page.getByTestId("language-menu")).toContainText("4/5");
  });

  test("Cancel applies the completed batch while the later call is delayed", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages", { translation: "cancel" });
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await page.getByTestId("language-menu").click();
    await page.getByTestId("language-add-fr").click();
    await selectLanguage(page, "fr");
    await page.getByTestId("language-menu").click();
    await page.getByTestId("translate-language").click();
    await expect(page.getByTestId("translation-status")).toContainText(
      "Translating 2 of 5…",
    );
    await page.getByTestId("translation-cancel").click();
    await expect(page.getByTestId("translation-result")).toHaveText(
      "Translated 2 fields",
    );
    await expect(page.getByTestId("language-menu")).toContainText("2/5");
    await expect(
      page.locator('[data-block-id="languages-title"]'),
    ).toContainText("Bienvenue dans la collection d’automne");
    await expect(
      page.locator('[data-block-id="languages-copy"]'),
    ).toContainText("Discover our new collection.");
    await expect(
      page
        .locator('[data-block-id="languages-copy"]')
        .getByTestId("locale-marker-untranslated"),
    ).toBeVisible();
    await expect(page.getByTestId("translation-cancel")).toHaveCount(0);
  });

  test("Re-translate updates the stale block and clears its marker", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await selectLanguage(page, "de");
    const stale = page.locator('[data-block-id="languages-stale"]');
    await expect(stale.getByTestId("locale-marker-stale")).toBeVisible();
    await stale.getByTestId("locale-retranslate").click();
    await expect(page.getByTestId("translation-result")).toHaveText(
      "Translated 1 fields",
    );
    await expect(stale.getByTestId("locale-marker-stale")).toHaveCount(0);
    await expect(stale).toContainText(
      "Das Angebot von Sable endet am Freitag.",
    );
    await expect(page.getByTestId("language-menu")).toContainText("3/4");
  });

  test("Rewrite writes its German reply into the German layer", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await selectLanguage(page, "de");
    await editorPage.doubleClickBlock("paragraph");
    const toolbar = editorPage.getTextToolbar();
    await toolbar.getByTestId("ai-rewrite-trigger").click();
    await toolbar.getByTestId("ai-rewrite-preset-shorten").click();
    await expect(toolbar.getByTestId("ai-rewrite-preview")).toContainText(
      "Entdecken Sie die Highlights unserer Herbstkollektion.",
    );
    await toolbar.getByTestId("ai-rewrite-replace").click();
    await editorPage.deselectBlock();
    const copy = page.locator('[data-block-id="languages-copy"]');
    await expect(copy).toContainText(
      "Entdecken Sie die Highlights unserer Herbstkollektion.",
    );
    await selectLanguage(page, "en");
    await expect(copy).toContainText("Discover our new collection.");
    await expect(copy).not.toContainText("Highlights");
    await selectLanguage(page, "de");
    await expect(copy).toContainText(
      "Entdecken Sie die Highlights unserer Herbstkollektion.",
    );
  });

  test("reports a German block held by the second page as skipped", async ({
    context,
    shadowDom,
  }) => {
    async function openTab(user: string) {
      const page = await context.newPage();
      watchVueWarnings(page, vueWarnings);
      const editor = new EditorPage(page);
      await new ScenePage(page, { shadowDom }).goto("languages", {
        collaboration: "1",
        user,
      });
      await editor.waitForReady();
      await editor.dismissOverlays();
      await selectLanguage(page, "de");
      return { page, editor };
    }
    const ada = await openTab("Ada");
    const grace = await openTab("Grace");
    const held = grace.page.locator('[data-block-id="languages-stale"]');
    await held.dblclick();
    await expect(held).toHaveClass(/tpl-block--selected/);
    const remote = ada.page.locator('[data-block-id="languages-stale"]');
    await expect(remote.getByTestId("block-lock")).toBeVisible();
    await ada.page.getByTestId("language-menu").click();
    await ada.page.getByTestId("translate-language").click();
    await expect(ada.page.getByTestId("translation-result")).toHaveText(
      "Translated 1 fields · 1 skipped: being edited in Deutsch",
    );
    await expect(remote).toContainText(
      "Das Angebot von Sable endet am Donnerstag.",
    );
    await expect(remote.getByTestId("locale-marker-stale")).toBeVisible();
    for (const tab of [ada, grace]) {
      await expect(
        tab.page.locator('[data-block-id="languages-hero"] img'),
      ).toHaveAttribute("alt", "Ein tragbarer Lautsprecher");
    }
  });
});
