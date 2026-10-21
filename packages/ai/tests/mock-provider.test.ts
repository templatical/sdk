import { describe, expect, it, vi } from "vitest";
import { CollaborationConflict } from "../src";
import { createMockAiProvider, createStandInEditor } from "../src/testing";

const content = {
  blocks: [{ id: "t1", type: "title", content: "<p>Hi</p>" }],
  settings: { width: 600 },
} as never;
const base = { templateId: "t-1", content, revision: null, sessionId: "s", mergeTags: null };
const rename = [{ op: "updateBlock" as const, blockId: "t1", set: { content: "<p>Hello</p>" } }];

describe("createMockAiProvider (D35)", () => {
  it("plays the first recording whose match fits the message", async () => {
    const ai = createMockAiProvider({
      chat: [
        { match: /title/i, events: [{ type: "operations", ops: rename }, { type: "text", text: "Renamed." }, { type: "done", messageId: null }] },
        { events: [{ type: "text", text: "Fallback." }, { type: "done", messageId: null }] },
      ],
    });
    const editor = createStandInEditor(content);

    const result = await (ai.chat as Function)(
      { ...base, message: "Change the title", selectedBlockId: null },
      editor.handlers(),
      new AbortController().signal,
    );

    expect(result).toEqual({ messageId: null, text: "Renamed." });
    expect((editor.content.blocks[0] as { content: string }).content).toBe("<p>Hello</p>");
    expect(ai.rewrite).toBe(false);
    expect(ai.conversation).toBe(undefined);
  });

  it("fails a turn whose operations the editor refuses", async () => {
    const ai = createMockAiProvider({
      chat: [{ events: [{ type: "operations", ops: [{ op: "deleteBlock", blockId: "nope" }] }, { type: "done", messageId: null }] }],
    });
    await expect(
      (ai.chat as Function)({ ...base, message: "x", selectedBlockId: null }, createStandInEditor(content).handlers(), new AbortController().signal),
    ).rejects.toBeInstanceOf(CollaborationConflict);
  });

  it("stops with an AbortError between events", async () => {
    vi.useFakeTimers();
    const ai = createMockAiProvider({
      delayMs: 100,
      chat: [{ events: [{ type: "text", text: "a" }, { type: "text", text: "b" }, { type: "done", messageId: null }] }],
    });
    const stop = new AbortController();
    const turn = (ai.chat as Function)({ ...base, message: "x", selectedBlockId: null }, createStandInEditor(content).handlers(), stop.signal);
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
      chat: [{ events: [{ type: "operations", ops: rename }, { type: "text", text: "Renamed." }, { type: "done", messageId: null }] }],
    });
    const editor = createStandInEditor(content);
    const result = await (ai.chat as Function)({ ...base, message: "Rename", selectedBlockId: null }, editor.handlers(), new AbortController().signal);

    const messages = await ai.conversation!.list("t-1");
    expect(messages.map((m) => [m.role, m.kind, m.text, m.batches.length])).toEqual([
      ["user", "chat", "Rename", 0],
      ["assistant", "chat", "Renamed.", 1],
    ]);
    expect(result.messageId).toBe(messages[1].id);

    const undo = await (ai.conversation!.undo as Function)("t-1", messages[1].id, { sessionId: "s" });
    expect(undo).toEqual({
      replayId: expect.any(String),
      operations: [{ op: "updateBlock", blockId: "t1", set: { content: "<p>Hi</p>" }, expect: { content: "<p>Hello</p>" } }],
    });
    expect((await ai.conversation!.list("t-1"))[1].undone).toBe(false);
    const outcome = { replayId: undo.replayId, direction: "undo" as const, applied: false, sessionId: "s" };
    await ai.conversation!.settleReplay("t-1", messages[1].id, outcome);
    expect((await ai.conversation!.list("t-1"))[1].undone).toBe(false);
    await ai.conversation!.settleReplay("t-1", messages[1].id, { ...outcome, applied: true });
    expect((await ai.conversation!.list("t-1"))[1].undone).toBe(false);
    const accepted = await (ai.conversation!.undo as Function)("t-1", messages[1].id, { sessionId: "s" });
    await ai.conversation!.settleReplay("t-1", messages[1].id, { ...outcome, replayId: accepted.replayId, applied: true });
    expect((await ai.conversation!.list("t-1"))[1].undone).toBe(true);
    const redo = await (ai.conversation!.redo as Function)("t-1", messages[1].id, { sessionId: "s" });
    expect(redo).toEqual({ replayId: expect.any(String), operations: [{ op: "updateBlock", blockId: "t1", set: { content: "<p>Hello</p>" }, expect: { content: "<p>Hi</p>" } }] });
    expect((await ai.conversation!.list("t-1"))[1].undone).toBe(true);
    await ai.conversation!.settleReplay("t-1", messages[1].id, { replayId: redo.replayId, direction: "redo", applied: true, sessionId: "s" });
    await ai.conversation!.settleReplay("t-1", messages[1].id, { ...outcome, replayId: accepted.replayId, applied: true });
    expect((await ai.conversation!.list("t-1"))[1].undone).toBe(false);
    await (ai.conversation!.clear as Function)("t-1");
    expect(await ai.conversation!.list("t-1")).toEqual([]);
  });

  it("answers scoring, suggestions and rewrite from the script", async () => {
    const result = {
      score: 50,
      categories: { spam: { score: 50, findings: [] }, readability: { score: 50, findings: [] }, bestPractices: { score: 50, findings: [] } },
    };
    const ai = createMockAiProvider({
      score: result,
      suggestions: ["One"],
      rewrite: (request) => [{ type: "text", text: "<p>X" }, { type: "done", html: `${request.html}!` }],
    });
    const signal = new AbortController().signal;
    const onText = vi.fn();
    expect(await (ai.score as Function)({ ...base, lintFindings: [] }, signal)).toEqual(result);
    expect(await (ai.suggestions as Function)(base, signal)).toEqual(["One"]);
    expect(await (ai.rewrite as Function)({ ...base, html: "<p>a</p>", preset: "shorten", language: null, instruction: null }, { onText }, signal)).toEqual({ html: "<p>a</p>!" });
    expect(onText).toHaveBeenCalledWith("<p>X");
  });
});
