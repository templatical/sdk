import { describe, expect, it } from "vitest";
import { serialiseChildren } from "../rich-text";

describe("serialiseChildren", () => {
  it("emits plain text", () => {
    expect(serialiseChildren([{ text: "Hello" }])).toBe("Hello");
  });

  it("escapes HTML in text", () => {
    expect(serialiseChildren([{ text: "a < b & c" }])).toBe("a &lt; b &amp; c");
  });

  it("wraps bold and a link", () => {
    expect(
      serialiseChildren([
        {
          text: "Click",
          bold: true,
          link: { href: "https://example.com", blank: true },
        },
      ]),
    ).toBe(
      '<a href="https://example.com" target="_blank"><strong>Click</strong></a>',
    );
  });

  it("inserts <br> for line-break nodes", () => {
    expect(
      serialiseChildren([{ text: "A" }, { type: "line-break" }, { text: "B" }]),
    ).toBe("A<br>B");
  });

  it("wraps html-block-node in its tagName", () => {
    expect(
      serialiseChildren([
        {
          type: "html-block-node",
          data: { tagName: "div" },
          children: [{ text: "View drink menu", bold: true }],
        },
      ]),
    ).toBe("<div><strong>View drink menu</strong></div>");
  });

  it("uses div when tagName is missing", () => {
    expect(
      serialiseChildren([
        { type: "html-block-node", data: {}, children: [{ text: "x" }] },
      ]),
    ).toBe("<div>x</div>");
  });

  it("returns empty string for empty children", () => {
    expect(serialiseChildren([])).toBe("");
    expect(serialiseChildren(undefined)).toBe("");
  });

  it("leaves liquid merge tags as text", () => {
    expect(serialiseChildren([{ text: "{{ order.number }}" }])).toBe(
      "{{ order.number }}",
    );
  });
});
