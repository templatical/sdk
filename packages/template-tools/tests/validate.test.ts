import { describe, expect, it } from "vitest";
import { runQualityLint, validateTemplate } from "../src/validate";

const padding = { top: 8, right: 8, bottom: 8, left: 8 };

const settings = {
  width: 600,
  backgroundColor: "#ffffff",
  textColor: "#111111",
  fontFamily: "Arial, sans-serif",
  linkUnderline: true,
  locale: "en",
};

function template(blocks: unknown[]) {
  return { blocks, settings };
}

/** A structurally complete title block — `level` and `textAlign` are required. */
function title(id: string, content: string, extra: object = {}) {
  return {
    id,
    type: "title",
    content,
    level: 1,
    textAlign: "left",
    styles: { padding },
    ...extra,
  };
}

describe("validateTemplate — happy path", () => {
  it("accepts a minimal valid template", () => {
    const result = validateTemplate(template([title("title_1", "Hi")]));
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("accepts a section with matching column count", () => {
    const result = validateTemplate(
      template([
        {
          id: "sec_1",
          type: "section",
          columns: "2",
          styles: { padding },
          children: [
            [title("t_1", "Left")],
            [
              {
                id: "p_1",
                type: "paragraph",
                content: "Right",
                styles: { padding },
              },
            ],
          ],
        },
      ]),
    );
    expect(result.valid).toBe(true);
  });
});

describe("validateTemplate — unhappy path", () => {
  it("rejects a non-object root", () => {
    expect(validateTemplate(null)).toEqual({
      valid: false,
      errors: ["(root) must be an object"],
    });
    expect(validateTemplate([]).errors).toEqual(["(root) must be an object"]);
    expect(validateTemplate("nope").valid).toBe(false);
  });

  it("reports a missing blocks array and a missing settings object", () => {
    const result = validateTemplate({});
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("blocks must be an array");
    expect(result.errors).toContain("settings must be an object");
  });

  it("names the block type in a per-block error", () => {
    const result = validateTemplate(
      template([{ id: "btn_1", type: "button", styles: { padding } }]),
    );
    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (e) =>
          e.startsWith("blocks[0] (button)") &&
          e.includes("must have required property"),
      ),
    ).toBe(true);
  });

  it("lists the known types when a block type is unknown", () => {
    const result = validateTemplate(
      template([{ id: "x", type: "carousel", styles: { padding } }]),
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain(
      'blocks[0] has unknown or missing block type "carousel"',
    );
    expect(result.errors[0]).toContain("button");
  });

  it("reports a missing block type as unknown rather than crashing", () => {
    const result = validateTemplate(template([{ id: "x", styles: { padding } }]));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("unknown or missing block type");
  });

  it("rejects unknown properties", () => {
    const result = validateTemplate(
      template([title("t", "Hi", { bogus: 1 })]),
    );
    expect(result.valid).toBe(false);
    // Otherwise-valid block: the only complaint must be the unknown property.
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("(bogus)");
  });
});

describe("validateTemplate — nested blocks", () => {
  it("reports errors inside a section column with a precise path", () => {
    const result = validateTemplate(
      template([
        {
          id: "sec_1",
          type: "section",
          columns: "1",
          styles: { padding },
          children: [[{ id: "btn_1", type: "button", styles: { padding } }]],
        },
      ]),
    );
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) =>
        e.startsWith("blocks[0].children[0][0] (button)"),
      ),
    ).toBe(true);
  });

  it("validates the section itself as well as its children", () => {
    const result = validateTemplate(
      template([
        { id: "sec_1", type: "section", styles: { padding }, children: [[]] },
      ]),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith("blocks[0] (section)"))).toBe(
      true,
    );
  });
});

describe("runQualityLint", () => {
  it("returns issues for a template with an accessibility problem", () => {
    const result = runQualityLint(
      template([
        {
          id: "img_1",
          type: "image",
          src: "https://example.com/a.png",
          alt: "",
          styles: { padding },
        },
      ]),
    );
    expect(result.error).toBeUndefined();
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.every((i) => typeof i.ruleId === "string")).toBe(true);
  });

  it("returns no issues for a clean template", () => {
    const result = runQualityLint(
      template([title("title_1", "Quarterly update")]),
    );
    const blocking = result.issues.filter(
      (i) => i.severity === "error" || i.severity === "warning",
    );
    expect(blocking).toEqual([]);
  });

  it("reports a linter crash as an error instead of throwing", () => {
    const result = runQualityLint(null);
    expect(result.issues).toEqual([]);
    expect(typeof result.error).toBe("string");
  });
});
