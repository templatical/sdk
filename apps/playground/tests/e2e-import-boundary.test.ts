import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// `join(import.meta.dirname, ...)`, not `new URL(..., import.meta.url)`: this
// suite runs under the `happy-dom` environment (vitest.config.ts), which
// shadows the global `URL` constructor with its own implementation that
// resolves a `../` relative merge against `file:` bases incorrectly.
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
 */
const FORBIDDEN = [
  /from\s+["'][^"']*config\/capabilities["']/,
  /from\s+["'][^"']*config\/capabilities\/index["']/,
  /from\s+["'][^"']*config\/capabilities\/saved-blocks["']/,
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
