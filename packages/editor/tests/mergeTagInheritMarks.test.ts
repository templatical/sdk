// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, type VueWrapper } from "@vue/test-utils";
import { reactive, shallowRef } from "vue";
import type { Editor } from "@tiptap/core";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createTitleBlock,
  SYNTAX_PRESETS,
} from "@templatical/types";
import { renderToMjml } from "@templatical/renderer";
import { Liquid } from "liquidjs";
import ParagraphEditor from "../src/components/blocks/ParagraphEditor.vue";
import TitleEditor from "../src/components/blocks/TitleEditor.vue";
import en from "../src/i18n/locales/en";
import { EDITOR_KEY, MERGE_TAGS_KEY, TRANSLATIONS_KEY } from "../src/keys";
import { insertLogicTagSelection } from "../src/utils/insertLogicTag";
import { mountEditor } from "./helpers/mount";

const STYLED = '<p><span style="font-size: 20px">Hello world</span></p>';
const CHIP =
  '<span data-merge-tag="{{first_name}}" data-label="First Name">First Name</span>';
let wrapper: VueWrapper<any> | null = null;
let vueErrors: unknown[] = [];

afterEach(() => {
  try {
    wrapper?.unmount();
  } finally {
    wrapper = null;
    vueErrors = [];
    document.body.innerHTML = "";
  }
});

async function mountWithContent(content: string, title = false) {
  const block = reactive(
    title ? createTitleBlock({ content }) : createParagraphBlock({ content }),
  );
  wrapper = mountEditor(title ? TitleEditor : ParagraphEditor, {
    props: { block, toolbarPosition: { top: 0, left: 0 } },
    attachTo: document.body,
    provides: {
      [EDITOR_KEY]: {
        updateBlock: (_id: string, patch: { content: string }) => {
          block.content = patch.content;
        },
      },
      [TRANSLATIONS_KEY]: en,
      [MERGE_TAGS_KEY]: shallowRef([
        { label: "First Name", value: "{{first_name}}" },
      ]),
    },
    global: {
      stubs: { ParagraphToolbar: true, RichTextLinkDialog: true },
      config: { errorHandler: (error: unknown) => vueErrors.push(error) },
    },
  });
  const editor = await vi.waitFor(
    () => {
      const dom = wrapper!.find(".ProseMirror");
      const instance = dom.exists()
        ? (dom.element as Element & { editor?: Editor }).editor
        : undefined;
      if (!instance) throw new Error("TipTap editor not constructed yet");
      return instance;
    },
    { timeout: 15_000 },
  );
  return { block, editor };
}

function typeText(editor: Editor, text: string) {
  const { view } = editor;
  const { from, to } = view.state.selection;
  const handled = view.someProp("handleTextInput", (f) =>
    f(view, from, to, text, () => view.state.tr.insertText(text, from, to)),
  );
  if (!handled) view.dispatch(view.state.tr.insertText(text, from, to));
}

function select(editor: Editor, from: number, to = from) {
  editor.commands.setTextSelection({ from, to });
}

/** Logic chips print no text, so they sit at the paragraph's top level. */
function logicChipParents(editor: Editor) {
  const doc = new DOMParser().parseFromString(editor.getHTML(), "text/html");
  return [...doc.querySelectorAll("[data-logic-merge-tag]")].map(
    (chip) => chip.parentElement?.tagName,
  );
}

function expectStyled(editor: Editor, inside: string) {
  expect(editor.getHTML()).toContain(
    `<span style="font-size: 20px;">Hello ${inside}world</span>`,
  );
  expect(vueErrors).toEqual([]);
}

