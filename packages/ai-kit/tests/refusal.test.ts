import { describe, expect, it } from "vitest";
import { OperationError, type TemplateContent } from "@templatical/types";
import { engineRefusal, type NamedLock } from "../src/server/refusal";

const content = {
  blocks: [
    {
      id: "b-1",
      type: "text",
      content: "Hi",
      styles: { padding: { top: 8, right: 4 } },
    },
    { id: "b-2", type: "text", content: "Bye" },
    {
      id: "s-1",
      type: "section",
      columns: [50, 50],
      children: [[], [{ id: "nested", type: "text", content: "Nested" }]],
    },
  ],
  settings: { width: 600 },
} as unknown as TemplateContent;

function precondition(ops: unknown[], template = content, index = 0): string {
  return engineRefusal(
    new OperationError("precondition_failed", index, "The template changed."),
    ops,
    template,
    [],
    null,
  );
}

describe("engineRefusal precondition details", () => {
  it("reports the first differing nested field after equal sibling fields", () => {
    expect(
      precondition([
        {
          op: "updateBlock",
          blockId: "b-1",
          expect: { styles: { padding: { right: 4, top: 2 } } },
        },
      ]),
    ).toBe("op 0's expect failed: styles.padding.top is now 8");
  });

  it("reports a nested field that was removed or added", () => {
    expect(
      precondition([
        {
          op: "updateBlock",
          blockId: "b-1",
          expect: { styles: { padding: { top: 8, right: 4, bottom: 2 } } },
        },
      ]),
    ).toBe("op 0's expect failed: styles.padding.bottom is now unset");
    expect(
      precondition([
        {
          op: "updateBlock",
          blockId: "b-1",
          expect: { styles: { padding: { top: 8 } } },
        },
      ]),
    ).toBe("op 0's expect failed: styles.padding.right is now 4");
  });

  it("compares settings against the template after earlier operations", () => {
    expect(
      precondition(
        [
          { op: "updateSettings", set: { width: 720 } },
          { op: "updateSettings", expect: { width: 600 } },
        ],
        content,
        1,
      ),
    ).toBe("op 1's expect failed: width is now 720");
  });

  it.each([
    ["missing", { blocks: [] }],
    ["null", { blocks: [], settings: null }],
  ])("falls back when template settings are %s", (_label, template) => {
    expect(
      precondition(
        [{ op: "updateSettings", expect: { width: 600 } }],
        template as unknown as TemplateContent,
      ),
    ).toBe("op 0's expect failed: the template changed");
  });

  it("reports a moved block's current parent and previous sibling", () => {
    expect(
      precondition([
        {
          op: "moveBlock",
          blockId: "nested",
          expect: { parent: null, after: null },
        },
      ]),
    ).toBe(
      'op 0\'s expect failed: parent is now {"sectionId":"s-1","column":1}',
    );
    expect(
      precondition([
        {
          op: "moveBlock",
          blockId: "b-2",
          expect: {},
        },
      ]),
    ).toBe("op 0's expect failed: after is now b-1");
  });

  it("reports the changed field of a block being deleted", () => {
    expect(
      precondition([
        {
          op: "deleteBlock",
          blockId: "b-2",
          expect: { block: { id: "b-2", type: "text", content: "Before" } },
        },
      ]),
    ).toBe("op 0's expect failed: block.content is now Bye");
  });

  it("truncates displayed values at 200 characters with an ellipsis", () => {
    const long = "x".repeat(201);
    const template = {
      ...content,
      blocks: [{ id: "long", type: "text", content: long }],
    } as unknown as TemplateContent;
    expect(
      precondition(
        [
          {
            op: "updateBlock",
            blockId: "long",
            expect: { content: "Before" },
          },
        ],
        template,
      ),
    ).toBe(`op 0's expect failed: content is now ${"x".repeat(200)}…`);
  });

  it.each([
    ["no operation", []],
    ["no expect", [{ op: "updateSettings" }]],
    ["null expect", [{ op: "updateSettings", expect: null }]],
    [
      "missing update target",
      [{ op: "updateBlock", blockId: "gone", expect: { content: "Before" } }],
    ],
    ["missing move target", [{ op: "moveBlock", blockId: "gone", expect: {} }]],
    [
      "missing delete target",
      [{ op: "deleteBlock", blockId: "gone", expect: { block: {} } }],
    ],
    ["unsupported operation", [{ op: "addBlock", expect: {} }]],
    ["matching values", [{ op: "updateSettings", expect: { width: 600 } }]],
    [
      "already unset field",
      [{ op: "updateSettings", expect: { subject: null } }],
    ],
    [
      "already null placement",
      [{ op: "moveBlock", blockId: "b-1", expect: {} }],
    ],
  ])("falls back to a template-change sentence for %s", (_label, ops) => {
    expect(precondition(ops)).toBe(
      "op 0's expect failed: the template changed",
    );
  });

  it("falls back when an earlier operation can no longer apply", () => {
    expect(
      precondition(
        [
          { op: "deleteBlock", blockId: "gone" },
          { op: "updateSettings", expect: { width: 600 } },
        ],
        content,
        1,
      ),
    ).toBe("op 1's expect failed: the template changed");
  });
});

describe("engineRefusal lock holders", () => {
  const ops = [{ op: "updateSettings" }, { op: "moveBlock", blockId: "b-2" }];
  const alice = { blockId: "b-1", sessionId: "alice", name: "Alice" };
  const bob = { blockId: "b-2", sessionId: "bob", name: "Bob" };

  it.each([
    ["no named holder", [], "someone is editing blocks in this template"],
    ["one name", [alice], "Alice is editing blocks in this template"],
    [
      "two names",
      [alice, bob],
      "Alice and Bob are editing blocks in this template",
    ],
    [
      "duplicate names",
      [alice, { ...alice, blockId: "b-2" }],
      "Alice is editing blocks in this template",
    ],
    [
      "three names",
      [alice, bob, { blockId: "s-1", sessionId: "carol", name: "Carol" }],
      "Alice, Bob and Carol are editing blocks in this template",
    ],
  ] satisfies [string, NamedLock[], string][])(
    "formats %s",
    (_label, locks, reason) => {
      expect(
        engineRefusal(
          new OperationError("locked_by_others", 1, "Locked."),
          ops,
          content,
          locks,
          null,
        ),
      ).toBe(`op 1 (moveBlock b-2) was refused: ${reason}`);
    },
  );

  it("excludes the requesting session and identifies the holder of the refused block", () => {
    expect(
      engineRefusal(
        new OperationError("lock_held", 1, "Locked.", "b-2"),
        ops,
        content,
        [alice, bob],
        "alice",
      ),
    ).toBe("op 1 (moveBlock b-2) was refused: Bob is editing this block");
    expect(
      engineRefusal(
        new OperationError("lock_held", 1, "Locked.", "b-2"),
        ops,
        content,
        [bob],
        "bob",
      ),
    ).toBe("op 1 (moveBlock b-2) was refused: someone is editing this block");
  });
});
