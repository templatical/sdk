// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { computed, defineComponent, h, ref, shallowRef } from "vue";
import { flushPromises, type VueWrapper } from "@vue/test-utils";
import type { Editor } from "@tiptap/core";
import { useEditor } from "@templatical/core";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createTitleBlock,
  createButtonBlock,
  createMenuBlock,
  resolveLocale,
  safeClone,
} from "@templatical/types";
import ColorPicker from "../src/components/ColorPicker.vue";
import RichTextLinkDialog from "../src/components/blocks/RichTextLinkDialog.vue";
import ParagraphToolbar from "../src/components/blocks/ParagraphToolbar.vue";
import { exportedParagraphAlignment } from "../../../apps/playground/e2e/helpers/exported-paragraph";
import { renderToMjml } from "@templatical/renderer";
import ParagraphEditor from "../src/components/blocks/ParagraphEditor.vue";
import Toolbar from "../src/components/Toolbar.vue";
import TitleEditor from "../src/components/blocks/TitleEditor.vue";
import {
  EDITOR_KEY,
  LOCALIZATION_KEY,
  MERGE_TAGS_KEY,
  POPOVER_ROOT_KEY,
  TRANSLATIONS_KEY,
} from "../src/keys";
import en from "../src/i18n/locales/en";
import { mountEditor } from "./helpers/mount";

let wrapper: VueWrapper | undefined;
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = "";
});

async function openInline(
  kind: "paragraph" | "title" = "paragraph",
  locale = "ar",
  distinctTranslations = false,
  withTags = false,
) {
  const content = createDefaultTemplateContent();
  content.settings.locale = "en";
  content.settings.locales = ["ar", "fr"];
  content.blocks = [
    kind === "paragraph"
      ? createParagraphBlock({ id: "copy", content: "<p>Hello</p>" })
      : createTitleBlock({ id: "copy", content: "<p>Hello</p>" }),
  ];
  if (distinctTranslations)
    content.blocks[0].l10n = {
      ar: {
        text: { content: { value: "<p>Arabic copy</p>", sourceHash: "original" } },
      },
      fr: {
        text: { content: { value: "<p>French copy</p>", sourceHash: "original" } },
      },
    };
  const store = useEditor({ content, localization: { locales: ["ar"] } });
  store.setActiveLocale(locale);
  const block = computed(
    () =>
      resolveLocale(store.content.value, store.activeLocale.value ?? "en")
        .blocks[0],
  );
  const popovers = document.createElement("div");
  document.body.appendChild(popovers);
  wrapper = mountEditor(
    defineComponent({
      setup: () => () =>
        h(kind === "paragraph" ? ParagraphEditor : TitleEditor, {
          block: block.value as never,
          toolbarPosition: { top: 0, left: 0 },
        }),
    }),
    {
      attachTo: document.body,
      provides: {
        [EDITOR_KEY]: store,
        [TRANSLATIONS_KEY]: en,
        ...(withTags
          ? {
              [MERGE_TAGS_KEY]: shallowRef([
                { label: "First Name", value: "{{first_name}}" },
              ]),
            }
          : {}),
        [LOCALIZATION_KEY]: { locales: ["ar"] },
        [POPOVER_ROOT_KEY]: ref(popovers),
      },
    },
  );
  const editor = await vi.waitFor(
    () => {
      const dom = wrapper!.find(".ProseMirror");
      const editor = dom.exists()
        ? (dom.element as HTMLElement & { editor?: Editor }).editor
        : undefined;
      if (!editor) throw new Error("Inline editor is loading");
      return editor;
    },
    { timeout: 15_000 },
  );
  return { store, editor, popovers };
}

// ProseMirror's input path, including its editable gate before text-input handlers.
function attemptTyping(editor: Editor, text: string) {
  editor.view.dom.dispatchEvent(
    new KeyboardEvent("keydown", { key: text, bubbles: true }),
  );
  editor.view.dom.dispatchEvent(
    new InputEvent("beforeinput", {
      inputType: "insertText",
      data: text,
      bubbles: true,
      cancelable: true,
    }),
  );
  if (editor.view.editable) {
    const { from, to } = editor.state.selection;
    editor.view.dispatch(editor.state.tr.insertText(text, from, to));
  }
}

