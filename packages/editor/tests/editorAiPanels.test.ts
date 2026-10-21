// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import {
  createDefaultTemplateContent,
  type Template,
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
          design: false,
          rewrite: false,
          score: false,
          suggestions: false,
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

describe("Editor.vue with an AI provider", () => {
  it("shows the AI menu once a template is loaded", async () => {
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
    await wrapper.get('[data-testid="ai-menu-item-chat"]').trigger("click");

    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="ai-panel-chat"]').exists()).toBe(true),
    );
    expect(wrapper.get(".tpl-body").classes()).toContain("tpl:right-[680px]");
    expect(wrapper.find('[data-testid="comments-sidebar"]').exists()).toBe(
      false,
    );
  });
});
