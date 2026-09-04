import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// `import.meta.url` is not a usable `file:` base in this environment, so
// paths resolve through `import.meta.dirname` instead — the same pattern
// this package's own `vitest.config.ts` uses for its `@` alias.
const E2E_ROOT = join(import.meta.dirname, "../e2e");

/** Every `.ts` file under `apps/playground/e2e/`, recursively. */
function e2eFiles(dir = E2E_ROOT): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return e2eFiles(full);
    return full.endsWith(".ts") ? [full] : [];
  });
}

/**
 * Playwright transforms spec files in Node, with no Vue plugin. The capability
 * barrel imports every capability, and `saved-blocks` imports
 * `createLocalStorageSavedBlocksProvider` from `@templatical/editor` — whose
 * entry pulls `.vue` source Node cannot parse, so the whole spec fails to load.
 *
 * `capabilities/templates`, `capabilities/version-history` and
 * `capabilities/comments` are safe: their imports resolve to local modules only.
 *
 * Match the module *specifier*, never the keyword that introduces it — a
 * dynamic `import()` and a bare side-effect import have no `from` at all, so
 * anchoring there is a guard with a hole in it. The anchor is what follows
 * the path instead: an optional `/index`, an optional `.ts`/`.js` extension,
 * then the closing quote — which is also what keeps `capabilities/templates`
 * and its siblings out, since their own trailing segment never reaches that
 * closing quote. See the "FORBIDDEN pattern coverage" table below for the
 * forms this must catch and must not.
 */
const FORBIDDEN = [
  /config\/capabilities(?:\/index)?(?:\.(?:ts|js))?["']/,
  /config\/capabilities\/saved-blocks(?:\.(?:ts|js))?["']/,
];

describe("e2e import boundary", () => {
  const files = e2eFiles();

  it("finds the e2e tree", () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it("no e2e file imports the capability barrel or saved-blocks", () => {
    const offenders = files.filter((file) => {
      const source = readFileSync(file, "utf8");
      return FORBIDDEN.some((pattern) => pattern.test(source));
    });
    expect(offenders).toEqual([]);
  });
});

/**
 * `FORBIDDEN` is what stands between a contributor and a broken e2e run, so
 * its patterns need their own proof independent of what the e2e tree happens
 * to contain today. Each row is a source line a contributor could plausibly
 * write; the `caught` column is what `FORBIDDEN` must say about it. A future
 * widening that narrows back to `from`-only, or over-reaches into the
 * allowed leaves, fails this table before it ever reaches the real files.
 */
describe("FORBIDDEN pattern coverage", () => {
  const specimens: [name: string, source: string, caught: boolean][] = [
    [
      "dynamic import() of the barrel",
      'await import("@/config/capabilities")',
      true,
    ],
    [
      "dynamic import() of saved-blocks by relative path",
      'await import("../../src/config/capabilities/saved-blocks")',
      true,
    ],
    [
      "bare side-effect import of the barrel",
      'import "@/config/capabilities";',
      true,
    ],
    [
      "named import of the barrel's explicit index with a .ts extension",
      'import x from "@/config/capabilities/index.ts"',
      true,
    ],
    [
      "type-only import of the barrel",
      'import type { X } from "@/config/capabilities"',
      true,
    ],
    [
      "re-export from the barrel",
      'export { X } from "@/config/capabilities"',
      true,
    ],
    [
      "named import of saved-blocks with a .js extension",
      'import { x } from "@/config/capabilities/saved-blocks.js"',
      true,
    ],
    [
      "bare `from` fragment naming the safe templates leaf",
      'from "@/config/capabilities/templates"',
      false,
    ],
    [
      "named import of the safe version-history leaf",
      'import { x } from "@/config/capabilities/version-history"',
      false,
    ],
    [
      "named import of the safe comments leaf",
      'import { x } from "@/config/capabilities/comments"',
      false,
    ],
    [
      "the real allowed import in version-history.spec.ts",
      'import { TEMPLATES_SAVE_PATH } from "../../src/config/capabilities/templates";',
      false,
    ],
  ];

  it.each(specimens)("%s", (_name, source, caught) => {
    expect(FORBIDDEN.some((pattern) => pattern.test(source))).toBe(caught);
  });
});
