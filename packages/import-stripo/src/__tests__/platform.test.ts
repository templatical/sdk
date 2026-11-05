import { describe, expect, it } from "vitest";
import { normalizePlatform } from "../platform";

describe("normalizePlatform", () => {
  it("maps Xing from a title, alt, or icon filename", () => {
    expect(normalizePlatform("Xing")).toBe("xing");
    expect(normalizePlatform(undefined, undefined, "XING")).toBe("xing");
    expect(
      normalizePlatform(undefined, "https://cdn.example/icons/xing.png"),
    ).toBe("xing");
  });

  it("does not treat a longer word or another host as Xing", () => {
    expect(
      normalizePlatform(undefined, "https://cdn.example/icons/boxing.png"),
    ).toBe("website");
    expect(normalizePlatform(undefined, "https://notxing.com/a.png")).toBe(
      "website",
    );
  });

  it("identifies an icon by its file name, not by the host or folders of its URL", () => {
    expect(
      normalizePlatform(
        undefined,
        "https://xing.com.evil.example/icons/other.png",
      ),
    ).toBe("website");
    expect(
      normalizePlatform(undefined, "https://cdn.example/xing/other.png"),
    ).toBe("website");
    expect(
      normalizePlatform(undefined, "https://cdn.example/other.png?f=xing.png"),
    ).toBe("website");
    expect(
      normalizePlatform(undefined, "https://cdn.example/icons/xing.png?v=2#a"),
    ).toBe("xing");
  });

  it("does not read a platform from the host when the URL has no file name", () => {
    expect(
      normalizePlatform(
        undefined,
        "https://xing.com.evil.example?file=other.png",
      ),
    ).toBe("website");
    expect(normalizePlatform(undefined, "https://xing.com.evil.example")).toBe(
      "website",
    );
    expect(
      normalizePlatform(undefined, "https://xing.com.evil.example/#xing.png"),
    ).toBe("website");
    expect(normalizePlatform(undefined, "http://[")).toBe("website");
    expect(normalizePlatform("mailbox")).toBe("website");
  });

  it("reads the file name of a protocol-relative or relative src", () => {
    expect(normalizePlatform(undefined, "//cdn.example/icons/xing.png")).toBe(
      "xing",
    );
    expect(normalizePlatform(undefined, "icons/xing.png")).toBe("xing");
    expect(normalizePlatform(undefined, "xing.png?v=2")).toBe("xing");
  });

  it("lets an explicit website label outrank the platform a file name suggests", () => {
    expect(
      normalizePlatform("Website", "https://cdn.example/icons/facebook.png"),
    ).toBe("website");
    expect(
      normalizePlatform(
        undefined,
        "https://cdn.example/icons/facebook.png",
        "Web",
      ),
    ).toBe("website");
    expect(
      normalizePlatform("Facebook", "https://cdn.example/icons/web.png"),
    ).toBe("facebook");
    expect(
      normalizePlatform(undefined, "https://cdn.example/icons/web.png"),
    ).toBe("website");
  });
});
