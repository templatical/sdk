// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref, watch } from "vue";
import { useEditor, useHistory } from "@templatical/core";
import type {
  AiChatMessage,
  AiProvider,
  AiTurnHandlers,
  CollaborationProvider,
  Operation,
  Template,
  TemplateContent,
} from "@templatical/types";
import { safeClone, SdkError } from "@templatical/types";
import {
  AI_BROADCAST_GRACE_MS,
  AI_MISSING_PROVIDER_MESSAGE,
  useAiFeature,
  type UseAiFeatureOptions,
} from "../src/composables/useAiFeature";
import { useCollaborationFeature } from "../src/composables/useCollaborationFeature";
import { effectiveAltMaxLength } from "../src/utils/aiFixableRules";
import { resolveLintOptions } from "../src/utils/resolveLintOptions";
import { normalizeRemoteOperations } from "../src/utils/normalizeMergeTagMarkup";

import { createHttpAiProvider } from "../../ai-kit/src/client";
import { createMockAiProvider } from "../../ai-kit/src/testing";
import { createReferenceHandler } from "../../ai-kit/tests/helpers/reference-server";

const CONTENT = {
  blocks: [
    { id: "t1", type: "title", content: "<p>Hi</p>" },
    { id: "p1", type: "paragraph", content: "<p>Body</p>" },
  ],
  settings: { width: 600 },
} as unknown as TemplateContent;
const MERGE_TAGS = { tags: [{ value: "{{first_name}}", label: "First name" }] };

const greet: Operation[] = [
  { op: "updateBlock", blockId: "t1", set: { content: "<p>Hello</p>" } },
];
const drop: Operation[] = [{ op: "deleteBlock", blockId: "p1" }];

async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

const off = {
  chat: false,
  fixFinding: false,
  chatAttachments: false,
  rewrite: false,
} as const;

/** A chat that plays `script` into the handlers, then answers `text`. */
function chatting(
  script: (on: AiTurnHandlers) => Promise<void> | void,
  text = "Done.",
  messageId: string | null = null,
): AiProvider["chat"] {
  return vi.fn(async (_request, on: AiTurnHandlers) => {
    await script(on);
    return { messageId, text };
  });
}

async function openLocal(
  provider: Partial<AiProvider>,
  extra: Partial<UseAiFeatureOptions> = {},
  load = true,
) {
  const scope = effectScope();
  const onError = vi.fn();
  const reload = vi.fn<NonNullable<UseAiFeatureOptions["reload"]>>(
    async () => {},
  );
  const result = scope.run(() => {
    const editor = useEditor({
      content: safeClone(CONTENT),
      templates: {
        load: async (id: string): Promise<Template> => ({
          id,
          content: safeClone(CONTENT),
        }),
        create: false,
        save: false,
      },
    });
    const history = useHistory({
      content: editor.content,
      setContent: editor.setContent,
    });
    const ai = useAiFeature({
      provider: { ...off, ...provider } as AiProvider,
      editor,
      collaboration: null,
      history: () => history,
      reload: null,
      mergeTags: () => ({ syntax: "liquid", tags: MERGE_TAGS.tags }),
      normalize: (ops, content) =>
        normalizeRemoteOperations(ops, content, MERGE_TAGS),

      commentsOpen: null,
      onError,
      ...extra,
      ...(extra.reload === undefined ? {} : { reload }),
    });
    return { editor, history, ai };
  })!;
  if (load) await result.editor.load("tpl-1");
  return { ...result, onError, reload, scope };
}

describe("useAiFeature without collaboration", () => {
  it.each(["undo", "redo"] as const)(
    "reloads a server-applied stored %s without collaboration",
    async (direction) => {
      const replay = vi.fn(async () => ({
        applied: { batchId: "remote", revision: 8 },
      }));
      const settleReplay = vi.fn(async () => {});
      const { ai, reload, editor, onError } = await openLocal(
        {
          conversation: {
            list: async () => [
              persistedMessage("persisted", direction === "redo"),
            ],
            clear: false,
            undo: replay,
            redo: replay,
            settleReplay,
          },
        },
        { reload: async () => {} },
      );
      editor.updateBlock("t1", { content: "<p>Awaiting server reload</p>" });
      const version = editor.loadVersion.value;
      reload.mockImplementation((id, guard) => editor.load(id, guard));
      ai.open("chat");
      await settle();
      await (direction === "undo"
        ? ai.undoMessage("persisted")
        : ai.redoMessage("persisted"));
      expect(replay).toHaveBeenCalledExactlyOnceWith("tpl-1", "persisted", {
        sessionId: expect.any(String),
      });
      expect(reload).toHaveBeenCalledExactlyOnceWith(
        "tpl-1",
        expect.any(Function),
      );
      expect(ai.messages.value[0]).toMatchObject({
        undone: direction === "undo",
        failure: undefined,
      });
      expect(editor.content.value).toEqual(CONTENT);
      expect(editor.state.isDirty).toBe(false);
      expect(editor.loadVersion.value).toBe(version + 1);
      expect(onError).not.toHaveBeenCalled();
      expect(settleReplay).not.toHaveBeenCalled();
    },
  );

  it.each(["undo", "redo"] as const)(
    "reports the missing provider after a server-applied stored %s without reload",
    async (direction) => {
      const { ai, onError, editor, reload } = await openLocal({
        conversation: {
          list: async () => [
            persistedMessage("persisted", direction === "redo"),
          ],
          clear: false,
          undo: async () => ({ applied: { batchId: "remote", revision: 8 } }),
          redo: async () => ({ applied: { batchId: "remote", revision: 8 } }),
          settleReplay: async () => {},
        },
      });
      ai.open("chat");
      await settle();
      await (direction === "undo"
        ? ai.undoMessage("persisted")
        : ai.redoMessage("persisted"));
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0]).toBeInstanceOf(SdkError);
      expect(onError.mock.calls[0][0]).toMatchObject({
        code: "ai_provider_error",
        statusCode: 502,
        message: AI_MISSING_PROVIDER_MESSAGE,
      });
      expect(ai.messages.value[0]).toMatchObject({
        undone: direction === "undo",
        failure: { context: direction, error: onError.mock.calls[0][0] },
      });
      expect(reload).not.toHaveBeenCalled();
      expect(editor.content.value).toEqual(CONTENT);
    },
  );

  it.each(["undo", "redo"] as const)(
    "ignores a local %s in the wrong undone state",
    async (direction) => {
      const { ai, editor, history, onError } = await openLocal({
        chat: chatting(async (on) => {
          await on.onOperations(greet);
        }),
      });
      await ai.send("Greet");
      const id = ai.messages.value.at(-1)!.id;
      await ai.undoMessage(id);
      if (direction === "redo") await ai.redoMessage(id);
      const before = safeClone(editor.content.value);
      const messages = safeClone(ai.messages.value);
      const record = vi.spyOn(history, "record");
      await (direction === "undo" ? ai.undoMessage(id) : ai.redoMessage(id));
      expect(editor.content.value).toEqual(before);
      expect(ai.messages.value).toEqual(messages);
      expect(record).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    },
  );

  it.each(["undo", "redo"] as const)(
    "ignores a local %s with no operations",
    async (direction) => {
      const { ai, editor, history, onError } = await openLocal({
        chat: chatting(() => {}),
      });
      await ai.send("Explain the template");
      const item = ai.messages.value.at(-1)!;
      // Public rows are mutable; put the empty record in the direction's eligible state.
      item.undone = direction === "redo";
      const before = safeClone(ai.messages.value);
      const record = vi.spyOn(history, "record");
      await (direction === "undo"
        ? ai.undoMessage(item.id)
        : ai.redoMessage(item.id));
      expect(editor.content.value).toEqual(CONTENT);
      expect(ai.messages.value).toEqual(before);
      expect(record).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    },
  );

  it("reports a current history rejection once with history context", async () => {
    const error = new Error("History unavailable");
    const list = vi.fn().mockRejectedValue(error);
    const { ai, onError } = await openLocal({
      conversation: {
        list,
        clear: false,
        undo: false,
        redo: false,
        settleReplay: async () => {},
      },
    });
    ai.open("chat");
    await settle();
    expect(list).toHaveBeenCalledExactlyOnceWith("tpl-1");
    expect(ai.failure.value).toEqual({ error, context: "history" });
    expect(onError).toHaveBeenCalledExactlyOnceWith(error);
    expect(ai.isLoadingHistory.value).toBe(false);
    expect(ai.messages.value).toEqual([]);
  });

  it("ignores a history rejection after its session is replaced", async () => {
    const stale = deferred<AiChatMessage[]>();
    const { ai, editor, onError } = await openLocal({
      conversation: {
        list: vi
          .fn()
          .mockImplementationOnce(() => stale.promise)
          .mockResolvedValue([persistedMessage("new-history")]),
        clear: false,
        undo: false,
        redo: false,
        settleReplay: async () => {},
      },
    });
    ai.open("chat");
    await settle();
    await editor.load("tpl-2");
    await settle();
    stale.reject(new Error("Stale history unavailable"));
    await settle();
    expect(ai.failure.value).toBeNull();
    expect(onError).not.toHaveBeenCalled();
    expect(ai.messages.value.map((item) => item.id)).toEqual(["new-history"]);
    expect(ai.isLoadingHistory.value).toBe(false);
  });

  it("reports template emptiness when a block is added", async () => {
    const { ai, editor } = await openLocal({ chat: chatting(() => {}) });
    editor.setContent({ ...CONTENT, blocks: [] });
    expect(ai.isTemplateEmpty.value).toBe(true);
    editor.setContent({ ...CONTENT, blocks: [safeClone(CONTENT.blocks[0])] });
    expect(ai.isTemplateEmpty.value).toBe(false);
  });

  it("is off until a template is loaded, and for features the provider withholds", async () => {
    const scope = effectScope();
    const { ai, editor } = scope.run(() => {
      const editor = useEditor({
        content: safeClone(CONTENT),
        templates: {
          load: async (id: string) => ({ id, content: safeClone(CONTENT) }),
          create: false,
          save: false,
        },
      });
      const history = useHistory({
        content: editor.content,
        setContent: editor.setContent,
      });
      return {
        editor,
        ai: useAiFeature({
          provider: {
            ...off,
            chat: chatting(() => {}),
            chatAttachments: true,
          } as AiProvider,
          editor,
          collaboration: null,
          history: () => history,
          reload: null,
          mergeTags: () => ({ syntax: "liquid", tags: [] }),
          normalize: (ops) => [...ops],

          commentsOpen: null,
        }),
      };
    })!;

    expect(ai.capability.isFeatureEnabled("chat")).toBe(false);
    expect(ai.has("chatAttachments")).toBe(false);
    expect(ai.capability.isFeatureEnabled("chatAttachments")).toBe(false);
    await editor.load("tpl-1");
    expect(ai.capability.isFeatureEnabled("chat")).toBe(true);
    expect(ai.capability.isFeatureEnabled("rewrite")).toBe(false);
    expect(ai.has("chatAttachments")).toBe(true);
    expect(ai.capability.isFeatureEnabled("chatAttachments")).toBe(true);
  });

  it("sends the snapshot, the session and the merge tags, and names a selected block in the snapshot", async () => {
    const chat = chatting(() => {});
    const { ai, editor } = await openLocal({ chat });
    editor.selectBlock("p1");

    await ai.send("Make it bold");

    expect(chat).toHaveBeenCalledWith(
      {
        templateId: "tpl-1",
        content: CONTENT,
        revision: null,
        sessionId: expect.any(String),
        mergeTags: { syntax: "liquid", tags: MERGE_TAGS.tags },
        message: "Make it bold",
        selectedBlockId: "p1",
        attachments: [],
      },
      expect.any(Object),
      expect.any(AbortSignal),
    );
  });

  it("applies a turn's batches locally as one undo step", async () => {
    const results: unknown[] = [];
    const { ai, editor, history } = await openLocal({
      chat: chatting(async (on) => {
        results.push(await on.onOperations(greet));
        results.push(await on.onOperations(drop));
      }),
    });

    await ai.send("Greet and tidy up");

    expect(editor.content.value.blocks.map((block) => block.id)).toEqual([
      "t1",
    ]);
    expect(editor.content.value.blocks[0]).toMatchObject({
      content: "<p>Hello</p>",
    });
    expect(editor.state.isDirty).toBe(true);
    expect(results[0]).toEqual({
      applied: true,
      inverse: [
        {
          op: "updateBlock",
          blockId: "t1",
          set: { content: "<p>Hi</p>" },
          expect: { content: "<p>Hello</p>" },
        },
      ],
    });
    expect(ai.messages.value.at(-1)).toMatchObject({
      role: "assistant",
      text: "Done.",
      operationCount: 2,
      canUndo: true,
      status: "done",
    });

    history.undo();

    expect(editor.content.value).toEqual(CONTENT);
  });

  it("turns bare merge tags into tags before applying (D8)", async () => {
    const { ai, editor } = await openLocal({
      chat: chatting(async (on) => {
        await on.onOperations([
          {
            op: "updateBlock",
            blockId: "t1",
            set: { content: "<p>Hi {{first_name}}</p>" },
          },
        ]);
      }),
    });

    await ai.send("Greet by name");

    expect(
      (editor.content.value.blocks[0] as { content: string }).content,
    ).toContain('data-merge-tag="{{first_name}}"');
  });

  it("answers the refusal for operations that don't apply, changing nothing", async () => {
    let answer: unknown;
    const { ai, editor } = await openLocal({
      chat: chatting(async (on) => {
        answer = await on.onOperations([
          { op: "deleteBlock", blockId: "gone" },
        ]);
      }),
    });

    await ai.send("Delete it");

    expect(answer).toMatchObject({
      applied: false,
      code: "block_missing",
      opIndex: 0,
    });
    expect(editor.content.value).toEqual(CONTENT);
  });

  it("outlines what a turn changed (D42)", async () => {
    const { ai } = await openLocal({
      chat: chatting(async (on) => void (await on.onOperations(greet))),
    });

    await ai.send("Greet");

    expect(ai.capability.highlightOf("t1")).toEqual(expect.any(Number));
    expect(ai.capability.highlightOf("p1")).toBe(null);
  });

  it("refuses server-applied batches it can't show (D9)", async () => {
    const { ai, onError } = await openLocal({
      chat: chatting((on) =>
        on.onApplied({ batchId: "b", revision: 2, operationCount: 1 }),
      ),
    });

    await ai.send("Server side");

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "ai_provider_error",
        message: AI_MISSING_PROVIDER_MESSAGE,
      }),
    );
    expect(ai.messages.value).toEqual([]);
    expect(ai.failure.value?.context).toBe("turn");
  });

  it("reloads the template once after a server-applied turn (D10)", async () => {
    const { ai, reload } = await openLocal(
      {
        chat: chatting((on) =>
          on.onApplied({ batchId: "b", revision: 2, operationCount: 3 }),
        ),
      },
      { reload: vi.fn() },
    );

    await ai.send("Server side");

    expect(reload).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledWith("tpl-1", expect.any(Function));
    expect(ai.messages.value.at(-1)).toMatchObject({
      operationCount: 3,
      canUndo: false,
    });
  });

  it("undoes and redoes a message from its stored inverse, guarded (D13)", async () => {
    const { ai, editor } = await openLocal({
      chat: chatting(async (on) => void (await on.onOperations(greet))),
    });
    await ai.send("Greet");
    const id = ai.messages.value.at(-1)!.id;

    await ai.undoMessage(id);
    expect(editor.content.value.blocks[0]).toMatchObject({
      content: "<p>Hi</p>",
    });
    expect(ai.messages.value.at(-1)).toMatchObject({ undone: true });

    await ai.redoMessage(id);
    expect(editor.content.value.blocks[0]).toMatchObject({
      content: "<p>Hello</p>",
    });
    expect(ai.messages.value.at(-1)).toMatchObject({ undone: false });

    editor.updateBlock("t1", { content: "<p>Mine</p>" } as never);
    await ai.undoMessage(id);
    expect(editor.content.value.blocks[0]).toMatchObject({
      content: "<p>Mine</p>",
    });
    expect(ai.messages.value.at(-1)).toMatchObject({
      undone: false,
      failure: { context: "undo" },
    });
  });

  it("drops a turn that failed before changing anything and gives the prompt back (D15)", async () => {
    const { ai, onError } = await openLocal({
      chat: vi.fn(async () => {
        throw new SdkError(
          "AI is unavailable right now. Try again later.",
          502,
          "ai_provider_error",
        );
      }),
    });

    await ai.send("Hello");

    expect(ai.messages.value).toEqual([]);
    expect(ai.failedPrompt.value).toBe("Hello");
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("keeps a turn that failed after changing something, with Undo (D15)", async () => {
    const { ai } = await openLocal({
      chat: vi.fn(async (_request, on: AiTurnHandlers) => {
        await on.onOperations(greet);
        throw new SdkError(
          "Too many AI requests. Try again in a moment.",
          429,
          "rate_limited",
        );
      }),
    });

    await ai.send("Greet");

    expect(ai.messages.value.at(-1)).toMatchObject({
      status: "failed",
      operationCount: 1,
      canUndo: true,
      failure: { context: "turn" },
    });
  });

  it("reports nothing for a stopped turn and keeps what applied (D15)", async () => {
    let release!: () => void;
    const { ai, onError } = await openLocal({
      chat: vi.fn(async (_request, on: AiTurnHandlers, signal: AbortSignal) => {
        await on.onOperations(greet);
        await new Promise<void>((resolve) => (release = resolve));
        signal.throwIfAborted();
        return { messageId: null, text: "" };
      }),
    });

    const turn = ai.send("Greet");
    await settle();
    ai.stop();
    release();
    await turn;

    expect(onError).not.toHaveBeenCalled();
    expect(ai.messages.value.at(-1)).toMatchObject({
      operationCount: 1,
      status: "done",
    });
  });

  it("keeps the chat in memory per template, and New chat empties it (D14)", async () => {
    const { ai, editor } = await openLocal({ chat: chatting(() => {}) });
    await ai.send("One");
    expect(ai.messages.value).toHaveLength(2);

    await editor.load("tpl-2");
    await settle();
    expect(ai.messages.value).toEqual([]);

    await editor.load("tpl-1");
    ai.open("chat");
    await settle();
    expect(ai.messages.value).toHaveLength(2);

    await ai.newChat();
    expect(ai.messages.value).toEqual([]);
  });

  it("closes comments when an AI panel opens, and the other way round (D18)", async () => {
    const commentsOpen = ref(true);
    const { ai } = await openLocal(
      { chat: chatting(() => {}) },
      { commentsOpen },
    );

    ai.open("chat");
    expect(commentsOpen.value).toBe(false);
    expect(ai.panel.value).toBe("chat");

    await nextTick();
    commentsOpen.value = true;
    await settle();
    expect(ai.panel.value).toBe(null);
  });
});

