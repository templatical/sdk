import { describe, expect, it } from "vitest";
import {
  HTML_URL_ATTRIBUTES,
  HTML_FORBIDDEN_ATTRIBUTES,
  SAFE_LINK_SCHEMES,
  isSafeHtmlUrl,
  isSafeUrlAttribute,
} from "@templatical/types";
import { isSafeTranslationHtml } from "../src/cli/html-safety";

describe("translation HTML safety", () => {
  it.each(["</table>", "</mj-text>", "<p>x</div>"])(
    "rejects explicit disallowed closing tags in %s without reading attribute text as tags",
    async (html) => {
      const { isSafeTranslationHtml } = await import("../src/cli/html-safety");
      expect(isSafeTranslationHtml(html)).toBe(false);
      expect(
        isSafeTranslationHtml('<p title="</table> </mj-text> <div>">x</p>'),
      ).toBe(true);
    },
  );
  it.each([
    "<script>alert(1)</script>",
    '<img onerror="alert(1)" src="x">',
    '<a href=" JavaScript:alert(1)">x</a>',
    '<a href="&#x6a;avascript:alert(1)">x</a>',
    '<span ONCLICK="alert(1)">x</span>',
    '<span src=" javascript:x">x</span>',
    '<iframe src="https://x.test"></iframe>',
    '<x id="1"/>',
  ])("rejects %s", async (html) => {
    const { isSafeTranslationHtml } = await import("../src/cli/html-safety");
    expect(isSafeTranslationHtml(html)).toBe(false);
  });
  it.each([
    '<p><strong>Hi</strong> <a href="https://x.test">x</a></p>',
    "<p><b>B</b><em>E</em><i>I</i><u>U</u><s>S</s><br><span>Text</span></p>",
    '<span data-merge-tag="{{name}}">Name</span><span data-logic-merge-tag="{% endif %}">ENDIF</span>',
  ])("accepts %s", async (html) => {
    const { isSafeTranslationHtml } = await import("../src/cli/html-safety");
    expect(isSafeTranslationHtml(html)).toBe(true);
  });
});

describe("translation HTML safety: comment-like markup", () => {
  it.each([
    "<p><![CDATA[><img src=x onerror=alert(1)>]]>Hallo</p>",
    "<p>Hallo<!-- note --></p>",
    "<p>Hallo<!x></p>",
    "<!doctype html><p>Hallo</p>",
    "<p><?xml version?>Hallo</p>",
  ])("rejects %s when the source carries no such markup", async (html) => {
    const { isSafeTranslationHtml } = await import("../src/cli/html-safety");
    expect(isSafeTranslationHtml(html, "<p>Hello</p>")).toBe(false);
  });
  it("accepts a comment the source carries byte for byte, and no other", async () => {
    const { isSafeTranslationHtml } = await import("../src/cli/html-safety");
    const source = "<p>Hello<!-- note --></p>";
    expect(isSafeTranslationHtml("<p><!-- note -->Hallo</p>", source)).toBe(
      true,
    );
    expect(isSafeTranslationHtml("<p>Hallo<!-- other --></p>", source)).toBe(
      false,
    );
    expect(
      isSafeTranslationHtml(
        "<p><![CDATA[><img src=x onerror=alert(1)>]]>Hallo</p>",
        source,
      ),
    ).toBe(false);
  });
  it("rejects a string that ends inside a tag", async () => {
    const { isSafeTranslationHtml } = await import("../src/cli/html-safety");
    expect(
      isSafeTranslationHtml(
        "<p>Hallo <span onmouseover=alert(1)//",
        "<p>Hello</p>",
      ),
    ).toBe(false);
    expect(
      isSafeTranslationHtml("<p>Hallo <span title=x", "<p>Hello</p>"),
    ).toBe(false);
  });
});

describe("translation HTML safety: URL attributes", () => {
  it("uses the shared URL rule and attribute sets for strings import", () => {
    for (const name of [...HTML_URL_ATTRIBUTES, ...HTML_FORBIDDEN_ATTRIBUTES])
      for (const value of [
        "",
        "#top",
        "/relative/path",
        "{{url}}",
        ...SAFE_LINK_SCHEMES.map((scheme) => `${scheme}:example`),
        "data:image/png;base64,AAAA",
        "data:text/html,x",
        "javascript:alert(1)",
        "java\tscript:alert(1)",
        "file:///tmp/x",
      ]) {
        const allowed =
          HTML_URL_ATTRIBUTES.some((attribute) => attribute === name) &&
          isSafeHtmlUrl(value, name);
        expect(isSafeUrlAttribute(name, value), `${name}=${value}`).toBe(
          allowed,
        );
        expect(
          isSafeTranslationHtml(`<span ${name}="${value}">x</span>`),
          `${name}=${value}`,
        ).toBe(allowed);
      }
  });

  it.each(["ping", "formaction", "action", "srcdoc"])(
    "rejects forbidden %s even with a safe URL",
    (name) => {
      expect(
        isSafeTranslationHtml(`<span ${name}="https://x.test">x</span>`),
      ).toBe(false);
    },
  );

  it.each([
    '<a href="java\tscript:alert(1)">x</a>',
    '<a href="java&#9;script:alert(1)">x</a>',
    '<a href="java&#x09;script:alert(1)">x</a>',
    '<a href="\x01javascript:alert(1)">x</a>',
    '<a href="&#1;javascript:alert(1)">x</a>',
    '<a href="data:text/html,x">x</a>',
    '<a href="data:image/png;base64,AAAA">x</a>',
    '<a href="vbscript:msgbox(1)">x</a>',
    '<a href="file:///etc/passwd">x</a>',
    '<span src="data:text/html,x">x</span>',
    '<a ping="javascript:alert(1)">x</a>',
    '<a xlink:href="javascript:alert(1)">x</a>',
    '<span background="java&#9;script:alert(1)">x</span>',
    '<span formaction="vbscript:x">x</span>',
  ])("rejects %s, as the editor's sanitizer removes it", async (html) => {
    const { isSafeTranslationHtml } = await import("../src/cli/html-safety");
    expect(isSafeTranslationHtml(html)).toBe(false);
  });
  it.each([
    '<a href="https://x.test">x</a>',
    '<a href=" https://x.test">x</a>',
    '<a href="mailto:x@x.test">x</a>',
    '<a href="tel:+1234">x</a>',
    '<a href="#top">x</a>',
    '<a href="/relative/path">x</a>',
    '<a href="{{url}}">x</a>',
    '<span src="data:image/png;base64,AAAA">x</span>',
    '<span title="javascript:alert(1)">x</span>',
  ])("accepts %s, as the editor's sanitizer keeps it", async (html) => {
    const { isSafeTranslationHtml } = await import("../src/cli/html-safety");
    expect(isSafeTranslationHtml(html)).toBe(true);
  });
});

