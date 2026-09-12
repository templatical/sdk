import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// This package owns both the CLI's own version and the script that syncs it
// everywhere the pin shows up (scripts/sync-pins.mjs), so the test proving
// every pin is correct lives here — skills/templatical-email holds no
// executable code of its own after the refactor, and apps/docs is a
// rendered site with no version of its own to check against. Covers every
// file scripts/sync-pins.mjs's job 2 + job 3 rewrite: SKILL.md plus both
// docs-site locales. skills/templatical-email/README.md is deliberately
// NOT in this list — its `npx -y @templatical/template-tools validate …`
// carries no `@version` at all, a "latest is fine" choice sync-pins.mjs
// must never touch (see that script's own header comment).
const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const OWN_PACKAGE_JSON = resolve(
  REPO_ROOT,
  "packages/template-tools/package.json",
);

const PINNED_FILES = [
  "skills/templatical-email/SKILL.md",
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
// across every reference island that documents a command. These two guards
// replace the single-file check above for that tree: one that every pin
// present agrees with the package version, and one that nothing states the
// version any other way (ruling R5 — cli.md:12 restated the version in prose
// a line below a correct invocation, and neither guard above nor
// sync-pins.mjs's CLI_PIN_RE could see it, so it drifted for six releases).
describe("CLI pin across the skill's island tree", () => {
  it("names no template-tools version outside an npx invocation", () => {
    const version = JSON.parse(
      readFileSync(resolve(REPO_ROOT, "packages/template-tools/package.json"), "utf8"),
    ).version;
    const dir = resolve(REPO_ROOT, "skills/templatical/reference");
    const offenders: string[] = [];
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
      const src = readFileSync(resolve(dir, file), "utf8");
      // Blank out every legitimate pinned invocation, then any version-shaped
      // string left behind is a restatement nothing syncs.
      const rest = src.replace(/npx -y @templatical\/template-tools@\S+/g, "");
      for (const [match] of rest.matchAll(/\b\d+\.\d+\.\d+\b/g)) {
        offenders.push(`${file}: ${match}`);
      }
    }
    expect(
      offenders,
      `a version restated outside an npx invocation is unguarded — sync-pins ` +
        `cannot see it, and ${version} will drift away from it silently`,
    ).toEqual([]);
  });

  it("pins every island identically to the package's own version", () => {
    const version = JSON.parse(
      readFileSync(resolve(REPO_ROOT, "packages/template-tools/package.json"), "utf8"),
    ).version;
    const dir = resolve(REPO_ROOT, "skills/templatical/reference");
    const found = readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .flatMap((f) => [
        ...readFileSync(resolve(dir, f), "utf8").matchAll(
          /npx -y @templatical\/template-tools@(\S+)/g,
        ),
      ].map(([, v]) => ({ file: f, version: v })));

    expect(found.length, "no island documents a CLI invocation").toBeGreaterThan(0);
    const wrong = found.filter((m) => m.version !== version);
    expect(wrong, `islands pinned to something other than ${version}`).toEqual([]);
  });
});
