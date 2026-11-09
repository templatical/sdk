import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Webpack resolves every literal `import()` at build time, so a `liquidjs`
// specifier anywhere the renderer loads warns "Can't resolve 'liquidjs'" in
// every build without it, the editor's `toMjml()` path included (#1167).
// The renderer loads its own source and `@templatical/types` at runtime.
const ROOTS = [
  resolve(import.meta.dirname, "../src"),
  resolve(import.meta.dirname, "../../types/src"),
];

// Anchored to code positions, so an error message or doc comment that quotes
// `import * as liquidjs from "liquidjs"` for the caller doesn't count.
const SPECIFIER = new RegExp(
  [
    String.raw`^\s*(?:import|export)\b[^;]*?\bfrom\s*["']liquidjs["']`,
    String.raw`^\s*import\s*["']liquidjs["']`,
    String.raw`\bimport\s*\(\s*["'\x60]liquidjs["'\x60]`,
    String.raw`\brequire\s*\(\s*["'\x60]liquidjs["'\x60]`,
  ].join("|"),
  "m",
);

// `import type` is erased at build time and leaves no specifier behind. The
// match ends at the statement's own `from "..."`, so a file without
// semicolons can't run it on into a runtime import below.
const TYPE_IMPORT = /^\s*import\s+type\b[^;'"]*?\bfrom\s*["'][^"']*["']\s*;?/gm;

function withoutTypeImports(code: string): string {
  return code.replace(TYPE_IMPORT, "");
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|js|mjs)$/.test(entry.name) ? [path] : [];
  });
}

function filesImportingLiquidjs(): string[] {
  return ROOTS.flatMap(sourceFiles).filter((file) => {
    return SPECIFIER.test(withoutTypeImports(readFileSync(file, "utf8")));
  });
}

describe("liquidjs stays out of the renderer's module graph", () => {
  it("has no runtime liquidjs specifier in renderer or types source", () => {
    expect(filesImportingLiquidjs()).toEqual([]);
  });

  it.each([
    ['const m = await import("liquidjs");'],
    ["import { Liquid } from 'liquidjs';"],
    ['import * as liquidjs from "liquidjs";'],
    ['const m = require("liquidjs");'],
    ['import "liquidjs";'],
  ])("recognises %s as a liquidjs specifier", (line) => {
    expect(SPECIFIER.test(line)).toBe(true);
  });

  it("does not count a quoted import in a string or comment", () => {
    expect(
      SPECIFIER.test(
        `throw new TypeError('pass it: import * as liquidjs from "liquidjs"');`,
      ),
    ).toBe(false);
    expect(SPECIFIER.test(' * (`import * as liquidjs from "liquidjs"`)')).toBe(false);
  });

  it("does not count an import type as a runtime specifier", () => {
    const line = 'import type { Liquid } from "liquidjs";';
    expect(SPECIFIER.test(line)).toBe(true);
    expect(SPECIFIER.test(withoutTypeImports(line))).toBe(false);
    const multiLine = 'import type {\n  Liquid,\n  Template,\n} from "liquidjs";';
    expect(SPECIFIER.test(withoutTypeImports(multiLine))).toBe(false);
  });

  it("keeps a runtime import below a type import in a file without semicolons", () => {
    const code = [
      'import type { Block } from "@templatical/types"',
      'import { Liquid } from "liquidjs"',
      // The first `;` in the file comes after the runtime import.
      "export const engine = new Liquid();",
    ].join("\n");
    expect(withoutTypeImports(code)).toContain('import { Liquid } from "liquidjs"');
    expect(SPECIFIER.test(withoutTypeImports(code))).toBe(true);
  });
});
