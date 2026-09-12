import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { skillMarkdownFiles } from "../scripts/sync-pins.mjs";

// This package owns both the CLI's own version and the script that syncs it
// everywhere the pin shows up (scripts/sync-pins.mjs), so the test proving
// every pin is correct lives here — apps/docs is a rendered site with no
// version of its own to check against. Covers job 3 (both docs-site
// locales); job 2 (every markdown file under skills/templatical/, including
// SKILL.md itself) has its own guard below, since the router's pin doesn't
// live in one file.
const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const OWN_PACKAGE_JSON = resolve(
  REPO_ROOT,
  "packages/template-tools/package.json",
);

const PINNED_FILES = [
  "apps/docs/guide/agent-skill.md",
  "apps/docs/de/guide/agent-skill.md",
].map((label) => ({ label, path: resolve(REPO_ROOT, label) }));

// Built from parts, like tests/cdn-pin.test.ts's own DECLARATION_RE and
// scripts/sync-pins.mjs's own CLI_PIN_RE, so this file's source never
// self-matches its own scan of the target files.
const CLI_PIN_RE = new RegExp(
  ["npx -y @templatical", "/template-tools@(\\S+)"].join(""),
  "g",
);

function ownVersion(): string {
  return JSON.parse(readFileSync(OWN_PACKAGE_JSON, "utf8")).version;
}

describe("CLI pin", () => {
  it("every `npx …` invocation in every pinned file is present, mutually identical, and equal to this package's version", () => {
    const files = PINNED_FILES.map(({ label, path }) => ({
      label,
      pins: [...readFileSync(path, "utf8").matchAll(CLI_PIN_RE)].map(
        (match) => match[1],
      ),
    }));

    // Non-zero, per file: a regex that stops matching anything in ONE file
    // (e.g. that file's fixed prefix wording changed) would otherwise be
    // masked by the other files still contributing pins to the combined
    // check below — an empty list from one file is trivially consistent
    // with a combined set that still collapses to one value.
    for (const { label, pins } of files) {
      expect(
        pins.length,
        `Found zero \`npx -y @templatical/template-tools@<version>\` ` +
          `invocations in ${label} — either the file no longer documents ` +
          "the CLI this way, or this test's CLI_PIN_RE no longer matches " +
          "its wording.",
      ).toBeGreaterThan(0);
    }

    // All identical across every file, and equal to the workspace version:
    // a partial rewrite (one file synced, another left stale by a mid-air
    // interruption, or a locale mirror hand-edited independently) must fail
    // here even though most of the pins are still correct.
    const allPins = files.flatMap((file) => file.pins);
    const distinct = [...new Set(allPins)];
    expect(
      distinct,
      `The CLI pin disagrees somewhere across ${files.map((f) => f.label).join(", ")} ` +
        `(found: ${distinct.join(", ")}), or disagrees with packages/template-tools/package.json ` +
        `(${ownVersion()}). Run \`pnpm --filter @templatical/template-tools run sync-pins\`.`,
    ).toEqual([ownVersion()]);
  });
});

// The router's pin no longer lives in one file — it's restated identically
// across every markdown file under the skill that documents a command,
// SKILL.md included. These two guards walk exactly what scripts/sync-pins.mjs's
// syncCliPin() walks (skillMarkdownFiles(), the same production walker, not a
// re-derived list) so a version restated anywhere that walk reaches — even in
// the router's own prose — can't drift unnoticed: one that every pin present
// agrees with the package version, and one that nothing states the version
// any other way (ruling R5 — cli.md:12 restated the version in prose a line
// below a correct invocation, and neither guard above nor sync-pins.mjs's
// CLI_PIN_RE could see it, so it drifted for six releases).
describe("CLI pin across the skill's island tree", () => {
  it("names no template-tools version outside an npx invocation", () => {
    const version = JSON.parse(
      readFileSync(resolve(REPO_ROOT, "packages/template-tools/package.json"), "utf8"),
    ).version;
    const offenders: string[] = [];
    for (const label of skillMarkdownFiles()) {
      const src = readFileSync(resolve(REPO_ROOT, label), "utf8");
      // Blank out every legitimate pinned invocation, then any version-shaped
      // string left behind is a restatement nothing syncs.
      const rest = src.replace(/npx -y @templatical\/template-tools@\S+/g, "");
      for (const [match] of rest.matchAll(/\b\d+\.\d+\.\d+\b/g)) {
        offenders.push(`${label}: ${match}`);
      }
    }
    expect(
      offenders,
      `a version restated outside an npx invocation is unguarded — sync-pins ` +
        `cannot see it, and ${version} will drift away from it silently`,
    ).toEqual([]);
  });

  it("pins every markdown file under the skill identically to the package's own version", () => {
    const version = JSON.parse(
      readFileSync(resolve(REPO_ROOT, "packages/template-tools/package.json"), "utf8"),
    ).version;
    const found = skillMarkdownFiles().flatMap((label) => [
      ...readFileSync(resolve(REPO_ROOT, label), "utf8").matchAll(
        /npx -y @templatical\/template-tools@(\S+)/g,
      ),
    ].map(([, v]) => ({ file: label, version: v })));

    expect(found.length, "no file documents a CLI invocation").toBeGreaterThan(0);
    const wrong = found.filter((m) => m.version !== version);
    expect(wrong, `files pinned to something other than ${version}`).toEqual([]);
  });
});