describe("useAiFeature with a conversation (D14)", () => {
  const stored: AiChatMessage[] = [
    {
      id: "u-1",
      role: "user",
      kind: "chat",
      text: "Greet",
      batches: [],
      undone: false,
      createdAt: "2026-10-20T10:00:00Z",
    },
    {
      id: "a-1",
      role: "assistant",
      kind: "chat",
      text: "Done.",
      batches: [{ batchId: "b", revision: null, operationCount: 1 }],
      undone: false,
      createdAt: "2026-10-20T10:00:01Z",
    },
  ];

  it("loads the stored messages when the chat opens, and undoes through the provider", async () => {
    const undo = vi.fn(async () => ({
      replayId: "replay",
      operations: [
        { op: "updateBlock", blockId: "t1", set: { content: "<p>Undone</p>" } },
      ] as Operation[],
    }));
    const { ai, editor } = await openLocal({
      chat: chatting(() => {}),
      conversation: {
        settleReplay: async () => {},
        list: vi.fn(async () => stored),
        clear: false,
        undo,
        redo: false,
      },
    });

    ai.open("chat");
    await settle();

    expect(
      ai.messages.value.map((item) => [
        item.id,
        item.operationCount,
        item.canUndo,
      ]),
    ).toEqual([
      ["u-1", 0, false],
      ["a-1", 1, true],
    ]);
    expect(ai.canClear).toBe(false);

    await ai.undoMessage("a-1");

    expect(undo).toHaveBeenCalledWith("tpl-1", "a-1", {
      sessionId: expect.any(String),
    });
    expect(editor.content.value.blocks[0]).toMatchObject({
      content: "<p>Undone</p>",
    });
    expect(ai.messages.value[1]).toMatchObject({ undone: true });
  });
});

describe("useAiFeature with collaboration", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  async function openCollaborative(
    provider: Partial<AiProvider>,
    connected = true,
  ) {
    let revision = 0;
    const submitted: unknown[] = [];
    const handlers: {
      current: Parameters<CollaborationProvider["join"]>[2] | null;
    } = { current: null };
    const collaborationProvider: CollaborationProvider = {
      join: vi.fn(async (_templateId, _session, h) => {
        handlers.current = h;
        return { revision: 0, locks: [], members: [], leave: () => {} };
      }),
      submit: vi.fn(async (_templateId, batch) => {
        submitted.push(batch);
        return { revision: ++revision };
      }),
      operationsAfter: vi.fn(async () => ({ revision, batches: [] })),
    };
    const scope = effectScope();
    const result = scope.run(() => {
      const templates = {
        load: async (id: string): Promise<Template> => ({
          id,
          revision: 0,
          content: safeClone(CONTENT),
        }),
        create: false as const,
        save: false as const,
      };
      const collaboration = useCollaborationFeature({
        provider: collaborationProvider,
        loadTemplate: templates.load,
      });
      const editor = useEditor({
        content: safeClone(CONTENT),
        templates,
        lockedBlocks: collaboration.locks,
      });
      collaboration.attach(editor);
      const ai = useAiFeature({
        provider: { ...off, ...provider } as AiProvider,
        editor,
        collaboration,
        history: () => collaboration.history,
        reload: null,
        mergeTags: () => ({ syntax: "liquid", tags: [] }),
        normalize: (ops) => [...ops],

        commentsOpen: null,
      });
      return { editor, collaboration, ai };
    })!;
    await result.editor.load("tpl-1");
    await settle();
    if (connected) handlers.current?.onConnectionChange("connected");
    return { ...result, submitted, collaborationProvider };
  }

  it("applies through the controller as this user's batch with origin ai, outlined, one undo step", async () => {
    const { ai, collaboration, submitted, editor } = await openCollaborative({
      chat: chatting(async (on) => {
        await on.onOperations(greet);
        await on.onOperations(drop);
      }),
    });

    await ai.send("Greet and tidy");
    await settle();

    expect(submitted).toEqual([
      expect.objectContaining({ origin: "ai", ops: greet }),
      expect.objectContaining({ origin: "ai", ops: drop }),
    ]);
    expect(collaboration.capability.agentHighlightOf("t1")).toEqual(
      expect.any(Number),
    );

    collaboration.history.undo();
    await settle();
    expect(editor.content.value).toEqual(CONTENT);
  });

  it("applies alt text as the user's AI batch with one collaboration undo and no chat", async () => {
    const { ai, editor, collaboration, submitted } = await openCollaborative(
      {},
    );
    editor.addBlock({
      id: "i",
      type: "image",
      src: "https://example.com/i.png",
      alt: "Old",
      decorative: true,
    } as never);
    await settle();
    const before = safeClone(editor.content.value);
    submitted.length = 0;
    await ai.applyAltTexts([{ blockId: "i", alt: "Shop", decorative: false }]);
    await settle();
    expect(submitted).toEqual([
      expect.objectContaining({
        origin: "ai",
        ops: [
          {
            op: "updateBlock",
            blockId: "i",
            set: { alt: "Shop", decorative: false },
            expect: { src: "https://example.com/i.png", alt: "Old", decorative: true },
          },
        ],
      }),
    ]);
    expect(ai.messages.value).toEqual([]);
    collaboration.history.undo();
    await settle();
    expect(editor.content.value).toEqual(before);
  });

  it("sends the revision and the controller's session, and no block the backend lacks (D12)", async () => {
    const chat = chatting(() => {});
    const { ai, editor, collaboration } = await openCollaborative({ chat });
    editor.addBlock({ id: "new", type: "spacer", height: 10 } as never);
    editor.selectBlock("new");

    await ai.send("Hi");

    const [request] = vi.mocked(chat as never as ReturnType<typeof vi.fn>).mock
      .calls[0] as [Record<string, unknown>];
    expect(request).toMatchObject({
      revision: 1,
      sessionId: collaboration.core.sessionId,
      selectedBlockId: "new",
    });
  });

  it("catches up immediately for a server-applied revision while collaboration is disconnected", async () => {
    const { ai, collaboration } = await openCollaborative(
      {
        chat: chatting((on) =>
          on.onApplied({ batchId: "offline", revision: 5, operationCount: 1 }),
        ),
      },
      false,
    );
    const catchUp = vi.spyOn(collaboration.core, "catchUp");
    expect(collaboration.core.connection.value).not.toBe("connected");
    await ai.send("Apply on the server");
    expect(catchUp).toHaveBeenCalledExactlyOnceWith();
    await vi.advanceTimersByTimeAsync(AI_BROADCAST_GRACE_MS);
    expect(catchUp).toHaveBeenCalledTimes(1);
    expect(ai.messages.value.at(-1)).toMatchObject({
      operationCount: 1,
      status: "done",
    });
  });

  it("follows a server-applied revision: at once offline, after the grace with a live channel (D10)", async () => {
    const live = await openCollaborative({
      chat: chatting((on) =>
        on.onApplied({ batchId: "b", revision: 5, operationCount: 1 }),
      ),
    });
    const catchUp = vi.spyOn(live.collaboration.core, "catchUp");

    await live.ai.send("x");
    expect(catchUp).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(AI_BROADCAST_GRACE_MS);
    expect(catchUp).toHaveBeenCalledTimes(1);
  });

  it("does not follow a stale remote replay into B (R1)", async () => {
    const response = deferred<{
      applied: { batchId: string; revision: number };
    }>();
    const { ai, editor, collaboration } = await openCollaborative({
      conversation: {
        settleReplay: async () => {},
        list: async () => [persistedMessage()],
        clear: false,
        undo: () => response.promise,
        redo: false,
      },
    });
    ai.open("chat");
    await settle();
    const pending = ai.undoMessage("persisted");
    await editor.load("tpl-2");
    await settle();
    const catchUp = vi.spyOn(collaboration.core, "catchUp");
    response.resolve({ applied: { batchId: "old", revision: 9 } });
    await pending;
    await vi.advanceTimersByTimeAsync(AI_BROADCAST_GRACE_MS);
    expect(catchUp).not.toHaveBeenCalled();
    expect(editor.state.template?.id).toBe("tpl-2");
    expect(ai.messages.value.at(-1)?.undone).toBe(false);
  });

  it("answers the refusal when another session holds the block", async () => {
    let answer: unknown;
    const { ai, collaboration } = await openCollaborative({
      chat: chatting(async (on) => {
        answer = await on.onOperations(greet);
      }),
    });
    vi.spyOn(collaboration.core, "applyOperations").mockReturnValueOnce({
      applied: false,
      error: Object.assign(new Error("held"), {
        code: "lock_held",
        opIndex: 0,
        name: "OperationError",
      }) as never,
    });

    await ai.send("Greet");

    expect(answer).toEqual({
      applied: false,
      code: "lock_held",
      opIndex: 0,
      message: "held",
    });
  });
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function persistedMessage(id = "persisted", undone = false): AiChatMessage {
  return {
    id,
    role: "assistant",
    kind: "chat",
    text: "Applied.",
    batches: [{ batchId: "batch", revision: null, operationCount: 1 }],
    undone,
    createdAt: "2026-10-21T12:00:00Z",
  };
}

function waitForStop(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const abort = () => reject(new DOMException("Stopped", "AbortError"));
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });
}

