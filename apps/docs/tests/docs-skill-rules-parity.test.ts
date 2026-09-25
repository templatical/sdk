import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The public Agent Skill page must keep the generation rules
 * `skills/templatical/reference/rules.md` enforces: never emit countdown or
 * custom, and treat schema.json (also `template-tools schema`) as the JSON
 * contract rather than a field list on the page.
 */

const REPO = join(import.meta.dirname, "../../..");

function readRepo(rel: string): string {
  return readFileSync(join(REPO, rel), "utf8");
}

describe("public Agent Skill page tracks skill generation rules", () => {
  const rules = readRepo("skills/templatical/reference/rules.md");
  const en = readRepo("apps/docs/guide/agent-skill.md");
  const de = readRepo("apps/docs/de/guide/agent-skill.md");

  it("rules.md forbids countdown, custom, slot, and wrapper", () => {
    expect(rules).toMatch(
      /Never emit `countdown`, `custom`, `slot`, or `wrapper`/,
    );
  });

  it("English page forbids countdown, custom, slot and wrapper and names the schema contract", () => {
    expect(en).toMatch(/Never emit `countdown`/);
    expect(en).toMatch(/Never emit `custom`/);
    expect(en).toMatch(/Never emit `slot` or `wrapper`/);
    expect(en).toMatch(/schema\.json/);
    expect(en).toMatch(/template-tools schema/);
    expect(en).toMatch(/Do not invent block fields from this page/);
  });

  it("German page forbids countdown, custom, slot and wrapper and names the schema contract", () => {
    expect(de).toMatch(/Nie `countdown` ausgeben/);
    expect(de).toMatch(/Nie `custom` ausgeben/);
    expect(de).toMatch(/Nie `slot` oder `wrapper` ausgeben/);
    expect(de).toMatch(/schema\.json/);
    expect(de).toMatch(/template-tools schema/);
    expect(de).toMatch(/Keine Blockfelder von dieser Seite erfinden/);
  });
});
