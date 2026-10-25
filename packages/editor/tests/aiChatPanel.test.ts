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
  chatAttachments: false,
  rewrite: false,
} as const;

async function setup(
  provider: Partial<AiProvider>,
  content: TemplateContent = CONTENT,
  locale = "en",
  load?: (id: string) => Promise<Template>,
) {
  const scope = effectScope();
  const { editor, feature } = scope.run(() => {
    const editor = useEditor({
      content: safeClone(content),
      templates: {
        load: load ?? (async (id: string): Promise<Template> => ({
          id,
          content: safeClone(content),
        })),
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
      reload: (id, guard) => editor.load(id, guard),
      mergeTags: () => ({ syntax: "liquid", tags: [] }),
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
  it("shows the history error string when conversation loading rejects", async () => {
    const { wrapper, feature } = await setup({
      conversation: {
        list: async () => {
          throw new Error("Private storage failure");
        },
        clear: false,
        undo: false,
        redo: false,
        settleReplay: async () => {},
      },
    });
    expect(feature.failure.value?.context).toBe("history");
    expect(wrapper.get('[data-testid="ai-chat-error"]').text()).toBe(
      "Couldn't load the conversation. Try again.",
    );
    expect(wrapper.text()).not.toContain("Private storage failure");
  });

  it("shows a partially applied turn's localized failure on that message", async () => {
    const { wrapper, editor, feature } = await setup({
      chat: async (_request, on) => {
        await on.onOperations([
          {
            op: "updateBlock",
            blockId: "t1",
            set: { content: "<p>Hello</p>" },
          },
        ]);
        throw new SdkError("Private provider detail", 409, "ai_turn_running");
      },
    });
    await wrapper
      .get('[data-testid="ai-chat-input"]')
      .setValue("Change the title");
    await wrapper.get('[data-testid="ai-chat-send"]').trigger("click");
    await flushPromises();
    expect(editor.content.value.blocks[0]).toMatchObject({
      content: "<p>Hello</p>",
    });
    expect(feature.messages.value.at(-1)).toMatchObject({
      role: "assistant",
      operationCount: 1,
      failure: { context: "turn" },
    });
    expect(wrapper.get('[data-testid="ai-chat-item-error"]').text()).toBe(
      "An AI request is already running on this template.",
    );
    expect(wrapper.get('[data-testid="ai-chat-applied"]').text()).toContain(
      "Applied 1 change",
    );
    expect(wrapper.get('[data-testid="ai-chat-undo"]').text()).toBe("Undo");
    expect(wrapper.find('[data-testid="ai-chat-error"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Private provider detail");
  });

  it.each([
    { chatAttachments: true, busy: false },
    { chatAttachments: false, busy: false },
    { chatAttachments: true, busy: true },
    { chatAttachments: false, busy: true },
  ])(
    "puts the full-width textarea above the toolbar (attachments: $chatAttachments, busy: $busy)",
    async ({ chatAttachments, busy }) => {
      const { wrapper, feature } = await setup({
        chat: vi.fn(async () => ({ messageId: null, text: "" })),
        chatAttachments,
      });
      feature.busy.value = busy;
      await nextTick();
      const box = wrapper.get(".tpl-ai-input-wrapper");
      const input = wrapper.get('[data-testid="ai-chat-input"]');
      const action = wrapper.get(
        `[data-testid="${busy ? "ai-chat-stop" : "ai-chat-send"}"]`,
      );
      const toolbar = action.element.parentElement!;
      expect(Array.from(box.element.children)).toEqual([
        input.element,
        toolbar,
      ]);
      expect(box.classes()).toContain("tpl:flex-col");
      expect(input.classes()).toContain("tpl:w-full");
      expect(input.classes()).toContain("tpl:min-h-[44px]");
      expect(Array.from(toolbar.classList)).toEqual(
        expect.arrayContaining([
          "tpl:flex",
          "tpl:items-center",
          "tpl:justify-between",
        ]),
      );
      const buttons = chatAttachments
        ? [wrapper.get('[aria-label="Attach files"]').element, action.element]
        : [action.element];
      expect(Array.from(toolbar.children)).toEqual(buttons);
      expect(action.classes()).toContain("tpl:ml-auto");
      expect(action.classes()).toContain("tpl:-mr-1.5");
      if (chatAttachments) {
        expect(wrapper.get('[aria-label="Attach files"]').classes()).toContain(
          "tpl:-ml-1.5",
        );
      }
    },
  );

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

const attachment = (name = "shot.png", size = 1, type = "image/png") =>
  new File([new Uint8Array(size)], name, { type });
async function pick(
  wrapper: Awaited<ReturnType<typeof setup>>["wrapper"],
  files: File[],
) {
  const input = wrapper.get('[data-testid="ai-chat-files"]');
  Object.defineProperty(input.element, "files", {
    configurable: true,
    value: files,
  });
  await input.trigger("change");
}
describe("chat attachment controls", () => {
  it("opens its picker, shows removable chips and clears them when sending", async () => {
    const chat = vi.fn(async () => ({ messageId: null, text: "OK" }));
    const { wrapper } = await setup({ chat, chatAttachments: true });
    const input = wrapper.get('[data-testid="ai-chat-files"]');
    const click = vi.spyOn(input.element as HTMLInputElement, "click");
    await wrapper.get('[aria-label="Attach files"]').trigger("click");
    expect(click).toHaveBeenCalledOnce();
    expect(input.attributes("accept")).toBe(
      "image/png,image/jpeg,image/webp,image/gif,application/pdf",
    );
    expect(input.attributes()).toHaveProperty("multiple");
    await pick(wrapper, [
      attachment(),
      attachment("plan.pdf", 1, "application/pdf"),
    ]);
    expect(
      wrapper
        .findAll('[data-testid="ai-chat-attachment"]')
        .map((c) => c.text()),
    ).toEqual(["shot.png", "plan.pdf"]);
    expect(wrapper.text()).toContain(
      "Pictures come in as placeholders. Replace them after the import.",
    );
    await wrapper.get('[aria-label="Remove shot.png"]').trigger("click");
    await wrapper.get('[data-testid="ai-chat-input"]').setValue("Use the PDF");
    await wrapper.get('[data-testid="ai-chat-send"]').trigger("click");
    await flushPromises();
    expect(chat).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          expect.objectContaining({ name: "plan.pdf", kind: "pdf" }),
        ],
      }),
      expect.anything(),
      expect.anything(),
    );
    expect(wrapper.findAll('[data-testid="ai-chat-attachment"]')).toHaveLength(
      0,
    );
    expect(
      wrapper.get('[data-testid="ai-chat-history-attachment"]').text(),
    ).toBe("plan.pdf");
  });
  it("uses a counter for file drags, ignores text drags and attaches drops", async () => {
    const { wrapper } = await setup({
      chat: vi.fn(async () => ({ messageId: null, text: "" })),
      chatAttachments: true,
    });
    const panel = wrapper.get('[data-testid="ai-chat-dropzone"]');
    await panel.trigger("dragenter", {
      dataTransfer: { types: ["text/plain"] },
    });
    expect(wrapper.find('[data-testid="ai-chat-drop-hint"]').exists()).toBe(
      false,
    );
    const dataTransfer = { types: ["Files"], files: [attachment()] };
    await panel.trigger("dragenter", { dataTransfer });
    await panel.trigger("dragenter", { dataTransfer });
    await panel.trigger("dragleave", { dataTransfer });
    expect(wrapper.get('[data-testid="ai-chat-drop-hint"]').text()).toBe(
      "Drop images or PDFs to attach them",
    );
    await panel.trigger("drop", { dataTransfer });
    expect(wrapper.find('[data-testid="ai-chat-drop-hint"]').exists()).toBe(
      false,
    );
    expect(wrapper.get('[data-testid="ai-chat-attachment"]').text()).toBe(
      "shot.png",
    );
  });
  it.each([
    [
      [attachment("bad.txt", 1, "text/plain")],
      "bad.txt isn't an image or a PDF.",
    ],
    [
      [attachment("large.png", 5 * 1024 * 1024 + 1)],
      "large.png is larger than 5 MB.",
    ],
    [
      Array.from({ length: 5 }, (_, i) => attachment(`${i}.png`)),
      "Attach at most 4 files.",
    ],
    [
      [
        attachment("a", 5 * 1024 * 1024),
        attachment("b", 5 * 1024 * 1024),
        attachment("c"),
      ],
      "Attachments can be at most 10 MB together.",
    ],
  ])(
    "announces validation errors %# and clears them on the next attach",
    async (files, message) => {
      const { wrapper } = await setup({
        chat: vi.fn(async () => ({ messageId: null, text: "" })),
        chatAttachments: true,
      });
      await pick(wrapper, files as File[]);
      expect(wrapper.get('[aria-live="polite"]').text()).toContain(message);
      await pick(wrapper, []);
      expect(wrapper.get('[aria-live="polite"]').text()).toBe("");
    },
  );
  it("hides all attachment controls when support is false", async () => {
    const { wrapper } = await setup({
      chat: vi.fn(async () => ({ messageId: null, text: "" })),
      chatAttachments: false,
    });
    expect(wrapper.find('[aria-label="Attach files"]').exists()).toBe(false);
    expect(wrapper.find('input[type="file"]').exists()).toBe(false);
  });
  it("disables attachment controls and ignores drops while busy", async () => {
    const { wrapper, feature } = await setup({
      chat: vi.fn(async () => ({ messageId: null, text: "" })),
      chatAttachments: true,
    });
    await pick(wrapper, [attachment()]);
    feature.busy.value = true;
    await nextTick();
    expect(
      wrapper.get('[aria-label="Attach files"]').attributes(),
    ).toHaveProperty("disabled");
    expect(
      wrapper.get('[aria-label="Remove shot.png"]').attributes(),
    ).toHaveProperty("disabled");
    expect(wrapper.get('input[type="file"]').attributes()).toHaveProperty(
      "disabled",
    );
    await wrapper.get('[data-testid="ai-chat-dropzone"]').trigger("drop", {
      dataTransfer: { types: ["Files"], files: [attachment("other.png")] },
    });
    expect(wrapper.findAll('[data-testid="ai-chat-attachment"]')).toHaveLength(
      1,
    );
  });
  it("restores files together with the failed prompt", async () => {
    const { wrapper } = await setup({
      chat: async () => {
        throw new SdkError("offline", 502, "ai_provider_error");
      },
      chatAttachments: true,
    });
    await pick(wrapper, [attachment()]);
    await wrapper.get('[data-testid="ai-chat-input"]').setValue("Use this");
    await wrapper.get('[data-testid="ai-chat-send"]').trigger("click");
    await flushPromises();
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "Use this",
    );
    expect(wrapper.get('[data-testid="ai-chat-attachment"]').text()).toBe(
      "shot.png",
    );
  });
  it("consumes the import queue on mount and later without overwriting text or sending", async () => {
    const chat = vi.fn(async () => ({ messageId: null, text: "" }));
    const { wrapper, feature } = await setup({ chat, chatAttachments: true });
    feature.startImport([attachment()]);
    await flushPromises();
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "Build this email from the attached design.",
    );
    expect(feature.importQueue.value).toEqual([]);
    await wrapper.get("textarea").setValue("Keep my text");
    feature.startImport([attachment("more.png")]);
    await flushPromises();
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "Keep my text",
    );
    expect(chat).not.toHaveBeenCalled();
    wrapper.unmount();
    feature.startImport([attachment("mount.png")]);
    const remount = mountEditor(AiChatPanel, {
      props: { feature },
      provides: { [TRANSLATIONS_KEY]: await loadTranslations("en") },
    });
    await flushPromises();
    expect((remount.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "Build this email from the attached design.",
    );
    expect(remount.get('[data-testid="ai-chat-attachment"]').text()).toBe(
      "mount.png",
    );
    expect(chat).not.toHaveBeenCalled();
  });
});

it.each(["tpl-2", "tpl-1"])("clears composer text, files and errors on committed load %s", async (id) => {
  const { wrapper, feature, editor } = await setup({ chat: chattingForDraft(), chatAttachments: true });
  await wrapper.get('[data-testid="ai-chat-input"]').setValue("A draft");
  await pick(wrapper, [attachment("a.png"), attachment("bad.txt", 1, "text/plain")]);
  feature.close();
  feature.open("chat");
  await nextTick();
  expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe("A draft");
  expect(wrapper.text()).toContain("a.png");
  await editor.load(id);
  await flushPromises();
  expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe("");
  expect(wrapper.findAll('[data-testid="ai-chat-attachment"]')).toHaveLength(0);
  expect(wrapper.text()).not.toContain("bad.txt");
});
function chattingForDraft(): AiProvider["chat"] {
  return async () => ({ messageId: null, text: "Done" });
}

it("never restores A's failed prompt or attachments into B", async () => {
  let reject!: (error: Error) => void;
  const { wrapper, editor } = await setup({
    chat: () => new Promise((_, fail) => { reject = fail; }), chatAttachments: true,
  });
  await wrapper.get("textarea").setValue("A prompt");
  await pick(wrapper, [attachment("a.png")]);
  await wrapper.get('[data-testid="ai-chat-send"]').trigger("click");
  await flushPromises();
  await editor.load("tpl-2");
  await flushPromises();
  await wrapper.get("textarea").setValue("B draft");
  reject(new Error("A failed late"));
  await flushPromises();
  expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe("B draft");
  expect(wrapper.findAll('[data-testid="ai-chat-attachment"]')).toHaveLength(0);
});

it.each([true, false])("guards deferred server reload against author edits: %s", async (edit) => {
  let finish!: (template: Template) => void;
  let loads = 0;
  const server = safeClone(CONTENT);
  (server.blocks[0] as { content: string }).content = "<p>Server</p>";
  const { wrapper, feature, editor } = await setup({
    chat: async (_r, on) => {
      on.onApplied({ batchId: "server", revision: 2, operationCount: 1 });
      return { messageId: null, text: "Done" };
    },
  }, CONTENT, "en", async (id) => {
    loads++;
    if (loads === 2) return new Promise((resolve) => { finish = resolve; });
    return { id, content: loads > 1 ? server : CONTENT };
  });
  const turn = feature.send("Server turn");
  await flushPromises();
  expect(loads).toBe(2);
  if (edit) editor.updateBlock("t1", { content: "<p>Author</p>" });
  finish({ id: "tpl-1", content: server });
  await turn;
  await flushPromises();
  expect(editor.content.value.blocks[0]).toMatchObject({ content: edit ? "<p>Author</p>" : "<p>Server</p>" });
  expect(wrapper.text().includes("You edited while the AI was working")).toBe(edit);
  if (edit) {
    expect(editor.state.isDirty).toBe(true);
    const reload = wrapper.findAll("button").find((button) => button.text() === "Reload")!;
    await reload.trigger("click");
    await flushPromises();
    expect(loads).toBe(3);
    expect(editor.content.value.blocks[0]).toMatchObject({ content: "<p>Server</p>" });
    expect(wrapper.text()).not.toContain("You edited while the AI was working");
  }
});
