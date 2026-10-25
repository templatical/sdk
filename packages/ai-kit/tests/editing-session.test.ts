import { describe, expect, it } from "vitest";
import { createEditingSession, EDITING_SESSION_LIMITS } from "../src/server";

const content = () =>
  ({
    blocks: [
      { id: "t1", type: "title", content: "<p>Hi</p>", level: 1 },
      {
        id: "s1",
        type: "section",
        columns: "2",
        children: [[{ id: "p1", type: "paragraph", content: "<p>Left</p>" }], []],
      },
    ],
    settings: { width: 600 },
  }) as never;

const mergeTags = {
  syntax: "liquid" as const,
  tags: [{ value: "{{first_name}}", label: "First name" }],
};

describe("createEditingSession (D30)", () => {
  it("applies a batch, answers its inverse and keeps the new content", () => {
    const session = createEditingSession({ content: content(), mergeTags });

    const result = session.apply(
      '[{"op":"updateBlock","blockId":"t1","set":{"content":"<p>Hello {{first_name}}</p>"}}]',
    );

    expect(result).toEqual({
      ok: true,
      ops: [
        {
          op: "updateBlock",
          blockId: "t1",
          set: { content: "<p>Hello {{first_name}}</p>" },
        },
      ],
      inverse: [
        {
          op: "updateBlock",
          blockId: "t1",
          set: { content: "<p>Hi</p>" },
          expect: { content: "<p>Hello {{first_name}}</p>" },
        },
      ],
      feedback: "Applied.",
    });
    expect((session.content.blocks[0] as { content: string }).content).toBe(
      "<p>Hello {{first_name}}</p>",
    );
    expect(session.batches).toHaveLength(1);
  });

  it("keeps an empty object an object (ops travel as a JSON string)", () => {
    const session = createEditingSession({ content: content(), mergeTags });
    const result = session.apply(
      '[{"op":"updateBlock","blockId":"t1","set":{"styles":{}}}]',
    );
    expect(result.ok && result.ops[0]).toEqual({
      op: "updateBlock",
      blockId: "t1",
      set: { styles: {} },
    });
  });

  it.each([
    ["not JSON", 'Refused: "ops" must be a JSON array of operations.'],
    ["{}", 'Refused: "ops" must be a non-empty JSON array of operations.'],
    ["[]", 'Refused: "ops" must be a non-empty JSON array of operations.'],
  ])("refuses %s", (json, feedback) => {
    expect(createEditingSession({ content: content(), mergeTags }).apply(json)).toEqual({
      ok: false,
      feedback,
    });
  });

  it("refuses more operations than one call may carry", () => {
    const ops = JSON.stringify(
      Array.from({ length: 101 }, () => ({ op: "updateSettings", set: { width: 600 } })),
    );
    expect(createEditingSession({ content: content(), mergeTags }).apply(ops)).toEqual({
      ok: false,
      feedback: "Refused: send at most 100 operations in one call.",
    });
    expect(EDITING_SESSION_LIMITS.maxOps).toBe(100);
  });

  it("refuses a custom, slot or wrapper block that isn't there already", () => {
    const result = createEditingSession({ content: content(), mergeTags }).apply(
      JSON.stringify([
        { op: "updateSettings", set: { width: 640 } },
        {
          op: "addBlock",
          block: { id: "c1", type: "custom", customType: "qr" },
          parent: null,
          after: null,
        },
      ]),
    );
    expect(result).toEqual({
      ok: false,
      feedback:
        "Refused: op 1 (addBlock c1) was refused: you can't add custom, slot or wrapper blocks",
    });
  });

  it("refuses replacing an existing title with a custom block through setContent", () => {
    const start = content();
    const session = createEditingSession({ content: start, mergeTags });
    expect(
      session.apply(JSON.stringify([
        {
          op: "setContent",
          content: {
            blocks: [{ id: "t1", type: "custom", customType: "qr" }],
            settings: { width: 600 },
          },
        },
      ])),
    ).toEqual({
      ok: false,
      feedback:
        "Refused: op 0 (setContent) was refused: you can't add custom, slot or wrapper blocks",
    });
    expect(session.content).toEqual(start);
    expect(session.batches).toHaveLength(0);
  });

  it("refuses deleting a title and adding a custom block with its id", () => {
    const start = content();
    const session = createEditingSession({ content: start, mergeTags });
    expect(
      session.apply(JSON.stringify([
        { op: "deleteBlock", blockId: "t1" },
        {
          op: "addBlock",
          block: { id: "t1", type: "custom", customType: "qr" },
          parent: null,
          after: null,
        },
      ])),
    ).toEqual({
      ok: false,
      feedback:
        "Refused: op 1 (addBlock t1) was refused: you can't add custom, slot or wrapper blocks",
    });
    expect(session.content).toEqual(start);
    expect(session.batches).toHaveLength(0);
  });

  it("accepts keeping an existing custom block unchanged", () => {
    const start = {
      blocks: [{ id: "c1", type: "custom", customType: "qr" }],
      settings: { width: 600 },
    };
    const session = createEditingSession({ content: start as never, mergeTags });
    expect(
      session.apply(JSON.stringify([{ op: "setContent", content: start }])),
    ).toMatchObject({ ok: true, feedback: "Applied." });
    expect(session.content).toEqual(start);
  });

  it("refuses replacing an existing custom block with a different customType", () => {
    const start = {
      blocks: [{ id: "c1", type: "custom", customType: "qr" }],
      settings: { width: 600 },
    };
    const session = createEditingSession({ content: start as never, mergeTags });
    expect(
      session.apply(JSON.stringify([
        {
          op: "setContent",
          content: {
            ...start,
            blocks: [{ id: "c1", type: "custom", customType: "barcode" }],
          },
        },
      ])),
    ).toEqual({
      ok: false,
      feedback:
        "Refused: op 0 (setContent) was refused: you can't add custom, slot or wrapper blocks",
    });
    expect(session.content).toEqual(start);
    expect(session.batches).toHaveLength(0);
  });

  it("refuses a merge tag the editor doesn't declare and the template doesn't hold", () => {
    const session = createEditingSession({ content: content(), mergeTags });
    expect(
      session.apply(
        '[{"op":"updateBlock","blockId":"p1","set":{"content":"<p>{{discount}} {{first_name}}</p>"}}]',
      ),
    ).toEqual({
      ok: false,
      feedback:
        "Refused: op 0 (updateBlock p1) was refused: it uses merge tags this editor doesn't declare: {{discount}}",
    });
  });

  it("accepts a merge tag the template already holds", () => {
    const start = content() as { blocks: { content?: string }[] };
    start.blocks[0].content =
      '<p><span data-merge-tag="{{legacy}}" data-label="Legacy">Legacy</span></p>';
    const session = createEditingSession({ content: start as never, mergeTags });
    expect(
      session.apply('[{"op":"updateBlock","blockId":"p1","set":{"content":"<p>{{legacy}}</p>"}}]')
        .ok,
    ).toBe(true);
  });

  it("names what an expect now finds", () => {
    const session = createEditingSession({ content: content(), mergeTags });
    expect(
      session.apply(
        '[{"op":"updateBlock","blockId":"t1","set":{"level":2},"expect":{"level":3}}]',
      ),
    ).toEqual({
      ok: false,
      feedback: "Refused: op 0's expect failed: level is now 1",
    });
  });

  it("reports the defaulted parent in a moveBlock expectation", () => {
    const session = createEditingSession({ content: content(), mergeTags });
    expect(
      session.apply(JSON.stringify([
        {
          op: "moveBlock",
          blockId: "p1",
          parent: null,
          after: null,
          expect: { after: null },
        },
      ])),
    ).toEqual({
      ok: false,
      feedback:
        'Refused: op 0\'s expect failed: parent is now {"sectionId":"s1","column":0}',
    });
  });

  it("says who holds a block, and words the engine's other refusals", () => {
    const session = createEditingSession({
      content: content(),
      mergeTags,
      locks: [{ blockId: "p1", sessionId: "s-grace", name: "Grace" }],
      sessionId: "s-ada",
    });
    expect(
      session.apply('[{"op":"deleteBlock","blockId":"p1"}]'),
    ).toEqual({
      ok: false,
      feedback: "Refused: op 0 (deleteBlock p1) was refused: Grace is editing this block",
    });
    expect(
      session.apply('[{"op":"deleteBlock","blockId":"nope"}]'),
    ).toEqual({
      ok: false,
      feedback: 'Refused: op 0 (deleteBlock nope) was refused: no block with id "nope"',
    });
  });

  it("refuses a batch that would make the template too large", () => {
    const session = createEditingSession({
      content: content(),
      mergeTags,
      limits: { maxContentBytes: 400 },
    });
    expect(
      session.apply(
        JSON.stringify([
          { op: "updateBlock", blockId: "t1", set: { content: `<p>${"x".repeat(400)}</p>` } },
        ]),
      ),
    ).toEqual({
      ok: false,
      feedback: "Refused: the template would be larger than 400 bytes. Change less at once.",
    });
  });
});