describe("translation text safety", () => {
  it.each([
    ["Hallo <img src=x onerror=alert(1)>", "Hello"],
    ["Hallo <b>", "Hello"],
    ["a<b", "a is less than b"],
    ["Hallo </b>", "Hello"],
    ["Hallo <!-- x -->", "Hello"],
    ["Hallo <![CDATA[x]]>", "Hello"],
    ["<!doctype html>Hallo", "Hello"],
    ["Hallo <span onmouseover=alert(1)//", "Hello"],
    ['Nutzen Sie <b onclick="alert(1)"> für Fett', "Use <b> for bold"],
  ])("rejects %s for the source %s", async (text, source) => {
    const { isSafeTranslationText } = await import("../src/cli/html-safety");
    expect(isSafeTranslationText(text, source)).toBe(false);
  });
  it.each([
    ["Hallo", "Hello"],
    ["a<b", "a<b"],
    ["a < b", "a is less than b"],
    ["Preis < 10 € & mehr > 5", "Price < 10 € & more > 5"],
    ["Nutzen Sie <b> für Fett", "Use <b> for bold"],
    ["Hallo <!-- x -->", "Hello <!-- x -->"],
    ["Hallo &lt;b&gt;", "Hello"],
  ])("accepts %s for the source %s", async (text, source) => {
    const { isSafeTranslationText } = await import("../src/cli/html-safety");
    expect(isSafeTranslationText(text, source)).toBe(true);
  });
});

describe("translation HTML safety: style values", () => {
  it.each([
    ["adds a style", "<p>Hello</p>", '<p style="color:red">Hallo</p>', false],
    [
      "changes a style",
      '<p style="color:red">Hello</p>',
      '<p style="color:blue">Hallo</p>',
      false,
    ],
    [
      "changes only the spacing of a style",
      '<p style="color:red">Hello</p>',
      '<p style="color: red">Hallo</p>',
      false,
    ],
    [
      "respells a style with a character reference",
      '<p style="color:red">Hello</p>',
      '<p style="color:&#114;ed">Hallo</p>',
      false,
    ],
    [
      "adds a remote fetch to a source style",
      '<p style="color:red">Hello</p>',
      '<p style="color:red;background:url(https://x.test/p.gif)">Hallo</p>',
      false,
    ],
    [
      "repeats the attribute with another value",
      '<p style="color:red">Hello</p>',
      '<p style="color:red" STYLE="color:blue">Hallo</p>',
      false,
    ],
    [
      "adds a style to another element",
      '<p style="color:red">Hello</p>',
      '<p style="color:red"><span style="color:blue">Hallo</span></p>',
      false,
    ],
    [
      "adds an unquoted style",
      "<p>Hello</p>",
      "<p style=position:fixed>Hallo</p>",
      false,
    ],
    ["adds a valueless style", "<p>Hello</p>", "<p style>Hallo</p>", false],
    [
      "keeps a style",
      '<p style="color:red">Hello</p>',
      '<p style="color:red">Hallo</p>',
      true,
    ],
    [
      "keeps a style in another quoting and case",
      '<p style="color:red">Hello</p>',
      "<p STYLE='color:red'>Hallo</p>",
      true,
    ],
    [
      "moves a style to another element",
      '<p style="color:red">Hello</p>',
      '<p><span style="color:red">Hallo</span></p>',
      true,
    ],
    [
      "drops the styles",
      '<p style="color:red">Hello</p>',
      "<p>Hallo</p>",
      true,
    ],
    ["has no styles", "<p>Hello</p>", "<p>Hallo</p>", true],
    [
      "writes a style only inside another attribute",
      "<p>Hello</p>",
      "<p title='style=\"color:red\"'>Hallo</p>",
      true,
    ],
  ])("%s", (_name, source, html, safe) => {
    expect(isSafeTranslationHtml(html, source)).toBe(safe);
  });
});

describe("markup-like less-than hint", () => {
  it.each([
    ["a<b", "a is less than b", true],
    ["Hallo <img src=x onerror=alert(1)>", "Hello", true],
    ["Hallo <!-- x -->", "Hello", false],
    ["Hallo </b>", "Hello", false],
    ["Preis < 10", "Price < 10", false],
    ["a<b", "a<b", false],
  ])("for %s with the source %s: %s", async (text, source, hint) => {
    const { hasMarkupLikeLessThan } = await import("../src/cli/html-safety");
    expect(hasMarkupLikeLessThan(text, source)).toBe(hint);
  });
});
