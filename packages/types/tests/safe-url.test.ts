import { describe, expect, it } from "vitest";
import { isSafeUrlAttribute } from "../src";

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
