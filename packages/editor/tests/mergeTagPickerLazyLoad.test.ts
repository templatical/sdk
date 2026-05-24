// Source-level regression. Mounting MergeTagPickerModal statically inside
// Editor.vue or CloudEditor.vue would pull the picker chunk into the
// editor's main entry — defeating the whole point of code-splitting it.
// This test parses the Vue SFCs as text and locks in the dynamic-import
// pattern so a future PR can't quietly switch to a static import.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const EDITOR_VUE = readFileSync(
  resolve(__dirname, "../src/Editor.vue"),
  "utf-8",
);
const CLOUD_EDITOR_VUE = readFileSync(
  resolve(__dirname, "../src/cloud/CloudEditor.vue"),
  "utf-8",
);

describe("MergeTagPickerModal lazy-load wiring", () => {
  it("Editor.vue imports MergeTagPickerModal via defineAsyncComponent + dynamic import()", () => {
    expect(EDITOR_VUE).toMatch(
      /defineAsyncComponent\(\s*\(\)\s*=>\s*import\(["']\.\/components\/MergeTagPickerModal\.vue["']\)/,
    );
  });

  it("CloudEditor.vue imports MergeTagPickerModal via defineAsyncComponent + dynamic import()", () => {
    expect(CLOUD_EDITOR_VUE).toMatch(
      /defineAsyncComponent\(\s*\(\)\s*=>\s*import\(["']\.\.\/components\/MergeTagPickerModal\.vue["']\)/,
    );
  });

  it("Editor.vue does NOT statically import MergeTagPickerModal", () => {
    // Static `import MergeTagPickerModal from "./..."` would defeat the
    // chunk split. The dynamic-import factory is the ONLY allowed
    // reference to the modal's source path.
    const staticImport =
      /^import\s+MergeTagPickerModal\s+from\s+["']\.\/components\/MergeTagPickerModal\.vue["']/m;
    expect(staticImport.test(EDITOR_VUE)).toBe(false);
  });

  it("CloudEditor.vue does NOT statically import MergeTagPickerModal", () => {
    const staticImport =
      /^import\s+MergeTagPickerModal\s+from\s+["']\.\.\/components\/MergeTagPickerModal\.vue["']/m;
    expect(staticImport.test(CLOUD_EDITOR_VUE)).toBe(false);
  });

  it("Editor.vue mounts <MergeTagPickerModal /> in the template", () => {
    expect(EDITOR_VUE).toContain("<MergeTagPickerModal");
  });

  it("CloudEditor.vue mounts <MergeTagPickerModal /> in the template", () => {
    expect(CLOUD_EDITOR_VUE).toContain("<MergeTagPickerModal");
  });
});