describe("localized inline editing", () => {
  it("keeps inherited paragraph alignment absent when typing in Arabic", async () => {
    const { store, editor } = await openInline();
    expect(editor.view.dom.getAttribute("dir")).toBe("rtl");
    attemptTyping(editor, " مرحبا");
    await flushPromises();
    const html = store.content.value.blocks[0].l10n?.ar.text?.content.value;
    expect(html).toContain("مرحبا");
    expect(html).not.toMatch(/text-align/);
    expect(
      editor.extensionManager.extensions.find((ext) => ext.name === "textAlign")
        ?.options.defaultAlignment,
    ).toBe("right");
  });

  it("updates inherited alignment when the mounted editor switches language", async () => {
    const { store, editor } = await openInline("paragraph", "en");
    store.setActiveLocale("ar");
    await flushPromises();
    expect(editor.view.dom.getAttribute("dir")).toBe("rtl");
    attemptTyping(editor, " مرحبا");
    await flushPromises();
    expect(
      store.content.value.blocks[0].l10n?.ar.text?.content.value,
    ).not.toMatch(/text-align/);
    expect(
      editor.extensionManager.extensions.find((ext) => ext.name === "textAlign")
        ?.options.defaultAlignment,
    ).toBe("right");
  });

  it.each(["paragraph", "title"] as const)(
    "%s preserves explicit non-default alignment",
    async (kind) => {
      const { store, editor } = await openInline(kind);
      if (kind === "paragraph") editor.commands.setTextAlign("center");
      attemptTyping(editor, " text");
      await flushPromises();
      const html = store.content.value.blocks[0].l10n?.ar.text?.content.value;
      expect(html).toContain("text");
      if (kind === "paragraph") expect(html).toContain("text-align: center");
    },
  );

  for (const kind of ["paragraph", "title"] as const) {
    it.each(["initial", "mounted"] as const)(
      `${kind} is visibly read-only in a disabled language (%s)`,
      async (when) => {
        const { store, editor, popovers } = await openInline(
          kind,
          when === "initial" ? "fr" : "ar",
        );
        if (when === "mounted") store.setActiveLocale("fr");
        await flushPromises();
        const before = editor.getHTML();
        attemptTyping(editor, "UNSAVED");
        await flushPromises();
        expect(editor.getHTML()).toBe(before);
        expect(editor.view.dom.getAttribute("contenteditable")).toBe("false");
        expect(editor.isEditable).toBe(false);
        const controls = [
          ...popovers.querySelectorAll("button, select, input"),
        ];
        expect(controls.length).toBeGreaterThan(0);
        expect(
          controls.every(
            (control) =>
              control.matches(":disabled") ||
              !!control.closest("fieldset[disabled]"),
          ),
        ).toBe(true);
        expect(store.content.value.blocks[0].l10n?.fr).toBeUndefined();
        store.setActiveLocale("ar");
        await flushPromises();
        expect(editor.view.dom.getAttribute("contenteditable")).toBe("true");
      },
    );
  }
});

it("disables the block toolbar when the selected view becomes read-only", async () => {
  const activeLocale = ref<string | null>("ar");
  wrapper = mountEditor(Toolbar, {
    props: { block: createParagraphBlock({ id: "copy" }) },
    provides: {
      [EDITOR_KEY]: { activeLocale },
      [LOCALIZATION_KEY]: { locales: ["ar"] },
      [TRANSLATIONS_KEY]: en,
    },
    global: { stubs: { "hex-color-picker": true } },
  });
  activeLocale.value = "fr";
  await flushPromises();
  const fieldset = wrapper.get("fieldset");
  expect(fieldset.attributes("disabled")).toBeDefined();
  expect(fieldset.attributes("inert")).toBeDefined();
  await wrapper.get('[data-testid="paragraph-spacing"] input').setValue("24");
  expect(wrapper.emitted("update")).toBeUndefined();
  activeLocale.value = "ar";
  await flushPromises();
  expect(fieldset.attributes("disabled")).toBeUndefined();
});

it("does not write another language's text when a mounted editor becomes editable again", async () => {
  const { store, editor } = await openInline("paragraph", "ar", true);
  const before = JSON.stringify(store.content.value);
  store.setActiveLocale("fr");
  await flushPromises();
  expect(editor.getHTML()).toContain("French copy");
  store.setActiveLocale("ar");
  await flushPromises();
  expect(editor.getHTML()).toContain("Arabic copy");
  expect(JSON.stringify(store.content.value)).toBe(before);
});

