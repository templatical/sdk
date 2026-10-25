// @vitest-environment happy-dom
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  type AiChatRequest,
  type AiTurnHandlers,
  type MergeTag,
  type ParagraphBlock,
  type Template,
  type TemplateContent,
} from "@templatical/types";
import Editor from "../src/Editor.vue";
import { useFonts } from "../src/composables";
import { loadTranslations } from "../src/i18n";

async function mountWithAi(extra: Record<string, unknown> = {}) {
  const content = createDefaultTemplateContent();
  const wrapper = mount(Editor, {
    props: {
      config: {
        container: document.createElement("div"),
        content,
        user: { id: "u-1", name: "Ada" },
        templates: {
          load: async (id: string): Promise<Template> => ({ id, content }),
          create: false,
          save: false,
        },
        ai: {
          chat: vi.fn(async () => ({ messageId: null, text: "Hi." })),
          fixFinding: false,
          chatAttachments: false,
          rewrite: false,
        },
        ...extra,
      },
      translations: await loadTranslations("en"),
      fontsManager: useFonts(undefined),
    } as never,
    global: { stubs: { teleport: true } },
  });
  return wrapper;
}

async function openAiPanel(wrapper: VueWrapper, panel: "chat") {
  await (
    wrapper.vm as unknown as { load: (id: string) => Promise<Template> }
  ).load("tpl-1");
  await vi.waitFor(() =>
    expect(wrapper.find('[data-testid="ai-menu-trigger"]').exists()).toBe(true),
  );
  await wrapper.get('[data-testid="ai-menu-trigger"]').trigger("click");
  await vi.waitFor(() =>
    expect(wrapper.find(`[data-testid="ai-panel-${panel}"]`).exists()).toBe(
      true,
    ),
  );
}

async function sendChat(wrapper: VueWrapper, prompt: string, reply: string) {
  await wrapper.get('[data-testid="ai-chat-input"]').setValue(prompt);
  await wrapper.get('[data-testid="ai-chat-send"]').trigger("click");
  await vi.waitFor(() =>
    expect(wrapper.get('[data-testid="ai-chat-reply"]').text()).toBe(reply),
  );
}

