import { describe, expect, it } from "vitest";
import { findOpenTagEnd, getTagAttrValue } from "../src/html-scan";

describe("findOpenTagEnd", () => {
  it("returns the index of the `>` that closes the open tag", () => {
    const html = '<span data-merge-tag="{{a}}">L</span>';
    const end = findOpenTagEnd(html, 5);
    expect(end).toBe(28);
    expect(html[end]).toBe(">");
  });

  it("ignores a `>` inside a double-quoted attribute value", () => {
    // Regression (#543): a custom merge-tag syntax whose value contains `>`
    // — e.g. Smarty-style `<% $email %>` — used to terminate the open-tag
    // scan mid-attribute, truncating the attribute string.
    const html = '<span data-merge-tag="<% $email %>">E-Mail</span>';
    const end = findOpenTagEnd(html, 5);
    expect(html.substring(5, end)).toBe(' data-merge-tag="<% $email %>"');
    expect(html[end]).toBe(">");
  });

  it("ignores a `>` inside a single-quoted attribute value", () => {
    const html = "<span data-merge-tag='<% $email %>'>E-Mail</span>";
    const end = findOpenTagEnd(html, 5);
    expect(html.substring(5, end)).toBe(" data-merge-tag='<% $email %>'");
  });

  it("does not treat a quote inside the other quote style as a delimiter", () => {
    const html = `<span title="it's > here" data-merge-tag="{{a}}">L</span>`;
    const end = findOpenTagEnd(html, 5);
    expect(html.substring(5, end)).toBe(
      ` title="it's > here" data-merge-tag="{{a}}"`,
    );
  });

  it("returns -1 when the open tag never closes", () => {
    expect(findOpenTagEnd("<span data-merge-tag=", 5)).toBe(-1);
  });

  it("returns -1 on an unterminated quote rather than guessing a tag end", () => {
    expect(findOpenTagEnd('<span data-merge-tag="{{a}}>L</span>', 5)).toBe(-1);
  });

  it("handles an open tag with no attributes", () => {
    expect(findOpenTagEnd("<span>L</span>", 5)).toBe(5);
  });
});

describe("getTagAttrValue", () => {
  it("extracts a double-quoted value", () => {
    expect(getTagAttrValue(' data-merge-tag="{{a}}"', "data-merge-tag")).toBe(
      "{{a}}",
    );
  });

  it("extracts a value containing `<` and `>` (#543)", () => {
    expect(
      getTagAttrValue(' data-merge-tag="<% $email %>"', "data-merge-tag"),
    ).toBe("<% $email %>");
  });

  it("extracts a single-quoted value", () => {
    expect(getTagAttrValue(" data-merge-tag='{{a}}'", "data-merge-tag")).toBe(
      "{{a}}",
    );
  });

  // Attribute values are entity-encoded in serialized HTML, so the raw
  // characters are what every caller wants back (#548 — the editor stores
  // `data-merge-tag="&lt;% $email %&gt;"`, which no longer matched the
  // configured `<% $email %>` and made every lookup miss).
  describe("entity decoding", () => {
    it("decodes an angle-bracket tag value (#548)", () => {
      expect(
        getTagAttrValue(' data-merge-tag="&lt;% $email %&gt;"', "data-merge-tag"),
      ).toBe("<% $email %>");
    });

    it("decodes the named entities an HTML serializer emits", () => {
      expect(getTagAttrValue(' x="a &amp; b"', "x")).toBe("a & b");
      expect(getTagAttrValue(' x="say &quot;hi&quot;"', "x")).toBe('say "hi"');
      expect(getTagAttrValue(" x=\"it&apos;s\"", "x")).toBe("it's");
      expect(getTagAttrValue(' x="a&nbsp;b"', "x")).toBe("a b");
    });

    it("decodes decimal and hex numeric references", () => {
      expect(getTagAttrValue(' x="&#60;%&#62;"', "x")).toBe("<%>");
      expect(getTagAttrValue(' x="&#x3C;%&#x3e;"', "x")).toBe("<%>");
    });

    it("decodes `&amp;lt;` to the literal text `&lt;`, not to `<`", () => {
      // One pass only. A second pass would turn a legitimately-escaped
      // entity in a consumer's tag value into markup.
      expect(getTagAttrValue(' x="&amp;lt;"', "x")).toBe("&lt;");
    });

    it("leaves an unknown or malformed entity untouched", () => {
      expect(getTagAttrValue(' x="&bogus; &amp"', "x")).toBe("&bogus; &amp");
    });

    it("leaves a value with no entities byte-identical", () => {
      expect(getTagAttrValue(' data-merge-tag="{{a}}"', "data-merge-tag")).toBe(
        "{{a}}",
      );
    });
  });

  it("extracts an unquoted value", () => {
    expect(
      getTagAttrValue(" data-merge-tag=abc class=x", "data-merge-tag"),
    ).toBe("abc");
  });

  it("matches the attribute name case-insensitively", () => {
    expect(getTagAttrValue(' DATA-MERGE-TAG="{{a}}"', "data-merge-tag")).toBe(
      "{{a}}",
    );
  });

  it("returns null when the attribute is absent", () => {
    expect(
      getTagAttrValue(' class="x" style="color:red"', "data-merge-tag"),
    ).toBe(null);
  });

  it("does not match a name that merely ends with the requested one", () => {
    expect(getTagAttrValue(' xdata-merge-tag="{{a}}"', "data-merge-tag")).toBe(
      null,
    );
  });

  it("does not match the requested name as a prefix of a longer one", () => {
    expect(getTagAttrValue(' data-merge-tag-index="3"', "data-merge-tag")).toBe(
      null,
    );
  });

  it("returns an empty string for an empty value", () => {
    expect(getTagAttrValue(' data-merge-tag=""', "data-merge-tag")).toBe("");
  });

  it("returns null for an unterminated quoted value", () => {
    expect(getTagAttrValue(' data-merge-tag="{{a}}', "data-merge-tag")).toBe(
      null,
    );
  });

  it("skips a boolean attribute that precedes the match", () => {
    expect(
      getTagAttrValue(' hidden data-merge-tag="{{a}}"', "data-merge-tag"),
    ).toBe("{{a}}");
  });

  it("runs in linear time over many attributes ending in an unterminated quote", () => {
    // The shape a backtracking regex chokes on: thousands of candidate
    // positions for the attribute name, and a value whose quote never closes.
    const adversarial =
      ' class="x"'.repeat(20_000) + ' data-merge-tag="unterminated';
    const start = Date.now();
    expect(getTagAttrValue(adversarial, "data-merge-tag")).toBe(null);
    expect(Date.now() - start).toBeLessThan(500);
  });

  it("pairs quotes the way an HTML parser does", () => {
    // `"a" b="c` — the second quote closes the first, so `x` reads as `a`.
    expect(getTagAttrValue(' x="a" data-merge-tag="c"', "x")).toBe("a");
  });
});
