import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Sibling of block-guide-freshness.test.ts, deliberately a separate file: that
// one guards the GENERATED half of block-guide.md (fix = re-run the generator),
// this one guards the HAND-WRITTEN half (fix = edit prose). They fail for
// different reasons and are repaired differently, so the file name is what tells
// a reader which half broke.
//
// What this exists for: `renderType` renders a `$ref` as its bare definition
// name, so `columns` reads `(ColumnLayout)` and `platform` does not appear in
// the generated line at all. The values live only in hand-written prose — which
// means a value added to @templatical/types reaches schema.json, reaches the
// generated line as an unchanged type name, and leaves the agent's actual
// instructions silent about it. This closes that.
const REFERENCE_DIR = resolve(import.meta.dirname, "../reference");
const guide = readFileSync(resolve(REFERENCE_DIR, "block-guide.md"), "utf8");
const schema = JSON.parse(
  readFileSync(resolve(REFERENCE_DIR, "schema.json"), "utf8"),
) as {
  definitions: Record<string, SchemaNode>;
};

type SchemaNode = {
  $ref?: string;
  enum?: unknown[];
  const?: unknown;
  items?: SchemaNode;
  anyOf?: SchemaNode[];
  properties?: Record<string, SchemaNode>;
};

// `countdown` needs Cloud to render, `custom` is registered at runtime, and
// `slot`/`wrapper` are layout markers — the skill emits none of them and the
// guide documents none. `countdown` carries an inline `separator` enum, so
// without this it would be looked up in a section that does not exist.
const NEVER_EMITTED = new Set(["countdown", "custom", "slot", "wrapper"]);