async function openReloading() {
  const fetched = deferred<Template>();
  const onLoaded = vi.fn();
  let aLoads = 0;
  const scope = effectScope();
  const result = scope.run(() => {
    const editor = useEditor({
      content: safeClone(CONTENT),
      templates: {
        load: async (id) => {
          if (id === "tpl-1" && ++aLoads > 1) return fetched.promise;
          return { id, content: safeClone(CONTENT) };
        },
        create: false,
        save: false,
        onLoaded,
      },
    });
    const history = useHistory({
      content: editor.content,
      setContent: editor.setContent,
    });
    const ai = useAiFeature({
      provider: {
        ...off,
        chat: chatting((on) =>
          on.onApplied({ batchId: "server", revision: 2, operationCount: 1 }),
        ),
      },
      editor,
      collaboration: null,
      history: () => history,
      reload: (id, shouldApply) => editor.load(id, shouldApply),
      mergeTags: () => ({ syntax: "liquid", tags: [] }),
      normalize: (ops) => [...ops],

      commentsOpen: null,
    });
    return { editor, ai };
  })!;
  await result.editor.load("tpl-1");
  return { ...result, fetched, onLoaded, scope };
}

describe("useAiFeature fix round 1", () => {
  it.each(["undo", "redo"] as const)(
    "discards delayed remote %s operations after switching templates (R1)",
    async (direction) => {
      const response = deferred<{
        operations: Operation[];
        replayId: string;
      }>();
      const replay = vi.fn(() => response.promise);
      const { ai, editor } = await openLocal({
        conversation: {
          settleReplay: async () => {},
          list: async () => [persistedMessage("same-id", direction === "redo")],
          clear: false,
          undo: direction === "undo" ? replay : false,
          redo: direction === "redo" ? replay : false,
        },
      });
      ai.open("chat");
      await settle();
      const pending =
        direction === "undo"
          ? ai.undoMessage("same-id")
          : ai.redoMessage("same-id");
      await editor.load("tpl-2");
      await settle();
      editor.updateBlock("t1", { content: "<p>Template B</p>" } as never);
      const before = safeClone(ai.messages.value);
      response.resolve({ operations: greet, replayId: "replay" });
      await pending;
      expect(editor.state.template?.id).toBe("tpl-2");
      expect(editor.content.value.blocks[0]).toMatchObject({
        content: "<p>Template B</p>",
      });
      expect(ai.messages.value).toEqual(before);
    },
  );

  it("keeps chat history when only the template name changes (generation guard)", async () => {
    const { ai, editor } = await openLocal({
      conversation: {
        settleReplay: async () => {},
        list: async () => [persistedMessage()],
        clear: false,
        undo: false,
        redo: false,
      },
    });
    ai.open("chat");
    await settle();
    const before = safeClone(ai.messages.value);
    editor.setName("Renamed");
    expect(ai.messages.value).toEqual(before);
  });

  it("discards delayed remote replay after reloading the same template (R1)", async () => {
    const response = deferred<{ operations: Operation[]; replayId: string }>();
    const { ai, editor } = await openLocal({
      conversation: {
        settleReplay: async () => {},
        list: async () => [persistedMessage()],
        clear: false,
        undo: () => response.promise,
        redo: false,
      },
    });
    ai.open("chat");
    await settle();
    const pending = ai.undoMessage("persisted");
    await editor.load("tpl-1");
    await settle();
    editor.updateBlock("t1", { content: "<p>Reloaded</p>" } as never);
    response.resolve({ operations: greet, replayId: "replay" });
    await pending;
    expect(editor.content.value.blocks[0]).toMatchObject({
      content: "<p>Reloaded</p>",
    });
    expect(ai.messages.value.at(-1)?.undone).toBe(false);
  });

  it("does not reload a stale remote server replay (R1)", async () => {
    const response = deferred<{
      applied: { batchId: string; revision: number };
    }>();
    const { ai, editor, reload } = await openLocal(
      {
        conversation: {
          settleReplay: async () => {},
          list: async () => [persistedMessage()],
          clear: false,
          undo: () => response.promise,
          redo: false,
        },
      },
      { reload: vi.fn() },
    );
    ai.open("chat");
    await settle();
    const pending = ai.undoMessage("persisted");
    await editor.load("tpl-2");
    await settle();
    response.resolve({ applied: { batchId: "old", revision: 9 } });
    await pending;
    expect(reload).not.toHaveBeenCalled();
    expect(editor.state.template?.id).toBe("tpl-2");
  });

  it("skips a stopped server-applied turn's reload after switching templates (R2)", async () => {
    const { ai, editor, reload, onError } = await openLocal(
      {
        chat: async (_request, on, signal) => {
          on.onApplied({ batchId: "old", revision: 2, operationCount: 1 });
          return waitForStop(signal);
        },
      },
      { reload: vi.fn() },
    );
    const turn = ai.send("Change A");
    await settle();
    await editor.load("tpl-2");
    await turn;
    expect(reload).not.toHaveBeenCalled();
    expect(editor.state.template?.id).toBe("tpl-2");
    expect(ai.messages.value).toEqual([]);
    expect(onError).not.toHaveBeenCalled();
  });

  it("stays busy until its server-applied reload finishes (R2)", async () => {
    const { editor, history, scope } = await openLocal({});
    const reloaded = deferred<void>();
    const ai = scope.run(() =>
      useAiFeature({
        provider: {
          ...off,
          chat: chatting((on) =>
            on.onApplied({ batchId: "server", revision: 2, operationCount: 1 }),
          ),
        },
        editor,
        collaboration: null,
        history: () => history,
        reload: () => reloaded.promise,
        mergeTags: () => ({ syntax: "liquid", tags: [] }),
        normalize: (ops) => [...ops],

        commentsOpen: null,
      }),
    )!;
    const pending = ai.send("Server turn");
    await settle();
    const busyDuringReload = ai.isRunning.value;
    reloaded.resolve();
    await pending;
    expect(busyDuringReload).toBe(true);
    expect(ai.isRunning.value).toBe(false);
    expect(ai.messages.value.at(-1)).toMatchObject({
      operationCount: 1,
      status: "done",
    });
  });

  it.each(["chat", "fixFinding"] as const)(
    "marks %s stopped during its final server reload as unsuccessful",
    async (feature) => {
      const { editor, history, scope } = await openLocal({});
      const reloaded = deferred<void>();
      const reload = vi.fn(() => reloaded.promise);
      const onError = vi.fn();
      const complete = async (_request: unknown, on: AiTurnHandlers) => {
        on.onApplied({
          batchId: "server-final",
          revision: 2,
          operationCount: 1,
        });
        return { messageId: null, text: "Applied on the server." };
      };
      const ai = scope.run(() =>
        useAiFeature({
          provider: { ...off, [feature]: complete } as AiProvider,
          editor,
          collaboration: null,
          history: () => history,
          reload,
          mergeTags: () => ({ syntax: "liquid", tags: [] }),
          normalize: (ops) => [...ops],
          commentsOpen: null,
          onError,
        }),
      )!;
      const pending =
        feature === "chat"
          ? ai.send("Change the template")
          : ai.fix({
              ruleId: "a11y.text-all-caps",
              message: "All caps.",
              suggestion: "Use sentence case.",
              reference: "https://docs.templatical.com/quality/",
              blockId: "t1",
            });
      await settle();
      expect(reload).toHaveBeenCalledTimes(1);
      expect(ai.busy.value).toBe(true);
      ai.stop();
      reloaded.resolve();
      const outcome = await pending;
      expect(outcome).toMatchObject({ failed: true, operationCount: 1 });
      expect(ai.busy.value).toBe(false);
      expect(ai.messages.value.at(-1)).toMatchObject({
        operationCount: 1,
        status: "done",
      });
      expect(onError).not.toHaveBeenCalled();
      scope.stop();
    },
  );

  it("discards a server reload whose fetch resolves after B loaded (R2)", async () => {
    const { ai, editor, fetched, onLoaded } = await openReloading();
    const turn = ai.send("Server turn");
    await settle();
    expect(ai.isRunning.value).toBe(true);
    await editor.load("tpl-2");
    editor.updateBlock("t1", { content: "<p>Template B</p>" } as never);
    const before = safeClone(editor.content.value);
    fetched.resolve({ id: "tpl-1", content: safeClone(CONTENT) });
    await turn;
    expect(editor.state.template?.id).toBe("tpl-2");
    expect(editor.content.value).toEqual(before);
    expect(onLoaded.mock.calls.map(([template]) => template.id)).toEqual([
      "tpl-1",
      "tpl-2",
    ]);
    expect(ai.messages.value).toEqual([]);
    expect(ai.isRunning.value).toBe(false);
  });

  it("keeps the completed turn when its own reload commits (R2 guard)", async () => {
    const { ai, editor, fetched } = await openReloading();
    const turn = ai.send("Server turn");
    await settle();
    const content = safeClone(CONTENT);
    (content.blocks[0] as { content: string }).content =
      "<p>Server version</p>";
    fetched.resolve({ id: "tpl-1", content });
    await turn;
    expect(editor.content.value.blocks[0]).toMatchObject({
      content: "<p>Server version</p>",
    });
    expect(ai.messages.value.at(-1)).toMatchObject({
      operationCount: 1,
      status: "done",
    });
    expect(ai.isRunning.value).toBe(false);
  });

  it("returns the applied count after assigning a persisted assistant id (R3)", async () => {
    const { ai } = await openLocal({
      chat: chatting(
        async (on) => {
          await on.onOperations(greet);
        },
        "Done.",
        "saved-turn",
      ),
      conversation: {
        settleReplay: async () => {},
        list: async () => [],
        clear: false,
        undo: false,
        redo: false,
      },
    });
    const outcome = await ai.send("Greet");
    expect(outcome).toEqual({
      messageId: "saved-turn",
      operationCount: 1,
      text: "Done.",
      failed: false,
    });
    expect(ai.messages.value.at(-1)).toMatchObject({
      id: "saved-turn",
      operationCount: 1,
    });
  });

  it.each(["comments"] as const)(
    "stops a running chat when opening %s (R4)",
    async (destination) => {
      const commentsOpen = ref(false);
      let received: AbortSignal | undefined;
      const { ai, onError } = await openLocal(
        {
          chat: async (_request, _on, signal) => {
            received = signal;
            return waitForStop(signal);
          },
        },
        { commentsOpen },
      );
      ai.open("chat");
      const turn = ai.send("Working");
      await settle();
      if (destination === "comments") commentsOpen.value = true;
      await nextTick();
      const abortedByTransition = received?.aborted;
      ai.stop();
      await turn;
      expect(abortedByTransition).toBe(true);
      expect(ai.panel.value).toBe(null);
      expect(onError).not.toHaveBeenCalled();
    },
  );

  it("waits for pending history before a turn and preserves its row and Undo (R5)", async () => {
    const history = deferred<AiChatMessage[]>();
    const chat = chatting(
      async (on) => {
        await on.onOperations(greet);
      },
      "New reply",
      "new-turn",
    );
    const undo = vi.fn(async () => ({
      operations: [
        { op: "updateBlock", blockId: "t1", set: { content: "<p>Hi</p>" } },
      ] as Operation[],
    }));
    const { ai, editor } = await openLocal({
      chat,
      conversation: {
        settleReplay: async () => {},
        list: () => history.promise,
        clear: false,
        undo,
        redo: false,
      },
    });
    ai.open("chat");
    const turn = ai.send("Greet");
    await settle();
    const callsBeforeHistory = vi.mocked(
      chat as Exclude<AiProvider["chat"], false>,
    ).mock.calls.length;
    history.resolve([persistedMessage("old-turn")]);
    await turn;
    expect(callsBeforeHistory).toBe(0);
    expect(ai.messages.value.at(-1)).toMatchObject({
      id: "new-turn",
      text: "New reply",
      operationCount: 1,
      canUndo: true,
    });
    await ai.undoMessage("new-turn");
    expect(editor.content.value.blocks[0]).toMatchObject({
      content: "<p>Hi</p>",
    });
    expect(undo).toHaveBeenCalledWith("tpl-1", "new-turn", {
      sessionId: expect.any(String),
    });
  });

  it("stops while waiting for history without calling the provider (R5 cancellation)", async () => {
    const history = deferred<AiChatMessage[]>();
    const chat = chatting(() => {});
    const { ai } = await openLocal({
      chat,
      conversation: {
        settleReplay: async () => {},
        list: () => history.promise,
        clear: false,
        undo: false,
        redo: false,
      },
    });
    ai.open("chat");
    let completed = false;
    const turn = ai.send("Wait").then((outcome) => {
      completed = true;
      return outcome;
    });
    await settle();
    ai.stop();
    await settle();
    const completedBeforeHistory = completed;
    history.resolve([]);
    const outcome = await turn;
    expect(outcome).toMatchObject({ messageId: null, failed: true });
    expect(completedBeforeHistory).toBe(true);
    expect(chat).not.toHaveBeenCalled();
    expect(ai.messages.value).toEqual([]);
  });

  it.each(["rejection", "throw"] as const)(
    "retries history %s when the chat reopens (R5)",
    async (failureKind) => {
      const list = vi
        .fn<() => Promise<AiChatMessage[]>>()
        .mockImplementationOnce(() => {
          const error = new Error("History unavailable");
          if (failureKind === "throw") throw error;
          return Promise.reject(error);
        })
        .mockResolvedValueOnce([persistedMessage()]);
      const { ai } = await openLocal({
        conversation: {
          settleReplay: async () => {},
          list,
          clear: false,
          undo: false,
          redo: false,
        },
      });
      ai.open("chat");
      await settle();
      expect(ai.failure.value?.context).toBe("history");
      ai.close();
      ai.open("chat");
      await settle();
      expect(list).toHaveBeenCalledTimes(2);
      expect(ai.messages.value.at(-1)?.id).toBe("persisted");
      expect(ai.failure.value).toBe(null);
    },
  );

  it("invalidates a pending history list when chat is cleared (R5)", async () => {
    const history = deferred<AiChatMessage[]>();
    const { ai } = await openLocal({
      conversation: {
        settleReplay: async () => {},
        list: () => history.promise,
        clear: async () => {},
        undo: false,
        redo: false,
      },
    });
    ai.open("chat");
    await ai.newChat();
    history.resolve([persistedMessage()]);
    await settle();
    expect(ai.messages.value).toEqual([]);
    expect(ai.isLoadingHistory.value).toBe(false);
  });

  it("invalidates pending history on a same-template reload (R5)", async () => {
    const stale = deferred<AiChatMessage[]>();
    const list = vi
      .fn<() => Promise<AiChatMessage[]>>()
      .mockImplementationOnce(() => stale.promise)
      .mockResolvedValue([persistedMessage("new-history")]);
    const { ai, editor } = await openLocal({
      conversation: {
        settleReplay: async () => {},
        list,
        clear: false,
        undo: false,
        redo: false,
      },
    });
    ai.open("chat");
    await editor.load("tpl-1");
    await settle();
    stale.resolve([persistedMessage("stale-history")]);
    await settle();
    expect(ai.messages.value.map((item) => item.id)).toEqual(["new-history"]);
    expect(ai.isLoadingHistory.value).toBe(false);
  });

  it("reconciles partial failures to their persisted id without losing the error (R6)", async () => {
    let persisted = false;
    const error = new SdkError("Try later", 429, "rate_limited");
    const undo = vi.fn(async () => ({
      operations: [
        { op: "updateBlock", blockId: "t1", set: { content: "<p>Hi</p>" } },
      ] as Operation[],
    }));
    const { ai, editor, onError } = await openAiSession(
      {
        chat: async (_request, on) => {
          on.onApplied({
            batchId: "failed-batch",
            revision: 2,
            operationCount: 1,
          });
          persisted = true;
          throw error;
        },
        conversation: {
          settleReplay: async () => {},
          list: async () =>
            persisted
              ? [messageWithBatch("failed-stored", "failed-batch")]
              : [],
          clear: false,
          undo,
          redo: false,
        },
      },
      async (id) => {
        const content = safeClone(CONTENT);
        if (persisted)
          Object.assign(content.blocks[0], { content: "<p>Hello</p>" });
        return { id, content };
      },
    );
    const outcome = await ai.send("Greet");
    expect(outcome).toMatchObject({
      messageId: "failed-stored",
      operationCount: 1,
      failed: true,
    });
    expect(ai.messages.value.at(-1)).toMatchObject({
      id: "failed-stored",
      status: "failed",
      failure: { error, context: "turn" },
      canUndo: true,
    });
    expect(onError).toHaveBeenCalledExactlyOnceWith(error);
    await ai.undoMessage("failed-stored");
    expect(editor.content.value.blocks[0]).toMatchObject({
      content: "<p>Hi</p>",
    });
    expect(undo).toHaveBeenCalledWith("tpl-1", "failed-stored", {
      sessionId: expect.any(String),
    });
  });

  it("keeps earlier failed recovery metadata when another partial turn refreshes history (R6)", async () => {
    const persisted: AiChatMessage[] = [];
    const firstError = new SdkError("First failure", 429, "rate_limited");
    const secondError = new SdkError("Second failure", 429, "rate_limited");
    const { ai } = await openAiSession({
      chat: async (_request, on) => {
        const first = persisted.length === 0;
        on.onApplied({
          batchId: first ? "first-batch" : "second-batch",
          revision: first ? 2 : 3,
          operationCount: 1,
        });
        persisted.push(
          messageWithBatch(
            first ? "first-failed" : "second-failed",
            first ? "first-batch" : "second-batch",
          ),
        );
        throw first ? firstError : secondError;
      },
      conversation: {
        settleReplay: async () => {},
        list: async () => [...persisted],
        clear: false,
        undo: async () => ({ operations: [], replayId: "replay" }),
        redo: false,
      },
    });
    await ai.send("First");
    await ai.send("Second");
    expect(ai.messages.value).toMatchObject([
      {
        id: "first-failed",
        status: "failed",
        failure: { error: firstError, context: "turn" },
        canUndo: true,
      },
      {
        id: "second-failed",
        status: "failed",
        failure: { error: secondError, context: "turn" },
        canUndo: true,
      },
    ]);
  });

  it("reconciles stopped server-applied turns for provider-backed Undo (R6)", async () => {
    let persisted = false;
    const undo = vi.fn(async () => ({ operations: greet, replayId: "replay" }));
    const { ai, onError } = await openLocal(
      {
        chat: async (_request, on, signal) => {
          on.onApplied({ batchId: "server", revision: 2, operationCount: 1 });
          persisted = true;
          return waitForStop(signal);
        },
        conversation: {
          settleReplay: async () => {},
          list: async () =>
            persisted ? [messageWithBatch("stopped-stored", "server")] : [],
          clear: false,
          undo,
          redo: false,
        },
      },
      { reload: vi.fn() },
    );
    const pending = ai.send("Server turn");
    await settle();
    ai.stop();
    const outcome = await pending;
    expect(outcome).toMatchObject({
      messageId: "stopped-stored",
      operationCount: 1,
      failed: true,
    });
    expect(ai.messages.value.at(-1)).toMatchObject({
      id: "stopped-stored",
      status: "done",
      canUndo: true,
    });
    await ai.undoMessage("stopped-stored");
    expect(undo).toHaveBeenCalledWith("tpl-1", "stopped-stored", {
      sessionId: expect.any(String),
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it("offers only the supported direction on stored messages (R7)", async () => {
    const { ai } = await openLocal({
      conversation: {
        settleReplay: async () => {},
        list: async () => [
          persistedMessage("done"),
          persistedMessage("undone", true),
        ],
        clear: false,
        undo: false,
        redo: async () => ({ operations: greet, replayId: "replay" }),
      },
    });
    ai.open("chat");
    await settle();
    expect(ai.messages.value).toMatchObject([
      { id: "done", canUndo: false, canRedo: false },
      { id: "undone", canUndo: false, canRedo: true },
    ]);
    await ai.redoMessage("undone");
    expect(ai.messages.value[1]).toMatchObject({
      undone: false,
      canUndo: false,
      canRedo: false,
    });
  });

  it("recomputes both replay flags after Undo and Redo (R7)", async () => {
    const { ai } = await openLocal({
      conversation: {
        settleReplay: async () => {},
        list: async () => [persistedMessage()],
        clear: false,
        undo: async () => ({ operations: greet, replayId: "replay" }),
        redo: async () => ({ operations: greet, replayId: "replay" }),
      },
    });
    ai.open("chat");
    await settle();
    await ai.undoMessage("persisted");
    expect(ai.messages.value[0]).toMatchObject({
      undone: true,
      canUndo: false,
      canRedo: true,
    });
    await ai.redoMessage("persisted");
    expect(ai.messages.value[0]).toMatchObject({
      undone: false,
      canUndo: true,
      canRedo: false,
    });
  });

  it("rejects unsupported stored Undo instead of using local records (R7)", async () => {
    const { ai, editor, onError } = await openLocal({
      chat: chatting(
        async (on) => {
          await on.onOperations(greet);
        },
        "Done",
        "remote-only",
      ),
      conversation: {
        settleReplay: async () => {},
        list: async () => [],
        clear: false,
        undo: false,
        redo: false,
      },
    });
    await ai.send("Greet");
    await ai.undoMessage("remote-only");
    expect(editor.content.value.blocks[0]).toMatchObject({
      content: "<p>Hello</p>",
    });
    expect(ai.messages.value.at(-1)).toMatchObject({
      undone: false,
      failure: { context: "undo" },
    });
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "feature_unavailable" }),
    );
  });
});

async function openAiSession(
  provider: Partial<AiProvider>,
  loadTemplate: (id: string) => Promise<Template> = async (id) => ({
    id,
    content: safeClone(CONTENT),
  }),
) {
  const scope = effectScope();
  const onError = vi.fn();
  const result = scope.run(() => {
    const editor = useEditor({
      content: safeClone(CONTENT),
      templates: {
        load: loadTemplate,
        create: false,
        save: false,
      },
    });
    const history = useHistory({
      content: editor.content,
      setContent: editor.setContent,
    });
    const ai = useAiFeature({
      provider: { ...off, ...provider } as AiProvider,
      editor,
      collaboration: null,
      history: () => history,
      reload: (id, shouldApply) => editor.load(id, shouldApply),
      mergeTags: () => ({ syntax: "liquid", tags: [] }),
      normalize: (ops) => [...ops],

      commentsOpen: null,
      onError,
    });
    return { editor, history, ai };
  })!;
  await result.editor.load("tpl-1");
  return { ...result, scope, onError };
}

function messageWithBatch(id: string, batchId: string): AiChatMessage {
  return {
    ...persistedMessage(id),
    batches: [{ batchId, revision: 2, operationCount: 1 }],
  };
}

describe("useAiFeature fix round 2", () => {
  it("ignores a double-clicked Undo while the first replay runs (F3)", async () => {
    const response = deferred<{ operations: Operation[]; replayId: string }>();
    const undo = vi.fn(() => response.promise);
    const { ai, editor } = await openLocal({
      conversation: {
        settleReplay: async () => {},
        list: async () => [persistedMessage()],
        clear: false,
        undo,
        redo: false,
      },
    });
    ai.open("chat");
    await settle();
    const first = ai.undoMessage("persisted");
    const second = ai.undoMessage("persisted");
    await settle();
    const callsDuringReplay = undo.mock.calls.length;
    const busyDuringReplay = ai.isRunning.value;
    response.resolve({ operations: greet, replayId: "replay" });
    await Promise.all([first, second]);
    expect(callsDuringReplay).toBe(1);
    expect(busyDuringReplay).toBe(true);
    expect(editor.content.value.blocks[0]).toMatchObject({
      content: "<p>Hello</p>",
    });
    expect(ai.isRunning.value).toBe(false);
  });

  it("queues a send behind a delayed clear and retains the new turn (F4)", async () => {
    const cleared = deferred<void>();
    const chat = chatting(async (on) => {
      await on.onOperations(greet);
    });
    const { ai, editor } = await openLocal({
      chat,
      conversation: {
        settleReplay: async () => {},
        list: async () => [],
        clear: () => cleared.promise,
        undo: false,
        redo: false,
      },
    });
    ai.open("chat");
    await settle();
    const clear = ai.newChat();
    const turn = ai.send("New conversation");
    await settle();
    const prematureCalls = vi.mocked(chat as Exclude<AiProvider["chat"], false>)
      .mock.calls.length;
    cleared.resolve();
    await Promise.all([clear, turn]);
    expect(prematureCalls).toBe(0);
    expect(ai.messages.value.at(-1)).toMatchObject({
      role: "assistant",
      status: "done",
      operationCount: 1,
    });
    expect(editor.content.value.blocks[0]).toMatchObject({
      content: "<p>Hello</p>",
    });
    expect(ai.isRunning.value).toBe(false);
  });

  it("invalidates a history read requested during a pending clear (F4)", async () => {
    const cleared = deferred<void>();
    const oldRead = deferred<AiChatMessage[]>();
    let serverCleared = false;
    const list = vi.fn(async () => (serverCleared ? [] : oldRead.promise));
    const { ai } = await openLocal({
      conversation: {
        settleReplay: async () => {},
        list,
        clear: async () => {
          await cleared.promise;
          serverCleared = true;
        },
        undo: false,
        redo: false,
      },
    });
    const clear = ai.newChat();
    ai.open("chat");
    await settle();
    const readsBeforeClear = list.mock.calls.length;
    cleared.resolve();
    await clear;
    oldRead.resolve([persistedMessage("cleared-row")]);
    await settle();
    expect(readsBeforeClear).toBe(0);
    expect(ai.messages.value).toEqual([]);
    expect(ai.isLoadingHistory.value).toBe(false);
  });

  it("keeps a rename during a pending reload in the same conversation (F1)", async () => {
    const { ai, editor, fetched } = await openReloading();
    const turn = ai.send("Server turn");
    await settle();
    editor.setName("Renamed while loading");
    const content = safeClone(CONTENT);
    (content.blocks[0] as { content: string }).content =
      "<p>Server version</p>";
    fetched.resolve({ id: "tpl-1", name: "Renamed while loading", content });
    await turn;
    expect(editor.content.value.blocks[0]).toMatchObject({
      content: "<p>Server version</p>",
    });
    expect(ai.messages.value.at(-1)).toMatchObject({
      role: "assistant",
      status: "done",
      operationCount: 1,
    });
  });

  it("keeps loading owned by the newer request after a stale discard (F2)", async () => {
    const oldResponse = deferred<Template>();
    const newResponse = deferred<Template>();
    const editor = useEditor({
      content: safeClone(CONTENT),
      templates: {
        load: async (id) =>
          id === "old"
            ? oldResponse.promise
            : id === "new"
              ? newResponse.promise
              : { id, content: safeClone(CONTENT) },
        create: false,
        save: false,
      },
    });
    const old = editor.load("old", () => false);
    await editor.load("middle");
    const current = editor.load("new");
    oldResponse.resolve({ id: "old", content: safeClone(CONTENT) });
    await old;
    const loadingAfterDiscard = editor.state.isLoading;
    newResponse.resolve({ id: "new", content: safeClone(CONTENT) });
    await current;
    expect(loadingAfterDiscard).toBe(true);
    expect(editor.state.isLoading).toBe(false);
    expect(editor.state.template?.id).toBe("new");
  });

  it("recovers this turn by its batch instead of the latest session's message (F5)", async () => {
    let persisted = false;
    const undo = vi.fn(async () => ({ operations: greet, replayId: "replay" }));
    const { ai } = await openLocal(
      {
        chat: async (_request, on) => {
          on.onApplied({
            batchId: "our-batch",
            revision: 2,
            operationCount: 1,
          });
          persisted = true;
          throw new SdkError("Partial failure", 502, "ai_provider_error");
        },
        conversation: {
          settleReplay: async () => {},
          list: async () =>
            persisted
              ? [
                  messageWithBatch("ours", "our-batch"),
                  messageWithBatch("theirs", "their-batch"),
                ]
              : [],
          clear: false,
          undo,
          redo: false,
        },
      },
      { reload: vi.fn() },
    );
    const outcome = await ai.send("Our turn");
    expect(outcome.messageId).toBe("ours");
    expect(ai.messages.value.find((item) => item.id === "ours")).toMatchObject({
      status: "failed",
      failure: { context: "turn" },
    });
    expect(
      ai.messages.value.find((item) => item.id === "theirs"),
    ).toMatchObject({ status: "done" });
    await ai.undoMessage(outcome.messageId!);
    expect(undo).toHaveBeenCalledWith("tpl-1", "ours", {
      sessionId: expect.any(String),
    });
  });

  it("retains unresolved recovery after a rejected list and a later partial turn (F6)", async () => {
    let turnNumber = 0;
    let rejected = false;
    const errors = [
      new SdkError("First failure", 502, "ai_provider_error"),
      new SdkError("Second failure", 502, "ai_provider_error"),
    ];
    const { ai } = await openLocal(
      {
        chat: async (_request, on) => {
          turnNumber++;
          on.onApplied({
            batchId: `batch-${turnNumber}`,
            revision: turnNumber,
            operationCount: 1,
          });
          throw errors[turnNumber - 1];
        },
        conversation: {
          settleReplay: async () => {},
          list: async () => {
            if (turnNumber === 0) return [];
            if (!rejected) {
              rejected = true;
              throw new Error("History unavailable");
            }
            return Array.from({ length: turnNumber }, (_, index) =>
              messageWithBatch(`stored-${index + 1}`, `batch-${index + 1}`),
            );
          },
          clear: false,
          undo: async () => ({ operations: greet, replayId: "replay" }),
          redo: false,
        },
      },
      { reload: vi.fn() },
    );
    await ai.send("First");
    await ai.send("Second");
    expect(
      ai.messages.value.find((item) => item.id === "stored-1"),
    ).toMatchObject({
      status: "failed",
      failure: { error: errors[0], context: "turn" },
      canUndo: true,
    });
    expect(
      ai.messages.value.find((item) => item.id === "stored-2"),
    ).toMatchObject({
      status: "failed",
      failure: { error: errors[1], context: "turn" },
      canUndo: true,
    });
  });

  it("retries a rejected recovery list when chat reopens (F6 retry)", async () => {
    let applied = false;
    let recoveryRejected = false;
    const list = vi.fn(async () => {
      if (!applied) return [];
      if (!recoveryRejected) {
        recoveryRejected = true;
        throw new Error("Recovery unavailable");
      }
      return [messageWithBatch("recovered-on-reopen", "retry-batch")];
    });
    const error = new SdkError("Partial failure", 502, "ai_provider_error");
    const { ai } = await openLocal(
      {
        chat: async (_request, on) => {
          on.onApplied({
            batchId: "retry-batch",
            revision: 2,
            operationCount: 1,
          });
          applied = true;
          throw error;
        },
        conversation: {
          settleReplay: async () => {},
          list,
          clear: false,
          undo: async () => ({ operations: greet, replayId: "replay" }),
          redo: false,
        },
      },
      { reload: vi.fn() },
    );
    await ai.send("Partial turn");
    expect(ai.messages.value.at(-1)).toMatchObject({
      status: "failed",
      failure: { error },
    });
    ai.close();
    ai.open("chat");
    await settle();
    expect(list).toHaveBeenCalledTimes(3);
    expect(ai.messages.value.at(-1)).toMatchObject({
      id: "recovered-on-reopen",
      status: "failed",
      failure: { error },
      canUndo: true,
    });
  });

  it("finalizes A's remembered row after cancellation while B is loaded (F7)", async () => {
    const { ai, editor } = await openLocal({
      chat: async (_request, on, signal) => {
        await on.onOperations(greet);
        return waitForStop(signal);
      },
    });
    const turn = ai.send("Change A");
    await settle();
    await editor.load("tpl-2");
    await turn;
    expect(ai.messages.value).toEqual([]);
    await editor.load("tpl-1");
    ai.open("chat");
    await settle();
    expect(ai.messages.value.at(-1)).toMatchObject({
      status: "done",
      operationCount: 1,
      canUndo: true,
    });
  });

  it("queues a turn through remote replay and its reload (lane)", async () => {
    const response = deferred<{
      applied: { batchId: string; revision: number };
    }>();
    const fetched = deferred<Template>();
    let loads = 0;
    const chat = chatting(() => {}, "New reply");
    const { ai } = await openAiSession(
      {
        chat,
        conversation: {
          settleReplay: async () => {},
          list: async () => [persistedMessage()],
          clear: false,
          undo: () => response.promise,
          redo: false,
        },
      },
      async (id) =>
        ++loads === 1 ? { id, content: safeClone(CONTENT) } : fetched.promise,
    );
    ai.open("chat");
    await settle();
    const replay = ai.undoMessage("persisted");
    const turn = ai.send("After Undo");
    await settle();
    const beforeReplay = vi.mocked(chat as Exclude<AiProvider["chat"], false>)
      .mock.calls.length;
    response.resolve({ applied: { batchId: "replay", revision: 2 } });
    await settle();
    const beforeReload = vi.mocked(chat as Exclude<AiProvider["chat"], false>)
      .mock.calls.length;
    const content = safeClone(CONTENT);
    (content.blocks[0] as { content: string }).content =
      "<p>Reloaded replay</p>";
    fetched.resolve({ id: "tpl-1", content });
    await Promise.all([replay, turn]);
    expect(beforeReplay).toBe(0);
    expect(beforeReload).toBe(0);
    expect(chat).toHaveBeenCalledWith(
      expect.objectContaining({ content }),
      expect.any(Object),
      expect.any(AbortSignal),
    );
    expect(ai.messages.value.at(-1)).toMatchObject({
      text: "New reply",
      status: "done",
    });
  });

  it("stops a pending replay and ignores its eventual operations (lane Stop)", async () => {
    const response = deferred<{ operations: Operation[]; replayId: string }>();
    const { ai, editor, onError } = await openLocal({
      conversation: {
        settleReplay: async () => {},
        list: async () => [persistedMessage()],
        clear: false,
        undo: () => response.promise,
        redo: false,
      },
    });
    ai.open("chat");
    await settle();
    const replay = ai.undoMessage("persisted");
    await settle();
    ai.stop();
    await settle();
    response.resolve({ operations: greet, replayId: "replay" });
    await replay;
    expect(editor.content.value).toEqual(CONTENT);
    expect(ai.messages.value.at(-1)?.undone).toBe(false);
    expect(ai.isRunning.value).toBe(false);
    expect(onError).not.toHaveBeenCalled();
  });

  it("retains the local failed row when no persisted identity is known (F5 safe fallback)", async () => {
    let persisted = false;
    const undo = vi.fn(async () => ({ operations: greet, replayId: "replay" }));
    const { ai, editor } = await openLocal({
      chat: async (_request, on) => {
        await on.onOperations(greet);
        persisted = true;
        throw new SdkError("Local partial failure", 502, "ai_provider_error");
      },
      conversation: {
        settleReplay: async () => {},
        list: async () =>
          persisted ? [messageWithBatch("other-session", "unknown-batch")] : [],
        clear: false,
        undo,
        redo: false,
      },
    });
    const outcome = await ai.send("Our local edit");
    expect(outcome.messageId).not.toBe("other-session");
    expect(
      ai.messages.value.find((item) => item.id === outcome.messageId),
    ).toMatchObject({
      status: "failed",
      operationCount: 1,
      failure: { context: "turn" },
    });
    await ai.undoMessage(outcome.messageId!);
    expect(undo).not.toHaveBeenCalled();
    expect(editor.content.value.blocks[0]).toMatchObject({
      content: "<p>Hi</p>",
    });
  });
});

describe("useAiFeature fix round 3", () => {
  it.each([
    ["undo", "stop"],
    ["redo", "stop"],
    ["undo", "failure"],
    ["redo", "failure"],
  ] as const)(
    "retains acknowledged %s direction when reload encounters %s (F1)",
    async (direction, ending) => {
      const fetched = deferred<Template>();
      let loads = 0;
      const remote = vi.fn(async () => ({
        applied: { batchId: "replayed-batch", revision: 3 },
      }));
      const { ai, editor, onError } = await openAiSession(
        {
          conversation: {
            settleReplay: async () => {},
            list: async () => [
              persistedMessage("replayed", direction === "redo"),
            ],
            clear: false,
            undo:
              direction === "undo"
                ? remote
                : async () => ({ operations: [], replayId: "replay" }),
            redo:
              direction === "redo"
                ? remote
                : async () => ({ operations: [], replayId: "replay" }),
          },
        },
        async (id) =>
          ++loads === 1 ? { id, content: safeClone(CONTENT) } : fetched.promise,
      );
      ai.open("chat");
      await settle();
      const pending =
        direction === "undo"
          ? ai.undoMessage("replayed")
          : ai.redoMessage("replayed");
      await settle();
      const acknowledged = { ...ai.messages.value.at(-1) };
      const content = safeClone(CONTENT);
      Object.assign(content.blocks[0], { content: "<p>After replay</p>" });
      const error = new Error("Reload unavailable");
      if (ending === "stop") {
        ai.stop();
        fetched.resolve({ id: "tpl-1", content });
      } else {
        fetched.reject(error);
      }
      await pending;
      const expected = {
        undone: direction === "undo",
        canUndo: direction === "redo",
        canRedo: direction === "undo",
      };
      expect(acknowledged).toMatchObject(expected);
      expect(ai.messages.value.at(-1)).toMatchObject(expected);
      expect(editor.content.value).toEqual(
        ending === "stop" ? content : CONTENT,
      );
      if (direction === "undo") await ai.undoMessage("replayed");
      else await ai.redoMessage("replayed");
      expect(remote).toHaveBeenCalledTimes(1);
      expect(ai.busy.value).toBe(false);
      if (ending === "stop") expect(onError).not.toHaveBeenCalled();
      else expect(onError).toHaveBeenCalledExactlyOnceWith(error);
    },
  );

  it("lets B load history and send before A's recovery list settles (F2)", async () => {
    const recoveredA = deferred<AiChatMessage[]>();
    let partial = false;
    const list = vi.fn(async (id: string) =>
      id === "tpl-1"
        ? partial
          ? recoveredA.promise
          : []
        : [persistedMessage("b-old")],
    );
    const chat = vi.fn(async (request, on: AiTurnHandlers) => {
      if (request.templateId === "tpl-1") {
        on.onApplied({ batchId: "a-batch", revision: 2, operationCount: 1 });
        partial = true;
        throw new SdkError("A partially failed", 502, "ai_provider_error");
      }
      await on.onOperations(greet);
      return { messageId: "b-new", text: "B reply" };
    });
    const { ai, editor } = await openLocal(
      {
        chat,
        conversation: {
          settleReplay: async () => {},
          list,
          clear: false,
          undo: false,
          redo: false,
        },
      },
      { reload: vi.fn() },
    );
    ai.open("chat");
    await settle();
    const aTurn = ai.send("A turn");
    await settle();
    await editor.load("tpl-2");
    const bTurn = ai.send("B turn");
    await settle();
    const bReadBeforeASettled = list.mock.calls.some(([id]) => id === "tpl-2");
    const bSentBeforeASettled = chat.mock.calls.some(
      ([request]) => request.templateId === "tpl-2",
    );
    const bRowsBeforeASettled = ai.messages.value.map((item) => item.id);
    recoveredA.resolve([messageWithBatch("a-recovered", "a-batch")]);
    await Promise.all([aTurn, bTurn]);
    await settle();
    expect(bReadBeforeASettled).toBe(true);
    expect(bSentBeforeASettled).toBe(true);
    expect(bRowsBeforeASettled).toContain("b-new");
    expect(ai.messages.value.map((item) => item.id)).toEqual(
      bRowsBeforeASettled,
    );
    expect(editor.state.template?.id).toBe("tpl-2");
    expect(editor.content.value.blocks[0]).toMatchObject({
      content: "<p>Hello</p>",
    });
  });

  it("forgets A's recovery memory when its clear succeeds after switching to B (F3)", async () => {
    const cleared = deferred<void>();
    let partial = false;
    let aCleared = false;
    const { ai, editor } = await openLocal({
      chat: async (_request, on) => {
        await on.onOperations(greet);
        partial = true;
        throw new SdkError("Unresolved A failure", 502, "ai_provider_error");
      },
      conversation: {
        settleReplay: async () => {},
        list: async (id) => {
          if (id === "tpl-2") return [persistedMessage("b-row")];
          if (partial && !aCleared) throw new Error("A recovery unavailable");
          return [];
        },
        clear: async () => {
          await cleared.promise;
          aCleared = true;
        },
        undo: async () => ({ operations: [], replayId: "replay" }),
        redo: false,
      },
    });
    ai.open("chat");
    await settle();
    await ai.send("Partial A");
    expect(ai.messages.value.at(-1)).toMatchObject({ status: "failed" });
    const clear = ai.newChat();
    await settle();
    await editor.load("tpl-2");
    await settle();
    cleared.resolve();
    await clear;
    await settle();
    const bRows = safeClone(ai.messages.value);
    expect(bRows.map((item) => item.id)).toEqual(["b-row"]);
    await editor.load("tpl-1");
    await settle();
    expect(ai.messages.value).toEqual([]);
    await editor.load("tpl-2");
    await settle();
    expect(ai.messages.value).toEqual(bRows);
  });

  it("prevents bootstraps, later loads and enqueues after destroy (F4)", async () => {
    const history = deferred<AiChatMessage[]>();
    const list = vi.fn(() => history.promise);
    const chat = chatting(() => {});
    const { ai, editor } = await openLocal({
      chat,
      conversation: {
        settleReplay: async () => {},
        list,
        clear: false,
        undo: false,
        redo: false,
      },
    });
    ai.open("chat");
    await settle();
    expect(list).toHaveBeenCalledTimes(1);
    expect(ai.isAvailable.value).toBe(true);
    ai.destroy();
    const availableAfterDestroy = ai.isAvailable.value;
    await settle();
    history.resolve([]);
    await settle();
    await editor.load("tpl-2");
    await settle();
    const busyStates: boolean[] = [];
    const watchBusy = watch(ai.busy, (value) => busyStates.push(value), {
      flush: "sync",
    });
    await ai.send("After destroy");
    ai.open("chat");
    await settle();
    watchBusy();
    expect(list).toHaveBeenCalledTimes(1);
    expect(chat).not.toHaveBeenCalled();
    expect(availableAfterDestroy).toBe(false);
    expect(ai.isAvailable.value).toBe(false);
    expect(ai.busy.value).toBe(false);
    expect(busyStates).not.toContain(true);
  });
});

describe("useAiFeature fix round 4", () => {
  it("keeps a server Undo acknowledgement after closing chat and synchronizes before releasing the lane", async () => {
    const response = deferred<{
      applied: { batchId: string; revision: number };
    }>();
    const fetched = deferred<Template>();
    const undo = vi.fn(() => response.promise);
    const list = vi.fn(async () => [persistedMessage("closed-replay")]);
    let loads = 0;
    const { ai, editor, onError } = await openAiSession(
      {
        conversation: {
          settleReplay: async () => {},
          list,
          clear: false,
          undo,
          redo: async () => ({ operations: [], replayId: "replay" }),
        },
      },
      async (id) =>
        ++loads === 1 ? { id, content: safeClone(CONTENT) } : fetched.promise,
    );
    ai.open("chat");
    await settle();
    const replay = ai.undoMessage("closed-replay");
    await settle();
    ai.close();
    await settle();
    const busyBeforeAcknowledgement = ai.busy.value;
    response.resolve({ applied: { batchId: "closed-undo", revision: 3 } });
    await settle();
    const busyDuringReload = ai.busy.value;
    const directionDuringReload = { ...ai.messages.value.at(-1) };
    const content = safeClone(CONTENT);
    Object.assign(content.blocks[0], { content: "<p>Undone remotely</p>" });
    fetched.resolve({ id: "tpl-1", content });
    await replay;
    expect(busyBeforeAcknowledgement).toBe(true);
    expect(busyDuringReload).toBe(true);
    expect(directionDuringReload).toMatchObject({
      undone: true,
      canUndo: false,
      canRedo: true,
    });
    expect(editor.content.value).toEqual(content);
    expect(ai.messages.value.at(-1)).toMatchObject({
      id: "closed-replay",
      undone: true,
      canUndo: false,
      canRedo: true,
    });
    expect(ai.busy.value).toBe(false);
    expect(ai.panel.value).toBeNull();
    ai.open("chat");
    await settle();
    expect(editor.content.value).toEqual(content);
    expect(ai.messages.value.at(-1)).toMatchObject({
      id: "closed-replay",
      undone: true,
      canUndo: false,
      canRedo: true,
    });
    expect(list).toHaveBeenCalledTimes(1);
    await ai.undoMessage("closed-replay");
    expect(undo).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("discards client Undo operations returned after closing chat and retains Undo on reopening", async () => {
    const response = deferred<{ operations: Operation[]; replayId: string }>();
    const undo = vi.fn(() => response.promise);
    const list = vi.fn(async () => [persistedMessage("closed-replay")]);
    const load = vi.fn(async (id: string) => ({
      id,
      content: safeClone(CONTENT),
    }));
    const { ai, editor, onError } = await openAiSession(
      {
        conversation: {
          settleReplay: async () => {},
          list,
          clear: false,
          undo,
          redo: async () => ({ operations: [], replayId: "replay" }),
        },
      },
      load,
    );
    ai.open("chat");
    await settle();
    const replay = ai.undoMessage("closed-replay");
    await settle();
    ai.close();
    await settle();
    const busyBeforeResponse = ai.busy.value;
    response.resolve({ operations: greet, replayId: "replay" });
    await replay;
    expect(busyBeforeResponse).toBe(true);
    expect(editor.content.value).toEqual(CONTENT);
    expect(ai.messages.value.at(-1)).toMatchObject({
      id: "closed-replay",
      undone: false,
      canUndo: true,
      canRedo: false,
    });
    expect(ai.busy.value).toBe(false);
    expect(ai.panel.value).toBeNull();
    ai.open("chat");
    await settle();
    expect(editor.content.value).toEqual(CONTENT);
    expect(ai.messages.value.at(-1)).toMatchObject({
      id: "closed-replay",
      undone: false,
      canUndo: true,
      canRedo: false,
    });
    expect(list).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledTimes(1);
    expect(undo).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });
});

describe("final fix: replay settlement", () => {
  it.each([true, false])(
    "settles the actual application result %s inside the lane",
    async (accept) => {
      const finished = deferred<void>();
      const settleReplay = vi.fn(() => finished.promise);
      const { ai, editor, onError } = await openLocal({
        conversation: {
          list: async () => [persistedMessage()],
          clear: false,
          redo: false,
          settleReplay,
          undo: async () => ({
            replayId: "r1",
            operations: accept
              ? greet
              : [
                  {
                    op: "updateBlock",
                    blockId: "t1",
                    set: { content: "x" },
                    expect: { content: "changed" },
                  },
                ],
          }),
        },
      });
      ai.open("chat");
      await settle();
      const replay = ai.undoMessage("persisted");
      await settle();
      expect(settleReplay).toHaveBeenCalledWith("tpl-1", "persisted", {
        replayId: "r1",
        direction: "undo",
        applied: accept,
        sessionId: expect.any(String),
      });
      expect(ai.busy.value).toBe(true);
      finished.resolve();
      await replay;
      expect(ai.messages.value.at(-1)?.undone).toBe(accept);
      expect(editor.content.value.blocks[0]).toMatchObject({
        content: accept ? "<p>Hello</p>" : "<p>Hi</p>",
      });
      expect(onError).toHaveBeenCalledTimes(accept ? 0 : 1);
    },
  );
  it("reports settlement failure while retaining the applied local direction", async () => {
    const error = new Error("Settlement failed");
    const { ai, editor, onError } = await openLocal({
      conversation: {
        list: async () => [persistedMessage()],
        clear: false,
        redo: false,
        undo: async () => ({ operations: greet, replayId: "r1" }),
        settleReplay: async () => {
          throw error;
        },
      },
    });
    ai.open("chat");
    await settle();
    await ai.undoMessage("persisted");
    expect(editor.content.value.blocks[0]).toMatchObject({
      content: "<p>Hello</p>",
    });
    expect(ai.messages.value.at(-1)).toMatchObject({
      undone: true,
      canRedo: false,
    });
    expect(onError).toHaveBeenCalledWith(error);
  });
  it("does not settle an abandoned session's late replay", async () => {
    const response = deferred<{ operations: Operation[]; replayId: string }>();
    const settleReplay = vi.fn(async () => {});
    const { ai, editor } = await openLocal({
      conversation: {
        list: async () => [persistedMessage()],
        clear: false,
        redo: false,
        settleReplay,
        undo: () => response.promise,
      },
    });
    ai.open("chat");
    await settle();
    const pending = ai.undoMessage("persisted");
    await settle();
    await editor.load("tpl-2");
    response.resolve({ operations: greet, replayId: "r1" });
    await pending;
    expect(settleReplay).not.toHaveBeenCalled();
    expect(editor.content.value).toEqual(CONTENT);
  });
  it("never settles a server-applied replay", async () => {
    const settleReplay = vi.fn(async () => {});
    const { ai, reload } = await openLocal(
      {
        conversation: {
          list: async () => [persistedMessage()],
          clear: false,
          redo: false,
          settleReplay,
          undo: async () => ({ applied: { batchId: "b", revision: 3 } }),
        },
      },
      { reload: async () => {} },
    );
    ai.open("chat");
    await settle();
    await ai.undoMessage("persisted");
    expect(reload).toHaveBeenCalled();
    expect(settleReplay).not.toHaveBeenCalled();
  });
});

it("undoes a stored merge-tag paragraph turn over the HTTP wire with editor normalization", async () => {
  const handle = createReferenceHandler({
    async *stream({ messages }) {
      if (messages.at(-1)?.role === "tool") {
        yield { type: "text", text: "Done" };
        return;
      }
      yield {
        type: "tool-call",
        id: "tags",
        name: "apply_operations",
        input: {
          ops: JSON.stringify([
            {
              op: "updateBlock",
              blockId: "p1",
              set: { content: "<p>Hello {{first_name}}</p>" },
            },
          ]),
        },
      };
    },
  });
  vi.stubGlobal("fetch", (input: string, init: RequestInit) =>
    handle(new Request(input, init)),
  );
  try {
    const provider = createHttpAiProvider({ baseUrl: "https://example.test" });
    const { ai, editor, onError } = await openLocal(provider);
    const turn = await ai.send("Greet the reader");
    expect(turn.operationCount).toBe(1);
    expect(
      (editor.content.value.blocks[1] as { content: string }).content,
    ).toContain('data-merge-tag="{{first_name}}"');
    await ai.undoMessage(turn.messageId!);
    expect(editor.content.value.blocks[1]).toMatchObject({
      content: "<p>Body</p>",
    });
    expect(ai.messages.value.at(-1)?.undone).toBe(true);
    expect((await provider.conversation!.list("tpl-1")).at(-1)?.undone).toBe(
      true,
    );
    expect(onError).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});

it("pre-checks UTF-8 content bytes before send reaches a provider", async () => {
  const chat = chatting(() => {});
  const { ai, editor } = await openLocal({ chat });
  editor.updateBlock("p1", { content: "é".repeat(100_000) } as never);
  await ai.send("Hi");
  expect(ai.failure.value?.error).toMatchObject({
    code: "content_too_large",
    statusCode: 413,
  });
  expect(chat).not.toHaveBeenCalled();
});

it("reloads a stopped HTTP turn after its buffered applied fact arrives", async () => {
  const bytes = new TextEncoder().encode(
    [
      { type: "text", text: "Starting" },
      { type: "operations", ops: greet },
      {
        type: "applied",
        batchId: "stopped-applied",
        revision: 2,
        operationCount: 1,
      },
      { type: "done", messageId: null },
    ]
      .map((event) => `data: ${JSON.stringify(event)}\n\n`)
      .join(""),
  );
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(bytes);
            controller.close();
          },
        }),
      ),
  );
  try {
    const http = createHttpAiProvider({
      baseUrl: "https://example.test",
      features: { conversation: false },
    });
    let stop = () => {};
    const { ai, reload, editor, onError } = await openLocal(
      {
        chat: (request, on, signal) =>
          (http.chat as Exclude<AiProvider["chat"], false>)(
            request,
            {
              ...on,
              onText: (text) => {
                on.onText(text);
                stop();
              },
            },
            signal,
          ),
      },
      { reload: async () => {} },
    );
    stop = ai.stop;
    await ai.send("Change background");
    // The already-received fact can finish draining after Stop releases send.
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(editor.content.value).toEqual(CONTENT);
    expect(ai.messages.value.at(-1)).toMatchObject({
      operationCount: 1,
      status: "done",
    });
    expect(onError).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});

