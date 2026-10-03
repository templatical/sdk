import { afterEach, describe, expect, it, vi } from "vitest";
import { formatList } from "../src/utils/formatList";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("formatList", () => {
  it.each([
    ["en", "Images, Videos, Audio"],
    ["ja", "Images、Videos、Audio"],
    ["de", "Images, Videos und Audio"],
  ])("joins the way %s writes a list", (locale, expected) => {
    expect(formatList(["Images", "Videos", "Audio"], locale)).toBe(expected);
  });

  it("returns a single item unchanged", () => {
    expect(formatList(["Images"], "en")).toBe("Images");
  });

  it("falls back to the runtime locale for a malformed tag", () => {
    expect(formatList(["A", "B"], "not a locale!")).toBe(
      new Intl.ListFormat(undefined, {
        style: "narrow",
        type: "conjunction",
      }).format(["A", "B"]),
    );
  });

  it("rethrows anything that is not a malformed-locale RangeError", () => {
    const failure = new TypeError("ListFormat unavailable");
    vi.stubGlobal("Intl", {
      ...Intl,
      ListFormat: class {
        constructor() {
          throw failure;
        }
      },
    });
    expect(() => formatList(["A"], "en")).toThrow(failure);
  });
});
