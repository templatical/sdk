import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Field autocomplete (MergeTagInput / MergeTagTextarea) is on the editor's
 * eager graph — the properties panel mounts with the chrome. It needs the
 * shared suggestion popup, and that popup used to live in the same module as
 * the TipTap `MergeTagSuggestion` extension. A static import of
 * `createMergeTagPopup` therefore pulled `@tiptap/core` + `@tiptap/suggestion`
 * (and, on the CDN build, the entire `tiptap` manual chunk) into every
 * session, whether or not the user ever opened a title or paragraph.
 *
 * The popup helpers belong in a TipTap-free module. The extension stays
 * behind ParagraphEditor / TitleEditor's existing dynamic `import()`.
 */

const SRC = join(import.meta.dirname, "..", "src");
const AUTOCOMPLETE = join(SRC, "composables", "useMergeTagAutocomplete.ts");
const EXTENSION = join(SRC, "extensions", "MergeTagSuggestion.ts");

function moduleProviding(fromFile: string, exportName: string): string {
  const src = readFileSync(fromFile, "utf8");
  const match = src.match(
    new RegExp(
      String.raw`import\s*\{[^}]*\b${exportName}\b[^}]*\}\s*from\s*["']([^"']+)["']`,
    ),
  );
  expect(
    match,
    `${fromFile} must import ${exportName} as a value`,
  ).toBeTruthy();
  const spec = match![1];
  expect(
    spec.startsWith("."),
    `${exportName} must come from a relative module, got ${spec}`,
  ).toBe(true);
  const resolved = join(dirname(fromFile), spec);
  return resolved.endsWith(".ts") ? resolved : `${resolved}.ts`;
}

function hasTiptapValueImport(source: string): boolean {
  // `import type` is erased; a value import of @tiptap is what the bundler
  // follows into the eager graph.
  return /(?:^|\n)\s*import\s+(?!type\b)[\s\S]*?from\s*["']@tiptap\//m.test(
    source,
  );
}

describe("merge-tag popup stays off @tiptap", () => {
  it("field autocomplete loads createMergeTagPopup from a TipTap-free module", () => {
    const popupModule = moduleProviding(AUTOCOMPLETE, "createMergeTagPopup");
    const source = readFileSync(popupModule, "utf8");
    expect(source).toContain("export function createMergeTagPopup");
    expect(hasTiptapValueImport(source)).toBe(false);
  });

  it("field autocomplete loads filterMergeTags from a TipTap-free module", () => {
    const popupModule = moduleProviding(AUTOCOMPLETE, "filterMergeTags");
    expect(hasTiptapValueImport(readFileSync(popupModule, "utf8"))).toBe(false);
  });

  it("the TipTap extension module still binds @tiptap/core and @tiptap/suggestion", () => {
    // Positive control: moving the popup helpers must not "fix" the leak by
    // dropping the rich-text suggestion extension. ParagraphEditor /
    // TitleEditor dynamic-import this file on first edit.
    const source = readFileSync(EXTENSION, "utf8");
    expect(source).toMatch(/from\s*["']@tiptap\/core["']/);
    expect(source).toMatch(/from\s*["']@tiptap\/suggestion["']/);
    expect(source).toContain("export const MergeTagSuggestion");
  });
});
