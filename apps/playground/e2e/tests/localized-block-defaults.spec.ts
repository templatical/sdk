import { expect } from "@playwright/test";
import { test } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";
import type { EditorPage } from "../pages/editor.page";
import type { ScenePage } from "../pages/scene.page";

/**
 * Issue #673 — a new Button read "Click Here" and a new Paragraph "Enter your
 * text here" in a German editor. (The reporter missed Title, which had it too.)
 *
 * Two things about this setup are load-bearing:
 *
 *  - **A blank canvas.** The showcase templates ship their own copy, so a block
 *    inserted into one proves nothing about what the *factory* produced.
 *  - **`/scenes/i18n`**, whose snippet is `locale: "de"`. `?locale=en` is the
 *    live override (host SDK-locale knob later); the snippet stays `de`.
 *
 * One insert per test: a second consecutive palette click does not land once a
 * block is selected, and batching them would make a locale failure
 * indistinguishable from that unrelated interaction problem.
 */
test.describe("localized block defaults", () => {
  async function openBlankEditor(
    scenePage: ScenePage,
    editorPage: EditorPage,
    sdkLocale: string,
  ): Promise<void> {
    await scenePage.goto("i18n", sdkLocale === "en" ? { locale: "en" } : {});
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await editorPage.closeCodeDrawer();
  }

  async function canvasText(editorPage: EditorPage): Promise<string> {
    return (await editorPage.getBlocks().allInnerTexts()).join("\n");
  }

  const CASES = [
    {
      type: "title",
      german: "Geben Sie Ihren Titel ein",
      english: "Enter your title",
    },
    {
      type: "paragraph",
      german: "Geben Sie hier Ihren Text ein",
      english: "Enter your text here",
    },
    { type: "button", german: "Hier klicken", english: "Click Here" },
  ] as const;

  for (const { type, german, english } of CASES) {
    test(`a German editor inserts German ${type} text`, async ({
      scenePage,
      editorPage,
    }) => {
      await openBlankEditor(scenePage, editorPage, "de");
      await editorPage.clickPaletteItem(type);

      const text = await canvasText(editorPage);
      expect(text).toContain(german);
      // The exact string the issue reported.
      expect(text).not.toContain(english);
    });

    test(`an English editor still inserts English ${type} text`, async ({
      scenePage,
      editorPage,
    }) => {
      await openBlankEditor(scenePage, editorPage, "en");
      await editorPage.clickPaletteItem(type);

      const text = await canvasText(editorPage);
      expect(text).toContain(english);
      expect(text).not.toContain(german);
    });
  }

  // A fresh template used to declare `<mjml lang="en">` no matter what language
  // the editor was in, so German copy announced itself as English to every
  // screen reader that opened the delivered email. It also decides which
  // language the browser spellchecks the canvas in.
  //
  // End-to-end outcome, not the SDK seeding on its own: the playground supplies
  // its own `content`, and a supplied template owns the language it declares —
  // so what this covers is the two halves agreeing. `resolveTemplateDefaults`
  // covers the seeding itself, on the path where no content is given.
  test("a fresh template declares the editor's language as its content language", async ({
    scenePage,
    editorPage,
  }) => {
    await openBlankEditor(scenePage, editorPage, "de");

    await expect(editorPage.page.locator(SELECTORS.canvas)).toHaveAttribute(
      "lang",
      "de",
    );
  });

  // The drag path builds the block through the same `:clone` handler as the
  // click path, so this covers the gesture the issue was actually reported for.
  test("dragging from the palette lands German text too", async ({
    scenePage,
    editorPage,
  }) => {
    await openBlankEditor(scenePage, editorPage, "de");
    await editorPage.dragBlockFromSidebar("button");

    const text = await canvasText(editorPage);
    expect(text).toContain("Hier klicken");
    expect(text).not.toContain("Click Here");
  });
});
