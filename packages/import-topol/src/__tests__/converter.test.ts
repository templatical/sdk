import { describe, expect, it } from "vitest";
import { convertTopolTemplate } from "../converter";

const EMPTY_DESIGN = {
  tagName: "mj-global-style",
  attributes: {},
  children: [{ tagName: "mj-container", attributes: {}, children: [] }],
};

const INVALID_INPUT_MESSAGE =
  "Invalid Topol template: expected the design JSON object. If you fetched it from Topol's API, pass the response's \"json\" field.";

describe("convertTopolTemplate input guards", () => {
  it("throws a typed message for a non-object input", () => {
    expect(() => convertTopolTemplate(42 as never)).toThrow(
      INVALID_INPUT_MESSAGE,
    );
  });

  it("throws a typed message for a malformed JSON string", () => {
    expect(() => convertTopolTemplate("{not json")).toThrow(
      INVALID_INPUT_MESSAGE,
    );
  });

  it("throws a typed message for a null root", () => {
    expect(() => convertTopolTemplate(null as never)).toThrow(
      INVALID_INPUT_MESSAGE,
    );
  });

  it("throws a typed message for an array root", () => {
    expect(() => convertTopolTemplate([] as never)).toThrow(
      INVALID_INPUT_MESSAGE,
    );
  });

  it("throws a typed message when the root tagName is wrong", () => {
    expect(() =>
      convertTopolTemplate({ tagName: "mj-container" } as never),
    ).toThrow(
      'Invalid Topol template: expected a root node with tagName "mj-global-style".',
    );
  });

  it("accepts a JSON string and parses it", () => {
    const { content } = convertTopolTemplate(JSON.stringify(EMPTY_DESIGN));
    expect(content.blocks).toEqual([]);
  });

  it("warns when the design has no convertible content", () => {
    const { report } = convertTopolTemplate(EMPTY_DESIGN);
    expect(report.warnings).toEqual([
      "No convertible content was found in the Topol design. Check that the mj-container holds at least one mj-section.",
    ]);
    expect(report.summary).toEqual({
      total: 0,
      converted: 0,
      approximated: 0,
      htmlFallback: 0,
      skipped: 0,
    });
  });

  it("defaults every setting when the design declares none", () => {
    const { content } = convertTopolTemplate(EMPTY_DESIGN);
    expect(content.settings.width).toBe(600);
    expect(content.settings.backgroundColor).toBe("#ffffff");
    expect(content.settings.fontFamily).toBe("Arial");
    expect(content.settings.textColor).toBe("#1a1a1a");
    expect("preheaderText" in content.settings).toBe(false);
  });
});
