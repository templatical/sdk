import { describe, expect, it } from "vitest";
import {
  applyOperations,
  OperationError,
  type Operation,
  type TemplateContent,
} from "../src";

/**
 * Batches a backend or an agent can send that aren't well formed. The shared
 * JSON fixtures pin the engine's contract with Templatical Cloud's PHP engine;
 * these cover the TypeScript engine's own shape checks on input no typed
 * caller would build.
 */

const CONTENT = {
  blocks: [{ id: "t1", type: "title", content: "Hi" }],
  settings: { width: 600 },
} as unknown as TemplateContent;

function refusal(
  content: TemplateContent,
  ops: unknown[],
): { code: string; opIndex: number; message: string } {
  try {
    applyOperations(content, ops as Operation[]);
  } catch (error) {
    if (!(error instanceof OperationError)) throw error;
    return { code: error.code, opIndex: error.opIndex, message: error.message };
  }
  throw new Error("The batch applied.");
}

describe("applyOperations on malformed batches", () => {
  it.each<[string, unknown]>([
    ["null", null],
    ["a string", "deleteBlock"],
    ["an array", [{ op: "deleteBlock", blockId: "t1" }]],
    ["an object without op", { blockId: "t1" }],
    ["an object whose op isn't a string", { op: 7, blockId: "t1" }],
  ])("refuses an operation that is %s", (_label, op) => {
    expect(
      refusal(CONTENT, [{ op: "deleteBlock", blockId: "t1" }, op]),
    ).toEqual({
      code: "invalid_operation",
      opIndex: 1,
      message: 'Each operation must be an object with an "op".',
    });
  });

  it.each<[string, Record<string, unknown>]>([
    ["set is a string", { set: "content" }],
    ["set is a list", { set: ["content"] }],
    ["unset isn't a list", { unset: "content" }],
    ["unset holds a non-string", { unset: ["content", 3] }],
  ])("refuses an updateBlock whose %s", (_label, changes) => {
    expect(
      refusal(CONTENT, [{ op: "updateBlock", blockId: "t1", ...changes }]),
    ).toEqual({
      code: "invalid_operation",
      opIndex: 0,
      message: "set must be an object and unset a list of keys.",
    });
  });

  it("refuses an updateSettings whose set isn't an object", () => {
    expect(refusal(CONTENT, [{ op: "updateSettings", set: 640 }])).toEqual({
      code: "invalid_operation",
      opIndex: 0,
      message: "set must be an object and unset a list of keys.",
    });
  });

  it.each<[string, unknown]>([
    ["a string", "Hi"],
    ["a list", [{ content: "Hi" }]],
    ["a number", 0],
  ])("refuses an expect that is %s", (_label, expected) => {
    expect(
      refusal(CONTENT, [
        {
          op: "updateBlock",
          blockId: "t1",
          set: { content: "Bye" },
          expect: expected,
        },
      ]),
    ).toEqual({
      code: "invalid_operation",
      opIndex: 0,
      message: "expect must be an object.",
    });
  });

  it("refuses a malformed expect on updateSettings too", () => {
    expect(
      refusal(CONTENT, [
        { op: "updateSettings", set: { width: 640 }, expect: "width" },
      ]),
    ).toEqual({
      code: "invalid_operation",
      opIndex: 0,
      message: "expect must be an object.",
    });
  });

  it("leaves the content untouched when it refuses", () => {
    const content = structuredClone(CONTENT);

    refusal(content, [{ op: "deleteBlock", blockId: "t1" }, null]);

    expect(content).toEqual(CONTENT);
  });
});

