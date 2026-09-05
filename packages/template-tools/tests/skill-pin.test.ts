import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// This package owns both the CLI's own version and the script that syncs it
// into the skill (scripts/sync-pins.mjs), so the test proving the pin is
// correct lives here — skills/templatical-email holds no executable code of
// its own after the refactor, only the content that reads this file.
const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const SKILL_MD = resolve(REPO_ROOT, "skills/templatical-email/SKILL.md");
const OWN_PACKAGE_JSON = resolve(
  REPO_ROOT,
  "packages/template-tools/package.json",
);

// Built from parts, like tests/cdn-pin.test.ts's own DECLARATION_RE and
// scripts/sync-pins.mjs's own CLI_PIN_RE, so this file's source never
// self-matches its own scan of SKILL.md.
const CLI_PIN_RE = new RegExp(
  ["npx -y @templatical", "/template-tools@(\\S+)"].join(""),
  "g",
);

function ownVersion(): string {
  return JSON.parse(readFileSync(OWN_PACKAGE_JSON, "utf8")).version;
}

describe("skill CLI pin", () => {
  it("every `npx …` invocation in SKILL.md is pinned to this package's version", () => {
    const skill = readFileSync(SKILL_MD, "utf8");
    const pins = [...skill.matchAll(CLI_PIN_RE)].map((match) => match[1]);

    // Non-zero: a regex that stops matching anything (e.g. SKILL.md's fixed
    // prefix wording changed) would otherwise make the checks below pass
    // vacuously — an empty list is trivially "all identical" and there is no
    // pins[0] to compare against the workspace version.
    expect(
      pins.length,
      "Found zero `npx -y @templatical/template-tools@<version>` " +
        "invocations in SKILL.md — either the file no longer documents the " +
        "CLI this way, or this test's CLI_PIN_RE no longer matches its wording.",
    ).toBeGreaterThan(0);

    // All identical: a partial rewrite (one pin hand-edited, the rest left
    // alone by a mid-air interruption) must fail here even though most of
    // the file is still correct.
    const distinct = [...new Set(pins)];
    expect(
      distinct,
      `SKILL.md's CLI pins disagree with each other: ${distinct.join(", ")}. ` +
        "Run `pnpm --filter @templatical/template-tools run sync-pins`.",
    ).toEqual([pins[0]]);

    // Equals the workspace version: what `sync-pins.mjs` is supposed to make
    // true, and what a release actually publishes to npm.
    expect(
      pins[0],
      `SKILL.md's CLI pin is ${pins[0]}, but packages/template-tools/package.json ` +
        `is ${ownVersion()}. Run \`pnpm --filter @templatical/template-tools run sync-pins\`.`,
    ).toBe(ownVersion());
  });
});
