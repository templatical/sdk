import { describe, expect, it } from "vitest";
import {
  applyOperations,
  createDefaultTemplateContent,
  createMenuBlock,
  createSectionBlock,
  createSocialIconsBlock,
  createTableBlock,
  createWrapperBlock,
  elementIdIssues,
  generateId,
  type Operation,
} from "../src";

function elements() {
  return [
    createMenuBlock({
      items: [
        {
          id: "v1.2",
          text: "Shop",
          url: "https://example.com",
          openInNewTab: false,
          bold: false,
          underline: false,
        },
      ],
    }),
    createSocialIconsBlock({
      icons: [{ id: "a/b", platform: "facebook", url: "https://example.com" }],
    }),
    createTableBlock({
      rows: [{ id: "r.1", cells: [{ id: "c/1", content: "Cell" }] }],
    }),
  ];
}

describe("elementIdIssues", () => {
  it("reports menu, social, row and cell ids depth first without mutating", () => {
    const content = createDefaultTemplateContent();
    content.blocks = elements();
    const before = JSON.stringify(content);
    expect(elementIdIssues(content)).toEqual([
      { path: "blocks[0].items[0].id", id: "v1.2" },
      { path: "blocks[1].icons[0].id", id: "a/b" },
      { path: "blocks[2].rows[0].id", id: "r.1" },
      { path: "blocks[2].rows[0].cells[0].id", id: "c/1" },
    ]);
    expect(JSON.stringify(content)).toBe(before);
  });

  it("descends into section columns and layout wrappers", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createWrapperBlock({
        children: [
          createSectionBlock({
            columns: "2",
            children: [[elements()[0]], [elements()[2]]],
          }),
        ],
      }),
    ];
    expect(elementIdIssues(content)).toEqual([
      { path: "blocks[0].children[0].children[0][0].items[0].id", id: "v1.2" },
      { path: "blocks[0].children[0].children[1][0].rows[0].id", id: "r.1" },
      {
        path: "blocks[0].children[0].children[1][0].rows[0].cells[0].id",
        id: "c/1",
      },
    ]);
  });

  it("accepts UUIDs and hyphenated element ids", () => {
    const content = createDefaultTemplateContent();
    const menu = elements()[0] as ReturnType<typeof createMenuBlock>;
    menu.items[0].id = "nav-shop";
    content.blocks = [menu, createSocialIconsBlock(), createTableBlock()];
    expect(elementIdIssues(content)).toEqual([]);
  });

  it("generates ids from hex digits and hyphens", () => {
    expect(generateId()).toMatch(/^[0-9a-f-]+$/);
  });
});

it.each([
  ["addBlock", 'Element id "v1.2" must not contain "." or "/".'],
  ["updateBlock", 'Element id "r.1" must not contain "." or "/".'],
  ["setContent", 'Element id "a/b" must not contain "." or "/".'],
] as const)(
  "refuses %s with the carrying block id and exact message",
  (op, message) => {
    const content = createDefaultTemplateContent();
    const table = createTableBlock({ id: "table" });
    content.blocks = [table];
    const blocks = elements();
    blocks[0].id = "menu";
    blocks[1].id = "social";
    const operation: Operation =
      op === "addBlock"
        ? {
            op,
            block: createSectionBlock({ children: [[blocks[0]]] }),
            parent: null,
            after: null,
          }
        : op === "updateBlock"
          ? {
              op,
              blockId: "table",
              set: {
                rows: (blocks[2] as ReturnType<typeof createTableBlock>).rows,
              },
            }
          : { op, content: { ...content, blocks: [blocks[1]] } };
    const before = JSON.stringify(content);
    expect(() => applyOperations(content, [operation])).toThrowError(
      expect.objectContaining({
        code: "invalid_operation",
        opIndex: 0,
        blockId:
          op === "addBlock"
            ? "menu"
            : op === "updateBlock"
              ? "table"
              : "social",
        message,
      }),
    );
    expect(JSON.stringify(content)).toBe(before);
  },
);
