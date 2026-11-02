// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import type {
  MergeTagsConfig,
  Operation,
  TemplateContent,
} from "@templatical/types";
import { normalizeRemoteOperations } from "../src/utils/normalizeMergeTagMarkup";

const MERGE_TAGS: MergeTagsConfig = {
  tags: [{ label: "First name", value: "{{first_name}}", sample: "Ada" }],
};
const CHIP = '<span data-merge-tag="{{first_name}}">First name</span>';

const CONTENT = {
  blocks: [
    { id: "t1", type: "title", content: "<p>Hi</p>" },
    { id: "h1", type: "html", content: "<p>Hi</p>" },
    { id: "b1", type: "button", text: "Go", url: "https://example.com" },
    {
      id: "s1",
      type: "section",
      columns: "2",
      children: [[{ id: "p1", type: "paragraph", content: "<p>Left</p>" }], []],
    },
  ],
  settings: { width: 600 },
} as unknown as TemplateContent;

function normalize(
  ops: Operation[],
  mergeTags: MergeTagsConfig | undefined = MERGE_TAGS,
): Operation[] {
  return normalizeRemoteOperations(ops, CONTENT, mergeTags);
}

const paragraph = (id: string, content: string) =>
  ({ id, type: "paragraph", content }) as never;

describe("normalizeRemoteOperations", () => {
  it("turns a token in an added paragraph into a tag", () => {
    expect(
      normalize([
        {
          op: "addBlock",
          block: paragraph("p2", "<p>Hi {{first_name}}</p>"),
          parent: null,
          after: "t1",
        },
      ]),
    ).toEqual([
      {
        op: "addBlock",
        block: { id: "p2", type: "paragraph", content: `<p>Hi ${CHIP}</p>` },
        parent: null,
        after: "t1",
      },
    ]);
  });

  it("reaches the paragraphs inside an added section", () => {
    const [op] = normalize([
      {
        op: "addBlock",
        block: {
          id: "s2",
          type: "section",
          columns: "1",
          children: [[paragraph("p3", "<p>{{first_name}}</p>")]],
        } as never,
        parent: null,
        after: null,
      },
    ]);

    expect(
      (op as { block: { children: { content: string }[][] } }).block
        .children[0][0].content,
    ).toBe(`<p>${CHIP}</p>`);
  });

  it("rewrites set.content for a title, and for a paragraph in a column", () => {
    expect(
      normalize([
        {
          op: "updateBlock",
          blockId: "t1",
          set: { content: "<p>{{first_name}}</p>" },
        },
        {
          op: "updateBlock",
          blockId: "p1",
          set: { content: "<p>Hi {{first_name}}</p>" },
        },
      ]),
    ).toEqual([
      { op: "updateBlock", blockId: "t1", set: { content: `<p>${CHIP}</p>` } },
      {
        op: "updateBlock",
        blockId: "p1",
        set: { content: `<p>Hi ${CHIP}</p>` },
      },
    ]);
  });

  it("rewrites set.content for a paragraph the same batch added", () => {
    const [, update] = normalize([
      {
        op: "addBlock",
        block: paragraph("p2", "<p>Hi</p>"),
        parent: null,
        after: "t1",
      },
      {
        op: "updateBlock",
        blockId: "p2",
        set: { content: "<p>{{first_name}}</p>" },
      },
    ]);

    expect(update).toEqual({
      op: "updateBlock",
      blockId: "p2",
      set: { content: `<p>${CHIP}</p>` },
    });
  });

  it("leaves an html block's content, a button's text and an unknown block as they are", () => {
    const ops: Operation[] = [
      {
        op: "updateBlock",
        blockId: "h1",
        set: { content: "<p>{{first_name}}</p>" },
      },
      { op: "updateBlock", blockId: "b1", set: { text: "Hi {{first_name}}" } },
      {
        op: "updateBlock",
        blockId: "gone",
        set: { content: "<p>{{first_name}}</p>" },
      },
    ];

    expect(normalize(ops)).toBe(ops);
  });

  it("normalizes a replaced template", () => {
    const [op] = normalize([
      {
        op: "setContent",
        content: {
          blocks: [
            { id: "t9", type: "title", content: "<p>{{first_name}}</p>" },
          ],
          settings: { width: 600 },
        } as unknown as TemplateContent,
      },
    ]);

    expect(
      (op as { content: { blocks: { content: string }[] } }).content.blocks[0]
        .content,
    ).toBe(`<p>${CHIP}</p>`);
  });

  it("leaves a token inside an href byte-identical", () => {
    const html = '<p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>';
    const ops: Operation[] = [
      { op: "updateBlock", blockId: "t1", set: { content: html } },
    ];

    expect(normalize(ops)).toBe(ops);
  });

  it("normalizes under the liquid default when no merge tags are configured", () => {
    const [op] = normalize(
      [{ op: "updateBlock", blockId: "t1", set: { content: "<p>{{x}}</p>" } }],
      undefined,
    );

    expect(op).toEqual({
      op: "updateBlock",
      blockId: "t1",
      set: { content: '<p><span data-merge-tag="{{x}}">{{x}}</span></p>' },
    });
  });

  it("hands back the same array when nothing changes, and never changes its input", () => {
    const untouched: Operation[] = [
      { op: "deleteBlock", blockId: "t1" },
      { op: "updateSettings", set: { width: 640 } },
    ];
    const input: Operation[] = [
      {
        op: "updateBlock",
        blockId: "t1",
        set: { content: "<p>{{first_name}}</p>" },
      },
    ];
    const snapshot = JSON.parse(JSON.stringify(input));

    expect(normalize(untouched)).toBe(untouched);
    normalize(input);
    expect(input).toEqual(snapshot);
  });
});

