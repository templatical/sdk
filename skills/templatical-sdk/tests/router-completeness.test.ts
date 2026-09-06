import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const SKILL_ROOT = resolve(import.meta.dirname, "..");
const REFERENCE_DIR = resolve(SKILL_ROOT, "reference");
const SKILL_MD_PATH = resolve(SKILL_ROOT, "SKILL.md");
const REGEN_COMMAND =
  "pnpm --filter @templatical/sdk-skill run generate-reference";

const BEGIN_MARKER = "<!-- BEGIN GENERATED INDEX -->";
const END_MARKER = "<!-- END GENERATED INDEX -->";

/** Every `.md` page under `dir`, relative to `dir` and `/`-joined. */
function listPages(dir: string, base: string = dir): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      out.push(...listPages(abs, base));
      continue;
    }
    if (entry.endsWith(".md")) {
      out.push(relative(base, abs).split(sep).join("/"));
    }
  }
  return out;
}

/**
 * The generated-index region of SKILL.md, between (not including) the two
 * markers tools/generate-reference.mjs rewrites between. Parsing only this
 * region — rather than the whole file — means a `reference/...` mention in
 * the hand-written router prose above it (the failure-mode table links
 * several) can never be mistaken for a router entry.
 */
function readGeneratedRegion(): string {
  const content = readFileSync(SKILL_MD_PATH, "utf8");
  const begin = content.indexOf(BEGIN_MARKER);
  const end = content.indexOf(END_MARKER);
  if (begin === -1 || end === -1 || end < begin) {
    throw new Error(
      `SKILL.md is missing ${BEGIN_MARKER} / ${END_MARKER}, or they're out of order — the ` +
        "generated index can't be isolated to parse it.",
    );
  }
  return content.slice(begin + BEGIN_MARKER.length, end);
}

/** Every `reference/<path>` target linked from a generated-index bullet, in document order. */
function parseIndexPaths(region: string): string[] {
  return [...region.matchAll(/^- \[[^\]]*\]\(reference\/([^)]+)\):/gm)].map(
    (match) => match[1],
  );
}

describe("SKILL.md generated index — router completeness", () => {
  const region = readGeneratedRegion();
  const indexPaths = parseIndexPaths(region);
  const actualPages = listPages(REFERENCE_DIR);

  // A sanity control on the parser itself: if the marker text or the bullet
  // format it looks for ever drifts, both directions below would otherwise
  // vacuously pass by comparing two empty lists.
  it("parses at least one entry from the generated region", () => {
    expect(indexPaths.length).toBeGreaterThan(0);
  });

  // A router pointing at a missing page is this skill's version of a
  // dangling reference — checked in both directions, since either one alone
  // would miss half of that failure mode.
  it("links every page in reference/ from the generated index", () => {
    const indexed = new Set(indexPaths);
    const missing = actualPages.filter((page) => !indexed.has(page)).sort();
    expect(
      missing,
      `reference/ page(s) not linked from SKILL.md's generated index: ${missing.join(", ")}. ` +
        `Run \`${REGEN_COMMAND}\`.`,
    ).toEqual([]);
  });

  it("never links a generated-index entry to a file that doesn't exist", () => {
    const dangling = indexPaths
      .filter((path) => !existsSync(join(REFERENCE_DIR, path)))
      .sort();
    expect(
      dangling,
      `SKILL.md's generated index links reference/ path(s) that don't exist: ${dangling.join(", ")}. ` +
        `Run \`${REGEN_COMMAND}\`.`,
    ).toEqual([]);
  });
});