it("replays a mock merge-tag turn with guarded Redo and refuses a later user edit", async () => {
  const provider = createMockAiProvider({
    conversation: true,
    chat: [
      {
        events: [
          {
            type: "operations",
            ops: [
              {
                op: "updateBlock",
                blockId: "p1",
                set: { content: "<p>Hello {{first_name}}</p>" },
              },
            ],
          },
          { type: "done", messageId: null },
        ],
      },
    ],
  });
  const { ai, editor, onError } = await openLocal(provider);
  const turn = await ai.send("Greet");
  await ai.undoMessage(turn.messageId!);
  expect(editor.content.value.blocks[1]).toMatchObject({
    content: "<p>Body</p>",
  });
  await ai.redoMessage(turn.messageId!);
  expect(ai.messages.value.at(-1)?.undone).toBe(false);
  expect(onError).not.toHaveBeenCalled();
  await ai.undoMessage(turn.messageId!);
  editor.updateBlock("p1", { content: "<p>User edit</p>" } as never);
  await ai.redoMessage(turn.messageId!);
  expect(editor.content.value.blocks[1]).toMatchObject({
    content: "<p>User edit</p>",
  });
  expect((await provider.conversation!.list("tpl-1")).at(-1)?.undone).toBe(
    true,
  );
});

