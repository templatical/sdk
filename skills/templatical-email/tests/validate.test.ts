import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
// The validator is what consumers actually run; import it as-is.
import { runQualityLint, validateTemplate } from "../scripts/validate.mjs";
// Import factories from source (not dist) so this test guards the committed
// schema.json against the canonical types it was generated from.
import {
  createButtonBlock,
  createCountdownBlock,
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
} from "../../../packages/types/src/factory";
import { createDefaultTemplateContent } from "../../../packages/types/src/template";

const here = dirname(fileURLToPath(import.meta.url));
const examplesDir = resolve(here, "../reference/examples");
const readExample = (name: string) =>
  JSON.parse(readFileSync(resolve(examplesDir, name), "utf8"));
const exampleFiles = readdirSync(examplesDir)
  .filter((f) => f.endsWith(".json"))
  .sort();

describe("validateTemplate — valid examples", () => {
  it("bundles a diverse set of example templates for few-shot coverage", () => {
    expect(exampleFiles.length).toBeGreaterThanOrEqual(5);
  });

  // Every committed example must validate — a broken few-shot would teach the
  // model to emit invalid JSON. Globbed so new examples are covered automatically.
  it.each(exampleFiles)("accepts %s with no structural errors", (file) => {
    const { valid, errors } = validateTemplate(readExample(file));
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });
});

describe("validateTemplate — structural errors", () => {
  it("rejects a non-object root", () => {
    const r = validateTemplate(null);
    expect(r.valid).toBe(false);
    expect(r.errors).toEqual(["(root) must be an object"]);
  });

  it("rejects a block missing a required field, with a precise path", () => {
    const button = createButtonBlock() as Record<string, unknown>;
    delete button.url;
    const doc = { ...createDefaultTemplateContent(), blocks: [button] };
    const r = validateTemplate(doc);
    expect(r.valid).toBe(false);
    expect(
      r.errors.some(
        (e) => e.includes("blocks[0] (button)") && e.includes("url"),
      ),
    ).toBe(true);
  });

  it("rejects an unknown block type by its discriminator", () => {
    const doc = {
      ...createDefaultTemplateContent(),
      blocks: [
        {
          id: "x",
          type: "carousel",
          styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
        },
      ],
    };
    const r = validateTemplate(doc);
    expect(r.valid).toBe(false);
    expect(
      r.errors.some((e) =>
        e.includes('unknown or missing block type "carousel"'),
      ),
    ).toBe(true);
  });

  it("rejects an unexpected extra property on a block", () => {
    const spacer = { ...createSpacerBlock(), extraneous: true };
    const doc = { ...createDefaultTemplateContent(), blocks: [spacer] };
    const r = validateTemplate(doc);
    expect(r.valid).toBe(false);
    expect(
      r.errors.some(
        (e) => e.includes("blocks[0] (spacer)") && e.includes("extraneous"),
      ),
    ).toBe(true);
  });

  it("reports the nested path for an invalid block inside a section column", () => {
    const badButton = createButtonBlock() as Record<string, unknown>;
    delete badButton.url;
    const section = createSectionBlock() as Record<string, unknown>;
    section.columns = "1";
    section.children = [[badButton]];
    const doc = { ...createDefaultTemplateContent(), blocks: [section] };
    const r = validateTemplate(doc);
    expect(r.valid).toBe(false);
    expect(
      r.errors.some((e) => e.includes("blocks[0].children[0][0] (button)")),
    ).toBe(true);
  });

  it("rejects invalid settings (missing width)", () => {
    const doc = createDefaultTemplateContent();
    delete (doc.settings as Record<string, unknown>).width;
    const r = validateTemplate(doc);
    expect(r.valid).toBe(false);
    expect(
      r.errors.some((e) => e.startsWith("settings") && e.includes("width")),
    ).toBe(true);
  });
});

describe("schema ↔ types drift guard", () => {
  it("accepts a canonical instance of all 14 block types", () => {
    // 13 standard blocks from their zero-arg factories, plus a hand-built
    // `custom` block (its factory needs a registered definition — custom blocks
    // are consumer runtime extensions, not prompt-generated).
    const customBlock = {
      id: "custom_1",
      type: "custom",
      styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
      customType: "product-card",
      fieldValues: { sku: "ABC-123" },
    };
    const blocks = [
      createSectionBlock(),
      createTitleBlock(),
      createParagraphBlock(),
      createImageBlock(),
      createButtonBlock(),
      createDividerBlock(),
      createVideoBlock(),
      createSocialIconsBlock(),
      createSpacerBlock(),
      createHtmlBlock(),
      createMenuBlock(),
      createTableBlock(),
      createCountdownBlock(),
      customBlock,
    ];
    expect(blocks).toHaveLength(14);
    const doc = { ...createDefaultTemplateContent(), blocks };
    const { valid, errors } = validateTemplate(doc);
    // If this fails after a types change, re-run `generate-schema`.
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });
});

describe("runQualityLint — optional layer", () => {
  it("flags a missing alt when @templatical/quality is available", async () => {
    const image = { ...createImageBlock(), alt: "", decorative: false };
    const doc = { ...createDefaultTemplateContent(), blocks: [image] };
    const r = await runQualityLint(doc);
    expect(Array.isArray(r.issues)).toBe(true);
    if (r.available) {
      expect(r.issues.some((i) => typeof i.ruleId === "string")).toBe(true);
    } else {
      expect(r.issues).toEqual([]);
    }
  });
});
