import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");

// Vite's native config loader, planned as the default in a future major, runs
// the config through Node, which resolves a relative import only with its
// file extension. Vite already prints a warning for each one it finds.
// Discovered, not listed, so a config added later is covered too.
const VITE_CONFIGS = ["packages", "apps"].flatMap((group) =>
  readdirSync(join(REPO_ROOT, group), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) =>
      readdirSync(join(REPO_ROOT, group, entry.name))
        .filter((name) => /^vite(?:st)?(?:\.[\w-]+)?\.config\.ts$/.test(name))
        .map((name) => `${group}/${entry.name}/${name}`),
    ),
);

// The three Vite packages roll up their .d.ts with api-extractor and emit no
// doc model or API report, so a message that only feeds those stays silent in
// all three. `ae-unresolved-link` fires on `{@link}`s that resolve in
// @templatical/types but not against the package that inlines them.
const API_EXTRACTOR_CONFIGS = [
  "packages/editor/api-extractor.json",
  "packages/media-library/api-extractor.json",
  "packages/quality/api-extractor.json",
];

const SILENCED_MESSAGES = [
  "ae-forgotten-export",
  "ae-missing-release-tag",
  "ae-unresolved-link",
];

/** Relative runtime imports in `source` whose specifier has no extension. */
function extensionlessRelativeImports(source: string): string[] {
  const file = ts.createSourceFile("config.ts", source, ts.ScriptTarget.Latest);
  const found: string[] = [];
  for (const statement of file.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      statement.importClause?.isTypeOnly ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      continue;
    }
    const specifier = statement.moduleSpecifier.text;
    if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]s$|\.json$/.test(specifier)) {
      found.push(specifier);
    }
  }
  return found;
}

function silencedMessages(path: string): string[] {
  const config = JSON.parse(readFileSync(join(REPO_ROOT, path), "utf8"));
  const reporting = config.messages.extractorMessageReporting;
  return Object.entries(reporting)
    .filter(
      ([name, setting]) =>
        name !== "default" && (setting as { logLevel: string }).logLevel === "none",
    )
    .map(([name]) => name)
    .sort();
}

describe("Vite configs import relative files with their extension", () => {
  it("finds the editor's, media-library's and playground's configs", () => {
    expect(VITE_CONFIGS).toEqual(
      expect.arrayContaining([
        "packages/editor/vite.config.ts",
        "packages/editor/vite.cdn.config.ts",
        "packages/editor/vitest.config.ts",
        "packages/media-library/vite.cdn.config.ts",
        "apps/playground/vite.config.ts",
      ]),
    );
  });

  it.each(VITE_CONFIGS)("%s", (path) => {
    const source = readFileSync(join(REPO_ROOT, path), "utf8");
    expect(extensionlessRelativeImports(source)).toEqual([]);
  });

  it("reports an extensionless relative import and ignores the rest", () => {
    const source = [
      "import { a } from './scripts/a';",
      "import { b } from '../../packages/editor/scripts/b';",
      "import { c } from './scripts/c.ts';",
      "import { d } from './d.mjs';",
      "import data from './data.json';",
      "import type { E } from './types';",
      "import { defineConfig } from 'vite';",
      "import { join } from 'node:path';",
    ].join("\n");
    expect(extensionlessRelativeImports(source)).toEqual([
      "./scripts/a",
      "../../packages/editor/scripts/b",
    ]);
  });
});

describe("api-extractor message suppressions", () => {
  it.each(API_EXTRACTOR_CONFIGS)("%s silences the same messages", (path) => {
    expect(silencedMessages(path)).toEqual(SILENCED_MESSAGES);
  });

  it.each(API_EXTRACTOR_CONFIGS)("%s keeps every other message at warning", (path) => {
    const config = JSON.parse(readFileSync(join(REPO_ROOT, path), "utf8"));
    expect(config.messages.extractorMessageReporting.default).toEqual({
      logLevel: "warning",
    });
  });
});
