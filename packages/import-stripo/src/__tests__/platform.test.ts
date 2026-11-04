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
});
