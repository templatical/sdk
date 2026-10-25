import { describe, expect, it, vi } from "vitest";
import { CollaborationConflict } from "../src";
import { createMockAiProvider, createStandInEditor } from "../src/testing";

const content = {
  blocks: [{ id: "t1", type: "title", content: "<p>Hi</p>" }],
  settings: { width: 600 },
} as never;
const base = {
  templateId: "t-1",
  content,
  revision: null,
  sessionId: "s",
  mergeTags: { syntax: "liquid" as const, tags: [] },
};
const rename = [
  {
    op: "updateBlock" as const,
    blockId: "t1",
    set: { content: "<p>Hello</p>" },
  },
];

describe("createMockAiProvider (D35)", () => {
  it("plays the first recording whose match fits the message", async () => {
    const ai = createMockAiProvider({
      chat: [
        {
          match: /title/i,
          events: [
            { type: "operations", ops: rename },
            { type: "text", text: "Renamed." },
            { type: "done", messageId: null },
          ],
        },
        {
          events: [
            { type: "text", text: "Fallback." },
            { type: "done", messageId: null },
          ],
        },
      ],
    });
    const editor = createStandInEditor(content);

    const result = await (ai.chat as Function)(
      { ...base, message: "Change the title", selectedBlockId: null },
      editor.handlers(),
      new AbortController().signal,
    );

    expect(result).toEqual({ messageId: null, text: "Renamed." });
    expect((editor.content.blocks[0] as { content: string }).content).toBe(
      "<p>Hello</p>",
    );
    expect(ai.rewrite).toBe(false);
    expect(ai.conversation).toBe(undefined);
  });

  it("fails a turn whose operations the editor refuses", async () => {
    const ai = createMockAiProvider({
      chat: [
        {
          events: [
            {
              type: "operations",
              ops: [{ op: "deleteBlock", blockId: "nope" }],
            },
            { type: "done", messageId: null },
          ],
        },
      ],
    });
    await expect(
      (ai.chat as Function)(
        { ...base, message: "x", selectedBlockId: null },
        createStandInEditor(content).handlers(),
        new AbortController().signal,
      ),
    ).rejects.toBeInstanceOf(CollaborationConflict);
  });

  it("stops with an AbortError between events", async () => {
    vi.useFakeTimers();
    const ai = createMockAiProvider({
      delayMs: 100,
      chat: [
        {
          events: [
            { type: "text", text: "a" },
            { type: "text", text: "b" },
            { type: "done", messageId: null },
          ],
        },
      ],
    });
    const stop = new AbortController();
    const turn = (ai.chat as Function)(
      { ...base, message: "x", selectedBlockId: null },
      createStandInEditor(content).handlers(),
      stop.signal,
    );
    const caught = turn.catch((error: Error) => error);
    await vi.advanceTimersByTimeAsync(150);
    stop.abort();
    await vi.advanceTimersByTimeAsync(100);
    expect(await caught).toMatchObject({ name: "AbortError" });
    vi.useRealTimers();
  });

  it("keeps history when asked: list, undo, redo, clear", async () => {
    const ai = createMockAiProvider({
      conversation: true,
      chat: [
        {
          events: [
            { type: "operations", ops: rename },
            { type: "text", text: "Renamed." },
            { type: "done", messageId: null },
          ],
        },
      ],
    });
    const editor = createStandInEditor(content);
    const result = await (ai.chat as Function)(
      { ...base, message: "Rename", selectedBlockId: null },
      editor.handlers(),
      new AbortController().signal,
    );

    const messages = await ai.conversation!.list("t-1");
    expect(
      messages.map((m) => [m.role, m.kind, m.text, m.batches.length]),
    ).toEqual([
      ["user", "chat", "Rename", 0],
      ["assistant", "chat", "Renamed.", 1],
    ]);
    expect(result.messageId).toBe(messages[1].id);

    const undo = await (ai.conversation!.undo as Function)(
      "t-1",
      messages[1].id,
      { sessionId: "s" },
    );
    expect(undo).toEqual({
      replayId: expect.any(String),
      operations: [
        {
          op: "updateBlock",
          blockId: "t1",
          set: { content: "<p>Hi</p>" },
          expect: { content: "<p>Hello</p>" },
        },
      ],
    });
    expect((await ai.conversation!.list("t-1"))[1].undone).toBe(false);
    const outcome = {
      replayId: undo.replayId,
      direction: "undo" as const,
      applied: false,
      sessionId: "s",
    };
    await ai.conversation!.settleReplay("t-1", messages[1].id, outcome);
    expect((await ai.conversation!.list("t-1"))[1].undone).toBe(false);
    await ai.conversation!.settleReplay("t-1", messages[1].id, {
      ...outcome,
      applied: true,
    });
    expect((await ai.conversation!.list("t-1"))[1].undone).toBe(false);
    const accepted = await (ai.conversation!.undo as Function)(
      "t-1",
      messages[1].id,
      { sessionId: "s" },
    );
    await ai.conversation!.settleReplay("t-1", messages[1].id, {
      ...outcome,
      replayId: accepted.replayId,
      applied: true,
    });
    expect((await ai.conversation!.list("t-1"))[1].undone).toBe(true);
    const redo = await (ai.conversation!.redo as Function)(
      "t-1",
      messages[1].id,
      { sessionId: "s" },
    );
    expect(redo).toEqual({
      replayId: expect.any(String),
      operations: [
        {
          op: "updateBlock",
          blockId: "t1",
          set: { content: "<p>Hello</p>" },
          expect: { content: "<p>Hi</p>" },
        },
      ],
    });
    expect((await ai.conversation!.list("t-1"))[1].undone).toBe(true);
    await ai.conversation!.settleReplay("t-1", messages[1].id, {
      replayId: redo.replayId,
      direction: "redo",
      applied: true,
      sessionId: "s",
    });
    await ai.conversation!.settleReplay("t-1", messages[1].id, {
      ...outcome,
      replayId: accepted.replayId,
      applied: true,
    });
    expect((await ai.conversation!.list("t-1"))[1].undone).toBe(false);
    await (ai.conversation!.clear as Function)("t-1");
    expect(await ai.conversation!.list("t-1")).toEqual([]);
  });

  it("derives rewrite HTML from the request and forwards streamed text", async () => {
    const ai = createMockAiProvider({
      rewrite: (request) => [
        { type: "text", text: "<p>X" },
        { type: "done", html: `${request.html}!` },
      ],
    });
    const signal = new AbortController().signal;
    const onText = vi.fn();
    expect(
      await (ai.rewrite as Function)(
        {
          ...base,
          html: "<p>a</p>",
          preset: "shorten",
          language: null,
          instruction: null,
        },
        { onText },
        signal,
      ),
    ).toEqual({ html: "<p>a</p>!" });
    expect(onText).toHaveBeenCalledWith("<p>X");
  });

  it("normalizes a non-Error abort reason and preserves a supplied AbortError", async () => {
    const ai = createMockAiProvider({
      rewrite: [{ type: "done", html: "<p>One</p>" }],
    });
    const stopped = new AbortController();
    stopped.abort("Stop now");
    await expect(
      (ai.rewrite as Function)(
        {
          ...base,
          html: "<p>One</p>",
          preset: "shorten",
          language: null,
          instruction: null,
        },
        { onText: () => {} },
        stopped.signal,
      ),
    ).rejects.toMatchObject({
      name: "AbortError",
      message: "The AI request was stopped.",
    });
    const supplied = new DOMException("Stopped by the caller.", "AbortError");
    const preserve = new AbortController();
    preserve.abort(supplied);
    await expect(
      (ai.rewrite as Function)(
        {
          ...base,
          html: "<p>One</p>",
          preset: "shorten",
          language: null,
          instruction: null,
        },
        { onText: () => {} },
        preserve.signal,
      ),
    ).rejects.toBe(supplied);
  });

  it("rejects unmatched recordings and streams that end without done with the provider error", async () => {
    const error = {
      name: "SdkError",
      code: "ai_provider_error",
      statusCode: 502,
      message: "AI is unavailable right now. Try again later.",
    };
    for (const chat of [
      [
        {
          match: /other/,
          events: [{ type: "done" as const, messageId: null }],
        },
      ],
      [{ events: [{ type: "text" as const, text: "Unfinished" }] }],
    ]) {
      const ai = createMockAiProvider({ chat });
      const handlers = createStandInEditor(content).handlers();
      await expect(
        (ai.chat as Function)(
          { ...base, message: "Hello", selectedBlockId: null },
          handlers,
          new AbortController().signal,
        ),
      ).rejects.toMatchObject(error);
      expect(handlers.text).toBe(
        chat[0].events[0].type === "text" ? "Unfinished" : "",
      );
    }
  });

  it("requires rewrite's done event to contain HTML", async () => {
    const ai = createMockAiProvider({
      rewrite: [{ type: "done", messageId: null }],
    });
    await expect(
      (ai.rewrite as Function)(
        {
          ...base,
          html: "<p>Hi</p>",
          preset: "shorten",
          language: null,
          instruction: null,
        },
        { onText: () => {} },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({
      name: "SdkError",
      code: "ai_provider_error",
      statusCode: 502,
      message: "AI is unavailable right now. Try again later.",
    });
  });

  it("forwards server-applied batches and records their exact metadata in history", async () => {
    const ai = createMockAiProvider({
      conversation: true,
      chat: [
        {
          events: [
            {
              type: "applied",
              batchId: "server-batch",
              revision: 12,
              operationCount: 3,
            },
            { type: "text", text: "Saved." },
            { type: "done", messageId: "server-message" },
          ],
        },
      ],
    });
    const editor = createStandInEditor(content);
    const result = await (ai.chat as Function)(
      { ...base, message: "Save it", selectedBlockId: null },
      editor.handlers(),
      new AbortController().signal,
    );
    const batch = { batchId: "server-batch", revision: 12, operationCount: 3 };
    expect(editor.serverBatches).toEqual([batch]);
    expect(editor.applied).toEqual([]);
    expect(editor.content).toEqual(content);
    const messages = await ai.conversation!.list("t-1");
    expect(
      messages.map((message) => ({
        role: message.role,
        text: message.text,
        batches: message.batches,
      })),
    ).toEqual([
      { role: "user", text: "Save it", batches: [] },
      { role: "assistant", text: "Saved.", batches: [batch] },
    ]);
    expect(result).toEqual({ messageId: messages[1].id, text: "Saved." });
  });

  it("refuses undo and redo for a message outside the conversation", async () => {
    const ai = createMockAiProvider({ conversation: true });
    const error = {
      name: "SdkError",
      statusCode: 404,
      code: "not_found",
      message: "That message isn't in this conversation.",
    };
    await expect(
      (ai.conversation!.undo as Function)("t-1", "missing", { sessionId: "s" }),
    ).rejects.toMatchObject(error);
    await expect(
      (ai.conversation!.redo as Function)("t-1", "missing", { sessionId: "s" }),
    ).rejects.toMatchObject(error);
    expect(await ai.conversation!.list("t-1")).toEqual([]);
  });

  it("records chat attachments as metadata only on the user message", async () => {
    const ai = createMockAiProvider({
      conversation: true,
      chatAttachments: true,
      chat: [
        {
          events: [
            { type: "text", text: "Built." },
            { type: "done", messageId: null },
          ],
        },
      ],
    });
    const result = await (ai.chat as Function)(
      {
        ...base,
        message: "Use this reference",
        selectedBlockId: null,
        attachments: [
          {
            file: new Blob(["image"], { type: "image/png" }),
            kind: "image",
            name: "shot.png",
          },
        ],
      },
      createStandInEditor(content).handlers(),
      new AbortController().signal,
    );
    const messages = await ai.conversation!.list("t-1");
    expect(
      messages.map(({ role, kind, text, attachments }) => ({
        role,
        kind,
        text,
        attachments,
      })),
    ).toEqual([
      {
        role: "user",
        kind: "chat",
        text: "Use this reference",
        attachments: [{ name: "shot.png", kind: "image" }],
      },
      {
        role: "assistant",
        kind: "chat",
        text: "Built.",
        attachments: undefined,
      },
    ]);
    expect(result).toEqual({ messageId: messages[1].id, text: "Built." });
  });

  it("plays explicit pauses before continuing the recorded text", async () => {
    const ai = createMockAiProvider({
      chat: [
        {
          events: [
            { delayMs: 1 },
            { type: "text", text: "After the pause." },
            { type: "done", messageId: "m-1" },
          ],
        },
      ],
    });
    const handlers = createStandInEditor(content).handlers();
    expect(
      await (ai.chat as Function)(
        { ...base, message: "Hello", selectedBlockId: null },
        handlers,
        new AbortController().signal,
      ),
    ).toEqual({ messageId: "m-1", text: "After the pause." });
    expect(handlers.text).toBe("After the pause.");
  });

  it("ignores an unknown runtime recording event without treating it as an applied batch", async () => {
    const ai = createMockAiProvider({
      chat: [
        {
          events: [
            { type: "unexpected" } as never,
            { type: "text", text: "Kept going." },
            { type: "done", messageId: "m-1" },
          ],
        },
      ],
    });
    const editor = createStandInEditor(content);
    const handlers = editor.handlers();
    expect(
      await (ai.chat as Function)(
        { ...base, message: "Hello", selectedBlockId: null },
        handlers,
        new AbortController().signal,
      ),
    ).toEqual({ messageId: "m-1", text: "Kept going." });
    expect(handlers.text).toBe("Kept going.");
    expect(editor.applied).toEqual([]);
    expect(editor.serverBatches).toEqual([]);
    expect(editor.content).toEqual(content);
  });
});