it.each(["stop", "close"] as const)(
  "releases the lane on %s even when a provider ignores abort",
  async (action) => {
    const pending = deferred<{ messageId: string | null; text: string }>();
    const { ai } = await openLocal({ chat: () => pending.promise });
    let done = false;
    const turn = ai.send("Waiting").then(() => {
      done = true;
    });
    await settle();
    ai[action]();
    await settle();
    expect(done).toBe(true);
    expect(ai.busy.value).toBe(false);
    pending.resolve({ messageId: null, text: "Late" });
    await turn;
  },
);

it("serializes a late server fact's reload ahead of the next turn", async () => {
  const waiting = deferred<{ messageId: string | null; text: string }>();
  const loaded = deferred<void>();
  let handlers!: AiTurnHandlers;
  let calls = 0;
  const chat = vi.fn(async (_request, on: AiTurnHandlers) => {
    if (calls++ === 0) {
      handlers = on;
      return waiting.promise;
    }
    return { messageId: null, text: "Next" };
  });
  const { ai, reload, onError } = await openLocal(
    { chat },
    { reload: async () => {} },
  );
  reload.mockImplementation(() => loaded.promise);
  const first = ai.send("First");
  await settle();
  ai.stop();
  await first;
  handlers.onApplied({ batchId: "late", revision: 3, operationCount: 1 });
  const next = ai.send("Next");
  await settle();
  expect(reload).toHaveBeenCalledTimes(1);
  expect(chat).toHaveBeenCalledTimes(1);
  expect(ai.busy.value).toBe(true);
  ai.stop();
  loaded.resolve();
  await next;
  expect(onError).not.toHaveBeenCalled();
  waiting.resolve({ messageId: null, text: "Ignored" });
});

