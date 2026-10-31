import { describe, expect, it } from "vitest";
import {
  DANGEROUS_SCRIPT_SCHEMES,
  SAFE_LINK_SCHEMES,
  extractUrlScheme,
  isSafeHtmlUrl,
  normalizeUrlForSchemeCheck,
} from "../src";

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
