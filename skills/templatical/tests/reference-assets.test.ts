import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

// This package's vitest.config.ts deliberately has no `passWithNoTests`, so
// the suite must never be empty — a rename that made the
// `tests/**/*.test.ts` glob match nothing would otherwise exit 0 silently.
// This file guards the workspace package identity and the three relocated
// contract assets (schema.json, block-guide.md, examples/) that the
// router's islands point agents at.
const PACKAGE_ROOT = resolve(import.meta.dirname, "..");
const REFERENCE_DIR = resolve(PACKAGE_ROOT, "reference");

describe("skill package identity", () => {
  it("is named @templatical/skill", () => {
    const pkg = JSON.parse(
      readFileSync(resolve(PACKAGE_ROOT, "package.json"), "utf8"),
    );
    expect(pkg.name).toBe("@templatical/skill");
  });
});

describe("relocated contract assets", () => {
  it("carries the generated block schema, rooted at TemplateContent", () => {
    const schema = JSON.parse(
      readFileSync(resolve(REFERENCE_DIR, "schema.json"), "utf8"),
    );
    expect(schema.$ref).toBe("#/definitions/TemplateContent");
    expect(Object.keys(schema.definitions)).toContain("TemplateContent");
  });

  it("carries the block guide", () => {
    const guide = readFileSync(
      resolve(REFERENCE_DIR, "block-guide.md"),
      "utf8",
    );
    expect(guide).toMatch(/^# Block guide/);
  });

  it("carries a diverse set of few-shot example templates", () => {
    const examplesDir = resolve(REFERENCE_DIR, "examples");
    const files = readdirSync(examplesDir)
      .filter((f) => f.endsWith(".json"))
      .sort();
    expect(files.length).toBeGreaterThanOrEqual(5);

    for (const file of files) {
      const content = JSON.parse(
        readFileSync(resolve(examplesDir, file), "utf8"),
      );
      expect(content.blocks, `${file} carries no blocks array`).toBeInstanceOf(
        Array,
      );
      expect(content.blocks.length, `${file} has an empty blocks array`)
        .toBeGreaterThan(0);
    }
  });
});