it("keeps fresh translations current across normalized remote batches and remaps guards", async () => {
  const {
    applyOperations,
    createDefaultTemplateContent,
    createTitleBlock,
    localeCoverage,
    sourceHash,
  } = await import("@templatical/types");
  const content = createDefaultTemplateContent();
  content.settings.locale = "en";
  content.settings.locales = ["de", "fr"];
  content.blocks = [createTitleBlock({ id: "title", content: "Hello" })];
  const source = sourceHash("Hello {{first_name}}");
  const first = { value: "Hallo {{first_name}}", sourceHash: source };
  const stale = sourceHash("Earlier {{first_name}}");
  const ops: Operation[] = [
    {
      op: "updateBlock",
      blockId: "title",
      set: { content: "Hello {{first_name}}" },
    },
    {
      op: "updateBlockLocale",
      blockId: "title",
      locale: "de",
      text: { content: first },
    },
    {
      op: "updateBlockLocale",
      blockId: "title",
      locale: "de",
      text: { content: { value: "Guten Tag {{first_name}}", sourceHash: source } },
      expect: { text: { content: first } },
    },
    {
      op: "updateBlockLocale",
      blockId: "title",
      locale: "fr",
      text: { content: { value: "Bonjour {{first_name}}", sourceHash: stale } },
    },
  ];
  const snapshot = structuredClone(ops);
  const normalized = normalizeRemoteOperations(ops, content, MERGE_TAGS);
  const result = applyOperations(content, normalized);
  expect(localeCoverage(result, "de")).toEqual({
    translated: ["title/content"],
    missing: [],
    stale: [],
  });
  expect(localeCoverage(result, "fr").stale).toEqual(["title/content"]);
  expect(result.blocks[0].l10n?.fr.text?.content.sourceHash).toBe(stale);
  expect(ops).toEqual(snapshot);
});

it("uses the evolving block type after a remote content replacement", () => {
  const replacement = {
    blocks: [{ id: "new", type: "html", content: "raw" }],
    settings: { width: 600 },
  } as TemplateContent;
  const ops: Operation[] = [
    {
      op: "addBlock",
      block: paragraph("new", "raw"),
      parent: null,
      after: null,
    },
    { op: "setContent", content: replacement },
    { op: "updateBlock", blockId: "new", set: { content: "{{first_name}}" } },
  ];
  expect(normalize(ops)[2]).toBe(ops[2]);
});

