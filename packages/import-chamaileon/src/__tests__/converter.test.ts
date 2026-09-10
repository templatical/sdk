import { describe, expect, it } from "vitest";
import { convertChamaileonTemplate } from "../converter";
import type { ChamaileonDocument } from "../types";

const EMPTY_DOC: ChamaileonDocument = {
  body: {
    eid: "root",
    type: "body",
    children: [],
    style: { bodyWidth: 600, backgroundColor: "#ffffff" },
    version: "4.1.0",
  },
};

const INVALID_MESSAGE =
  "Invalid Chamaileon template: expected the document JSON object from getDocument().";
const WRONG_BODY_MESSAGE =
  'Invalid Chamaileon template: expected body.type to be "body".';

describe("convertChamaileonTemplate input guards", () => {
  it("throws a typed message for a non-object input", () => {
    expect(() => convertChamaileonTemplate(42 as never)).toThrow(
      INVALID_MESSAGE,
    );
  });

  it("throws the same message for unparseable JSON", () => {
    expect(() => convertChamaileonTemplate("{")).toThrow(INVALID_MESSAGE);
  });

  it("throws when body.type is missing", () => {
    expect(() =>
      convertChamaileonTemplate({ body: { children: [] } } as never),
    ).toThrow(WRONG_BODY_MESSAGE);
  });

  it("throws on an Unlayer-shaped object rather than importing it", () => {
    expect(() =>
      convertChamaileonTemplate({ body: { rows: [] } } as never),
    ).toThrow(WRONG_BODY_MESSAGE);
  });

  it("accepts a JSON string and parses it", () => {
    const { content } = convertChamaileonTemplate(JSON.stringify(EMPTY_DOC));
    expect(content.blocks).toEqual([]);
  });

  it("warns when the document has no convertible content", () => {
    const { report } = convertChamaileonTemplate(EMPTY_DOC);
    expect(report.warnings).toEqual([
      "No convertible content was found in the Chamaileon document. Check that body.children holds at least one fullwidth.",
    ]);
    expect(report.summary).toEqual({
      total: 0,
      converted: 0,
      approximated: 0,
      htmlFallback: 0,
      skipped: 0,
    });
  });

  it("defaults every setting when the document declares none", () => {
    const { content } = convertChamaileonTemplate({
      body: { eid: "root", type: "body", children: [] },
    });
    expect(content.settings.width).toBe(600);
    expect(content.settings.backgroundColor).toBe("#ffffff");
    expect(content.settings.fontFamily).toBe("Arial");
    expect(content.settings.textColor).toBe("#1a1a1a");
    expect("preheaderText" in content.settings).toBe(false);
  });
});
