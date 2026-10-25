import { describe, expect, it } from "vitest";
import type { AiWireEvent } from "../src";
import { buildChatRequest, editingInstructions, runEditingTurn } from "../src/server";
import { scriptedModel } from "./helpers/scripted-model";

const content = () =>
  ({
    blocks: [{ id: "t1", type: "title", content: "<p>Hi</p>", level: 1 }],
    settings: { width: 600 },
  }) as never;

const request = (message: string) => ({
  content: content(),
  revision: 3,
  mergeTags: { syntax: "liquid" as const, tags: [] },
  selectedBlockId: null,
  request: buildChatRequest(message),
});

const rename = JSON.stringify([
  { op: "updateBlock", blockId: "t1", set: { content: "<p>Hello</p>" } },
]);

describe("runEditingTurn (D31)", () => {
  it("streams text, applies a tool call, feeds the result back, and stops on a reply without one", async () => {
    const model = scriptedModel([
      [
        { type: "text", text: "On it. " },
        { type: "tool-call", id: "c1", name: "apply_operations", input: { ops: rename } },
        { type: "usage", inputTokens: 100, outputTokens: 20 },
      ],
      [
        { type: "text", text: "I renamed the title." },
        { type: "usage", inputTokens: 130, outputTokens: 8 },
      ],
    ]);
    const events: AiWireEvent[] = [];

    const result = await runEditingTurn({
      request: request("Say hello"),
      model,
      write: (event) => void events.push(event),
    });

    expect(events).toEqual([
      { type: "text", text: "On it. " },
      {
        type: "operations",
        ops: [{ op: "updateBlock", blockId: "t1", set: { content: "<p>Hello</p>" } }],
      },
      { type: "text", text: "I renamed the title." },
    ]);
    expect(result.text).toBe("On it. I renamed the title.");
    expect(result.usage).toEqual({ inputTokens: 230, outputTokens: 28 });
    expect(result.batches).toHaveLength(1);
    expect((result.content.blocks[0] as { content: string }).content).toBe("<p>Hello</p>");
    expect(model.calls).toHaveLength(2);
    expect(model.calls[0].system).toBe(editingInstructions);
    expect(model.calls[0].tools).toEqual(["apply_operations"]);
    expect(model.calls[1].messages.at(-1)).toEqual({
      role: "tool",
      toolCallId: "c1",
      name: "apply_operations",
      content: "Applied.",
    });
    expect(model.calls[0].messages[0]).toMatchObject({
      role: "user",
      content: expect.stringContaining("# Template (revision 3)"),
    });
  });

  it("takes the tool's arguments as a JSON string too, and hands a refusal back without an event", async () => {
    const model = scriptedModel([
      [
        {
          type: "tool-call",
          id: "c1",
          name: "apply_operations",
          input: JSON.stringify({ ops: '[{"op":"deleteBlock","blockId":"nope"}]' }),
        },
      ],
      [{ type: "text", text: "That block isn't there." }],
    ]);
    const events: AiWireEvent[] = [];

    const result = await runEditingTurn({
      request: request("Delete it"),
      model,
      write: (event) => void events.push(event),
    });

    expect(events).toEqual([{ type: "text", text: "That block isn't there." }]);
    expect(result.batches).toEqual([]);
    expect(model.calls[1].messages.at(-1)).toMatchObject({
      role: "tool",
      content: 'Refused: op 0 (deleteBlock nope) was refused: no block with id "nope"',
    });
  });

  it("answers a tool it doesn't know with a refusal", async () => {
    const model = scriptedModel([
      [{ type: "tool-call", id: "c1", name: "send_email", input: {} }],
      [{ type: "text", text: "I can't send email." }],
    ]);
    await runEditingTurn({ request: request("Send"), model, write: () => {} });
    expect(model.calls[1].messages.at(-1)).toMatchObject({
      content: "Refused: there is no tool called send_email.",
    });
  });

  it("stops after maxSteps model calls", async () => {
    const call = { type: "tool-call" as const, id: "c", name: "apply_operations", input: { ops: "[]" } };
    const model = scriptedModel([[call], [call], [call], [call]]);
    await runEditingTurn({ request: request("Loop"), model, write: () => {}, maxSteps: 3 });
    expect(model.calls).toHaveLength(3);
  });

  it("rejects with an AbortError when stopped, keeping what applied", async () => {
    const abort = new AbortController();
    const model = scriptedModel([
      [{ type: "tool-call", id: "c1", name: "apply_operations", input: { ops: rename } }],
      [{ type: "text", text: "never" }],
    ]);
    const events: AiWireEvent[] = [];

    await expect(
      runEditingTurn({
        request: request("Say hello"),
        model,
        write: (event) => {
          events.push(event);
          if (event.type === "operations") abort.abort();
        },
        signal: abort.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(events.map((event) => event.type)).toEqual(["operations"]);
  });

  it.each(["null", "7", '"ops"', "[invalid"])(
    "refuses malformed tool arguments %s and feeds the refusal back",
    async (input) => {
      const model = scriptedModel([
        [{ type: "tool-call", id: "bad", name: "apply_operations", input }],
        [{ type: "text", text: "Please send operations." }],
      ]);
      const events: AiWireEvent[] = [];
      const result = await runEditingTurn({
        request: request("Edit"),
        model,
        write: (event) => void events.push(event),
      });

      expect(model.calls[1].messages.at(-1)).toEqual({
        role: "tool",
        toolCallId: "bad",
        name: "apply_operations",
        content: 'Refused: "ops" must be a non-empty JSON array of operations.',
      });
      expect(result.content).toEqual(content());
      expect(result.batches).toEqual([]);
      expect(events).toEqual([
        { type: "text", text: "Please send operations." },
      ]);
    },
  );
});
