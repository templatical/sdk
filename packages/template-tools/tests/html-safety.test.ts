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
    ["Preis < 10 € & mehr > 5", "Price < 10 € & more > 5"],
    ["Nutzen Sie <b> für Fett", "Use <b> for bold"],
    ["Hallo <!-- x -->", "Hello <!-- x -->"],
    ["Hallo &lt;b&gt;", "Hello"],
  ])("accepts %s for the source %s", async (text, source) => {
    const { isSafeTranslationText } = await import("../src/cli/html-safety");
    expect(isSafeTranslationText(text, source)).toBe(true);
  });
});
