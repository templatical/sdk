// @vitest-environment happy-dom
// The line-height and letter-spacing selects render their placeholder and the
// "normal" option from translations. Mounted with the real Japanese locale:
// its strings differ from English, so a hardcoded "LH" or "Normal" can't pass
// as translated. ColorPicker and the emoji picker are stubbed; neither touches
// these selects.
import { describe, expect, it } from "vitest";
import { ref } from "vue";
import type { Editor } from "@tiptap/core";
import ParagraphToolbar from "../src/components/blocks/ParagraphToolbar.vue";
import ja from "../src/i18n/locales/ja";
import { POPOVER_ROOT_KEY, TRANSLATIONS_KEY } from "../src/keys";
import { mountEditor } from "./helpers/mount";

function stubEditor(): Editor {
  const chain: Record<string, () => unknown> = new Proxy(
    {},
    { get: () => () => chain },
  );
  return {
    isActive: () => false,
    getAttributes: () => ({}),
    chain: () => chain,
  } as unknown as Editor;
}

function mountToolbar() {
  return mountEditor(ParagraphToolbar, {
    props: {
      editor: stubEditor(),
      toolbarPosition: { top: 0, left: 0 },
      isLoading: false,
      canRequestMergeTag: false,
      canInsertLogicTag: false,
    },
    provides: {
      [TRANSLATIONS_KEY]: ja,
      [POPOVER_ROOT_KEY]: ref(document.createElement("div")),
    },
    global: {
      stubs: { teleport: true, ColorPicker: true, EmojiPickerDropdown: true },
    },
  });
}

function select(label: string) {
  return mountToolbar().get(`select[aria-label="${label}"]`);
}

describe("ParagraphToolbar line-height and letter-spacing selects", () => {
  it("translates the line-height placeholder", () => {
    const placeholder = select(ja.paragraphEditor.lineHeight).get(
      'option[value=""]',
    );

    expect(placeholder.text()).toBe("行間");
  });

  it("translates the letter-spacing placeholder", () => {
    const placeholder = select(ja.paragraphEditor.letterSpacing).get(
      'option[value=""]',
    );

    expect(placeholder.text()).toBe("字間");
  });

  it("translates the normal letter-spacing option and keeps its value", () => {
    const normal = select(ja.paragraphEditor.letterSpacing).get(
      'option[value="normal"]',
    );

    expect(normal.text()).toBe("標準");
  });

  it("keeps pixel letter-spacing options as their values", () => {
    const options = select(ja.paragraphEditor.letterSpacing)
      .findAll("option")
      .map((option) => [option.attributes("value"), option.text()]);

    expect(options).toEqual([
      ["", "字間"],
      ["normal", "標準"],
      ["-0.5px", "-0.5px"],
      ["0.5px", "0.5px"],
      ["1px", "1px"],
      ["1.5px", "1.5px"],
      ["2px", "2px"],
      ["3px", "3px"],
    ]);
  });
});