describe("open popovers follow locale editability", () => {
  it.each(["text-color-picker", "highlight-color-picker"])(
    "%s closes on a disabled language and ignores delayed mutation callbacks",
    async (testid) => {
      const { store, editor, popovers } = await openInline();
      editor.commands.selectAll();
      const toolbar = wrapper!.findComponent(ParagraphToolbar);
      const picker = toolbar
        .findAllComponents(ColorPicker)
        .find((picker) => picker.attributes("data-testid") === testid)!;
      await picker.get("button").trigger("click");
      expect(popovers.querySelector(".tpl-color-popover")).not.toBeNull();
      store.setActiveLocale("fr");
      await flushPromises();
      const before = editor.getHTML();
      // A callback already queued before disablement still reaches the parent.
      picker.vm.$emit("update:modelValue", "#123456");
      await flushPromises();
      expect(editor.getHTML()).toBe(before);
      expect(popovers.querySelector(".tpl-color-popover")).toBeNull();
      expect(picker.get("button").attributes("disabled")).toBeDefined();
      store.setActiveLocale("ar");
      await flushPromises();
      editor.commands.selectAll();
      await picker.get("button").trigger("click");
      const wheel = popovers.querySelector("hex-color-picker")!;
      expect(wheel).not.toBeNull();
      wheel.dispatchEvent(
        new CustomEvent("color-changed", { detail: { value: "#654321" } }),
      );
      await flushPromises();
      expect(editor.getHTML()).toContain("#654321");
      expect(
        store.content.value.blocks[0].l10n?.ar.text?.content.value,
      ).toContain("#654321");
    },
  );
});

it("exports the edited inner Arabic paragraph without an explicit left alignment", async () => {
  const { store, editor } = await openInline("paragraph", "en");
  store.setActiveLocale("ar");
  await flushPromises();
  attemptTyping(editor, " مرحبا.");
  await flushPromises();
  const mjml = await renderToMjml(store.content.value, { locale: "ar" });
  expect(mjml).toContain('align="right"');
  expect(exportedParagraphAlignment(mjml, "مرحبا.")).not.toBe("left");
});

it("ignores delayed link-dialog mutation callbacks in a read-only view", async () => {
  const { store, editor } = await openInline();
  editor.commands.selectAll();
  store.setActiveLocale("fr");
  await flushPromises();
  const before = editor.getHTML();
  const dialog = wrapper!.findComponent(RichTextLinkDialog);
  dialog.vm.$emit("update:linkUrl", "https://example.com");
  await flushPromises();
  dialog.vm.$emit("insert");
  await flushPromises();
  expect(editor.getHTML()).toBe(before);
});

it.each([
  ["title", createTitleBlock()],
  ["button", createButtonBlock()],
  ["menu", createMenuBlock()],
] as const)(
  "%s sidebar color popovers close when the language becomes disabled",
  async (_name, block) => {
    const activeLocale = ref<string | null>("ar");
    const popovers = document.createElement("div");
    document.body.appendChild(popovers);
    wrapper = mountEditor(Toolbar, {
      props: { block },
      provides: {
        [EDITOR_KEY]: { activeLocale },
        [LOCALIZATION_KEY]: { locales: ["ar"] },
        [POPOVER_ROOT_KEY]: ref(popovers),
        [TRANSLATIONS_KEY]: en,
      },
    });
    const picker = wrapper.findComponent(ColorPicker);
    await picker.get("button").trigger("click");
    expect(popovers.querySelector(".tpl-color-popover")).not.toBeNull();
    activeLocale.value = "fr";
    await flushPromises();
    expect(popovers.querySelector(".tpl-color-popover")).toBeNull();
    expect(picker.get("button").attributes("disabled")).toBeDefined();
    activeLocale.value = "ar";
    await flushPromises();
    await picker.get("button").trigger("click");
    expect(popovers.querySelector(".tpl-color-popover")).not.toBeNull();
  },
);

it("closes a rich-text suggestion popup and ignores a retained option after disabling", async () => {
  const { store, editor, popovers } = await openInline(
    "paragraph",
    "ar",
    false,
    true,
  );
  editor.commands.focus("end");
  editor.commands.insertContent(" {{");
  await flushPromises();
  const popup = popovers.querySelector(
    '[data-testid="merge-tag-suggestion-popup"]',
  );
  expect(popup).not.toBeNull();
  const option = popup!.querySelector("button")!;
  expect(option).not.toBeNull();
  // Equal projections produce no setContent transaction to dismiss suggestions.
  const content = safeClone(store.content.value);
  content.blocks[0].l10n!.fr = safeClone(content.blocks[0].l10n!.ar);
  store.setContent(content);
  await flushPromises();
  store.setActiveLocale("fr");
  await flushPromises();
  const before = editor.getHTML();
  option.dispatchEvent(
    new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
  );
  await flushPromises();
  expect(editor.getHTML()).toBe(before);
  expect(
    popovers.querySelector('[data-testid="merge-tag-suggestion-popup"]'),
  ).toBeNull();
  store.setActiveLocale("ar");
  await flushPromises();
  editor.commands.focus("end");
  editor.commands.insertContent(" {{");
  await flushPromises();
  expect(
    popovers.querySelector('[data-testid="merge-tag-suggestion-popup"]'),
  ).not.toBeNull();
});
