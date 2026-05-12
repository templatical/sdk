import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Snapshot media-library's use of `<Teleport to="body">`. All 4 modal
 * components (`MediaLibraryModal` + the 3 nested replace/edit/import-url
 * modals) now teleport to `:to="popoverTarget || 'body'"` — when the host
 * editor passes a `popoverTarget` prop the modal lands inside the editor's
 * shadow-aware popover root; without it, fallback to body matches the
 * standalone SDK's original behavior.
 *
 * Any new `<Teleport to="body">` in source fails this test — same
 * regression-sensitive pattern as `packages/editor/tests/global-refs-audit.test.ts`.
 *
 * File paths are relative to `packages/media-library/src/`, POSIX-style.
 */

const SRC = join(import.meta.dirname, "..", "src");

function listSourceFiles(): string[] {
  const entries = readdirSync(SRC, {
    recursive: true,
    withFileTypes: true,
  });
  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        (entry.name.endsWith(".ts") || entry.name.endsWith(".vue")) &&
        !entry.name.endsWith(".d.ts"),
    )
    .map((entry) =>
      relative(SRC, join(entry.parentPath ?? SRC, entry.name)).split(sep).join("/"),
    )
    .sort();
}

function filesMatching(files: string[], pattern: RegExp): string[] {
  return files
    .filter((relPath) => pattern.test(readFileSync(join(SRC, relPath), "utf8")))
    .sort();
}

const FILES = listSourceFiles();

describe("media-library teleport audit", () => {
  it("source tree was discovered (sanity check)", () => {
    expect(FILES.length).toBeGreaterThan(15);
  });

  it("no source file declares `<Teleport to=\"body\">`", () => {
    const actual = filesMatching(FILES, /<Teleport\s+to=["']body["']/);
    expect(actual).toEqual([]);
  });

  it("only the expected `.vue` files declare a popoverTarget-bound `<Teleport>`", () => {
    const actual = filesMatching(
      FILES,
      /<Teleport[^>]*:to=["']popoverTarget\s*\|\|\s*['"]body['"]["']/,
    );
    expect(actual).toEqual([
      "components/MediaLibraryModal.vue",
      "components/media/MediaEditModal.vue",
      "components/media/MediaImportUrlModal.vue",
      "components/media/MediaReplaceModal.vue",
    ]);
  });
});
