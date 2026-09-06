import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SKILL_ROOT = resolve(import.meta.dirname, "..");
const MANIFEST_PATH = resolve(SKILL_ROOT, "reference/manifest.json");
const SKILL_MD_PATH = resolve(SKILL_ROOT, "SKILL.md");
const REGEN_COMMAND =
  "pnpm --filter @templatical/sdk-skill run generate-reference";

const BEGIN_MARKER = "<!-- BEGIN GENERATED INDEX -->";
const END_MARKER = "<!-- END GENERATED INDEX -->";

// Built from parts so this file's own source text can never self-match the
// pattern it searches SKILL.md for — the same discipline
// packages/template-tools/tests/{skill-pin,cdn-pin}.test.ts use for their
// own version-citation regexes.
const VERSION_CITATION_RE = new RegExp(
  ["`@templatical/editor@", "([^`]+)`"].join(""),
);

function readManifestVersion(): string {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  return manifest.sdkVersion;
}

/** The `@templatical/editor@<version>` citation inside SKILL.md's generated region. */
function readCitedVersion(): string {
  const content = readFileSync(SKILL_MD_PATH, "utf8");
  const begin = content.indexOf(BEGIN_MARKER);
  const end = content.indexOf(END_MARKER);
  if (begin === -1 || end === -1 || end < begin) {
    throw new Error(
      `SKILL.md is missing ${BEGIN_MARKER} / ${END_MARKER}, or they're out of order.`,
    );
  }
  const region = content.slice(begin, end);
  const match = region.match(VERSION_CITATION_RE);
  if (!match) {
    throw new Error(
      "SKILL.md's generated index doesn't cite an `@templatical/editor@<version>` the way " +
        `tools/generate-reference.mjs writes it. Run \`${REGEN_COMMAND}\`.`,
    );
  }
  return match[1];
}

describe("SDK version agreement", () => {
  // design-notes/sdk-skill.md §9 item 3 ("no enumerated version drift"): the
  // router and the reference tree it links into must describe the same
  // release. This is the one property both the freshness suite and this
  // suite state independently — freshness treats it as part of the tree's
  // internal consistency, this suite exists so the specific failure (a
  // version citation left behind by a partial regeneration) gets its own
  // name and its own actionable message.
  it("SKILL.md cites the same @templatical/editor version as reference/manifest.json", () => {
    const manifestVersion = readManifestVersion();
    const citedVersion = readCitedVersion();
    expect(
      citedVersion,
      `SKILL.md's generated index cites @templatical/editor@${citedVersion}, but ` +
        `reference/manifest.json's sdkVersion is ${manifestVersion} — the router and the reference ` +
        `tree disagree about which release they describe. Run \`${REGEN_COMMAND}\`.`,
    ).toBe(manifestVersion);
  });
});
