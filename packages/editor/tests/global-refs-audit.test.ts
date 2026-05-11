import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Snapshot the editor's use of global browser APIs that the Shadow DOM
 * migration touches: `document.body`, `document.head`, `document.activeElement`,
 * `window.getSelection`, and `<Teleport to="body">`.
 *
 * Each phase of the migration updates one of these counts deliberately. The
 * snapshot fails CI when a new file introduces one of these patterns without
 * intent — preventing accidental regressions to the host-CSS-bleeds bug class
 * (issue #70).
 *
 * Updating: when a phase removes (or adds, with `// shadow-ok` justification)
 * a reference, edit the expected arrays below in the same PR.
 *
 * File paths are relative to `packages/editor/src/`, POSIX-style.
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

describe("editor global DOM-reference audit", () => {
  it("source tree was discovered (sanity check)", () => {
    // Guard against the walker silently returning [] (e.g. if SRC path is wrong).
    expect(FILES.length).toBeGreaterThan(50);
  });

  it("only the expected source files reference `document.body`", () => {
    // Shadow DOM migration will rework MergeTagSuggestion's `appendChild`
    // (Phase 3.1) to mount inside the editor's popover root.
    const actual = filesMatching(FILES, /document\.body/);
    expect(actual).toEqual(["extensions/MergeTagSuggestion.ts"]);
  });

  it("only the expected source files reference `document.head`", () => {
    // `useFonts` deliberately appends <link> to document.head — fonts must
    // live at document level (shadow root @font-face is unreliable across
    // browsers). This is the one intentional global escape in the migration.
    const actual = filesMatching(FILES, /document\.head/);
    expect(actual).toEqual(["composables/useFonts.ts"]);
  });

  it("only the expected source files reference `document.activeElement`", () => {
    // `useFocusTrap` currently reads `document.activeElement`. Phase 4.1 will
    // refactor to use `useEditorRoot().root.activeElement` (works for both
    // Document and ShadowRoot — same API surface).
    const actual = filesMatching(FILES, /document\.activeElement/);
    expect(actual).toEqual(["composables/useFocusTrap.ts"]);
  });

  it("no source file references `window.getSelection` (use TipTap selection APIs instead)", () => {
    const actual = filesMatching(FILES, /window\.getSelection/);
    expect(actual).toEqual([]);
  });

  it("only the expected `.vue` files declare `<Teleport to=\"body\">`", () => {
    // Phase 2 rewrites all four to teleport to the injected popover root.
    const actual = filesMatching(FILES, /<Teleport\s+to=["']body["']/);
    expect(actual).toEqual([
      "cloud/components/TplModal.vue",
      "components/blocks/ParagraphToolbar.vue",
      "components/blocks/RichTextLinkDialog.vue",
      "components/blocks/TitleEditor.vue",
    ]);
  });
});
