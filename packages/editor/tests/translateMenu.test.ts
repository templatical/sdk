// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { init } from "../src/index";
import {
  openLanguages,
  chooseLanguage,
  languageContent,
} from "./helpers/localization";
import {
  createHtmlBlock,
  createTitleBlock,
  sourceHash,
  type TranslationProvider,
} from "@templatical/types";

const provider: TranslationProvider = {
  translate: async (request) => ({
    fields: request.fields.map(({ id, text }) => ({ id, text: `DE ${text}` })),
  }),
};
const button = (id: string) => `[data-testid="${id}"]`;
async function menu(
  wrapper: Awaited<ReturnType<typeof openLanguages>>["wrapper"],
) {
  await wrapper.get(button("language-menu")).trigger("click");
}

describe("translation entry points", () => {
  it("hides actions without a provider, in the default view and in a read-only version", async () => {
    const absent = await openLanguages();
    await chooseLanguage(absent.wrapper, "de");
    await menu(absent.wrapper);
    expect(absent.wrapper.find(button("translate-language")).exists()).toBe(
      false,
    );
    expect(absent.wrapper.find(button("locale-translate")).exists()).toBe(
      false,
    );
    const { wrapper } = await openLanguages({ translation: provider });
    await menu(wrapper);
    expect(wrapper.find(button("translate-language")).exists()).toBe(false);
    await wrapper.get(button("language-option-fr")).trigger("click");
    await menu(wrapper);
    expect(wrapper.find(button("translate-all-again")).exists()).toBe(false);
    expect(wrapper.find(button("locale-retranslate")).exists()).toBe(false);
    await wrapper.get(button("language-option-de")).trigger("click");
    await menu(wrapper);
    expect(wrapper.get(button("translate-language")).text()).toContain(
      "Translate from English",
    );
  });

  it("shows each count, translates gaps, and disables the gaps action at zero", async () => {
    const { wrapper, editor, history } = await openLanguages({
      translation: provider,
    });
    await chooseLanguage(wrapper, "de");
    await menu(wrapper);
    expect(wrapper.get(button("translate-language")).text()).toContain("2");
    expect(wrapper.get(button("translate-all-again")).text()).toContain("2");
    await wrapper.get(button("translate-language")).trigger("click");
    await vi.waitFor(() =>
      expect(editor.content.value.blocks[1].l10n?.de.text?.alt.value).toBe(
        "DE Product",
      ),
    );
    await menu(wrapper);
    expect(
      wrapper.get(button("translate-language")).attributes("disabled"),
    ).toBeDefined();
    expect(
      wrapper.get(button("translate-all-again")).attributes("disabled"),
    ).toBeUndefined();
    history.undo();
    expect(editor.content.value.blocks[1].l10n).toBeUndefined();
  });

  it("cancels confirmation without changing manual text, then confirms replacing it", async () => {
    const { wrapper, editor } = await openLanguages({ translation: provider });
    await chooseLanguage(wrapper, "de");
    await menu(wrapper);
    await wrapper.get(button("translate-all-again")).trigger("click");
    expect(wrapper.get('[role="dialog"]').text()).toContain(
      "Replace every Deutsch translation, including manual edits?",
    );
    await wrapper.get(button("translation-confirm-cancel")).trigger("click");
    expect(editor.content.value.blocks[0].l10n?.de.text?.content.value).toBe(
      "Hallo",
    );
    await wrapper.get(button("translate-all-again")).trigger("click");
    await wrapper.get(button("translation-confirm")).trigger("click");
    await vi.waitFor(() =>
      expect(editor.content.value.blocks[0].l10n?.de.text?.content.value).toBe(
        "DE Hello",
      ),
    );
  });

  it("offers block Translate and Re-translate and disables every action while running", async () => {
    let finish!: (value: { fields: { id: string; text: string }[] }) => void;
    const requests: string[][] = [];
    const { wrapper, editor } = await openLanguages({
      translation: {
        translate: (request) => {
          requests.push(request.fields.map(({ id }) => id));
          return new Promise((resolve) => {
            finish = resolve;
          });
        },
      },
    });
    await chooseLanguage(wrapper, "de");
    expect(wrapper.get(button("locale-translate")).text()).toBe("Translate");
    expect(wrapper.get(button("locale-retranslate")).text()).toBe(
      "Re-translate",
    );
    await wrapper.get(button("locale-retranslate")).trigger("click");
    expect(requests).toEqual([["title/content"]]);
    expect(
      wrapper.get(button("locale-translate")).attributes("disabled"),
    ).toBeDefined();
    expect(
      wrapper.get(button("locale-retranslate")).attributes("disabled"),
    ).toBeDefined();
    await menu(wrapper);
    expect(
      wrapper.get(button("translate-language")).attributes("disabled"),
    ).toBeDefined();
    expect(
      wrapper.get(button("translate-all-again")).attributes("disabled"),
    ).toBeDefined();
    finish({ fields: [{ id: "title/content", text: "Guten Tag" }] });
    await vi.waitFor(() =>
      expect(wrapper.find(button("locale-retranslate")).exists()).toBe(false),
    );
    await wrapper.get(button("locale-translate")).trigger("click");
    expect(requests[1]).toEqual(["image/alt"]);
    finish({ fields: [{ id: "image/alt", text: "Produkt" }] });
    await vi.waitFor(() =>
      expect(editor.content.value.blocks[1].l10n?.de.text?.alt.value).toBe(
        "Produkt",
      ),
    );
  });

  it("disables both menu actions when no fields are eligible", async () => {
    const { wrapper, editor } = await openLanguages({ translation: provider });
    editor.content.value.blocks = [];
    await chooseLanguage(wrapper, "de");
    await menu(wrapper);
    for (const id of ["translate-language", "translate-all-again"])
      expect(wrapper.get(button(id)).attributes("disabled")).toBeDefined();
  });

  it.each([null, false, () => {}, {}, { translate: true }])(
    "rejects invalid translation config %j before mounting",
    async (translation) => {
      const container = document.createElement("div");
      await expect(
        init({ container, translation } as any),
      ).rejects.toMatchObject({
        name: "SdkError",
        message: "translation must be an object with a translate function.",
      });
      expect(container.childElementCount).toBe(0);
      await nextTick();
    },
  );

  it.each(["clean", "undo and redo"])(
    "keeps %s state when Translate everything again returns identical values",
    async (state) => {
      const seed = languageContent();
      seed.blocks[0].l10n!.de.text!.content.source = sourceHash("Hello");
      seed.blocks[1].l10n = {
        de: {
          text: { alt: { value: "Produkt", source: sourceHash("Product") } },
        },
      };
      seed.settings.preheaderText = "Preview";
      seed.settings.l10n = {
        de: {
          text: {
            preheaderText: { value: "Vorschau", source: sourceHash("Preview") },
          },
        },
      };
      const translate = vi.fn(async () => ({
        fields: [
          { id: "title/content", text: "Hallo" },
          { id: "image/alt", text: "Produkt" },
          { id: "settings/preheaderText", text: "Vorschau" },
        ],
      }));
      const { wrapper, editor, history } = await openLanguages({
        content: seed,
        translation: { translate },
      });
      await chooseLanguage(wrapper, "de");
      if (state === "undo and redo") {
        editor.updateBlock("title", { color: "#112233" } as any);
        history.flushDebounce();
        editor.updateBlock("title", { color: "#445566" } as any);
        history.undo();
      }
      const before = JSON.stringify(editor.content.value);
      expect(editor.state.isDirty).toBe(state !== "clean");
      expect(history.canUndo.value).toBe(state !== "clean");
      expect(history.canRedo.value).toBe(state !== "clean");
      await menu(wrapper);
      await wrapper.get(button("translate-all-again")).trigger("click");
      await wrapper.get(button("translation-confirm")).trigger("click");
      await vi.waitFor(() => expect(translate).toHaveBeenCalledTimes(1));
      await vi.waitFor(() =>
        expect(wrapper.find(button("translation-result")).exists()).toBe(true),
      );
      expect(wrapper.get(button("translation-result")).text()).toBe(
        "Translated 0 fields",
      );
      expect(JSON.stringify(editor.content.value)).toBe(before);
      expect(editor.state.isDirty).toBe(state !== "clean");
      expect(history.canUndo.value).toBe(state !== "clean");
      expect(history.canRedo.value).toBe(state !== "clean");
      if (state === "undo and redo") {
        history.redo();
        expect(editor.content.value.blocks[0].l10n?.de.set?.color).toBe(
          "#445566",
        );
        history.undo();
        expect(JSON.stringify(editor.content.value)).toBe(before);
        history.undo();
        expect(editor.content.value.blocks[0].l10n?.de.set?.color).toBe(
          "#123456",
        );
      }
    },
  );

  it.each(["raw HTML", "liquid tags", "mailchimp tags"])(
    "hides translation actions for ineligible %s gaps",
    async (kind) => {
      const seed = languageContent();
      if (kind === "raw HTML")
        seed.blocks = [
          createTitleBlock({ id: "eligible", content: "Hello" }),
          createHtmlBlock({ id: "ineligible", content: "<p>Manual HTML</p>" }),
        ];
      else {
        const source =
          kind === "mailchimp tags" ? "Hello *|NAME|*" : "Hello {{name}}";
        const old =
          kind === "mailchimp tags" ? "Alt *|OTHER|*" : "Alt {{other}}";
        seed.blocks = [
          createTitleBlock({ id: "eligible", content: "Hello" }),
          createTitleBlock({
            id: "ineligible",
            content: source,
            l10n: { de: { text: { content: { value: old, source: "old" } } } },
          }),
        ];
      }
      const { wrapper } = await openLanguages({
        content: seed,
        translation: provider,
        mergeTags: {
          syntax: kind === "mailchimp tags" ? "mailchimp" : "liquid",
        },
      });
      await chooseLanguage(wrapper, "de");
      expect(
        wrapper
          .find('[data-block-id="eligible"] [data-testid="locale-translate"]')
          .exists(),
      ).toBe(true);
      const ineligible = wrapper.get('[data-block-id="ineligible"]');
      expect(
        ineligible
          .find(
            button(
              kind === "raw HTML"
                ? "locale-marker-untranslated"
                : "locale-marker-stale",
            ),
          )
          .exists(),
      ).toBe(true);
      expect(ineligible.find(button("locale-translate")).exists()).toBe(false);
      expect(ineligible.find(button("locale-retranslate")).exists()).toBe(
        false,
      );
    },
  );
});
