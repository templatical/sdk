import { describe, expect, it } from "vitest";
import { convertContent } from "../block-mapper";

const text = (value: string, format = 0) => ({
  type: "text",
  text: value,
  format,
});
const state = (children: unknown[]) => ({ root: { type: "root", children } });
const paragraph = (children: unknown[]) => ({ type: "paragraph", children });
function html(textJson: unknown, type = "text") {
  const { block } = convertContent(
    { type, values: { textJson, text: "<p>Legacy</p>" } },
    [],
  );
  expect(block.type).toBe("paragraph");
  return "content" in block ? block.content : null;
}
describe("Unlayer modern text", () => {
  it("reads bold, a link and a line break instead of legacy text", () => {
    expect(
      html(
        state([
          paragraph([
            text("Hello", 1),
            { type: "linebreak" },
            {
              type: "link",
              url: "https://example.com/?a=1&b=2",
              children: [text("Site")],
            },
          ]),
        ]),
      ),
    ).toBe(
      '<p><strong>Hello</strong><br><a href="https://example.com/?a=1&amp;b=2">Site</a></p>',
    );
  });
  it("converts the paragraph content type", () => {
    expect(html(state([paragraph([text("Modern")])]), "paragraph")).toBe(
      "<p>Modern</p>",
    );
  });
  it.each([
    [1, "strong"],
    [2, "em"],
    [4, "s"],
    [8, "u"],
    [16, "code"],
    [32, "sub"],
    [64, "sup"],
  ])("reads format bit %s", (format, tag) => {
    expect(html(state([paragraph([text("Text", Number(format))])]))).toBe(
      `<p><${tag}>Text</${tag}></p>`,
    );
  });
  it("reads headings, lists, unknown-node children and escaped text", () => {
    expect(
      html(
        state([
          { type: "heading", tag: "h3", children: [text("Title")] },
          {
            type: "list",
            listType: "number",
            tag: "ol",
            children: [{ type: "listitem", children: [text("One")] }],
          },
          paragraph([{ type: "custom", children: [text("<safe>&")] }]),
        ]),
      ),
    ).toBe("<h3>Title</h3><ol><li>One</li></ol><p>&lt;safe&gt;&amp;</p>");
  });
  it("accepts serialized JSON and falls back when it cannot read the state", () => {
    expect(html(JSON.stringify(state([paragraph([text("JSON")])])))).toBe(
      "<p>JSON</p>",
    );
    for (const value of [null, {}, "{bad", { root: { type: "root" } }])
      expect(html(value)).toBe("<p>Legacy</p>");
  });
  it("preserves a heading-only Lexical state without a paragraph wrapper", () => {
    expect(
      html(state([{ type: "heading", tag: "h3", children: [text("Title")] }])),
    ).toBe("<h3>Title</h3>");
  });
  it("preserves a list-only Lexical state without a paragraph wrapper", () => {
    expect(
      html(
        state([
          {
            type: "list",
            tag: "ol",
            listType: "number",
            children: [{ type: "listitem", children: [text("One")] }],
          },
        ]),
      ),
    ).toBe("<ol><li>One</li></ol>");
    expect(html(null)).toBe("<p>Legacy</p>");
    const { block } = convertContent(
      { type: "text", values: { text: "Legacy inline" } },
      [],
    );
    expect(block).toHaveProperty("content", "<p>Legacy inline</p>");
  });
});
