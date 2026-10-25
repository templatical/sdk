// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  type AiProvider,
  type MergeTag,
  type TemplateContent,
} from "@templatical/types";
import Editor from "../src/Editor.vue";
import EditorHeader from "../src/components/EditorHeader.vue";
import { useFonts } from "../src/composables";
import type { UseAiFeatureReturn } from "../src/composables/useAiFeature";
import { loadTranslations } from "../src/i18n";

let wrapper: VueWrapper | undefined;
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});
const content = () => ({
  ...createDefaultTemplateContent(),
  blocks: [createParagraphBlock({ id: "p1", content: "<p>Hi</p>" })],
});
async function open(chat: AiProvider["chat"]) {
  wrapper = mount(Editor, {
    props: {
      config: {
        container: document.createElement("div"),
        content: content(),
        templates: {
          load: async (id: string) => ({ id, content: content() }),
          create: false,
          save: false,
        },
        ai: {
          chat,
          rewrite: false,
          fixFinding: false,
          altText: false,
          chatAttachments: false,
        },
      },
      translations: await loadTranslations("en"),
      fontsManager: useFonts(undefined),
    } as never,
    global: { stubs: { teleport: true } },
  });
  const editor = wrapper.vm as unknown as {
    load(id: string): Promise<unknown>;
    setMergeTags(tags: MergeTag[]): void;
    getContent(): TemplateContent;
  };
  await editor.load("tpl-1");
  const ai = wrapper
    .getComponent(EditorHeader)
    .props("ai") as UseAiFeatureReturn;
  return { editor, ai };
}

it("sends the default liquid syntax when no tags are declared", async () => {
  const chat = vi.fn<Exclude<AiProvider["chat"], false>>(async () => ({
    messageId: null,
    text: "Done",
  }));
  const { ai } = await open(chat);
  await ai.send("Hello");
  expect(chat).toHaveBeenCalledOnce();
  expect(chat.mock.calls[0][0].mergeTags).toEqual({
    syntax: "liquid",
    tags: [],
  });
});

it("normalizes AI edits with tags added through setMergeTags", async () => {
  const { editor, ai } = await open(async (_request, on) => {
    expect(
      await on.onOperations([
        {
          op: "updateBlock",
          blockId: "p1",
          set: { content: "<p>{{new_tag}}</p>" },
        },
      ]),
    ).toMatchObject({ applied: true });
    return { messageId: null, text: "Done" };
  });
  editor.setMergeTags([{ value: "{{new_tag}}", label: "New tag label" }]);
  await ai.send("Add the new tag");
  expect(editor.getContent().blocks[0]).toMatchObject({
    content: '<p><span data-merge-tag="{{new_tag}}">New tag label</span></p>',
  });
});