describe("Editor.vue with an AI provider", () => {
  it("shows the AI button once a template is loaded", async () => {
    const wrapper = await mountWithAi();
    await flushPromises();
    expect(wrapper.find('[data-testid="ai-menu-trigger"]').exists()).toBe(
      false,
    );

    await (
      wrapper.vm as unknown as { load: (id: string) => Promise<Template> }
    ).load("tpl-1");
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="ai-menu-trigger"]').exists()).toBe(
        true,
      ),
    );
  });

  it("opens the chat in the right gutter and closes comments (D18)", async () => {
    const wrapper = await mountWithAi({
      comments: {
        list: async () => [],
        create: false,
        update: false,
        delete: false,
        setResolved: false,
      },
    });
    await (
      wrapper.vm as unknown as { load: (id: string) => Promise<Template> }
    ).load("tpl-1");
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="comments-trigger"]').exists()).toBe(
        true,
      ),
    );

    await wrapper.get('[data-testid="comments-trigger"]').trigger("click");
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="ai-menu-trigger"]').exists()).toBe(
        true,
      ),
    );
    await wrapper.get('[data-testid="ai-menu-trigger"]').trigger("click");

    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="ai-panel-chat"]').exists()).toBe(true),
    );
    expect(wrapper.get(".tpl-body").classes()).toContain("tpl:right-[680px]");
    expect(wrapper.find('[data-testid="comments-sidebar"]').exists()).toBe(
      false,
    );
  });

  it("sends the current merge tags and normalizes a chat edit through the editor's history", async () => {
    const content = {
      ...createDefaultTemplateContent(),
      blocks: [createParagraphBlock({ id: "p1", content: "<p>Before</p>" })],
    };
    const chat = vi.fn(
      async (_request: AiChatRequest, handlers: AiTurnHandlers) => {
        const applied = await handlers.onOperations([
          {
            op: "updateBlock",
            blockId: "p1",
            set: { content: "<p>Hi {{first_name}}</p>" },
            expect: { content: "<p>Before</p>" },
          },
        ]);
        expect(applied).toEqual({
          applied: true,
          inverse: [
            {
              op: "updateBlock",
              blockId: "p1",
              set: { content: "<p>Before</p>" },
              expect: {
                content:
                  '<p>Hi <span data-merge-tag="{{first_name}}">First Name</span></p>',
              },
            },
          ],
        });
        return { messageId: null, text: "Personalized." };
      },
    );
    const wrapper = await mountWithAi({
      templates: {
        load: async (id: string): Promise<Template> => ({ id, content }),
        create: false,
        save: false,
      },
      mergeTags: {
        tags: [{ value: "{{first_name}}", label: "First Name", sample: "Ada" }],
      },
      ai: { chat },
    });
    onTestFinished(() => wrapper.unmount());
    await openAiPanel(wrapper, "chat");
    const api = wrapper.vm as unknown as {
      getContent: () => TemplateContent;
      setMergeTags: (tags: MergeTag[]) => void;
    };
    api.setMergeTags([
      {
        value: "{{first_name}}",
        label: "First Name",
        sample: "Private sample",
        group: "Contact",
        description: "Recipient name",
      },
    ]);

    await sendChat(wrapper, "Personalize the greeting", "Personalized.");

    expect(chat.mock.calls[0][0]).toMatchObject({
      templateId: "tpl-1",
      message: "Personalize the greeting",
      selectedBlockId: null,
      revision: null,
      content,
      mergeTags: {
        syntax: "liquid",
        tags: [
          {
            value: "{{first_name}}",
            label: "First Name",
            group: "Contact",
            description: "Recipient name",
          },
        ],
      },
    });
    expect(chat.mock.calls[0][0].mergeTags).toEqual({
      syntax: "liquid",
      tags: [
        {
          value: "{{first_name}}",
          label: "First Name",
          group: "Contact",
          description: "Recipient name",
        },
      ],
    });
    expect((api.getContent().blocks[0] as ParagraphBlock).content).toBe(
      '<p>Hi <span data-merge-tag="{{first_name}}">First Name</span></p>',
    );
    expect(wrapper.get('[data-testid="ai-chat-applied"]').text()).toContain(
      "Applied 1 change",
    );
    await wrapper.get('[data-testid="ai-chat-undo"]').trigger("click");
    await vi.waitFor(() => expect(api.getContent()).toEqual(content));
  });

  it("reloads a server-applied turn through the templates provider", async () => {
    const original = {
      ...createDefaultTemplateContent(),
      blocks: [createParagraphBlock({ id: "p1", content: "<p>Before</p>" })],
    };
    const updated = {
      ...original,
      blocks: [
        createParagraphBlock({ id: "p1", content: "<p>Saved by AI</p>" }),
      ],
    };
    let stored = original;
    const load = vi.fn(async (id: string): Promise<Template> => ({
      id,
      content: stored,
    }));
    const chat = vi.fn(
      async (_request: AiChatRequest, handlers: AiTurnHandlers) => {
        stored = updated;
        handlers.onApplied({
          batchId: "batch-1",
          revision: 1,
          operationCount: 1,
        });
        return { messageId: null, text: "Saved." };
      },
    );
    const wrapper = await mountWithAi({
      templates: { load, create: false, save: false },
      ai: { chat },
    });
    onTestFinished(() => wrapper.unmount());
    await openAiPanel(wrapper, "chat");

    await sendChat(wrapper, "Update the saved template", "Saved.");

    const api = wrapper.vm as unknown as {
      getContent: () => TemplateContent;
      isDirty: () => boolean;
    };
    await vi.waitFor(() => expect(api.getContent()).toEqual(updated));
    expect(api.isDirty()).toBe(false);
    expect(load.mock.calls).toEqual([["tpl-1"], ["tpl-1"]]);
    expect(chat.mock.calls[0][0].mergeTags).toEqual({ syntax: "liquid", tags: [] });
    expect(wrapper.get('[data-testid="ai-chat-applied"]').text()).toContain(
      "Applied 1 change",
    );
  });

  it("keeps AI unavailable when no templates provider can open a template", async () => {
    const chat = vi.fn(async () => ({ messageId: null, text: "Hi." }));
    const wrapper = await mountWithAi({ templates: undefined, ai: { chat } });
    onTestFinished(() => wrapper.unmount());
    await flushPromises();

    await expect(
      (
        wrapper.vm as unknown as { load: (id: string) => Promise<Template> }
      ).load("tpl-1"),
    ).rejects.toMatchObject({
      name: "SdkError",
      message:
        "[Templatical] Templates: load() needs a templates provider. Pass one as `init({ templates })` to enable saving and loading.",
    });
    expect(wrapper.find('[data-testid="ai-menu-trigger"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="ai-panel-chat"]').exists()).toBe(false);
    expect(
      (
        wrapper.vm as unknown as { getContent: () => TemplateContent }
      ).getContent(),
    ).toEqual(createDefaultTemplateContent());
  });
});
