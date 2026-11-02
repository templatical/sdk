import { describe, expect, it } from "vitest";
import {
  DANGEROUS_SCRIPT_SCHEMES,
  HTML_URL_ATTRIBUTES,
  HTML_FORBIDDEN_ATTRIBUTES,
  isSafeUrlAttribute,
  SAFE_LINK_SCHEMES,
  extractUrlScheme,
  isSafeHtmlUrl,
  normalizeUrlForSchemeCheck,
} from "../src/url-policy";

describe("shared URL scheme policy", () => {
  it("normalizes the same controls that the browser URL parser removes", () => {
    expect(
      normalizeUrlForSchemeCheck("\u0001 java\tsc\nript:\ralert(1) "),
    ).toBe("javascript:alert(1)");
    expect(extractUrlScheme("\u0001 JaVa\nScRiPt:alert(1)")).toBe("javascript");
    expect(extractUrlScheme("/relative/path")).toBe(null);
  });

  it("exports the link and dangerous-scheme sets", () => {
    expect(SAFE_LINK_SCHEMES).toEqual([
      "http",
      "https",
      "mailto",
      "tel",
      "ftp",
      "ftps",
      "sms",
      "xmpp",
      "cid",
    ]);
    expect(DANGEROUS_SCRIPT_SCHEMES).toEqual([
      "javascript",
      "data",
      "vbscript",
    ]);
    expect(Object.isFrozen(SAFE_LINK_SCHEMES)).toBe(true);
    expect(Object.isFrozen(DANGEROUS_SCRIPT_SCHEMES)).toBe(true);
  });

  it("allows image data only for src", () => {
    expect(isSafeHtmlUrl("data:image/png;base64,AA", "src")).toBe(true);
    expect(isSafeHtmlUrl("data:image/svg+xml;utf8,x", "src")).toBe(true);
    expect(isSafeHtmlUrl("data:image/png;base64,AA", "href")).toBe(false);
    expect(isSafeHtmlUrl("data:text/html,x", "src")).toBe(false);
    expect(isSafeHtmlUrl("java\tscript:alert(1)", "href")).toBe(false);
    expect(isSafeHtmlUrl("#section", "href")).toBe(true);
  });
});

describe("isSafeUrlAttribute", () => {
  it.each([
    ["href", "javascript:alert(1)"],
    ["href", "JaVaScRiPt:alert(1)"],
    ["href", " javascript:alert(1)"],
    ["href", "java\tscript:alert(1)"],
    ["href", "java\nscript:alert(1)"],
    ["href", "java\rscript:alert(1)"],
    ["href", "\x01javascript:alert(1)"],
    ["href", "\tj\na\rv\ta\nscript:alert(1)"],
    ["href", "vbscript:msgbox(1)"],
    ["href", "file:///etc/passwd"],
    ["href", "data:text/html,x"],
    ["href", "data:image/png;base64,AAAA"],
    ["HREF", "javascript:alert(1)"],
    ["xlink:href", "javascript:alert(1)"],
    ["formaction", "javascript:alert(1)"],
    ["action", "javascript:alert(1)"],
    ["ping", "javascript:alert(1)"],
    ["background", "javascript:alert(1)"],
    ["poster", "javascript:alert(1)"],
    ["src", "javascript:alert(1)"],
    ["src", "java\tscript:alert(1)"],
    ["src", "data:text/html,x"],
  ])("refuses %s=%j", (name, value) => {
    expect(isSafeUrlAttribute(name, value)).toBe(false);
  });

  it.each([
    ["href", "https://x.test"],
    ["href", " https://x.test"],
    ["href", "mailto:x@x.test"],
    ["href", "tel:+1234"],
    ["href", "sms:+1234"],
    ["href", "#top"],
    ["href", "/relative/path"],
    ["href", "{{url}}"],
    ["href", ""],
    ["src", "data:image/png;base64,AAAA"],
    ["src", "data:image/svg+xml;base64,AAAA"],
    ["title", "javascript:alert(1)"],
    ["data-merge-tag", "javascript:alert(1)"],
  ])("accepts %s=%j", (name, value) => {
    expect(isSafeUrlAttribute(name, value)).toBe(true);
  });
});

describe("HTML attribute policy parity", () => {
  it("shares the editor hook's URL attributes and forbidden config attributes", () => {
    expect(HTML_URL_ATTRIBUTES).toEqual([
      "href",
      "xlink:href",
      "background",
      "poster",
      "src",
    ]);
    expect(HTML_FORBIDDEN_ATTRIBUTES).toEqual([
      "srcdoc",
      "ping",
      "formaction",
      "action",
    ]);
    expect(Object.isFrozen(HTML_URL_ATTRIBUTES)).toBe(true);
    expect(Object.isFrozen(HTML_FORBIDDEN_ATTRIBUTES)).toBe(true);
  });

  it.each(["srcdoc", "ping", "formaction", "action"])(
    "refuses %s even with an empty or safe value, as the sanitizer does",
    (name) => {
      for (const value of ["", "https://example.com", "javascript:alert(1)"])
        expect(isSafeUrlAttribute(name.toUpperCase(), value)).toBe(false);
    },
  );

  it("uses isSafeHtmlUrl for every shared URL attribute", () => {
    for (const attribute of HTML_URL_ATTRIBUTES)
      for (const value of [
        "",
        "#top",
        "/relative/path",
        "{{url}}",
        ...SAFE_LINK_SCHEMES.map((scheme) => `${scheme}:example`),
        "data:image/png;base64,AAAA",
        "data:image/svg+xml;utf8,x",
        "data:text/html,x",
        "javascript:alert(1)",
        "java\tscript:alert(1)",
        "\x01javascript:alert(1)",
        "vbscript:msgbox(1)",
        "file:///etc/passwd",
      ])
        expect(
          isSafeUrlAttribute(attribute.toUpperCase(), value),
          `${attribute}=${value}`,
        ).toBe(isSafeHtmlUrl(value, attribute));
  });
});
