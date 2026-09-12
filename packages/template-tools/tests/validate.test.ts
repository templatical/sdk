import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { runQualityLint, schema, validateTemplate } from "../src/validate";
import {
  createButtonBlock,
  createCountdownBlock,
  createCustomBlock,
  createDefaultTemplateContent,
  createDividerBlock,
  createHtmlBlock,
  createImageBlock,
  createMenuBlock,
  createParagraphBlock,
  createSectionBlock,
  createSocialIconsBlock,
  createSpacerBlock,
  createTableBlock,
  createTitleBlock,
  createVideoBlock,
  type Block,
  type BlockType,
} from "@templatical/types";

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

  it("reports invalid settings when present but missing a required field", () => {
    // Distinct from the absent-settings case above: `settings` here IS an
    // object, so validateTemplate takes the `settingsValidator` branch rather
    // than the `settings must be an object` shortcut.
    const result = validateTemplate({
      blocks: [],
      settings: { backgroundColor: "#ffffff", textColor: "#111111" },
    });
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.startsWith("settings") && e.includes("width")),
    ).toBe(true);
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

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const EXAMPLES_DIR = resolve(
  REPO_ROOT,
  "skills/templatical/reference/examples",
);
const exampleFiles = readdirSync(EXAMPLES_DIR)
  .filter((f) => f.endsWith(".json"))
  .sort();

describe("validateTemplate — bundled few-shot examples", () => {
  it("bundles a diverse set of example templates for few-shot coverage", () => {
    expect(exampleFiles.length).toBeGreaterThanOrEqual(5);
  });

  // Every committed example must validate — a broken few-shot would teach the
  // model to emit invalid JSON. Enumerated from the directory (rather than
  // listed by name) so a newly added example is covered with no edit here.
  it.each(exampleFiles)("accepts %s with no structural errors", (file) => {
    const content = JSON.parse(
      readFileSync(resolve(EXAMPLES_DIR, file), "utf8"),
    );
    const { valid, errors } = validateTemplate(content);
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });
});

// One factory call per member of the BlockType union. @templatical/types has
// no runtime list of block types to enumerate instead — BlockType is a
// type-only union (`Block["type"]`) — so the Record annotation below gives an
// editor's type checker a completeness hint, but it is not a CI-enforced one:
// this package's tsc --noEmit (like every sibling package's) `include`s only
// "src", never "tests", and vitest transpiles test files without type
// checking them. The completeness check that actually runs is the first test
// below, which compares this object's keys against schema.json's own
// discriminator consts at runtime — schema.json is generated from
// @templatical/types and tests/schema-freshness.test.ts keeps it in sync, so
// that comparison is the real derivation.
const BLOCK_FACTORIES: Record<BlockType, () => Block> = {
  section: () => createSectionBlock(),
  title: () => createTitleBlock(),
  paragraph: () => createParagraphBlock(),
  image: () => createImageBlock(),
  button: () => createButtonBlock(),
  divider: () => createDividerBlock(),
  video: () => createVideoBlock(),
  social: () => createSocialIconsBlock(),
  spacer: () => createSpacerBlock(),
  html: () => createHtmlBlock(),
  menu: () => createMenuBlock(),
  table: () => createTableBlock(),
  countdown: () => createCountdownBlock(),
  // Custom blocks are consumer runtime extensions, not prompt-generated — but
  // they remain a valid schema member, so the drift guard covers them too.
  custom: () =>
    createCustomBlock({
      type: "product-card",
      name: "Product card",
      fields: [],
      template: "<div></div>",
    }),
};

/** Every block type's discriminator `const`, read from the generated schema. */
function schemaBlockTypes(): string[] {
  return Object.values(schema.definitions)
    .map((def) => def.properties?.type?.const)
    .filter((value): value is string => typeof value === "string")
    .sort();
}

describe("validateTemplate — schema ↔ types drift guard", () => {
  it("covers every block type the generated schema declares", () => {
    // Catches the case the second test below cannot: a block type added to
    // @templatical/types (and regenerated into schema.json) with no matching
    // entry added here yet. Re-run `generate-schema` first if this fails
    // after a types change and schema.json itself looks stale.
    expect(Object.keys(BLOCK_FACTORIES).sort()).toEqual(schemaBlockTypes());
  });

  it("accepts a canonical instance of every block type @templatical/types defines", () => {
    const blocks = Object.values(BLOCK_FACTORIES).map((factory) => factory());
    const doc = { ...createDefaultTemplateContent(), blocks };
    const { valid, errors } = validateTemplate(doc);
    // If this fails after a types change, re-run `generate-schema`.
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });
});
