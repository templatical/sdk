import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REFERENCE_DIR = resolve(import.meta.dirname, "../reference");
const schema = JSON.parse(
  readFileSync(resolve(REFERENCE_DIR, "schema.json"), "utf8"),
) as {
  definitions: Record<
    string,
    { properties?: Record<string, { const?: string }>; required?: string[] }
  >;
};
const guide = readFileSync(resolve(REFERENCE_DIR, "block-guide.md"), "utf8");

// `countdown` needs the Cloud backend to render its animated GIF and `custom`
// blocks are consumer-registered at runtime, so the skill never emits either.
// They are valid in the schema — Cloud and headless callers use them — and
// deliberately absent from this guide.
const NEVER_EMITTED = new Set(["countdown", "custom"]);

/** Block type -> its `required` property names, `type` itself excluded. */
function requiredByType(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const definition of Object.values(schema.definitions)) {
    const discriminator = definition.properties?.type?.const;
    if (!discriminator) continue;
    out.set(
      discriminator,
      (definition.required ?? []).filter((p) => p !== "type"),
    );
  }
  return out;
}

/**
 * Each `### <type>` section's body, ending at the next heading of level <= 3.
 * Scoping matters: an unscoped search of the whole guide passes for the wrong
 * reason, because generic names like `padding` or `url` appear under several
 * blocks and would satisfy every one of them.
 */
function sectionsByType(): Map<string, string> {
  const lines = guide.split("\n");
  const out = new Map<string, string>();
  lines.forEach((line, i) => {
    const heading = /^### ([a-z]+)$/.exec(line);
    if (!heading) return;
    let end = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      if (/^#{1,3} /.test(lines[j])) {
        end = j;
        break;
      }
    }
    out.set(heading[1], lines.slice(i + 1, end).join("\n"));
  });
  return out;
}

/** The shared-field section, which documents id / styles / visibility once. */
function commonFields(): string {
  const start = guide.indexOf("## Common block fields");
  expect(start, "block-guide.md has no `## Common block fields` section").toBeGreaterThan(-1);
  const rest = guide.slice(start + 1);
  const next = rest.indexOf("\n## ");
  return next === -1 ? rest : rest.slice(0, next);
}

describe("block-guide.md covers the generated schema", () => {
  it("documents a section for exactly the emittable block types", () => {
    const emittable = [...requiredByType().keys()]
      .filter((t) => !NEVER_EMITTED.has(t))
      .sort();
    expect([...sectionsByType().keys()].sort()).toEqual(emittable);
  });

  it("mentions every required field of every block it documents", () => {
    // schema.json is generated and guarded, so it cannot drift from
    // @templatical/types. This guide is hand-written, so without this check a
    // block could gain a required field, be regenerated into the schema, and
    // leave the prose the agent actually reads silent about it.
    const required = requiredByType();
    const sections = sectionsByType();
    const common = commonFields();
    const gaps: string[] = [];

    for (const [type, section] of sections) {
      for (const field of required.get(type) ?? []) {
        const documented =
          section.includes(`\`${field}\``) || common.includes(`\`${field}\``);
        if (!documented) gaps.push(`${type}.${field}`);
      }
    }

    expect(
      gaps,
      "required fields missing from block-guide.md — regenerating schema.json " +
        "does not update this guide, so add them by hand under each block's " +
        "own `### <type>` section",
    ).toEqual([]);
  });

  it("keeps the two never-emitted types out of the guide", () => {
    // Their presence would invite the agent to emit them; the "Never emit"
    // rule and their absence here are the same decision expressed twice.
    for (const type of NEVER_EMITTED) {
      expect(
        sectionsByType().has(type),
        `block-guide.md documents \`${type}\`, which the skill never emits`,
      ).toBe(false);
      expect(
        requiredByType().has(type),
        `\`${type}\` vanished from the schema — it should stay valid for ` +
          "Cloud and headless callers even though the skill never emits it",
      ).toBe(true);
    }
  });
});

// Deliberately not checked: a field REMOVED from the block model while the
// guide still documents it. The honest reverse check — every backticked token
// in a section is a real property of that block — false-positives on 27 tokens
// here, all of them values or block-type names (`behance`, `true`,
// `paragraph`), and an allowlist that size is a guard people weaken rather
// than fix. That hole is bounded: a stale field makes the agent emit a
// property the schema rejects, so it surfaces as a validation failure at
// `validate` time rather than shipping a broken email.