describe("updateSettings on content without a settings object", () => {
  it.each<[string, unknown]>([
    ["null", null],
    ["absent", undefined],
    ["a list", [600]],
    ["a string", "wide"],
  ])("starts from empty settings when they are %s", (_label, settings) => {
    const content = {
      blocks: [],
      settings,
    } as unknown as TemplateContent;

    const next = applyOperations(content, [
      { op: "updateSettings", set: { width: 640 } },
    ]);

    expect(next.settings).toEqual({ width: 640 });
    expect(content.settings).toEqual(settings);
  });

  it("checks an expect against the empty settings, where every key reads as null", () => {
    const content = {
      blocks: [],
      settings: null,
    } as unknown as TemplateContent;

    expect(
      applyOperations(content, [
        { op: "updateSettings", set: { width: 640 }, expect: { width: null } },
      ]).settings,
    ).toEqual({ width: 640 });
    expect(
      refusal(content, [
        { op: "updateSettings", set: { width: 640 }, expect: { width: 600 } },
      ]),
    ).toEqual({
      code: "precondition_failed",
      opIndex: 0,
      message: 'Setting "width" has changed since.',
    });
  });
});

describe("applyOperations on content that isn't well formed", () => {
  const paragraph = (id: string) => ({ id, type: "paragraph", content: id });

  it("reads a block list that isn't a list as empty, and adds into a fresh one", () => {
    const content = {
      blocks: null,
      settings: {},
    } as unknown as TemplateContent;

    expect(refusal(content, [{ op: "deleteBlock", blockId: "t1" }])).toEqual({
      code: "block_missing",
      opIndex: 0,
      message: 'No block with id "t1".',
    });
    expect(
      applyOperations(content, [
        {
          op: "addBlock",
          block: paragraph("a") as never,
          parent: null,
          after: null,
        },
      ]).blocks,
    ).toEqual([paragraph("a")]);
  });

  it("looks past entries that aren't blocks, sections without an id, and children that aren't lists", () => {
    const content = {
      blocks: [
        null,
        "t0",
        { type: "section", children: [[paragraph("hidden")]] },
        { id: "s0", type: "section", children: "none" },
        { id: "s1", type: "section", children: [null, [paragraph("p1")]] },
      ],
      settings: {},
    } as unknown as TemplateContent;

    const next = applyOperations(content, [
      { op: "updateBlock", blockId: "p1", set: { content: "Found" } },
    ]);

    expect(
      (next.blocks[4] as unknown as { children: unknown[][] }).children[1],
    ).toEqual([{ id: "p1", type: "paragraph", content: "Found" }]);
    expect(
      refusal(content, [{ op: "deleteBlock", blockId: "hidden" }]),
    ).toMatchObject({ code: "block_missing" });
  });

  it("makes a column that isn't a list into one when a block goes into it", () => {
    const content = {
      blocks: [
        {
          id: "s1",
          type: "section",
          columns: "2",
          children: [[paragraph("a")], "pending"],
        },
      ],
      settings: {},
    } as unknown as TemplateContent;

    const next = applyOperations(content, [
      {
        op: "addBlock",
        block: paragraph("b") as never,
        parent: { sectionId: "s1", column: 1 },
        after: null,
      },
    ]);

    expect(
      (next.blocks[0] as unknown as { children: unknown[][] }).children,
    ).toEqual([[paragraph("a")], [paragraph("b")]]);
  });

  it("gives a section whose children aren't a list the columns of its new layout", () => {
    const content = {
      blocks: [{ id: "s1", type: "section", columns: "2", children: null }],
      settings: {},
    } as unknown as TemplateContent;

    const next = applyOperations(content, [
      { op: "updateBlock", blockId: "s1", set: { columns: "3" } },
    ]);

    expect(next.blocks[0]).toEqual({
      id: "s1",
      type: "section",
      columns: "3",
      children: [[], [], []],
    });
  });

  it("finds a locked block inside a section past entries without an id", () => {
    const content = {
      blocks: [
        {
          id: "s1",
          type: "section",
          columns: "1",
          children: [[null, { type: "paragraph" }, paragraph("p1")]],
        },
      ],
      settings: {},
    } as unknown as TemplateContent;

    let thrown: unknown = null;
    try {
      applyOperations(content, [{ op: "deleteBlock", blockId: "s1" }], {
        locks: [{ blockId: "p1", sessionId: "s-grace" }],
        session: "s-ada",
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(OperationError);
    expect(thrown).toMatchObject({ code: "lock_held", blockId: "p1" });
  });

  it("deletes a section whose children aren't a list, checking only its own lock", () => {
    const content = {
      blocks: [
        { id: "s1", type: "section", columns: "2", children: null },
        paragraph("a"),
      ],
      settings: {},
    } as unknown as TemplateContent;
    const context = {
      locks: [{ blockId: "a", sessionId: "s-grace" }],
      session: "s-ada",
    };

    expect(
      applyOperations(content, [{ op: "deleteBlock", blockId: "s1" }], context)
        .blocks,
    ).toEqual([paragraph("a")]);
  });

  it("reads a previous sibling that isn't a block, or has no id, as no sibling", () => {
    const content = {
      blocks: [null, paragraph("a"), { type: "divider" }, paragraph("b")],
      settings: {},
    } as unknown as TemplateContent;

    const next = applyOperations(content, [
      {
        op: "moveBlock",
        blockId: "a",
        parent: null,
        after: "b",
        expect: { parent: null, after: null },
      },
      {
        op: "moveBlock",
        blockId: "b",
        parent: null,
        after: null,
        expect: { parent: null, after: null },
      },
    ]);

    expect(next.blocks).toEqual([
      paragraph("b"),
      null,
      { type: "divider" },
      paragraph("a"),
    ]);
  });
});

describe("expect values a typed caller wouldn't send", () => {
  it("skips an expect key whose value is undefined", () => {
    const next = applyOperations(CONTENT, [
      {
        op: "updateBlock",
        blockId: "t1",
        set: { content: "Bye" },
        expect: { content: "Hi", color: undefined },
      },
    ]);

    expect(next.blocks[0]).toEqual({ id: "t1", type: "title", content: "Bye" });
  });

  it("refuses a deleteBlock whose expect has no block", () => {
    expect(
      refusal(CONTENT, [{ op: "deleteBlock", blockId: "t1", expect: {} }]),
    ).toEqual({
      code: "precondition_failed",
      opIndex: 0,
      message: 'Block "t1" has changed since.',
    });
  });
});

describe.each([
  ["updateBlockLocale", "content", "content"],
  ["updateSettingsLocale", "direction", "preheaderText"],
] as const)("%s values from TypeScript callers", (op, setPath, textPath) => {
  const localized = {
    blocks: [{ id: "t1", type: "title", content: "Hi" }],
    settings: {
      width: 600,
      locale: "en",
      locales: ["de"],
      direction: "ltr",
      preheaderText: "Hello",
    },
  } as unknown as TemplateContent;

  it.each([
    ["an undefined override", { set: { [setPath]: undefined } }],
    [
      "an undefined override next to a defined one",
      { set: { width: 640, [setPath]: undefined } },
    ],
    ["an undefined text entry", { text: { [textPath]: undefined } }],
    [
      "a text entry missing value",
      { text: { [textPath]: { source: "67eb44ba" } } },
    ],
    [
      "a text entry missing source",
      { text: { [textPath]: { value: "Hallo" } } },
    ],
    [
      "an undefined text value",
      { text: { [textPath]: { value: undefined, source: "67eb44ba" } } },
    ],
    [
      "an undefined text source",
      { text: { [textPath]: { value: "Hallo", source: undefined } } },
    ],
    [
      "a non-string text value",
      { text: { [textPath]: { value: 42, source: "67eb44ba" } } },
    ],
    [
      "a non-string text source",
      { text: { [textPath]: { value: "Hallo", source: 42 } } },
    ],
  ])("refuses %s with the original batch index", (_label, change) => {
    const before = JSON.stringify(localized);
    expect(
      refusal(localized, [
        { op: "updateSettings", set: { width: 640 } },
        {
          op,
          locale: "de",
          ...(op === "updateBlockLocale" ? { blockId: "t1" } : {}),
          ...change,
        },
      ]),
    ).toEqual({
      code: "invalid_operation",
      opIndex: 1,
      message:
        "A locale update needs text, set, unset or a block's boolean hidden.",
    });
    expect(JSON.stringify(localized)).toBe(before);
  });
});
