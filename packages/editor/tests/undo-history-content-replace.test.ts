// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  type CollaborationProvider,
  type Template,
  type TemplateContent,
  type TemplatesProvider,
} from "@templatical/types";
import { init, type TemplaticalEditor } from "../src/index";
import Editor from "../src/Editor.vue";
import Canvas from "../src/components/Canvas.vue";
import { useFonts } from "../src/composables";
import { loadTranslations } from "../src/i18n";
import { EDITOR_KEY, HISTORY_KEY } from "../src/keys";
import type { UseEditorReturn, UseHistoryReturn } from "@templatical/core";

function content(text: string): TemplateContent {
  const result = createDefaultTemplateContent();
  result.blocks = [
    createParagraphBlock({ id: "paragraph", content: `<p>${text}</p>` }),
  ];
  return result;
}

function firstText(value: TemplateContent): string {
  return (value.blocks[0] as ReturnType<typeof createParagraphBlock>).content;
}

function template(id: string, text: string): Template {
  return { id, name: id, content: content(text) };
}

const handles: TemplaticalEditor[] = [];
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  for (const handle of handles.splice(0)) handle.unmount();
  document.body.innerHTML = "";
  delete (
    Element.prototype as Element & {
      scrollIntoView?: typeof Element.prototype.scrollIntoView;
    }
  ).scrollIntoView;
});

async function open(config: {
  content?: TemplateContent;
  templates?: TemplatesProvider;
}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const handle = await init({
    container,
    shadowDom: false,
    content: config.content,
    templates: config.templates,
  });
  handles.push(handle);
  return handle;
}

function undo(): void {
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "z",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    }),
  );
}

describe("public editor history after content replacement", () => {
  it("setContent starts a new undo history instead of restoring an old design", async () => {
    const handle = await open({ content: content("A1") });
    handle.insertBlock(createParagraphBlock({ content: "<p>A2</p>" }));
    expect(handle.getContent().blocks).toHaveLength(2);

    handle.setContent(content("B1"));
    expect(firstText(handle.getContent())).toBe("<p>B1</p>");
    undo();
    expect(handle.getContent().blocks).toHaveLength(1);
    expect(firstText(handle.getContent())).toBe("<p>B1</p>");
  });

  it("load starts a new undo history and save writes the newly loaded template", async () => {
    const storage: TemplatesProvider = {
      load: vi.fn(async (id) => template(id, id === "x" ? "X1" : "Y1")),
      create: false,
      save: vi.fn(async (id, patch) => ({
        id,
        name: patch.name ?? id,
        content: patch.content!,
      })),
    };
    const handle = await open({
      content: content("draft"),
      templates: storage,
    });
    await handle.load("x");
    handle.insertBlock(createParagraphBlock({ content: "<p>X2</p>" }));
    expect(handle.getContent().blocks).toHaveLength(2);

    await handle.load("y");
    undo();
    expect(handle.getContent().blocks).toHaveLength(1);
    expect(firstText(handle.getContent())).toBe("<p>Y1</p>");
    await handle.save();
    expect(storage.save).toHaveBeenCalledWith("y", {
      name: "y",
      content: handle.getContent(),
    });
  });

  it("load and create with content reset collaboration history without rejoining the old template", async () => {
    let revision = 0;
    const storage: TemplatesProvider = {
      load: vi.fn(async () => ({ ...template("x", "X1"), revision })),
      create: vi.fn(async (input) => ({
        id: "y",
        name: "y",
        content: input.content,
      })),
      save: false,
    };
    const collaboration: CollaborationProvider = {
      join: vi.fn(async () => ({
        revision: 0,
        locks: [],
        members: [],
        leave: () => {},
      })),
      submit: vi.fn(async () => ({ revision: ++revision })),
      operationsAfter: vi.fn(async () => ({ revision: 0, batches: [] })),
    };
    const wrapper = mount(Editor, {
      props: {
        config: {
          container: document.createElement("div"),
          content: content("draft"),
          templates: storage,
          collaboration,
        },
        translations: await loadTranslations("en"),
        fontsManager: useFonts(undefined),
      } as never,
      global: { stubs: { teleport: true } },
    });
    try {
      const canvas = wrapper.findComponent(Canvas);
      const provided = (canvas.vm as any).$.provides;
      const editor = provided[EDITOR_KEY as symbol] as UseEditorReturn;
      const history = provided[HISTORY_KEY as symbol] as UseHistoryReturn;
      await wrapper.vm.load("x");
      for (let i = 0; i < 20; i++) await Promise.resolve();
      editor.addBlock(
        createParagraphBlock({ id: "new-paragraph", content: "<p>X2</p>" }),
      );
      for (let i = 0; i < 20; i++) await Promise.resolve();
      expect(editor.content.value.blocks).toHaveLength(2);
      expect(history.canUndo.value).toBe(true);

      await wrapper.vm.load("x");
      expect(firstText(editor.content.value)).toBe("<p>X1</p>");
      expect(history.canUndo.value).toBe(false);
      expect(history.canRedo.value).toBe(false);
      history.undo();
      expect(firstText(editor.content.value)).toBe("<p>X1</p>");

      wrapper.vm.setContent(content("B1"));
      for (let i = 0; i < 20; i++) await Promise.resolve();
      expect(firstText(editor.content.value)).toBe("<p>B1</p>");
      expect(history.canUndo.value).toBe(false);
      expect(history.canRedo.value).toBe(false);

      editor.addBlock(
        createParagraphBlock({ id: "another-paragraph", content: "<p>B2</p>" }),
      );
      for (let i = 0; i < 20; i++) await Promise.resolve();
      expect(history.canUndo.value).toBe(true);
      await wrapper.vm.create({ content: content("Y1") });
      for (let i = 0; i < 20; i++) await Promise.resolve();
      expect(firstText(editor.content.value)).toBe("<p>Y1</p>");
      expect(history.canUndo.value).toBe(false);
      expect(history.canRedo.value).toBe(false);
      expect(
        vi.mocked(collaboration.join).mock.calls.map(([id]) => id),
      ).toEqual(["x", "y"]);
    } finally {
      wrapper.unmount();
    }
  });
});
