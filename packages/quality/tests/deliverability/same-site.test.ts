import { describe, expect, it } from "vitest";
import { isSameSite, MULTI_PART_SUFFIXES, parseHttpUrl, normalizedHost } from "../../src/deliverability/same-site";

describe("same site", () => {
  it.each([
    ["shop.example.com", "example.com", true],
    ["news.vw.de", "click.vw.de", true],
    ["example.co.uk", "evil.co.uk", false],
    ["a.example.co.uk", "b.example.co.uk", true],
    ["example.com.evil.io", "example.com", false],
    ["bücher.de", "xn--bcher-kva.de", true],
    ["203.0.113.7", "203.0.113.7", true],
    ["203.0.113.7", "203.0.113.8", false],
    ["[2001:db8::1]", "[2001:db8::2]", false],
  ] as const)("compares %s with %s", (left, right, expected) => {
    expect(isSameSite(left, right)).toBe(expected);
  });

  it("normalizes scheme, case, www, trailing dot, and IDN", () => {
    expect(normalizedHost(parseHttpUrl("HTTPS://WWW.BÜCHER.DE./x")!)).toBe("xn--bcher-kva.de");
    expect(parseHttpUrl("mailto:hi@example.com")).toBeNull();
    expect(parseHttpUrl("https://{{domain}}/x")).toBeNull();
  });

  it("pins the explicit multi-part suffix list", () => {
    expect(MULTI_PART_SUFFIXES).toEqual(
      "ac.jp ac.uk co.at co.id co.il co.in co.jp co.kr co.nz co.uk co.za com.ar com.au com.br com.cn com.co com.hk com.mx com.my com.ph com.pl com.sg com.tr com.tw com.ua edu.au go.jp gov.au gov.uk ltd.uk me.uk ne.jp net.au net.br net.cn net.in net.nz or.at or.jp or.kr org.au org.br org.cn org.in org.nz org.uk plc.uk".split(" "),
    );
  });
});
