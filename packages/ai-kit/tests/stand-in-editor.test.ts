import { describe, expect, it } from "vitest";
import { applyOperations, type Operation } from "@templatical/types";
import { AI_EVAL_TEMPLATES, createStandInEditor } from "../src/testing";

describe("createStandInEditor", () => {
  it("applies operations to its own copy and returns a guarded inverse", () => {
    const original = AI_EVAL_TEMPLATES.welcome;
    const editor = createStandInEditor(original);
    const ops: Operation[] = [
      { op: "updateBlock", blockId: "cta", set: { text: "Try it" } },
    ];
    const result = editor.apply(ops);
    expect(result).toEqual({
      applied: true,
      inverse: [
        {
          op: "updateBlock",
          blockId: "cta",
          set: { text: "Get started" },
          expect: { text: "Try it" },
        },
      ],
    });
    expect(
      editor.content.blocks.find((block) => block.id === "cta"),
    ).toMatchObject({ text: "Try it" });
    expect(original.blocks.find((block) => block.id === "cta")).toMatchObject({
      text: "Get started",
    });
    expect(editor.applied).toEqual([ops]);
    ops[0] = { op: "deleteBlock", blockId: "cta" };
    expect(editor.applied).toEqual([
      [{ op: "updateBlock", blockId: "cta", set: { text: "Try it" } }],
    ]);
    if (!result.applied) throw new Error("The update should be accepted.");
    expect(applyOperations(editor.content, result.inverse)).toEqual(original);
  });

  it("returns and records the exact engine refusal without changing content", () => {
    const original = AI_EVAL_TEMPLATES.welcome;
    const editor = createStandInEditor(original);
    expect(editor.apply([{ op: "deleteBlock", blockId: "missing" }])).toEqual({
      applied: false,
      code: "block_missing",
      opIndex: 0,
      message: 'No block with id "missing".',
    });
    expect(editor.refused).toEqual([
      {
        code: "block_missing",
        opIndex: 0,
        message: 'No block with id "missing".',
      },
    ]);
    expect(editor.content).toEqual(original);
    expect(editor.applied).toEqual([]);
  });

  it("collects streamed text per handler and snapshots server-applied batches", async () => {
    const editor = createStandInEditor(AI_EVAL_TEMPLATES.welcome);
    const chunks: string[] = [];
    const handlers = editor.handlers({ onText: (chunk) => chunks.push(chunk) });
    handlers.onText("Hello");
    handlers.onText(" there.");
    expect(handlers.text).toBe("Hello there.");
    expect(chunks).toEqual(["Hello", " there."]);
    expect(editor.handlers().text).toBe("");
    const batch = { batchId: "b-1", revision: 3, operationCount: 2 };
    handlers.onApplied(batch);
    batch.revision = 4;
    expect(editor.serverBatches).toEqual([
      { batchId: "b-1", revision: 3, operationCount: 2 },
    ]);
    expect(
      await handlers.onOperations([
        { op: "updateSettings", set: { width: 640 } },
      ]),
    ).toEqual({
      applied: true,
      inverse: [
        { op: "updateSettings", set: { width: 600 }, expect: { width: 640 } },
      ],
    });
    expect(editor.content.settings.width).toBe(640);
  });
});


it("keeps the editor syntax with no declared tags", () => {
  expect(createStandInEditor(AI_EVAL_TEMPLATES.welcome)).toMatchObject({ mergeTags: { syntax: "liquid", tags: [] } });
});
