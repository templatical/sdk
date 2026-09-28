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

  it("serialises an html-node as its tag with its attributes", () => {
    expect(
      serialiseChildren([
        { text: "" },
        {
          type: "html-node",
          data: { tagName: "em" },
          attributes: { style: "font-style: italic" },
          children: [{ text: "The Studio," }],
        },
        { text: " est." },
      ]),
    ).toBe('<em style="font-style: italic">The Studio,</em> est.');
  });

  it("self-closes a void html-node and ignores its children", () => {
    expect(
      serialiseChildren([
        { text: "A" },
        {
          type: "html-node",
          data: { tagName: "br" },
          attributes: {},
          children: [{ text: "" }],
        },
        { text: "B" },
        {
          type: "html-node",
          data: { tagName: "IMG" },
          attributes: { src: "https://cdn.test/x.png", alt: "" },
          children: [{ text: "ignored" }],
        },
      ]),
    ).toBe('A<br />B<img src="https://cdn.test/x.png" />');
  });

  it("escapes html-node attribute values and keeps marks inside it", () => {
    expect(
      serialiseChildren([
        {
          type: "html-node",
          data: { tagName: "span" },
          attributes: {
            style: '\n  font-family: "Mono", monospace; content: "<&>";\n',
          },
          children: [{ text: "WELCOME10", bold: true }],
        },
      ]),
    ).toBe(
      '<span style="font-family: &quot;Mono&quot;, monospace; content: &quot;&lt;&amp;&gt;&quot;;"><strong>WELCOME10</strong></span>',
    );
  });

  it("drops html-node attributes that are not strings or not attribute names", () => {
    expect(
      serialiseChildren([
        {
          type: "html-node",
          data: { tagName: "a" },
          attributes: {
            href: "https://x.test",
            tabIndex: 3,
            hidden: true,
            title: "  ",
            'x" onload="y': "z",
          },
          children: [{ text: "Link" }],
        },
      ]),
    ).toBe('<a href="https://x.test">Link</a>');
  });

  it("falls back to span for a missing or invalid html-node tagName", () => {
    expect(
      serialiseChildren([
        { type: "html-node", data: {}, children: [{ text: "a" }] },
        {
          type: "html-node",
          data: { tagName: "x><script" },
          children: [{ text: "b" }],
        },
      ]),
    ).toBe("<span>a</span><span>b</span>");
  });

  it("emits a mergetag as the liquid token Easy Email Pro renders", () => {
    expect(
      serialiseChildren([
        { text: "Hello " },
        {
          type: "mergetag",
          data: {},
          attributes: {},
          children: [{ text: "customer.name" }],
        },
        { text: ", here is your order" },
      ]),
    ).toBe("Hello {{ customer.name }}, here is your order");
  });

  it("keeps the marks on a mergetag's text and trims its name", () => {
    expect(
      serialiseChildren([
        {
          type: "mergetag",
          data: { default: "friend" },
          attributes: {},
          children: [{ text: " order.number ", bold: true }],
        },
      ]),
    ).toBe("<strong>{{ order.number }}</strong>");
  });

  it("emits nothing for a mergetag with no name", () => {
    expect(
      serialiseChildren([
        { text: "Hi" },
        {
          type: "mergetag",
          data: {},
          attributes: {},
          children: [{ text: " " }],
        },
        { type: "mergetag", data: {}, attributes: {}, children: [] },
        { text: "!" },
      ]),
    ).toBe("Hi!");
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