it("rebases fresh source hashes after a raw guarded update over existing chip markup", async () => {
  const {
    applyOperations,
    createDefaultTemplateContent,
    createTitleBlock,
    localeCoverage,
    sourceHash,
  } = await import("@templatical/types");
  const content = createDefaultTemplateContent();
  content.settings.locale = "en";
  content.settings.locales = ["de"];
  content.blocks = [
    createTitleBlock({ id: "title", content: `<p>Hello ${CHIP}</p>` }),
  ];
  const rawDefault = "<p>Welcome {{first_name}}</p>";
  const ops: Operation[] = [
    {
      op: "updateBlock",
      blockId: "title",
      set: { content: rawDefault },
      expect: { content: "<p>Hello {{first_name}}</p>" },
    },
    {
      op: "updateBlockLocale",
      blockId: "title",
      locale: "de",
      text: {
        content: {
          value: "<p>Willkommen {{first_name}}</p>",
          sourceHash: sourceHash(rawDefault),
        },
      },
    },
  ];
  const snapshot = structuredClone({ content, ops });
  const normalized = normalizeRemoteOperations(ops, content, MERGE_TAGS);
  expect(normalized[0]).toMatchObject({
    expect: { content: `<p>Hello ${CHIP}</p>` },
  });
  const result = applyOperations(content, normalized);
  expect(result.blocks[0].l10n?.de.text?.content.sourceHash).toBe(
    sourceHash(`<p>Welcome ${CHIP}</p>`),
  );
  expect(localeCoverage(result, "de")).toEqual({
    translated: ["title/content"],
    missing: [],
    stale: [],
  });
  expect({ content, ops }).toEqual(snapshot);
});

it("propagates a failed locale-batch simulation before later hashes can use stale state", async () => {
  const {
    createDefaultTemplateContent,
    createTitleBlock,
    OperationError,
    sourceHash,
  } = await import("@templatical/types");
  const content = createDefaultTemplateContent();
  content.settings.locale = "en";
  content.settings.locales = ["de"];
  content.blocks = [createTitleBlock({ id: "title", content: "Hello" })];
  const ops: Operation[] = [
    {
      op: "updateBlock",
      blockId: "missing",
      set: { content: "Hello {{first_name}}" },
    },
    {
      op: "updateBlockLocale",
      blockId: "title",
      locale: "de",
      text: { content: { value: "Hallo", sourceHash: sourceHash("Hello") } },
    },
  ];
  const snapshot = structuredClone({ content, ops });
  expect(() => normalizeRemoteOperations(ops, content, MERGE_TAGS)).toThrow(
    OperationError,
  );
  expect({ content, ops }).toEqual(snapshot);
});

it("preserves the original batch index and refusal details from a singleton simulation", async () => {
  const {
    createDefaultTemplateContent,
    createTitleBlock,
    OperationError,
    sourceHash,
  } = await import("@templatical/types");
  const content = createDefaultTemplateContent();
  content.settings.locale = "en";
  content.settings.locales = ["de"];
  content.blocks = [createTitleBlock({ id: "title", content: "Hello" })];
  const ops: Operation[] = [
    { op: "updateBlock", blockId: "title", set: { content: "Welcome" } },
    {
      op: "updateBlockLocale",
      blockId: "missing",
      locale: "de",
      text: { content: { value: "Hallo", sourceHash: sourceHash("Hello") } },
    },
  ];
  const snapshot = structuredClone({ content, ops });
  let failure: unknown;
  try {
    normalizeRemoteOperations(ops, content, MERGE_TAGS);
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(OperationError);
  expect(failure).toMatchObject({
    code: "block_missing",
    opIndex: 1,
    message: 'No block with id "missing".',
    blockId: "missing",
  });
  expect({ content, ops }).toEqual(snapshot);
});
