// @vitest-environment happy-dom
import "./dom-stubs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import {
  AUTH_MANAGER_KEY,
  CLOUD_TRANSLATIONS_KEY,
  EDITOR_KEY,
  MERGE_TAGS_KEY,
} from "../src/keys";
import cloudEn from "../src/i18n/locales/cloud/en";

const { ai } = vi.hoisted(() => {
  const { ref } = require("vue") as typeof import("vue");
  return {
    ai: {
      messages: ref<
        Array<{ id: string; role: "user" | "assistant"; content: string }>
      >([]),
      isGenerating: ref(false),
      isLoadingHistory: ref(false),
      isLastChangeReverted: ref(false),
      lastApplyMessageId: ref<string | null>(null),
      error: ref<string | null>(null),
      failedPrompt: ref<string | null>(null),
      suggestions: ref<string[]>([]),
      isLoadingSuggestions: ref(false),
      sendPrompt: vi.fn(async () => null),
      toggleLastRevert: vi.fn(),
      loadConversation: vi.fn(async () => {}),
      loadSuggestions: vi.fn(async () => {}),
      clearChat: vi.fn(),
    },
  };
});

vi.mock("@templatical/core/cloud", () => ({
  useAiChat: () => ai,
}));

import AiChatSidebar from "../src/cloud/components/AiChatSidebar.vue";

const editor = {
  state: { template: { id: "tpl-1" } },
  content: ref({ blocks: [] as unknown[], settings: {} }),
};

function mountChat(visible = false) {
  return mount(AiChatSidebar, {
    props: { visible },
    global: {
      provide: {
        [CLOUD_TRANSLATIONS_KEY as symbol]: cloudEn,
        [EDITOR_KEY as symbol]: editor,
        [AUTH_MANAGER_KEY as symbol]: {},
        [MERGE_TAGS_KEY as symbol]: ref([]),
      },
      stubs: {
        Transition: false,
      },
    },
  });
}

afterEach(() => {
  ai.messages.value = [];
  ai.isGenerating.value = false;
  ai.isLoadingHistory.value = false;
  ai.isLastChangeReverted.value = false;
  ai.lastApplyMessageId.value = null;
  ai.error.value = null;
  ai.failedPrompt.value = null;
  ai.suggestions.value = [];
  editor.content.value = { blocks: [], settings: {} };
});

describe("AiChatSidebar", () => {
  it("loads history on first open and asks for suggestions on an empty canvas", async () => {
    const wrapper = mountChat(false);
    expect(ai.loadConversation).not.toHaveBeenCalled();

    await wrapper.setProps({ visible: true });
    await flushPromises();

    expect(ai.loadConversation).toHaveBeenCalledTimes(1);
    expect(ai.loadSuggestions).toHaveBeenCalledTimes(1);

    await wrapper.setProps({ visible: false });
    await wrapper.setProps({ visible: true });
    await flushPromises();
    expect(ai.loadConversation).toHaveBeenCalledTimes(1);
  });

  it("does not load suggestions when the template already has blocks", async () => {
    editor.content.value = {
      blocks: [{ id: "b1", type: "title" }],
      settings: {},
    };
    const wrapper = mountChat(false);
    await wrapper.setProps({ visible: true });
    await flushPromises();
    expect(ai.loadConversation).toHaveBeenCalled();
    expect(ai.loadSuggestions).not.toHaveBeenCalled();
  });

  it("does not load suggestions after unmount mid-history", async () => {
    let resolveLoad!: () => void;
    ai.loadConversation.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveLoad = resolve;
        }),
    );
    const wrapper = mountChat(false);
    await wrapper.setProps({ visible: true });
    wrapper.unmount();
    resolveLoad();
    await flushPromises();
    expect(ai.loadSuggestions).not.toHaveBeenCalled();
  });

  it("sends the trimmed prompt and restores it when the request fails", async () => {
    ai.sendPrompt.mockImplementationOnce(async () => {
      ai.failedPrompt.value = "Make a welcome email";
      return null;
    });
    const wrapper = mountChat(false);
    await wrapper.setProps({ visible: true });
    await flushPromises();

    const textarea = wrapper.get("textarea");
    await textarea.setValue("  Make a welcome email  ");
    await wrapper
      .findAll("button")
      .find((b) => b.classes().includes("tpl-ai-send-btn"))!
      .trigger("click");
    await flushPromises();

    expect(ai.sendPrompt).toHaveBeenCalledWith(
      "Make a welcome email",
      editor.content.value,
      [],
    );
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "Make a welcome email",
    );
  });

  it("sends on Enter and not on Shift+Enter or an empty prompt", async () => {
    const wrapper = mountChat(false);
    await wrapper.setProps({ visible: true });
    await flushPromises();

    const textarea = wrapper.get("textarea");
    await textarea.trigger("keydown", { key: "Enter" });
    expect(ai.sendPrompt).not.toHaveBeenCalled();

    await textarea.setValue("hello");
    await textarea.trigger("keydown", { key: "Enter", shiftKey: true });
    expect(ai.sendPrompt).not.toHaveBeenCalled();

    await textarea.trigger("keydown", { key: "Enter" });
    expect(ai.sendPrompt).toHaveBeenCalledTimes(1);
  });

  it("strips a json fence and shows the applied copy for a json-only reply", async () => {
    ai.messages.value = [
      { id: "u1", role: "user", content: "do it" },
      {
        id: "a1",
        role: "assistant",
        content: '```json\n{"blocks":[]}\n```',
      },
    ];
    ai.lastApplyMessageId.value = "a1";
    const wrapper = mountChat(false);
    await wrapper.setProps({ visible: true });
    await nextTick();

    expect(wrapper.text()).toContain("Changes applied to template.");
    expect(wrapper.text()).not.toContain("```json");

    await wrapper
      .findAll("button")
      .find((b) => b.text().includes("Revert changes"))!
      .trigger("click");
    expect(ai.toggleLastRevert).toHaveBeenCalled();
  });

  it("names apply-failed separately from a generate error", async () => {
    ai.error.value = "ai_apply_failed";
    const wrapper = mountChat(false);
    await wrapper.setProps({ visible: true });
    await nextTick();
    expect(wrapper.text()).toContain(
      "Could not apply changes to template. Please try again.",
    );

    ai.error.value = "boom";
    await nextTick();
    expect(wrapper.text()).toContain("Failed to generate template");
  });

  it("clears the chat and closes", async () => {
    ai.messages.value = [{ id: "u1", role: "user", content: "hi" }];
    const wrapper = mountChat(false);
    await wrapper.setProps({ visible: true });
    await nextTick();

    await wrapper
      .get(`button[aria-label="${cloudEn.aiChat.clear}"]`)
      .trigger("click");
    expect(ai.clearChat).toHaveBeenCalled();

    await wrapper
      .get(`button[aria-label="${cloudEn.aiChat.close}"]`)
      .trigger("click");
    expect(wrapper.emitted("close")).toHaveLength(1);
  });

  it("sends a suggestion as the prompt", async () => {
    ai.suggestions.value = ["Add a hero"];
    const wrapper = mountChat(false);
    await wrapper.setProps({ visible: true });
    await nextTick();

    await wrapper
      .findAll("button")
      .find((b) => b.text() === "Add a hero")!
      .trigger("click");
    await flushPromises();
    expect(ai.sendPrompt).toHaveBeenCalledWith(
      "Add a hero",
      editor.content.value,
      [],
    );
  });
});