/** Heading text -> that section's body, ending at the next heading. */
function sections(): Map<string, string> {
  const lines = guide.split("\n");
  const out = new Map<string, string>();
  lines.forEach((line, i) => {
    const heading = /^#{2,3} (.+)$/.exec(line);
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

/**
 * A section's bullets, keyed by the bullet's FIRST backticked token — which is
 * the field it documents.
 *
 * Bullet scope, not section scope, is what makes this guard bite on short
 * values. `"2-1"` is documented twice in the `section` section: once in the
 * `columns` bullet that enumerates the layouts, and again in the `children`
 * bullet's column-count rule. A section-scoped check therefore still passes with
 * the `columns` enumeration gutted, because the other bullet covers for it.
 * Anchoring on the bullet makes each enumeration answer for itself.
 *
 * A bullet runs from its `- ` line to the next `- ` line or a blank line; the
 * guide's lists are contiguous and its wrapped continuation lines never start
 * with `- `.
 */
function bulletsByField(section: string): Map<string, string> {
  const lines = section.split("\n");
  const out = new Map<string, string>();
  for (let i = 0; i < lines.length; i++) {
    if (!/^- /.test(lines[i])) continue;
    let end = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      if (/^- /.test(lines[j]) || lines[j].trim() === "") {
        end = j;
        break;
      }
    }
    const bullet = lines.slice(i, end).join("\n");
    const anchor = /`([A-Za-z][A-Za-z0-9]*)`/.exec(bullet);
    if (anchor && !out.has(anchor[1])) out.set(anchor[1], bullet);
  }
  return out;
}

type EnumSite = {
  /** Guide heading the values must be documented under. */
  heading: string;
  /** Leaf property name — the bullet anchor for a `$ref` enum. */
  field: string;
  /** Dotted path, for failure messages only. */
  path: string;
  values: unknown[];
  /** Inline enums are already printed in the generated line; `$ref`s are not. */
  inline: boolean;
};

/**
 * Every enum reachable from a documented block (or from `TemplateSettings`),
 * walked from the schema rather than listed here — including nested ones, which
 * is how `SocialIcon.platform` is reached.
 *
 * What a new enum costs, measured:
 *
 * - **Inline** (`variant: "filled" | "outline"`) — zero edits anywhere. The
 *   walker finds it and `renderType` prints its values into the generated line,
 *   so the inline case below is satisfied the moment the generator runs.
 * - **Behind a `$ref`** (`variant: ButtonVariant`) — the walker finds it too,
 *   so it is never silently missed, but two cases then fail: the literal path
 *   list in the sanity case must gain `button.variant`, and a bullet
 *   enumerating the values must be written.
 *
 * Those two edits are the design, not friction to remove. A `$ref` enum's
 * values appear nowhere in the generated line, so waving one through would
 * reinstate exactly the hole this file closes — and an expected-path list
 * derived from the schema instead of written out would make the sanity case
 * agree with any walker, including a broken one.
 */
function enumSites(): EnumSite[] {
  const found: EnumSite[] = [];
  const deref = (node: SchemaNode | undefined) =>
    node?.$ref ? schema.definitions[node.$ref.split("/").pop()!] : undefined;

  const walk = (
    definition: SchemaNode | undefined,
    heading: string,
    path: string,
    seen: Set<SchemaNode>,
  ) => {
    if (!definition?.properties || seen.has(definition)) return;
    seen.add(definition);
    for (const [field, spec] of Object.entries(definition.properties)) {
      if (Array.isArray(spec.enum)) {
        found.push({
          heading,
          field,
          path: `${path}.${field}`,
          values: spec.enum,
          inline: true,
        });
      }
      // A property reaches another definition directly, through an array's
      // items, or as one member of a union.
      const candidates = [spec, spec.items, ...(spec.anyOf ?? [])];
      for (const candidate of candidates) {
        const target = deref(candidate);
        if (!target) continue;
        if (Array.isArray(target.enum)) {
          found.push({
            heading,
            field,
            path: `${path}.${field}`,
            values: target.enum,
            inline: false,
          });
        } else {
          walk(target, heading, `${path}.${field}`, seen);
        }
      }
    }
  };

  for (const definition of Object.values(schema.definitions)) {
    const blockType = definition.properties?.type?.const;
    if (typeof blockType !== "string" || NEVER_EMITTED.has(blockType)) continue;
    walk(definition, blockType, blockType, new Set());
  }
  walk(schema.definitions.TemplateSettings, "Settings", "settings", new Set());
  return found;
}

/**
 * The guide quotes enum values inconsistently — `` `"1"` `` for `ColumnLayout`,
 * `` `facebook` `` for `SocialPlatform`, `` `1` `` for the numeric
 * `HeadingLevel` — so both spellings count. Matching a BACKTICKED token rather
 * than a bare substring is the other half of what stops this being vacuous:
 * bare `1` occurs 9 times in the guide and bare `2` seven times, in prose that
 * has nothing to do with `ColumnLayout`.
 */
function mentions(haystack: string, value: unknown): boolean {
  const raw = String(value);
  return haystack.includes(`\`${raw}\``) || haystack.includes(`\`"${raw}"\``);
}

describe("block-guide.md documents every enum value the schema declares", () => {
  it("finds the enum sites it is supposed to be guarding", () => {
    // Without this the suite below passes vacuously the day the walker breaks
    // and returns nothing. Asserted as concrete paths, not a count.
    const byPath = enumSites()
      .filter((site) => !site.inline)
      .map((site) => site.path)
      .sort();
    expect(byPath).toEqual([
      // `top` only: the walker visits the shared BorderSideValue definition
      // once, through the first side that reaches it.
      "button.border.top.style",
      "image.border.top.style",
      "section.border.top.style",
      "section.columns",
      "settings.direction",
      "social.iconSize",
      "social.iconStyle",
      "social.icons.platform",
      "title.level",
    ]);
  });

  it("spells out every value of a `$ref` enum in that field's own bullet", () => {
    // These are the ones at risk: the generated line shows only the definition
    // name (`(ColumnLayout)`), or omits the field entirely when it is nested
    // (`platform` lives inside `SocialIcon`). Prose is the agent's only source.
    const bySection = sections();
    const gaps: string[] = [];

    for (const site of enumSites().filter((s) => !s.inline)) {
      const section = bySection.get(site.heading);
      if (section === undefined) {
        gaps.push(`${site.path}: no \`${site.heading}\` section in the guide`);
        continue;
      }
      const bullet = bulletsByField(section).get(site.field);
      if (bullet === undefined) {
        gaps.push(
          `${site.path}: no bullet anchored on \`${site.field}\` under "${site.heading}"`,
        );
        continue;
      }
      for (const value of site.values) {
        if (!mentions(bullet, value)) {
          gaps.push(`${site.path}: \`${site.heading}\` bullet omits ${JSON.stringify(value)}`);
        }
      }
    }

    expect(
      gaps,
      "block-guide.md's prose is the only place these values appear — the " +
        "generated field list renders a `$ref` as its bare definition name. " +
        "Add the missing value(s) to that field's bullet by hand.",
    ).toEqual([]);
  });

  it("carries every value of an inline enum in the block's section", () => {
    // Satisfied today by the generated line alone, since `renderType` prints an
    // inline enum in full. What makes it worth asserting is that it holds
    // ABSOLUTELY, against the file, rather than against whatever the generator
    // currently emits — which is the one thing freshness cannot do.
    //
    // Measured: break `renderType` so an inline enum renders `string`, then
    // regenerate. The guide now matches the broken generator, so
    // block-guide-freshness.test.ts passes; this case fails with 24 entries
    // ("title.textAlign: section omits \"left\"" …). Freshness proves the guide
    // matches the generator; only an absolute assertion notices the generator
    // getting worse.
    //
    // Note what this case does NOT catch, because the boundary is easy to
    // misread: extracting an inline enum to a `$ref` reclassifies the site to
    // `inline: false`, so it leaves this case entirely. The `$ref` case above
    // picks it up and fails with "no bullet anchored on …".
    const bySection = sections();
    const gaps: string[] = [];

    for (const site of enumSites().filter((s) => s.inline)) {
      const section = bySection.get(site.heading);
      if (section === undefined) {
        gaps.push(`${site.path}: no \`${site.heading}\` section in the guide`);
        continue;
      }
      for (const value of site.values) {
        // The generated line writes an inline enum as `("left" | "center")`:
        // quoted, not backticked.
        if (!section.includes(`"${String(value)}"`) && !mentions(section, value)) {
          gaps.push(`${site.path}: section omits ${JSON.stringify(value)}`);
        }
      }
    }

    expect(gaps).toEqual([]);
  });
});
