import { describe, expect, it } from "vitest";
// @ts-expect-error - plain .mjs script, no types
import { applyEditorVersion } from "../scripts/sync-editor-version.mjs";

// Fixture strings below are built from parts, like tests/cdn-pin.test.ts's own
// DECLARATION_RE, so a fixture never self-matches that test's repo-wide scan
// for a second EDITOR_VERSION declaration — collapsing one back into a plain
// literal would make this file itself look like a duplicate declaration and
// fail CI. The runtime string value is unchanged either way.
describe("applyEditorVersion", () => {
  it("rewrites the declaration in place", () => {
    const src = ["export const EDITOR_VERSION", ' = "0.1.0";\n'].join("");
    expect(applyEditorVersion(src, "9.9.9")).toBe(
      ["export const EDITOR_VERSION", ' = "9.9.9";\n'].join(""),
    );
  });

  it("throws when the declaration is missing, rather than silently no-oping", () => {
    expect(() => applyEditorVersion("const x = 1;", "1.0.0")).toThrow(
      /EDITOR_VERSION/,
    );
  });

  it("leaves the rest of the file untouched", () => {
    const src = [
      "const a = 1;\nexport const EDITOR_VERSION",
      ' = "0.1.0";\nconst b = 2;\n',
    ].join("");
    const out = applyEditorVersion(src, "2.0.0");
    expect(out).toContain("const a = 1;");
    expect(out).toContain("const b = 2;");
  });
});