it("ignores settlement errors after the requesting session was abandoned", async () => {
  const settled = deferred<void>();
  const { ai, editor, onError } = await openLocal({
    conversation: {
      list: async () => [persistedMessage()],
      clear: false,
      redo: false,
      undo: async () => ({ operations: greet, replayId: "r" }),
      settleReplay: () => settled.promise,
    },
  });
  ai.open("chat");
  await settle();
  const replay = ai.undoMessage("persisted");
  await settle();
  await editor.load("tpl-2");
  await replay;
  await settle();
  settled.reject(new Error("Old session settlement failed"));
  await settle();
  expect(ai.messages.value.at(-1)?.undone).toBe(false);
  expect(editor.content.value).toEqual(CONTENT);
  expect(onError).not.toHaveBeenCalled();
});

it("reloads again when another applied fact arrives during stopped-turn cleanup", async () => {
  const firstReload = deferred<Template>();
  const firstContent = safeClone(CONTENT);
  const latestContent = safeClone(CONTENT);
  Object.assign(firstContent.blocks[0], {
    content: "<p>First server revision</p>",
  });
  Object.assign(latestContent.blocks[0], {
    content: "<p>Latest server revision</p>",
  });
  let handlers!: AiTurnHandlers;
  let loads = 0;
  const { ai, editor } = await openAiSession(
    {
      chat: async (_request, on, signal) => {
        handlers = on;
        on.onApplied({ batchId: "a", revision: 1, operationCount: 1 });
        return waitForStop(signal);
      },
    },
    async (id) => {
      loads++;
      if (loads === 1) return { id, content: safeClone(CONTENT) };
      if (loads === 2) return firstReload.promise;
      return { id, content: latestContent };
    },
  );
  const turn = ai.send("Server turn");
  await settle();
  ai.stop();
  await settle();
  expect(loads).toBe(2);
  handlers.onApplied({ batchId: "b", revision: 2, operationCount: 1 });
  firstReload.resolve({ id: "tpl-1", content: firstContent });
  await turn;
  expect(editor.content.value).toEqual(latestContent);
  expect(loads).toBe(3);
  expect(ai.busy.value).toBe(false);
});

