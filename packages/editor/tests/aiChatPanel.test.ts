// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { effectScope, nextTick } from "vue";
import { flushPromises } from "@vue/test-utils";
import { useEditor, useHistory } from "@templatical/core";
import type {
  AiProvider,
  AiTurnHandlers,
  Template,
  TemplateContent,
} from "@templatical/types";
import { safeClone, SdkError } from "@templatical/types";
import AiChatPanel from "../src/components/ai/AiChatPanel.vue";
import { useAiFeature } from "../src/composables/useAiFeature";
import { loadTranslations } from "../src/i18n";
import { TRANSLATIONS_KEY, UI_LOCALE_KEY } from "../src/keys";
import { mountEditor } from "./helpers/mount";

const CONTENT = {
  blocks: [{ id: "t1", type: "title", content: "<p>Hi</p>" }],
  settings: { width: 600 },
} as unknown as TemplateContent;
const off = {
  chat: false,
  fixFinding: false,
  design: false,
  rewrite: false,
} as const;

async function setup(
  provider: Partial<AiProvider>,
  content: TemplateContent = CONTENT,
  locale = "en",
) {
  const scope = effectScope();
  const { editor, feature } = scope.run(() => {
    const editor = useEditor({
      content: safeClone(content),
      templates: {
        load: async (id: string): Promise<Template> => ({
          id,
          content: safeClone(content),
        }),
        create: false,
        save: false,
      },
    });
    const history = useHistory({
      content: editor.content,
      setContent: editor.setContent,
    });
    const feature = useAiFeature({
      provider: { ...off, ...provider } as AiProvider,
      editor,
      collaboration: null,
      history: () => history,
      reload: null,
      mergeTags: () => null,
      normalize: (ops) => [...ops],

      commentsOpen: null,
      onError: () => {},
    });
    return { editor, feature };
  })!;
  await editor.load("tpl-1");
  feature.open("chat");
  const wrapper = mountEditor(AiChatPanel, {
    props: { feature },
    provides: {
      [TRANSLATIONS_KEY]: await loadTranslations(locale),
      [UI_LOCALE_KEY]: locale,
    },
  });
  await flushPromises();
  return { wrapper, feature, editor };
}