it("refuses custom block retyping while allowing fieldValues edits", () => {
  const content = { blocks: [{ id: "c", type: "custom", customType: "allowed", fieldValues: { text: "Before" } }], settings: {} } as never;
  const session = createEditingSession({ content, mergeTags: { syntax: "liquid" as const, tags: [] } });
  expect(session.apply([{ op: "updateBlock", blockId: "c", set: { customType: "other" } }])).toMatchObject({ ok: false, feedback: expect.stringContaining("customType") });
  expect(session.apply([{ op: "updateBlock", blockId: "c", set: { type: "paragraph" } }])).toMatchObject({ ok: false, feedback: expect.stringContaining("type") });
  expect(session.apply([{ op: "updateBlock", blockId: "c", unset: ["customType"] }])).toMatchObject({ ok: false });
  expect(session.apply([{ op: "updateBlock", blockId: "c", set: { fieldValues: { text: "After" } } }])).toMatchObject({ ok: true });
  expect(session.content.blocks[0]).toMatchObject({ customType: "allowed", fieldValues: { text: "After" } });
});


it("refuses an invented liquid tag when no merge tags are declared", () => {
  const start = content();
  const session = createEditingSession({ content: start, mergeTags: { syntax: "liquid", tags: [] } });
  expect(session.apply([{ op: "updateBlock", blockId: "t1", set: { content: "<p>{{x}}</p>" } }])).toEqual({
    ok: false,
    feedback: "Refused: op 0 (updateBlock t1) was refused: it uses merge tags this editor doesn't declare: {{x}}",
  });
  expect(session.content).toEqual(start);
  expect(session.batches).toHaveLength(0);
});
