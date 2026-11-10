import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * A `TemplaticalEditorConfig` key is a public `init()` option. An agent
 * integrating the editor reads integrate.md's host capability map to learn
 * what it can wire, so every key must sit in that table's Options column:
 * prose elsewhere is not enough, and a key named only in a deeper island is
 * one the agent never reaches. A missing hook gets rebuilt by hand, as when
 * a host built a "test as guest" bar instead of `resolvePreview`.
 *
 * Adding a key to EXEMPT is the explicit "not a host capability" decision.
 * The default is a map row.
 */

const INTEGRATE = resolve(import.meta.dirname, "../reference/integrate.md");
const EDITOR_INDEX = resolve(
  import.meta.dirname,
  "../../../packages/editor/src/index.ts",
);
const MAP_HEADING = "## Host capability map";

/**
 * Keys that are not a capability a host decides on. Each needs its reason;
 * a new key does **not** go here by default.
 */
const EXEMPT = new Map<string, string>([
  ["container", "the required mount target in every snippet, not a choice"],
  ["onError", "error plumbing for the host's logger, no feature behind it"],
  ["changeDebounce", "tunes the onChange / autosave timer, no feature"],
]);

/**
 * The host hooks an earlier EXEMPT list hid from agents. Each is a feature a
 * host otherwise rebuilds around the editor, so none may be exempted again.
 */
const MUST_BE_MAPPED = [
  "layout",
  "sectionWrapper",
  "resolvePreview",
  "onRequestMedia",
  "resolveImageUrl",
  "mergeTags",
  "logicTags",
  "displayConditions",
  "customBlocks",
  "onChange",
  "onDirtyChange",
];

function interfaceKeys(src: string, name: string): string[] {
  const header = new RegExp(`export interface ${name}\\s*\\{`);
  const match = header.exec(src);
  if (!match) throw new Error(`no interface ${name}`);
  const open = src.indexOf("{", match.index);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const body = src.slice(open + 1, i);
        return [...body.matchAll(/^  ([A-Za-z][A-Za-z0-9]*)\??:/gm)].map(
          (m) => m[1],
        );
      }
    }
  }
  throw new Error(`unclosed ${name}`);
}

const DOCS_ROOT = resolve(import.meta.dirname, "../../../apps/docs");

interface MapRow {
  need: string;
  options: string;
  when: string;
  docs: string;
}

/** The rows of the first table under MAP_HEADING, header and rule skipped. */
function capabilityMapRows(markdown: string): MapRow[] {
  const start = markdown.indexOf(`\n${MAP_HEADING}\n`);
  if (start === -1) return [];
  const rest = markdown.slice(start + MAP_HEADING.length + 2);
  const nextHeading = rest.search(/^## /m);
  const section = nextHeading === -1 ? rest : rest.slice(0, nextHeading);
  const tableLines = section.split("\n").filter((line) => line.startsWith("|"));
  return tableLines.slice(2).map((line) => {
    const cells = line
      .slice(1, -1)
      .split(/(?<!\\)\|/)
      .map((cell) => cell.trim());
    return {
      need: cells[0],
      options: cells[1],
      when: cells[2],
      docs: cells[3],
    };
  });
}

/** Backticked names in a cell, cut to their top-level key. */
function optionRoots(cell: string): string[] {
  return [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1].split(".")[0]);
}

describe("init() config keys reach the skill's capability map", () => {
  const keys = interfaceKeys(
    readFileSync(EDITOR_INDEX, "utf8"),
    "TemplaticalEditorConfig",
  );
  const rows = capabilityMapRows(readFileSync(INTEGRATE, "utf8"));
  const mapped = new Set(rows.flatMap((row) => optionRoots(row.options)));

  it("finds TemplaticalEditorConfig keys", () => {
    expect(keys).toContain("layout");
    expect(keys).toContain("resolvePreview");
    expect(keys.length).toBeGreaterThan(10);
  });

  it("has a capability map table in integrate.md", () => {
    expect(rows.length).toBeGreaterThan(10);
    for (const row of rows) {
      expect(row.need, JSON.stringify(row)).toMatch(/\S/);
      expect(row.when, JSON.stringify(row)).toMatch(/\S/);
    }
  });

  it("names every non-exempt key in the map's Options column", () => {
    const missing = keys.filter((key) => !EXEMPT.has(key) && !mapped.has(key));
    expect(
      missing,
      `init() keys with no row in integrate.md's "${MAP_HEADING}": ${missing.join(", ")}. Add a row (host need, option, when), or add the key to EXEMPT with a reason.`,
    ).toEqual([]);
  });

  it("names only real init() keys in the Options column", () => {
    const known = new Set(keys);
    const unknown = [...mapped].filter((name) => !known.has(name));
    expect(
      unknown,
      `Options column names that are not TemplaticalEditorConfig keys: ${unknown.join(", ")}. Move helpers and types to the When column.`,
    ).toEqual([]);
  });

  it("points every row at a docs page that exists", () => {
    const broken = rows
      .map((row) => row.docs.match(/^`([a-z0-9/-]+)`$/)?.[1] ?? row.docs)
      .filter((slug) => !existsSync(resolve(DOCS_ROOT, `${slug}.md`)));
    expect(
      broken,
      `Docs cells must be one backticked page slug under apps/docs: ${broken.join(", ")}`,
    ).toEqual([]);
  });

  it("exempts only real keys, and none that are mapped", () => {
    for (const key of EXEMPT.keys()) {
      expect(keys, `stale EXEMPT entry ${key}`).toContain(key);
      expect(mapped.has(key), `${key} is both mapped and exempt`).toBe(false);
    }
  });

  it("never exempts the host hooks agents missed", () => {
    for (const key of MUST_BE_MAPPED) {
      expect(EXEMPT.has(key), key).toBe(false);
      expect(keys, `${key} left TemplaticalEditorConfig`).toContain(key);
    }
  });
});