describe("AiChatPanel", () => {
  it("says it is an AI assistant (Art. 50)", async () => {
    const { wrapper } = await setup({
      chat: vi.fn(async () => ({ messageId: null, text: "" })),
    });
    expect(wrapper.get('[data-testid="ai-panel-title"]').text()).toBe(
      "AI assistant",
    );
    expect(wrapper.get('[data-testid="ai-panel-subtitle"]').text()).toBe(
      "Replies and changes come from AI.",
    );
  });

  it.each([
    {
      name: "empty EN",
      locale: "en",
      content: { ...CONTENT, blocks: [] },
      starters: [
        "Draft a welcome email for new customers",
        "Create a product launch announcement",
        "Build a monthly newsletter layout",
      ],
    },
    {
      name: "filled EN",
      locale: "en",
      content: CONTENT,
      starters: [
        "Shorten the copy",
        "Make the tone friendlier",
        "Update the dates and the offer",
        "Add a clear call to action",
      ],
    },
    {
      name: "empty DE",
      locale: "de",
      content: { ...CONTENT, blocks: [] },
      starters: [
        "Willkommens-E-Mail für neue Kunden entwerfen",
        "Ankündigung für einen Produktstart erstellen",
        "Layout für einen monatlichen Newsletter aufbauen",
      ],
    },
    {
      name: "filled DE",
      locale: "de",
      content: CONTENT,
      starters: [
        "Den Text kürzen",
        "Den Ton freundlicher machen",
        "Daten und Angebot aktualisieren",
        "Einen klaren Call-to-Action ergänzen",
      ],
    },
  ])(
    "shows static starters for an $name template and sends the clicked text",
    async ({ content, locale, starters }) => {
      const chat = vi.fn(async () => ({ messageId: null, text: "Sure." }));
      const { wrapper } = await setup({ chat }, content, locale);
      const buttons = wrapper.findAll('[data-testid="ai-chat-starter"]');
      expect(buttons.map((button) => button.text())).toEqual(starters);
      expect(chat).not.toHaveBeenCalled();

      await buttons[0].trigger("click");
      await flushPromises();
      expect(chat).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ message: starters[0] }),
        expect.anything(),
        expect.anything(),
      );
    },
  );

  it("shows Applied N changes with Undo, then Undone with Redo", async () => {
    const { wrapper, editor } = await setup({
      chat: vi.fn(async (_request, on: AiTurnHandlers) => {
        await on.onOperations([
          {
            op: "updateBlock",
            blockId: "t1",
            set: { content: "<p>Hello</p>" },
          },
        ]);
        return { messageId: null, text: "Renamed the title." };
      }),
    });

    await wrapper
      .get('[data-testid="ai-chat-input"]')
      .setValue("Rename the title");
    await wrapper.get('[data-testid="ai-chat-send"]').trigger("click");
    await flushPromises();

    expect(wrapper.get('[data-testid="ai-chat-reply"]').text()).toBe(
      "Renamed the title.",
    );
    expect(wrapper.get('[data-testid="ai-chat-applied"]').text()).toContain(
      "Applied 1 change",
    );

    await wrapper.get('[data-testid="ai-chat-undo"]').trigger("click");
    await flushPromises();

    expect(editor.content.value.blocks[0]).toMatchObject({
      content: "<p>Hi</p>",
    });
    expect(wrapper.get('[data-testid="ai-chat-applied"]').text()).toContain(
      "Undone",
    );
    expect(wrapper.get('[data-testid="ai-chat-undo"]').text()).toBe("Redo");
  });

  it("turns Send into Stop while a turn runs", async () => {
    let finish!: () => void;
    const { wrapper } = await setup({
      chat: vi.fn(
        (_request, _on, signal: AbortSignal) =>
          new Promise((resolve, reject) => {
            finish = () => resolve({ messageId: null, text: "" });
            signal.addEventListener("abort", () =>
              reject(new DOMException("stopped", "AbortError")),
            );
          }),
      ),
    });

    await wrapper.get('[data-testid="ai-chat-input"]').setValue("Hi");
    await wrapper.get('[data-testid="ai-chat-send"]').trigger("click");
    await nextTick();
    expect(wrapper.find('[data-testid="ai-chat-stop"]').exists()).toBe(true);

    await wrapper.get('[data-testid="ai-chat-stop"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-testid="ai-chat-send"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="ai-chat-error"]').exists()).toBe(false);
    finish();
  });

  it("shows a failed turn's message and puts the prompt back", async () => {
    const { wrapper } = await setup({
      chat: vi.fn(async () => {
        throw new SdkError("x", 409, "ai_turn_running");
      }),
    });

    await wrapper.get('[data-testid="ai-chat-input"]').setValue("Hello");
    await wrapper.get('[data-testid="ai-chat-send"]').trigger("click");
    await flushPromises();

    expect(wrapper.get('[data-testid="ai-chat-error"]').text()).toBe(
      "An AI request is already running on this template.",
    );
    expect(
      (
        wrapper.get('[data-testid="ai-chat-input"]')
          .element as HTMLTextAreaElement
      ).value,
    ).toBe("Hello");
  });

  it("keeps a failed turn's alert above the composer outside the starters' containing block", async () => {
    const { wrapper, feature } = await setup({
      chat: vi.fn(async () => {
        throw new SdkError("x", 409, "ai_turn_running");
      }),
    });

    await wrapper.get('[data-testid="ai-chat-input"]').setValue("Hello");
    await wrapper.get('[data-testid="ai-chat-send"]').trigger("click");
    await flushPromises();

    expect(feature.messages.value).toEqual([]);
    const alert = wrapper.get('[data-testid="ai-chat-error"]');
    expect(alert.text()).toBe(
      "An AI request is already running on this template.",
    );
    const starter = wrapper.get('[data-testid="ai-chat-starter"]');
    expect(starter.text()).toBe("Shorten the copy");
    const startersContainingBlock = starter.element.closest(
      '[class~="tpl:relative"]',
    );
    expect(startersContainingBlock).not.toBeNull();
    expect(startersContainingBlock!.contains(alert.element)).toBe(false);
    const composer = wrapper.get(".tpl-ai-input-wrapper").element;
    expect(alert.element.parentElement).toBe(composer.parentElement);
    expect(alert.element.nextElementSibling).toBe(composer);
  });

  it.each([
    { name: "IME composition", options: { isComposing: true } },
    { name: "legacy IME keyCode 229", options: { keyCode: 229 } },
  ])("does not submit Enter during $name", async ({ options }) => {
    const chat = vi.fn(async () => ({ messageId: null, text: "Hi." }));
    const { wrapper, feature } = await setup({ chat });
    const input = wrapper.get('[data-testid="ai-chat-input"]');
    await input.setValue("Hello");
    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
      ...options,
    });

    input.element.dispatchEvent(event);
    await flushPromises();

    expect(chat).not.toHaveBeenCalled();
    expect(feature.messages.value).toEqual([]);
    expect((input.element as HTMLTextAreaElement).value).toBe("Hello");
    expect(event.defaultPrevented).toBe(false);
  });

  it("submits a normal Enter", async () => {
    const chat = vi.fn(async () => ({ messageId: null, text: "Hi." }));
    const { wrapper } = await setup({ chat });
    const input = wrapper.get('[data-testid="ai-chat-input"]');
    await input.setValue("Hello");
    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });

    input.element.dispatchEvent(event);
    await flushPromises();

    expect(chat).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Hello" }),
      expect.anything(),
      expect.anything(),
    );
    expect((input.element as HTMLTextAreaElement).value).toBe("");
    expect(wrapper.get('[data-testid="ai-chat-reply"]').text()).toBe("Hi.");
    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves Shift+Enter available for a newline", async () => {
    const chat = vi.fn(async () => ({ messageId: null, text: "Hi." }));
    const { wrapper, feature } = await setup({ chat });
    const input = wrapper.get('[data-testid="ai-chat-input"]');
    await input.setValue("Hello");
    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });

    input.element.dispatchEvent(event);
    await flushPromises();

    expect(chat).not.toHaveBeenCalled();
    expect(feature.messages.value).toEqual([]);
    expect((input.element as HTMLTextAreaElement).value).toBe("Hello");
    expect(event.defaultPrevented).toBe(false);
  });

  it("starts a new chat without asking", async () => {
    const { wrapper, feature } = await setup({
      chat: vi.fn(async () => ({ messageId: null, text: "Hi." })),
    });
    await wrapper.get('[data-testid="ai-chat-input"]').setValue("Hello");
    await wrapper.get('[data-testid="ai-chat-send"]').trigger("click");
    await flushPromises();

    await wrapper.get('[data-testid="ai-chat-new"]').trigger("click");
    await flushPromises();

    expect(feature.messages.value).toEqual([]);
  });
});
