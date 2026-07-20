import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), "utf8");

describe("SKILL.md block-type coverage", () => {
  // Guards the highest-value piece of hand-written prose against drift: if a new
  // block type is added to the schema but never mentioned in SKILL.md, the model
  // won't know it exists. (schema.json itself is kept in sync by
  // schema-freshness.test.ts.)
  it("mentions every block type in the schema (emit list or exclusions note)", () => {
    const schema = JSON.parse(read("../reference/schema.json"));
    const schemaTypes = Object.values(schema.definitions)
      .map((def) => def?.properties?.type?.const)
      .filter((t) => typeof t === "string");
    // Sanity: parsing worked and `html` (a non-obvious, always-available block)
    // is covered.
    expect(schemaTypes).toContain("html");

    const skill = read("../SKILL.md");
    const mentioned = new Set(
      [...skill.matchAll(/`([a-z]+)`/g)].map((m) => m[1]),
    );

    const missing = schemaTypes.filter((t) => !mentioned.has(t)).sort();
    expect(
      missing,
      `SKILL.md doesn't mention block type(s): ${missing.join(", ")}. Add them to the "Emit these block types" list (or the exclusions note) so the model knows about them.`,
    ).toEqual([]);
  });
});