describe("merge tag chips inherit the text marks", () => {
  it("inserts a toolbar merge tag inside styled paragraph text and renders it in MJML", async () => {
    const { editor } = await mountWithContent(STYLED);
    select(editor, 7);
    editor.commands.insertMergeTag({
      label: "First Name",
      value: "{{first_name}}",
    });
    expectStyled(editor, CHIP);

    const content = createDefaultTemplateContent();
    content.blocks = [createParagraphBlock({ content: editor.getHTML() })];
    const mjml = await renderToMjml(content);
    expect(mjml).toContain(
      '<span style="font-size: 20px;">Hello {{first_name}}world</span>',
    );
  });

  it("inserts a toolbar merge tag inside bold title text", async () => {
    const { editor } = await mountWithContent(
      "<p><strong>Hello world</strong></p>",
      true,
    );
    select(editor, 7);
    editor.commands.insertMergeTag({
      label: "First Name",
      value: "{{first_name}}",
    });
    expect(editor.getHTML()).toContain(`<strong>Hello ${CHIP}world</strong>`);
  });

  it("uses stored marks when inserting after styled text", async () => {
    const { editor } = await mountWithContent(
      '<p><span style="font-size: 20px">Hello</span></p>',
    );
    select(editor, 6);
    const mark = editor.schema.marks.textStyle.create({ fontSize: "30px" });
    editor.view.dispatch(editor.state.tr.setStoredMarks([mark]));
    editor.commands.insertMergeTag({
      label: "First Name",
      value: "{{first_name}}",
    });
    expect(editor.getHTML()).toContain(
      `<span style="font-size: 20px;">Hello</span><span style="font-size: 30px;">${CHIP}</span>`,
    );
  });

  it("does not add marks in unstyled text", async () => {
    const { editor } = await mountWithContent("<p>Hello world</p>");
    select(editor, 7);
    editor.commands.insertMergeTag({
      label: "First Name",
      value: "{{first_name}}",
    });
    expect(editor.getHTML()).toBe(`<p>Hello ${CHIP}world</p>`);
  });

  it("takes the replaced text's marks, not the previous character's, for a selection", async () => {
    const { editor } = await mountWithContent("<p><strong>A</strong>BC</p>");
    select(editor, 2, 3);
    editor.commands.insertMergeTag({
      label: "First Name",
      value: "{{first_name}}",
    });
    expect(editor.getHTML()).toBe(`<p><strong>A</strong>${CHIP}C</p>`);
    expect(vueErrors).toEqual([]);
  });

  it("inserts an autocomplete choice inside styled text", async () => {
    const { editor } = await mountWithContent(STYLED);
    select(editor, 7);
    typeText(editor, "{{f");
    await flushPromises();
    const option = document.querySelector<HTMLButtonElement>(
      '[data-merge-tag-value="{{first_name}}"]',
    );
    expect(option?.textContent).toContain("First Name");
    editor.view.dispatch(editor.state.tr.setStoredMarks([]));
    option!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await flushPromises();
    expectStyled(editor, CHIP);
  });

  it("turns a typed merge tag inside styled text into a styled chip", async () => {
    const { editor } = await mountWithContent(
      '<p><span style="font-size: 20px">Hello {{first_name}world</span></p>',
    );
    select(editor, 1 + "Hello {{first_name}".length);
    typeText(editor, "}");
    await flushPromises();
    expectStyled(editor, CHIP);
  });

  it("uses the replaced text marks when a typed tag starts the paragraph", async () => {
    const { editor } = await mountWithContent(
      '<p><span style="font-size: 20px">{{first_name}world</span></p>',
    );
    select(editor, 1 + "{{first_name}".length);
    typeText(editor, "}");
    await flushPromises();
    expect(editor.getHTML()).toContain(
      `<span style="font-size: 20px;">${CHIP}world</span>`,
    );
  });

  it("turns a pasted merge tag inside styled text into a styled chip", async () => {
    const { editor } = await mountWithContent(STYLED);
    select(editor, 7);
    editor.view.pasteText("{{first_name}}");
    await flushPromises();
    expectStyled(editor, CHIP);
  });

  it("uses pasted text marks when a pasted tag starts the paragraph", async () => {
    const { editor } = await mountWithContent(
      '<p><span style="font-size: 20px">world</span></p>',
    );
    select(editor, 1);
    editor.view.pasteText("{{first_name}}");
    await flushPromises();
    expect(editor.getHTML()).toContain(
      `<span style="font-size: 20px;">${CHIP}world</span>`,
    );
  });

  it("keeps logic chips outside formatting so a condition can't split an element", async () => {
    const { editor } = await mountWithContent(
      '<p><span style="font-size: 20px">Hello </span><strong>world</strong></p>',
    );
    select(editor, 3, 9);
    insertLogicTagSelection(
      editor,
      { label: "If VIP", before: "{% if vip %}", after: "{% endif %}" },
      SYNTAX_PRESETS.liquid,
    );
    expect(logicChipParents(editor)).toEqual(["P", "P"]);

    const content = createDefaultTemplateContent();
    content.blocks = [createParagraphBlock({ content: editor.getHTML() })];
    const mjml = await renderToMjml(content);
    const liquid = new Liquid();
    expect(await liquid.parseAndRender(mjml, { vip: false })).toContain(
      '<p style="mso-line-height-alt:21px"><span style="font-size: 20px;">He</span><strong>rld</strong></p>',
    );
    expect(await liquid.parseAndRender(mjml, { vip: true })).toContain(
      '<p style="mso-line-height-alt:21px"><span style="font-size: 20px;">He</span><span style="font-size: 20px;">llo </span><strong>wo</strong><strong>rld</strong></p>',
    );
  });

  it("keeps a standalone logic tag in styled text unmarked", async () => {
    const { editor } = await mountWithContent(STYLED);
    select(editor, 7);
    insertLogicTagSelection(
      editor,
      { label: "If VIP", value: "{% if vip %}" },
      SYNTAX_PRESETS.liquid,
    );
    expect(logicChipParents(editor)).toEqual(["P"]);
  });

  it("keeps typed and pasted logic tags in styled text unmarked", async () => {
    const { editor } = await mountWithContent(
      '<p><span style="font-size: 20px">Hello {% if vip %world</span></p>',
    );
    select(editor, 1 + "Hello {% if vip %".length);
    typeText(editor, "}");
    await flushPromises();
    editor.view.pasteText("{% endif %}");
    await flushPromises();
    expect(logicChipParents(editor)).toEqual(["P", "P"]);
    expect(vueErrors).toEqual([]);
  });

  it("preserves bold marks on an inserted merge tag", async () => {
    const { editor } = await mountWithContent(
      "<p><strong>Hello world</strong></p>",
    );
    select(editor, 7);
    editor.commands.insertMergeTag({
      label: "First Name",
      value: "{{first_name}}",
    });
    expect(editor.getHTML()).toContain(`<strong>Hello ${CHIP}world</strong>`);
  });
});
