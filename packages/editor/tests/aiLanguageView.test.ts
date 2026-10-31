// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { computed, effectScope, markRaw, nextTick } from "vue";
import { flushPromises } from "@vue/test-utils";
import { Editor as TiptapEditor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { useEditor, useHistory } from "@templatical/core";
import {
  createDefaultTemplateContent,
  createCustomBlock,
  createImageBlock,
  createParagraphBlock,
  safeClone,
  sourceHash,
  type AiChatMessage,
  type AiProvider,
  type AiOperationsResult,
  type CollaborationProvider,
  type Operation,
} from "@templatical/types";
import { useAiFeature } from "../src/composables/useAiFeature";
import { useCollaborationFeature } from "../src/composables/useCollaborationFeature";
import { useTemplateLint } from "../src/composables/useTemplateLint";
import { resolveLintOptions } from "../src/utils/resolveLintOptions";
import AiChatPanel from "../src/components/ai/AiChatPanel.vue";
import AiRewriteMenu from "../src/components/ai/AiRewriteMenu.vue";
import AiAltTextPopover from "../src/components/ai/AiAltTextPopover.vue";
import AiAltTextReview from "../src/components/ai/AiAltTextReview.vue";
import IssuesPanel from "../src/components/sidebar/IssuesPanel.vue";
import Canvas from "../src/components/Canvas.vue";
import en from "../src/i18n/locales/en";
import {
  AI_FEATURE_KEY,
  EDITOR_KEY,
  TEMPLATE_LINT_KEY,
  TRANSLATIONS_KEY,
} from "../src/keys";
import { mountEditor } from "./helpers/mount";
import { openLanguages } from "./helpers/localization";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

function seed() {
  const content = createDefaultTemplateContent();
  content.settings.locale = "en";
  content.settings.locales = ["de", "fr"];
  content.blocks = [
    createParagraphBlock({
      id: "copy",
      content: "<p>A calm English sentence.</p>",
      l10n: {
        de: {
          text: {
            content: {
              value: "<p>DIES IST EIN LANGER DEUTSCHER SATZ</p>",
              sourceHash: sourceHash("<p>A calm English sentence.</p>"),
            },
          },
        },
      },
    }),
    createImageBlock({
      id: "hero",
      src: "https://example.com/en.png",
      alt: "English hero",
      decorative: false,
      l10n: {
        de: {
          set: { src: "https://example.com/de.png" },
          text: {
            alt: {
              value: "Deutsches Bild",
              sourceHash: sourceHash("English hero"),
            },
          },
        },
      },
    }),
  ];
  return content;
}

const changes: Operation[] = [
  {
    op: "updateBlock",
    blockId: "copy",
    set: { content: "<p>Ein neuer Satz.</p>" },
  },
];

async function setup(
  provider: Partial<AiProvider> = {},
  collaborative = false,
) {
  const content = seed();
  let revision = 0;
  const submitted: Parameters<CollaborationProvider["submit"]>[1][] = [];
  const collaborationProvider: CollaborationProvider = {
    join: async () => ({ revision: 0, members: [], locks: [], leave() {} }),
    submit: async (_id, batch) => {
      submitted.push(batch);
      return { revision: ++revision };
    },
    operationsAfter: async () => ({ revision, batches: [] }),
  };
  const scope = effectScope();
  const normalize = vi.fn((ops: readonly Operation[]) => [...ops]);
  const onError = vi.fn();
  const state = scope.run(() => {
    const templates = {
      load: async (id: string) => ({
        id,
        revision: 0,
        content: safeClone(content),
      }),
      create: false as const,
      save: false as const,
    };
    const collaboration = collaborative
      ? useCollaborationFeature({
          provider: collaborationProvider,
          loadTemplate: templates.load,
        })
      : null;
    const editor = useEditor({
      content: safeClone(content),
      templates,
      localization: { locales: ["de", "fr"] },
      lockedBlocks: collaboration?.locks,
    });
    collaboration?.attach(editor);
    const history =
      collaboration?.history ??
      useHistory({ content: editor.content, setContent: editor.setContent });
    const ai = useAiFeature({
      provider: {
        chat: false,
        fixFinding: false,
        altText: false,
        rewrite: false,
        chatAttachments: false,
        ...provider,
      },
      editor,
      collaboration,
      history: () => history,
      reload: null,
      normalize,
      mergeTags: () => ({ syntax: "liquid", tags: [] }),
      commentsOpen: null,
      onError,
    });
    return { editor, history, ai, collaboration };
  })!;
  cleanups.push(
    () => scope.stop(),
    () => state.collaboration?.core.destroy(),
    state.ai.destroy,
  );
  await state.editor.load("language-ai");
  await flushPromises();
  return { ...state, scope, submitted, normalize, onError };
}

function mountAi(
  component: any,
  state: Awaited<ReturnType<typeof setup>>,
  props = {},
) {
  const wrapper = mountEditor(component, {
    props,
    provides: {
      [EDITOR_KEY]: state.editor,
      [AI_FEATURE_KEY]: state.ai,
      [TRANSLATIONS_KEY]: en,
    },
  });
  cleanups.push(() => wrapper.unmount());
  return wrapper;
}

describe("language-aware AI", () => {
  it("keeps default request content and existing fields, and sends German projection with locale", async () => {
    const requests: any[] = [];
    const { ai, editor } = await setup({
      chat: async (request) => {
        requests.push(request);
        return { messageId: null, text: "Done" };
      },
    });
    // An old template has no explicit locale: the default request must keep that shape.
    editor.setContent({
      blocks: [createParagraphBlock({ id: "old", content: "<p>Old</p>" })],
      settings: { width: 600 },
    } as any);
    const old = JSON.stringify(editor.content.value);
    await ai.send("Default");
    expect(JSON.stringify(requests[0].content)).toBe(old);
    expect(requests[0]).toMatchObject({
      locale: null,
      templateId: "language-ai",
      revision: null,
      message: "Default",
      selectedBlockId: null,
      attachments: [],
      mergeTags: { syntax: "liquid", tags: [] },
    });
    expect(requests[0].sessionId).toEqual(expect.any(String));
    editor.setContent(seed());
    editor.setActiveLocale("de");
    await ai.send("Deutsch");
    expect(requests[1]).toMatchObject({
      locale: "de",
      content: {
        settings: { locale: "de" },
        blocks: [
          { content: "<p>DIES IST EIN LANGER DEUTSCHER SATZ</p>" },
          { src: "https://example.com/de.png", alt: "Deutsches Bild" },
        ],
      },
    });
    expect(JSON.stringify(requests[1].content)).not.toContain("l10n");
    expect(requests[1].content.settings.locales).toBeUndefined();
  });

  it.each([false, true])(
    "maps before normalization and restores the layer with one Undo (collaboration=%s)",
    async (collaborative) => {
      const state = await setup(
        {
          chat: async (_request, on) => {
            await on.onOperations(changes);
            await on.onOperations([
              {
                op: "updateBlock",
                blockId: "hero",
                set: { alt: "Neues Bild" },
              },
            ]);
            return { messageId: null, text: "Fertig" };
          },
        },
        collaborative,
      );
      const { ai, editor, history, normalize, submitted } = state;
      editor.setActiveLocale("de");
      const before = safeClone(editor.content.value);
      await ai.send("Bearbeiten");
      expect(normalize.mock.calls[0][0]).toEqual([
        {
          op: "updateBlockLocale",
          blockId: "copy",
          locale: "de",
          text: {
            content: {
              value: "<p>Ein neuer Satz.</p>",
              sourceHash: sourceHash("<p>A calm English sentence.</p>"),
            },
          },
        },
      ]);
      expect(editor.content.value.blocks[0]).toMatchObject({
        content: "<p>A calm English sentence.</p>",
        l10n: {
          de: { text: { content: { value: "<p>Ein neuer Satz.</p>" } } },
        },
      });
      if (collaborative)
        expect(submitted).toEqual([
          expect.objectContaining({
            origin: "ai",
            ops: normalize.mock.calls[0][0],
          }),
          expect.objectContaining({
            origin: "ai",
            ops: normalize.mock.calls[1][0],
          }),
        ]);
      history.undo();
      await flushPromises();
      expect(editor.content.value).toEqual(before);
    },
  );

  it("uses shared inverses for local message Undo and Redo after switching language", async () => {
    const { ai, editor } = await setup({
      chat: async (_r, on) => {
        await on.onOperations(changes);
        return { messageId: null, text: "Fertig" };
      },
    });
    editor.setActiveLocale("de");
    const before = safeClone(editor.content.value);
    const result = await ai.send("Ändern");
    const after = safeClone(editor.content.value);
    editor.setActiveLocale("fr");
    await ai.undoMessage(result.messageId!);
    expect(editor.content.value).toEqual(before);
    await ai.redoMessage(result.messageId!);
    expect(editor.content.value).toEqual(after);
    expect(editor.content.value.blocks[0].l10n?.fr).toBeUndefined();
    expect(editor.content.value.blocks[0].l10n?.de?.text?.content.value).toBe(
      "<p>Ein neuer Satz.</p>",
    );
  });

  it.each([
    { stage: "mapped", collaborative: false },
    { stage: "mapped", collaborative: true },
    { stage: "normalized", collaborative: false },
    { stage: "normalized", collaborative: true },
  ])(
    "preserves German redo and reports zero changes for an empty $stage batch (collaboration=$collaborative)",
    async ({ stage, collaborative }) => {
      let turns = 0;
      let result: AiOperationsResult | undefined;
      const { ai, editor, history, collaboration, normalize, submitted } =
        await setup(
          {
            chat: async (_request, on) => {
              const ops: Operation[] =
                ++turns === 1 || stage === "normalized"
                  ? changes
                  : [
                      {
                        op: "updateBlock",
                        blockId: "copy",
                        set: {
                          content: "<p>DIES IST EIN LANGER DEUTSCHER SATZ</p>",
                        },
                      },
                    ];
              result = await on.onOperations(ops);
              return { messageId: null, text: "Fertig" };
            },
          },
          collaborative,
        );
      editor.setActiveLocale("de");
      expect((await ai.send("Ändern")).operationCount).toBe(1);
      const changed = safeClone(editor.content.value);
      history.undo();
      await flushPromises();
      expect(history.canRedo.value).toBe(true);
      expect(history.canUndo.value).toBe(false);
      expect(editor.content.value.blocks[0].l10n?.de?.text?.content.value).toBe(
        "<p>DIES IST EIN LANGER DEUTSCHER SATZ</p>",
      );
      const before = safeClone(editor.content.value);
      const record = vi.spyOn(history, "record");
      const markDirty = vi.spyOn(editor, "markDirty");
      const apply = collaboration
        ? vi.spyOn(collaboration.core, "applyOperations")
        : null;
      submitted.length = 0;
      if (stage === "normalized") normalize.mockImplementation(() => []);

      const outcome = await ai.send("Unverändert lassen");
      await flushPromises();

      expect(result).toEqual({ applied: true, inverse: [] });
      expect(outcome).toMatchObject({ operationCount: 0, failed: false });
      expect(
        ai.messages.value.find((item) => item.id === outcome.messageId),
      ).toMatchObject({ operationCount: 0, canUndo: false });
      expect(editor.content.value).toEqual(before);
      expect(record).not.toHaveBeenCalled();
      expect(markDirty).not.toHaveBeenCalled();
      if (apply) expect(apply).not.toHaveBeenCalled();
      expect(submitted).toEqual([]);
      expect(history.canUndo.value).toBe(false);
      expect(history.canRedo.value).toBe(true);
      if (stage === "normalized")
        normalize.mockImplementation((ops) => [...ops]);
      history.redo();
      await flushPromises();
      expect(editor.content.value).toEqual(changed);
    },
  );

  it("maps provider conversation replays using the stored message locale", async () => {
    const message: AiChatMessage = {
      id: "stored",
      role: "assistant",
      kind: "chat",
      text: "Fertig",
      locale: "de",
      batches: [{ batchId: "b", operationCount: 1 }],
      undone: false,
      createdAt: "2026-10-26T00:00:00Z",
    };
    const { ai, editor } = await setup({
      conversation: {
        list: async () => [message],
        clear: false,
        undo: async () => ({
          replayId: "undo",
          operations: [
            {
              op: "updateBlock",
              blockId: "copy",
              expect: { content: "<p>DIES IST EIN LANGER DEUTSCHER SATZ</p>" },
              set: { content: "<p>Zurück.</p>" },
            },
          ],
        }),
        redo: async () => ({ replayId: "redo", operations: changes }),
        settleReplay: async () => {},
      },
    });
    ai.open("chat");
    await flushPromises();
    editor.setActiveLocale("fr");
    await ai.undoMessage("stored");
    expect(editor.content.value.blocks[0]).toMatchObject({
      content: "<p>A calm English sentence.</p>",
      l10n: { de: { text: { content: { value: "<p>Zurück.</p>" } } } },
    });
    await ai.redoMessage("stored");
    expect(editor.content.value.blocks[0].l10n?.de?.text?.content.value).toBe(
      "<p>Ein neuer Satz.</p>",
    );
    expect(editor.content.value.blocks[0].l10n?.fr).toBeUndefined();
  });

  it("ignores every later chat batch after switching away and back", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let entered!: () => void;
    const ready = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const { ai, editor } = await setup({
      chat: async (_r, on) => {
        entered();
        await gate;
        await on.onOperations(changes);
        return { messageId: null, text: "Done" };
      },
    });
    editor.setActiveLocale("de");
    const before = safeClone(editor.content.value);
    const pending = ai.send("Warten");
    await ready;
    editor.setActiveLocale("fr");
    editor.setActiveLocale("de");
    release();
    await pending;
    expect(editor.content.value).toEqual(before);
  });

  it("surfaces indexed mapper refusals without recording history", async () => {
    const results: AiOperationsResult[] = [];
    const { ai, editor, history } = await setup({
      chat: async (_r, on) => {
        results.push(
          await on.onOperations([
            ...changes,
            { op: "setContent", content: seed() },
          ]),
        );
        results.push(
          await on.onOperations([
            { op: "updateSettings", set: { locale: "fr" } },
          ]),
        );
        return { messageId: null, text: "Refused" };
      },
    });
    editor.setActiveLocale("de");
    const before = safeClone(editor.content.value);
    const record = vi.spyOn(history, "record");
    await ai.send("Replace");
    expect(results).toMatchObject([
      { applied: false, code: "invalid_operation", opIndex: 1 },
      { applied: false, code: "invalid_operation", opIndex: 0 },
    ]);
    expect(editor.content.value).toEqual(before);
    expect(record).not.toHaveBeenCalled();
  });

  it("offers Fix with AI from German lint and maps its fix", async () => {
    const requests: any[] = [];
    const state = await setup({
      fixFinding: async (request, on) => {
        requests.push(request);
        await on.onOperations(changes);
        return { messageId: null, text: "Fertig" };
      },
    });
    const { editor, ai, scope } = state;
    const options = computed(() =>
      resolveLintOptions({
        locale: "en",
        content: editor.content.value,
        contentLocale: editor.activeLocale.value ?? undefined,
        structure: false,
        links: false,
        deliverability: false,
        compatibility: false,
      }),
    );
    const lint = scope.run(() =>
      useTemplateLint({
        content: editor.content,
        get options() {
          return options.value;
        },
        updateBlock: editor.updateBlock,
        updateSettings: editor.updateSettings,
        removeBlock: editor.removeBlock,
        debounce: 1,
      }),
    )!;
    cleanups.push(lint.destroy);
    await vi.waitFor(() => expect(lint.ready.value).toBe(true));
    expect(
      lint.issues.value.some((issue) => issue.ruleId === "a11y.text-all-caps"),
    ).toBe(false);
    editor.setActiveLocale("de");
    await vi.waitFor(() =>
      expect(
        lint.issues.value.some(
          (issue) => issue.ruleId === "a11y.text-all-caps",
        ),
      ).toBe(true),
    );
    const wrapper = mountEditor(IssuesPanel, {
      provides: {
        [EDITOR_KEY]: editor,
        [AI_FEATURE_KEY]: ai,
        [TRANSLATIONS_KEY]: en,
        [TEMPLATE_LINT_KEY]: lint,
      },
    });
    cleanups.push(() => wrapper.unmount());
    expect(ai.has("fixFinding")).toBe(true);
    await wrapper.get('[data-testid="issue-ai-fix"]').trigger("click");
    await flushPromises();
    expect(requests[0]).toMatchObject({
      locale: "de",
      finding: { ruleId: "a11y.text-all-caps", blockId: "copy" },
    });
    expect(editor.content.value.blocks[0].l10n?.de?.text?.content.value).toBe(
      "<p>Ein neuer Satz.</p>",
    );
  });

  it.each(["popover", "review"])(
    "reads and applies the German hero projection in the alt-text %s",
    async (kind) => {
      const requests: any[] = [];
      const state = await setup({
        altText: async (request) => {
          requests.push(request);
          return { alt: "Ein neues deutsches Bild" };
        },
      });
      state.editor.setActiveLocale("de");
      const wrapper =
        kind === "popover"
          ? mountAi(AiAltTextPopover, state, { blockId: "hero" })
          : mountAi(AiAltTextReview, state, {
              blockIds: ["hero"],
              feature: state.ai,
            });
      await flushPromises();
      expect(requests[0]).toMatchObject({
        locale: "de",
        image: { url: "https://example.com/de.png" },
        currentAlt: "Deutsches Bild",
        nearbyText: "DIES IST EIN LANGER DEUTSCHER SATZ",
      });
      if (kind === "review")
        expect(wrapper.get("img").attributes("src")).toBe(
          "https://example.com/de.png",
        );
      const apply = wrapper
        .findAll("button")
        .find(
          (b) =>
            b.text() === (kind === "popover" ? "Accept" : "Apply accepted (1)"),
        )!;
      expect(apply).toBeDefined();
      await apply.trigger("click");
      await flushPromises();
      expect(state.editor.content.value.blocks[1]).toMatchObject({
        alt: "English hero",
        l10n: {
          de: {
            text: { alt: { value: "Ein neues deutsches Bild" } },
            set: { src: "https://example.com/de.png" },
          },
        },
      });
    },
  );

  it.each(["popover", "review"])(
    "invalidates a completed alt-text %s after a language switch",
    async (kind) => {
      const state = await setup({
        altText: async () => ({ alt: "Alte deutsche Antwort" }),
      });
      state.editor.setActiveLocale("de");
      const wrapper =
        kind === "popover"
          ? mountAi(AiAltTextPopover, state, { blockId: "hero" })
          : mountAi(AiAltTextReview, state, {
              blockIds: ["hero"],
              feature: state.ai,
            });
      await flushPromises();
      const before = safeClone(state.editor.content.value);
      state.editor.setActiveLocale("fr");
      state.editor.setActiveLocale("de");
      await nextTick();
      expect(wrapper.emitted("close")).toBeTruthy();
      for (const button of wrapper.findAll("button"))
        await button.trigger("click");
      await flushPromises();
      expect(state.editor.content.value).toEqual(before);
    },
  );

  it.each([false, true])(
    "routes Rewrite into the German layer and invalidates completed suggestions=%s",
    async (switchLanguage) => {
      const requests: any[] = [];
      const state = await setup({
        rewrite: async (request) => {
          requests.push(request);
          return { html: "<p>Ein kurzer Satz.</p>" };
        },
      });
      const { editor } = state;
      editor.setActiveLocale("de");
      const tiptap = markRaw(
        new TiptapEditor({
          extensions: [StarterKit],
          content: "<p>DIES IST EIN LANGER DEUTSCHER SATZ</p>",
          onUpdate: ({ editor: richText }) =>
            editor.updateBlock("copy", { content: richText.getHTML() }),
        }),
      );
      cleanups.push(() => tiptap.destroy());
      const wrapper = mountAi(AiRewriteMenu, state, { editor: tiptap });
      await wrapper.get('[data-testid="ai-rewrite-trigger"]').trigger("click");
      await wrapper
        .get('[data-testid="ai-rewrite-preset-shorten"]')
        .trigger("click");
      await flushPromises();
      expect(requests[0]).toMatchObject({
        locale: "de",
        html: "<p>DIES IST EIN LANGER DEUTSCHER SATZ</p>",
      });
      if (switchLanguage) {
        editor.setActiveLocale("fr");
        editor.setActiveLocale("de");
        await nextTick();
        expect(
          wrapper.find('[data-testid="ai-rewrite-replace"]').exists(),
        ).toBe(false);
        expect(
          editor.content.value.blocks[0].l10n?.de?.text?.content.value,
        ).toBe("<p>DIES IST EIN LANGER DEUTSCHER SATZ</p>");
      } else {
        await wrapper
          .get('[data-testid="ai-rewrite-replace"]')
          .trigger("click");
        expect(editor.content.value.blocks[0]).toMatchObject({
          content: "<p>A calm English sentence.</p>",
          l10n: {
            de: { text: { content: { value: "<p>Ein kurzer Satz.</p>" } } },
          },
        });
      }
    },
  );

  it("shows the active-language note and local and stored message language labels", async () => {
    const state = await setup({
      chat: async () => ({ messageId: null, text: "Fertig" }),
      conversation: {
        list: async () => [
          {
            id: "stored-de",
            role: "assistant",
            kind: "chat",
            locale: "de",
            text: "Gespeichert",
            batches: [],
            undone: false,
            createdAt: "2026-10-26T00:00:00Z",
          },
          {
            id: "stored-default",
            role: "assistant",
            kind: "chat",
            locale: null,
            text: "Default",
            batches: [],
            undone: false,
            createdAt: "2026-10-26T00:00:00Z",
          },
          {
            id: "stored-old",
            role: "assistant",
            kind: "chat",
            text: "Old",
            batches: [],
            undone: false,
            createdAt: "2026-10-26T00:00:00Z",
          },
        ],
        clear: false,
        undo: false,
        redo: false,
        settleReplay: async () => {},
      },
    });
    state.ai.open("chat");
    state.editor.setActiveLocale("de");
    const wrapper = mountAi(AiChatPanel, state, { feature: state.ai });
    await flushPromises();
    expect(wrapper.get('[data-testid="ai-active-language"]').text()).toBe(
      "AI chat edits Deutsch. Structure changes apply to every language.",
    );
    await state.ai.send("Deutsch ändern");
    await nextTick();
    expect(state.ai.messages.value.slice(-2).map((row) => row.locale)).toEqual([
      "de",
      "de",
    ]);
    expect(
      wrapper
        .findAll('[data-testid="ai-chat-language"]')
        .map((label) => label.text()),
    ).toEqual(["Deutsch", "Deutsch", "Deutsch"]);
    state.editor.setActiveLocale(null);
    await nextTick();
    expect(wrapper.find('[data-testid="ai-active-language"]').exists()).toBe(
      false,
    );
  });

  it("keeps structural AI additions in the shared tree and shows the existing notice", async () => {
    const content = seed();
    const added = createParagraphBlock({
      id: "added",
      content: "<p>Neuer Block.</p>",
    });
    const { wrapper, editor } = await openLanguages({
      content,
      templates: {
        load: async (id) => ({ id, content }),
        create: false,
        save: false,
      },
      ai: {
        chat: async (_r, on) => {
          await on.onOperations([
            { op: "addBlock", block: added, parent: null, after: "copy" },
          ]);
          return { messageId: null, text: "Fertig" };
        },
        fixFinding: false,
        altText: false,
        rewrite: false,
        chatAttachments: false,
      },
    });
    await editor.load("ai-structure-notice");
    editor.setActiveLocale("de");
    const feature = (wrapper.findComponent(Canvas).vm as any).$.provides[
      AI_FEATURE_KEY as symbol
    ];
    await feature.send("Hinzufügen");
    await nextTick();
    expect(
      editor.content.value.blocks.find((block) => block.id === "added"),
    ).toEqual(added);
    expect(wrapper.get('[data-testid="structure-notice"]').text()).toContain(
      "Structure changes apply to every language.",
    );
  });

  it("threads custom text and textarea definitions from Editor into AI mapping", async () => {
    const content = seed();
    content.blocks.push({
      ...createCustomBlock({
        type: "card",
        name: "Card",
        fields: [
          { key: "headline", label: "Headline", type: "text" },
          { key: "body", label: "Body", type: "textarea" },
        ],
        template: "<p>{{headline}}</p>",
      }),
      id: "card",
      fieldValues: { headline: "Hello", body: "English body" },
    });
    const { wrapper, editor } = await openLanguages({
      content,
      customBlocks: [
        {
          type: "card",
          name: "Card",
          fields: [
            { key: "headline", label: "Headline", type: "text" },
            { key: "body", label: "Body", type: "textarea" },
          ],
          template: "<p>{{headline}}</p>",
        },
      ],
      templates: {
        load: async (id) => ({ id, content }),
        create: false,
        save: false,
      },
      ai: {
        chat: async (_r, on) => {
          await on.onOperations([
            {
              op: "updateBlock",
              blockId: "card",
              set: {
                fieldValues: { headline: "Hallo", body: "Deutscher Text" },
              },
            },
          ]);
          return { messageId: null, text: "Fertig" };
        },
        fixFinding: false,
        altText: false,
        rewrite: false,
        chatAttachments: false,
      },
    });
    await editor.load("ai-custom");
    editor.setActiveLocale("de");
    const feature = (wrapper.findComponent(Canvas).vm as any).$.provides[
      AI_FEATURE_KEY as symbol
    ];
    await feature.send("Karte");
    expect(editor.content.value.blocks[2].l10n?.de).toEqual({
      text: {
        "fieldValues.headline": { value: "Hallo", sourceHash: sourceHash("Hello") },
        "fieldValues.body": {
          value: "Deutscher Text",
          sourceHash: sourceHash("English body"),
        },
      },
    });
  });

  it("refuses mapped AI writes to a Not enabled version", async () => {
    const content = seed();
    let result: AiOperationsResult | undefined;
    const { wrapper, editor } = await openLanguages({
      content,
      localization: { locales: ["fr"] },
      templates: {
        load: async (id) => ({ id, content }),
        create: false,
        save: false,
      },
      ai: {
        chat: async (_r, on) => {
          result = await on.onOperations(changes);
          return { messageId: null, text: "Fertig" };
        },
        fixFinding: false,
        altText: false,
        rewrite: false,
        chatAttachments: false,
      },
    });
    await editor.load("ai-not-enabled");
    editor.setActiveLocale("de");
    const before = safeClone(editor.content.value);
    const feature = (wrapper.findComponent(Canvas).vm as any).$.provides[
      AI_FEATURE_KEY as symbol
    ];
    await feature.send("Ändern");
    expect(result).toMatchObject({
      applied: false,
      code: "invalid_operation",
      opIndex: 0,
    });
    expect(editor.content.value).toEqual(before);
  });

  it("preserves plain-object provider error codes for the UI", async () => {
    const state = await setup({
      chat: async () => {
        throw {
          code: "rate_limited",
          message: "Wait",
          statusCode: 429,
          details: { retryAfter: 10 },
        };
      },
    });
    state.ai.open("chat");
    const wrapper = mountAi(AiChatPanel, state, { feature: state.ai });
    await state.ai.send("Hello");
    await nextTick();
    expect(state.ai.failure.value?.error).toMatchObject({
      code: "rate_limited",
      message: "Wait",
      statusCode: 429,
      details: { retryAfter: 10 },
    });
    expect(wrapper.get('[data-testid="ai-chat-error"]').text()).toBe(
      en.ai.errors.rateLimited,
    );
  });

  it("refuses a stored language replay when localization is no longer configured", async () => {
    const content = seed();
    const { wrapper, editor } = await openLanguages({
      content,
      localization: undefined,
      templates: {
        load: async (id) => ({ id, content }),
        create: false,
        save: false,
      },
      ai: {
        chat: false,
        fixFinding: false,
        altText: false,
        rewrite: false,
        chatAttachments: false,
        conversation: {
          list: async () => [
            {
              id: "disabled-replay",
              role: "assistant",
              kind: "chat",
              locale: "de",
              text: "Fertig",
              batches: [{ batchId: "b", operationCount: 1 }],
              undone: false,
              createdAt: "2026-10-26T00:00:00Z",
            },
          ],
          clear: false,
          undo: async () => ({ replayId: "disabled", operations: changes }),
          redo: false,
          settleReplay: async () => {},
        },
      },
    });
    await editor.load("ai-unconfigured-replay");
    const feature = (wrapper.findComponent(Canvas).vm as any).$.provides[
      AI_FEATURE_KEY as symbol
    ];
    feature.open("chat");
    await flushPromises();
    const before = safeClone(editor.content.value);
    await feature.undoMessage("disabled-replay");
    expect(editor.content.value).toEqual(before);
    expect(feature.messages.value[0]).toMatchObject({
      undone: false,
      failure: { error: { code: "invalid_operation" } },
    });
  });
});
