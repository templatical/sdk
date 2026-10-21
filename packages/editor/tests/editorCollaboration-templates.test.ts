// @vitest-environment happy-dom
//
// Editor.vue with a collaboration provider, where it meets the templates
// provider: a save settles the batches and answers with the canvas, and a
// re-sync reloads through the provider with merge-tag tokens turned into tags.

import { afterEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createTitleBlock,
  safeClone,
  type CollaborationProvider,
  type Template,
  type TemplateContent,
  type TemplatePatch,
} from "@templatical/types";
import Editor from "../src/Editor.vue";
import { useFonts } from "../src/composables";
import { loadTranslations } from "../src/i18n";

// Each test's editor holds a live controller and window listeners.
enableAutoUnmount(afterEach);

const MERGE_TAGS = {
  tags: [{ label: "First name", value: "{{first_name}}" }],
};

interface ExposedEditor {
  load: (id: string) => Promise<Template>;
  save: () => Promise<Template>;
  setContent: (content: TemplateContent) => void;
  getContent: () => TemplateContent;
}

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await flushPromises();
}

async function mountEditor() {
  const title = createTitleBlock({ content: "<p>Hello</p>" });
  const paragraph = createParagraphBlock({ content: "<p>Body</p>" });
  let stored: Template = {
    id: "tpl-1",
    name: "Welcome",
    revision: 0,
    content: {
      ...createDefaultTemplateContent(),
      blocks: [title, paragraph],
    },
  };
  const templates = {
    load: vi.fn(async (id: string): Promise<Template> => ({
      ...safeClone(stored),
      id,
    })),
    create: false as const,
    save: vi.fn(
      async (id: string, patch: TemplatePatch): Promise<Template> => ({
        ...safeClone(stored),
        id,
        ...patch,
      }),
    ),
  };
  const provider: CollaborationProvider = {
    join: vi.fn(async (_templateId, session) => ({
      revision: 0,
      locks: [],
      members: [
        {
          sessionId: session.sessionId,
          userId: "u-1",
          name: "Ada",
          type: "user" as const,
          color: "#3b82f6",
        },
      ],
      leave: () => {},
    })),
    submit: vi.fn(async () => ({ revision: 1 })),
    operationsAfter: vi.fn(async () => ({ revision: 0, batches: [] })),
  };
  const wrapper = mount(Editor, {
    props: {
      config: {
        container: document.createElement("div"),
        content: stored.content,
        user: { id: "u-1", name: "Ada" },
        mergeTags: MERGE_TAGS,
        templates,
        collaboration: provider,
      },
      translations: await loadTranslations("en"),
      fontsManager: useFonts(undefined),
    } as never,
    global: { stubs: { teleport: true } },
  });
  const vm = wrapper.vm as unknown as ExposedEditor;
  await vm.load("tpl-1");
  await flush();
  return {
    wrapper,
    vm,
    provider,
    templates,
    title,
    paragraph,
    store: (next: Template) => {
      stored = next;
    },
  };
}

describe("Editor.vue with collaboration and a templates provider", () => {
  it("saves by waiting for the batches and answering with the canvas, sending no content", async () => {
    const { vm, provider, templates, title, paragraph } = await mountEditor();
    let confirm!: (answer: { revision: number }) => void;
    vi.mocked(provider.submit).mockImplementationOnce(
      () => new Promise((resolve) => (confirm = resolve)),
    );
    const loaded = safeClone(vm.getContent());

    vm.setContent({ ...loaded, blocks: [loaded.blocks[0]] });
    let answered = false;
    const saving = vm.save().finally(() => (answered = true));
    await flush();
    expect(answered).toBe(false);
    confirm({ revision: 1 });
    const saved = await saving;

    expect(vi.mocked(provider.submit).mock.calls[0][1].ops).toEqual([
      { op: "deleteBlock", blockId: paragraph.id },
    ]);
    expect(templates.save).not.toHaveBeenCalled();
    expect(saved.id).toBe("tpl-1");
    expect(saved.name).toBe("Welcome");
    expect(saved.content.blocks.map((block) => block.id)).toEqual([title.id]);
    expect(saved.content).toEqual(vm.getContent());
  });

  it("reloads through the templates provider when the backend says to re-sync, with tokens as tags", async () => {
    const { wrapper, provider, templates, title, paragraph, store } =
      await mountEditor();
    const handlers = vi.mocked(provider.join).mock.calls[0][2];
    store({
      id: "tpl-1",
      name: "Welcome",
      revision: 3,
      content: {
        ...createDefaultTemplateContent(),
        blocks: [{ ...title, content: "<p>Bye {{first_name}}</p>" }, paragraph],
      },
    });
    vi.mocked(provider.operationsAfter).mockResolvedValueOnce({
      revision: 3,
      resync: true,
    });

    handlers.onResync(3);
    await flush();

    expect(templates.load).toHaveBeenCalledTimes(2);
    expect(templates.load).toHaveBeenLastCalledWith("tpl-1");
    const tag = wrapper
      .get(`[data-block-id="${title.id}"]`)
      .get('[data-merge-tag="{{first_name}}"]');
    expect(tag.text()).toBe("First name");
    expect(provider.submit).not.toHaveBeenCalled();
  });
});