describe("useAiFeature alt text", () => {
  const image = {
    id: "i",
    type: "image",
    src: "https://example.com/i.png",
    alt: "Old",
    decorative: true,
  } as const;
  it("refuses an image deleted before drafting without calling the provider", async () => {
    const altText = vi.fn(async () => ({ alt: "Shop arrivals" }));
    const { ai, editor, onError } = await openLocal({ altText });
    editor.addBlock(safeClone(image) as never);
    editor.removeBlock("i");
    const error = await ai.draftAltText("i").catch((error) => error);
    expect(error).toBeInstanceOf(SdkError);
    expect(error).toMatchObject({
      code: "block_missing",
      statusCode: 409,
      message: "The image is no longer available.",
    });
    expect(altText).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledExactlyOnceWith(error);
  });

  it.each(["disabled", "no session"] as const)(
    "refuses alt-text drafting with %s before calling a provider",
    async (reason) => {
      const altText = vi.fn(async () => ({ alt: "Shop arrivals" }));
      const chat = chatting(() => {});
      const { ai, editor, onError } = await openLocal(
        {
          chat,
          altText: reason === "disabled" ? false : altText,
        },
        {},
        reason !== "no session",
      );
      editor.addBlock(safeClone(image) as never);
      const error = await ai.draftAltText("i").catch((error) => error);
      expect(error).toBeInstanceOf(SdkError);
      expect(error).toMatchObject({
        code: "feature_unavailable",
        statusCode: 403,
        message: "This AI feature isn't available.",
      });
      expect(altText).not.toHaveBeenCalled();
      expect(chat).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledExactlyOnceWith(error);
    },
  );

  it("sends the effective limit, image context and template locale without becoming busy", async () => {
    const requests: unknown[] = [];
    const { ai, editor } = await openLocal(
      {
        altText: async (request, signal) => {
          signal.throwIfAborted();
          requests.push(request);
          return { alt: "Shop arrivals" };
        },
      },
      {
        altMaxLength: () =>
          effectiveAltMaxLength(
            resolveLintOptions({
              lint: { accessibility: { thresholds: { altMaxLength: 60 } } },
            }),
          ),
      },
    );
    editor.setContent({
      ...CONTENT,
      blocks: [safeClone(image)],
      settings: { ...CONTENT.settings, locale: "de-DE" },
    } as TemplateContent);
    const draft = ai.draftAltText("i");
    expect(ai.busy.value).toBe(false);
    expect(await draft).toBe("Shop arrivals");
    expect(requests).toEqual([
      {
        templateId: "tpl-1",
        sessionId: expect.any(String),
        blockId: "i",
        image: { url: image.src },
        currentAlt: null,
        linkHref: null,
        nearbyText: "",
        locale: "de-DE",
        maxLength: 60,
      },
    ]);
    expect(ai.messages.value).toEqual([]);
    expect(editor.content.value.blocks[0]).toEqual(image);
  });
  it("applies all image fields in one undo step and leaves no chat history", async () => {
    const { ai, editor, history } = await openLocal({});
    editor.setContent({
      ...CONTENT,
      blocks: [safeClone(image), { ...image, id: "i2", decorative: false }],
    } as TemplateContent);
    const before = safeClone(editor.content.value);
    const record = vi.spyOn(history, "record");
    await ai.applyAltTexts([
      { blockId: "i", alt: "Arrivals", decorative: false },
      { blockId: "i2", alt: "", decorative: true },
    ]);
    expect(editor.content.value.blocks).toMatchObject([
      { alt: "Arrivals", decorative: false },
      { alt: "", decorative: true },
    ]);
    expect(record).toHaveBeenCalledTimes(1);
    expect(ai.messages.value).toEqual([]);
    history.undo();
    expect(editor.content.value).toEqual(before);
  });
  it.each(["switch", "destroy", "stop"] as const)(
    "aborts every pending independent draft on %s",
    async (action) => {
      const signals: AbortSignal[] = [];
      const { ai, editor } = await openLocal({
        altText: async (_r, signal) => {
          signals.push(signal);
          return new Promise(() => {});
        },
      });
      editor.setContent({
        ...CONTENT,
        blocks: [safeClone(image)],
      } as TemplateContent);
      const controller = new AbortController();
      const first = ai.draftAltText("i", controller.signal);
      const second = ai.draftAltText("i", controller.signal);
      const outcomes = Promise.allSettled([first, second]);
      expect(signals).toHaveLength(2);
      expect(signals[0]).not.toBe(signals[1]);
      expect(ai.busy.value).toBe(false);
      if (action === "switch") await editor.load("tpl-2");
      else if (action === "destroy") ai.destroy();
      else controller.abort();
      expect(signals.every((s) => s.aborted)).toBe(true);
      expect((await outcomes).map((r) => r.status)).toEqual([
        "rejected",
        "rejected",
      ]);
    },
  );
  it("reports draft failures through onError", async () => {
    const error = new SdkError("Unavailable", 502, "ai_provider_error");
    const { ai, editor, onError } = await openLocal({
      altText: async () => {
        throw error;
      },
    });
    editor.setContent({
      ...CONTENT,
      blocks: [safeClone(image)],
    } as TemplateContent);
    await expect(ai.draftAltText("i")).rejects.toBe(error);
    expect(onError).toHaveBeenCalledWith(error);
  });
  it("drafting does not occupy the fix lane, but apply waits behind a turn", async () => {
    let finish!: () => void;
    const { ai, editor } = await openLocal({
      altText: async () => new Promise(() => {}),
      chat: chatting(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      ),
    });
    editor.setContent({
      ...CONTENT,
      blocks: [safeClone(image)],
    } as TemplateContent);
    const draft = ai.draftAltText("i").catch(() => {});
    const turn = ai.send("Wait");
    await settle();
    const apply = ai.applyAltTexts([
      { blockId: "i", alt: "New", decorative: false },
    ]);
    expect(editor.content.value.blocks[0]).toMatchObject({ alt: "Old" });
    finish();
    await turn;
    await apply;
    expect(editor.content.value.blocks[0]).toMatchObject({
      alt: "New",
      decorative: false,
    });
    ai.destroy();
    await draft;
  });
});

