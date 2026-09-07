import { expect } from "@playwright/test";
import { test } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";
import type { ChooserPage } from "../pages/chooser.page";
import type { EditorPage } from "../pages/editor.page";

/**
 * Issue #673 — a new Button read "Click Here" and a new Paragraph "Enter your
 * text here" in a German editor. (The reporter missed Title, which had it too.)
 *
 * Three things about this setup are load-bearing:
 *
 *  - **A blank canvas.** The showcase templates ship their own copy, so a block
 *    inserted into one proves nothing about what the *factory* produced.
 *  - **`tpl-playground-sdk-locale`, not the header switcher.** The playground
 *    keeps two independent locales: `tpl-playground-locale` drives its own
 *    chrome, and only this one reaches `init({ locale })`. Driving the header
 *    select turns the playground German and leaves the editor English, so the
 *    assertions below would fail while the SDK was working correctly.
 *  - **Seeded before navigation.** The app reads it at mount, so setting it
 *    afterwards races the read — hence the hand-rolled navigation instead of the
 *    `blankEditorReady` fixture, which navigates before a test can add to it.
 *
 * One insert per test: a second consecutive palette click does not land once a
 * block is selected, and batching them would make a locale failure
 * indistinguishable from that unrelated interaction problem.
 */
test.describe("localized block defaults", () => {
  async function openBlankEditor(
    chooserPage: ChooserPage,
    editorPage: EditorPage,
    sdkLocale: string,
  ): Promise<void> {
    await editorPage.page.addInitScript((locale) => {
      localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
      localStorage.setItem("tpl-playground-features-dismissed", "true");
      localStorage.setItem("tpl-playground-sdk-locale", locale);
    }, sdkLocale);
    await chooserPage.goto();
    await chooserPage.selectBlankTemplate();
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
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
      chooserPage,
      editorPage,
    }) => {
      await openBlankEditor(chooserPage, editorPage, "de");
      await editorPage.clickPaletteItem(type);

      const text = await canvasText(editorPage);
      expect(text).toContain(german);
      // The exact string the issue reported.
      expect(text).not.toContain(english);
    });

    test(`an English editor still inserts English ${type} text`, async ({
      chooserPage,
      editorPage,
    }) => {
      await openBlankEditor(chooserPage, editorPage, "en");
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
    chooserPage,
    editorPage,
  }) => {
    await openBlankEditor(chooserPage, editorPage, "de");

    await expect(editorPage.page.locator(SELECTORS.canvas)).toHaveAttribute(
      "lang",
      "de",
    );
  });

  // The drag path builds the block through the same `:clone` handler as the
  // click path, so this covers the gesture the issue was actually reported for.
  test("dragging from the palette lands German text too", async ({
    chooserPage,
    editorPage,
  }) => {
    await openBlankEditor(chooserPage, editorPage, "de");
    await editorPage.dragBlockFromSidebar("button");

    const text = await canvasText(editorPage);
    expect(text).toContain("Hier klicken");
    expect(text).not.toContain("Click Here");
  });
});
