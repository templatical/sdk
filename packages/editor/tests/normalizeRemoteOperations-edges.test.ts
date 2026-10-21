// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import type {
  MergeTagsConfig,
  Operation,
  TemplateContent,
} from "@templatical/types";
import { normalizeRemoteOperations } from "../src/utils/normalizeMergeTagMarkup";

/**
 * Where `normalizeRemoteOperations` looks up the type of the block an
 * `updateBlock` names — inside a wrapper, past entries that aren't blocks —
 * and batches or content that aren't well formed, which it passes on for the
 * engine to judge rather than throwing.
 */

const MERGE_TAGS: MergeTagsConfig = {
  tags: [{ label: "First name", value: "{{first_name}}", sample: "Ada" }],
};
const CHIP = '<span data-merge-tag="{{first_name}}">First name</span>';

function setTitle(blockId: string): Operation {
  return {
    op: "updateBlock",
    blockId,
    set: { content: "<p>Hi {{first_name}}</p>" },
  };
}

const NORMALIZED = { content: `<p>Hi ${CHIP}</p>` };

function contentOf(blocks: unknown): TemplateContent {
  return { blocks, settings: { width: 600 } } as unknown as TemplateContent;
}

describe("normalizeRemoteOperations — finding the block", () => {
  it("finds a paragraph inside a wrapper", () => {
    const content = contentOf([
      {
        id: "w1",
        type: "wrapper",
        children: [{ id: "p1", type: "paragraph", content: "<p>Hi</p>" }],
      },
    ]);

    expect(
      normalizeRemoteOperations([setTitle("p1")], content, MERGE_TAGS),
    ).toEqual([{ ...setTitle("p1"), set: NORMALIZED }]);
  });

  it("looks past a wrapper that doesn't hold the block", () => {
    const content = contentOf([
      {
        id: "w1",
        type: "wrapper",
        children: [{ id: "h1", type: "html", content: "<p>Hi</p>" }],
      },
      { id: "t1", type: "title", content: "<p>Hi</p>" },
    ]);

    expect(
      normalizeRemoteOperations([setTitle("t1")], content, MERGE_TAGS),
    ).toEqual([{ ...setTitle("t1"), set: NORMALIZED }]);
  });

  it("skips entries that aren't blocks, and columns that aren't lists", () => {
    const content = contentOf([
      null,
      "t0",
      {
        id: "s1",
        type: "section",
        columns: "2",
        children: [null, [{ id: "p1", type: "paragraph", content: "" }]],
      },
    ]);

    expect(
      normalizeRemoteOperations([setTitle("p1")], content, MERGE_TAGS),
    ).toEqual([{ ...setTitle("p1"), set: NORMALIZED }]);
  });

  it("leaves an update alone when the content has no block list", () => {
    const ops = [setTitle("t1")];

    expect(normalizeRemoteOperations(ops, contentOf(null), MERGE_TAGS)).toBe(
      ops,
    );
  });
});

describe("normalizeRemoteOperations — blocks the batch adds", () => {
  it("finds a paragraph inside a wrapper the same batch added, past entries that aren't blocks", () => {
    const add: Operation = {
      op: "addBlock",
      block: {
        id: "w1",
        type: "wrapper",
        children: ["divider", { id: "p5", type: "paragraph", content: "" }],
      } as never,
      parent: null,
      after: null,
    };

    const [first, second] = normalizeRemoteOperations(
      [add, setTitle("p5")],
      contentOf([]),
      MERGE_TAGS,
    );

    expect(first).toBe(add);
    expect(second).toEqual({ ...setTitle("p5"), set: NORMALIZED });
  });

  it("records nothing for an added block without an id", () => {
    const ops: Operation[] = [
      {
        op: "addBlock",
        block: { id: 7, type: "paragraph", content: "" } as never,
        parent: null,
        after: null,
      },
      setTitle("7"),
    ];

    expect(normalizeRemoteOperations(ops, contentOf([]), MERGE_TAGS)).toBe(ops);
  });
});

describe("normalizeRemoteOperations — malformed batches", () => {
  it.each([
    ["no block", undefined],
    ["a null block", null],
    ["a block that is a string", "p9"],
  ])("passes on an addBlock with %s untouched", (_label, block) => {
    const add = {
      op: "addBlock",
      block,
      parent: null,
      after: null,
    } as unknown as Operation;
    const ops = [add];

    expect(
      normalizeRemoteOperations(
        ops,
        contentOf([{ id: "t1", type: "title" }]),
        MERGE_TAGS,
      ),
    ).toBe(ops);
  });

  it("still normalizes the rest of a batch around such an addBlock", () => {
    const add = {
      op: "addBlock",
      block: null,
      parent: null,
      after: null,
    } as unknown as Operation;

    const next = normalizeRemoteOperations(
      [add, setTitle("t1")],
      contentOf([{ id: "t1", type: "title", content: "" }]),
      MERGE_TAGS,
    );

    expect(next[0]).toBe(add);
    expect(next[1]).toEqual({ ...setTitle("t1"), set: NORMALIZED });
  });
});