describe("chat attachments and import queue", () => {
  it("passes blobs and stores only attachment metadata on user items", async () => {
    const chat = chatting(() => {});
    const { ai } = await openLocal({ chat, chatAttachments: true });
    const files = [
      new File(["image"], "shot.png", { type: "image/png" }),
      new File(["pdf"], "plan.pdf", { type: "application/pdf" }),
    ];
    await ai.send("Use these", files);
    expect(chat).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          { file: files[0], kind: "image", name: "shot.png" },
          { file: files[1], kind: "pdf", name: "plan.pdf" },
        ],
      }),
      expect.anything(),
      expect.anything(),
    );
    expect(ai.messages.value.map((item) => item.attachments)).toEqual([
      [
        { name: "shot.png", kind: "image" },
        { name: "plan.pdf", kind: "pdf" },
      ],
      [],
    ]);
  });
  it("restores a failed turn's text and files and clears both on retry", async () => {
    const files = [new File(["image"], "shot.png", { type: "image/png" })];
    let failed = true;
    const { ai } = await openLocal({
      chat: async () => {
        if (failed) throw new SdkError("offline", 502, "ai_provider_error");
        return { text: "Done", messageId: null };
      },
      chatAttachments: true,
    });
    await ai.send("Use this", files);
    expect(ai.failedPrompt.value).toBe("Use this");
    expect(ai.failedAttachments.value).toEqual(files);
    failed = false;
    await ai.send("Retry", files);
    expect(ai.failedPrompt.value).toBe(null);
    expect(ai.failedAttachments.value).toEqual([]);
  });
  it("maps history metadata and defaults absent metadata to an empty array", async () => {
    const { ai } = await openLocal({
      chat: chatting(() => {}),
      conversation: {
        list: async () => [
          {
            id: "u",
            role: "user",
            kind: "chat",
            text: "Reference",
            attachments: [{ name: "shot.png", kind: "image" }],
            batches: [],
            undone: false,
            createdAt: "2026-10-23T00:00:00Z",
          },
          {
            id: "a",
            role: "assistant",
            kind: "chat",
            text: "OK",
            batches: [],
            undone: false,
            createdAt: "2026-10-23T00:00:00Z",
          },
        ],
        clear: false,
        undo: false,
        redo: false,
        settleReplay: async () => {},
      },
    });
    ai.open("chat");
    await settle();
    expect(ai.messages.value.map((item) => item.attachments)).toEqual([
      [{ name: "shot.png", kind: "image" }],
      [],
    ]);
  });
  it.each([
    [true, true],
    [false, false],
  ])(
    "gates attachment support and import on %s",
    async (chatAttachments, expected) => {
      const chat = chatting(() => {});
      const { ai } = await openLocal({ chat, chatAttachments });
      const files = [new File(["x"], "ref.png", { type: "image/png" })];
      expect(ai.has("chatAttachments")).toBe(expected);
      expect(ai.capability.isFeatureEnabled("chatAttachments")).toBe(expected);
      ai.startImport(files);
      expect(ai.panel.value).toBe(expected ? "chat" : null);
      expect(ai.importQueue.value).toEqual(expected ? files : []);
      expect(chat).not.toHaveBeenCalled();
    },
  );
  it("requires chat and a loaded template for attachment support", async () => {
    const { ai, editor } = await openLocal({
      chat: false,
      chatAttachments: true,
    });
    expect(ai.has("chatAttachments")).toBe(false);
    ai.capability.startImport([new File(["x"], "x.png")]);
    expect(ai.panel.value).toBe(null);
    editor.state.template = null;
    expect(ai.has("chatAttachments")).toBe(false);
  });
});

it("rejects obsolete recovery after A is reopened and has a newer turn", async () => {
  const oldRecovery = deferred<AiChatMessage[]>();
  let aReads = 0;
  let aTurns = 0;
  const { ai, editor } = await openLocal({
    chat: async (request, on) => {
      if (request.templateId === "tpl-1" && ++aTurns === 1) {
        on.onApplied({ batchId: "old-batch", revision: 1, operationCount: 1 });
        throw new Error("partial");
      }
      return { messageId: "a-new", text: "New session answer" };
    },
    conversation: {
      list: async (id) => id === "tpl-1" && ++aReads === 2 ? oldRecovery.promise : [],
      clear: false, undo: false, redo: false, settleReplay: async () => {},
    },
  }, { reload: async () => {} });
  ai.open("chat");
  await settle();
  const first = ai.send("Old A turn");
  await settle();
  await editor.load("tpl-2");
  await settle();
  await editor.load("tpl-1");
  await settle();
  await ai.send("New A turn");
  expect(ai.messages.value.map((row) => row.id)).toContain("a-new");
  oldRecovery.resolve([messageWithBatch("obsolete", "old-batch")]);
  await first;
  await settle();
  await ai.send("Publish memory again");
  expect(ai.messages.value.filter((row) => row.text === "New session answer")).toHaveLength(2);
  expect(ai.messages.value.map((row) => row.id)).not.toContain("obsolete");
});

it("reports a rewrite failure exactly once through onError", async () => {
  const error = new Error("rewrite failed");
  const { ai, onError } = await openLocal({ rewrite: async () => { throw error; } });
  await expect(ai.rewrite({ html: "<p>Hi</p>", preset: "shorten" }, () => {}, new AbortController().signal)).rejects.toBe(error);
  expect(onError).toHaveBeenCalledExactlyOnceWith(error);
});

it("does not report a stopped rewrite through onError", async () => {
  const { ai, onError } = await openLocal({ rewrite: async (_r, _on, signal) => waitForStop(signal) });
  const stopped = ai.rewrite({ html: "<p>Hi</p>", preset: "shorten" }, () => {}, new AbortController().signal);
  const result = expect(stopped).rejects.toMatchObject({ name: "AbortError" });
  await settle();
  ai.stop();
  await result;
  expect(onError).not.toHaveBeenCalled();
});

it("checks captured image fields when queued alt text operations reach the lane", async () => {
  const pending = deferred<void>();
  const { ai, editor, onError } = await openLocal({ chat: chatting(() => pending.promise) });
  editor.setContent({ ...CONTENT, blocks: [{ id: "i", type: "image", src: "https://example.com/a.png", alt: "Old", decorative: false }] } as TemplateContent);
  const turn = ai.send("Wait");
  await settle();
  const apply = ai.applyAltTexts([{ blockId: "i", alt: "Draft", decorative: false, expect: { src: "https://example.com/a.png", alt: "Old", decorative: false } }]);
  const refused = expect(apply).rejects.toMatchObject({ code: "precondition_failed" });
  editor.updateBlock("i", { src: "https://example.com/b.png" });
  pending.resolve();
  await turn;
  await refused;
  expect(editor.content.value.blocks[0]).toMatchObject({ src: "https://example.com/b.png", alt: "Old", decorative: false });
  expect(onError).toHaveBeenCalledTimes(1);
});

it("keeps author edits made before a buffered server fact starts reconciliation", async () => {
  let handlers!: AiTurnHandlers;
  const { ai, editor, reload } = await openLocal({ chat: async (_r, on, signal) => {
    handlers = on;
    return waitForStop(signal);
  } }, { reload: async () => {} });
  const turn = ai.send("Server turn");
  await settle();
  ai.stop();
  await turn;
  editor.updateBlock("t1", { content: "<p>Keep this author edit</p>" });
  handlers.onApplied({ batchId: "buffered", revision: 2, operationCount: 1 });
  await settle();
  expect(reload).not.toHaveBeenCalled();
  expect(ai.keptYourVersion.value).toBe(true);
  expect(editor.content.value.blocks[0]).toMatchObject({ content: "<p>Keep this author edit</p>" });
});

it("does not count the AI's own applied batches as author edits before reload", async () => {
  const { ai, reload } = await openLocal({ chat: chatting(async (on) => {
    await on.onOperations(greet);
    on.onApplied({ batchId: "server", revision: 2, operationCount: 1 });
  }) }, { reload: async () => {} });
  await ai.send("Mixed turn");
  expect(reload).toHaveBeenCalledTimes(1);
  expect(ai.keptYourVersion.value).toBe(false);
});


it.each(["saved", "failed", "superseded"] as const)("clears the retained-version notice only for a covering successful save: %s", async (ending) => {
  const turnFinished = deferred<void>();
  const saved = deferred<Template>();
  const scope = effectScope();
  const { editor, ai } = scope.run(() => {
    const editor = useEditor({
      content: safeClone(CONTENT),
      templates: {
        load: async (id) => ({ id, content: safeClone(CONTENT) }),
        create: false,
        save: async () => saved.promise,
      },
    });
    const history = useHistory({ content: editor.content, setContent: editor.setContent });
    const ai = useAiFeature({
      provider: { ...off, chat: chatting(async (on) => {
        await turnFinished.promise;
        on.onApplied({ batchId: "server", revision: 2, operationCount: 1 });
      }) } as AiProvider,
      editor, collaboration: null, history: () => history,
      reload: (id, guard) => editor.load(id, guard),
      mergeTags: () => ({ syntax: "liquid", tags: [] }), normalize: (ops) => [...ops], commentsOpen: null,
    });
    return { editor, ai };
  })!;
  try {
    await editor.load("tpl-1");
    const turn = ai.send("Server turn");
    await settle();
    editor.updateBlock("t1", { content: "<p>Retained author version</p>" });
    turnFinished.resolve();
    await turn;
    expect(ai.keptYourVersion.value).toBe(true);
    const snapshot = safeClone(editor.content.value);
    const saving = editor.save();
    const result = saving.catch((error) => error);
    expect(ai.keptYourVersion.value).toBe(true);
    if (ending === "superseded") editor.updateBlock("t1", { content: "<p>Newer author version</p>" });
    if (ending === "failed") saved.reject(new Error("Save failed"));
    else saved.resolve({ id: "tpl-1", content: snapshot });
    await result;
    expect(editor.state.isDirty).toBe(ending !== "saved");
    expect(ai.keptYourVersion.value).toBe(ending !== "saved");
    expect(editor.content.value.blocks[0]).toMatchObject({ content: ending === "superseded" ? "<p>Newer author version</p>" : "<p>Retained author version</p>" });
  } finally { ai.destroy(); scope.stop(); }
});


it("keeps the returning A session's messages and replay records after an old New chat clears", async () => {
  const cleared = deferred<void>();
  const clear = vi.fn(() => cleared.promise);
  const { ai, editor } = await openLocal({
    chat: chatting(async (on) => { await on.onOperations(greet); }),
    conversation: { list: async () => [], clear, undo: false, redo: false, settleReplay: async () => {} },
  });
  ai.open("chat");
  await settle();
  const oldClear = ai.newChat();
  await settle();
  expect(clear).toHaveBeenCalledExactlyOnceWith("tpl-1");
  await editor.load("tpl-2");
  await settle();
  await editor.load("tpl-1");
  await settle();
  await ai.send("New A turn");
  const messages = safeClone(ai.messages.value);
  const answer = messages.find((row) => row.role === "assistant")!;
  expect(answer.canUndo).toBe(true);
  expect(editor.content.value.blocks[0]).toMatchObject({ content: "<p>Hello</p>" });
  cleared.resolve();
  await oldClear;
  await settle();
  expect(ai.messages.value).toEqual(messages);
  await ai.undoMessage(answer.id);
  expect(editor.content.value.blocks[0]).toMatchObject({ content: "<p>Hi</p>" });
  expect(ai.messages.value.find((row) => row.id === answer.id)).toMatchObject({ undone: true });
  await ai.send("Publish memory again");
  expect(ai.messages.value.map((row) => row.id)).toContain(answer.id);
});
