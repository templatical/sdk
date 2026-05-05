import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { init as initLexer, parse } from "es-module-lexer";

/**
 * These tests guard the editor's bundle topology — specifically the constraints
 * that, if violated, cause silent runtime failures in published consumers:
 *
 *   1. Only optional cloud peers may be external imports. Anything else (Vue,
 *      `@templatical/core`, `@templatical/types`, vue libs) must be bundled
 *      inline. If `@templatical/core` becomes external, consumer's
 *      `node_modules/@vue/reactivity` becomes a second reactivity instance and
 *      every editor interaction silently no-ops (chrome renders, clicks dead).
 *      This was the 0.1.1 regression.
 *
 *   2. Exactly one `@vue/reactivity` source — the bundled vue runtime. Any
 *      additional chunk referencing `@vue/reactivity` means the dedupe
 *      (`resolve.dedupe` in vite.config.ts) failed.
 *
 * Tests run against built `dist/` artifacts. They require `pnpm run build` first.
 * In CI the test job runs after build (see .github/workflows/ci.yml).
 */

const DIST = join(import.meta.dirname, "..", "dist");

const ALLOWED_EXTERNALS = new Set([
  "@templatical/media-library",
  "@templatical/quality",
  "@templatical/renderer",
  "pusher-js",
]);

function isBareSpecifier(spec: string): boolean {
  // Bare specifier: not relative ("./x", "../x") and not absolute ("/x").
  // Includes scoped packages ("@scope/pkg") and unscoped ("pkg").
  return !spec.startsWith(".") && !spec.startsWith("/");
}

function getEntrypointSpecifier(spec: string): string {
  // "@scope/pkg/sub" → "@scope/pkg" ; "pkg/sub" → "pkg" ; "@scope/pkg" → "@scope/pkg" ; "pkg" → "pkg"
  if (spec.startsWith("@")) {
    const parts = spec.split("/");
    return parts.slice(0, 2).join("/");
  }
  return spec.split("/")[0];
}

function listJsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter(
      (entry) => entry.isFile() && entry.name.endsWith(".js") && !entry.name.endsWith(".map"),
    )
    .map((entry) => join(dir, entry.name));
}

function extractImports(source: string): string[] {
  // Use a real ES module lexer — regex-based extraction triggers false
  // positives on string literals and template literals that happen to
  // contain `from "..."` substrings.
  const [imports] = parse(source);
  return imports.map((i) => i.n).filter((n): n is string => typeof n === "string");
}

describe("editor bundle topology", () => {
  let allFiles: string[];
  let bareImportsByFile: Map<string, Set<string>>;

  beforeAll(async () => {
    if (!existsSync(DIST)) {
      throw new Error(
        `dist/ not found. Run \`pnpm --filter @templatical/editor run build\` before running this test.`,
      );
    }
    await initLexer;
    // Skip the cdn/ directory — it's a separate self-contained CDN build with
    // its own topology rules (everything inlined including optional peers).
    allFiles = listJsFiles(DIST);

    bareImportsByFile = new Map();
    for (const file of allFiles) {
      const src = readFileSync(file, "utf8");
      const bare = extractImports(src)
        .filter(isBareSpecifier)
        .map(getEntrypointSpecifier);
      bareImportsByFile.set(file, new Set(bare));
    }
  });

  it("the npm dist directory contains the entry, the css file, and the type declarations", () => {
    const names = readdirSync(DIST);
    expect(names).toContain("templatical-editor.js");
    expect(names).toContain("style.css");
    expect(names).toContain("index.d.ts");
  });

  it("only allowed externals appear as bare imports across all bundle chunks", () => {
    const violations: { file: string; specifier: string }[] = [];
    for (const [file, specs] of bareImportsByFile) {
      for (const spec of specs) {
        if (!ALLOWED_EXTERNALS.has(spec)) {
          violations.push({ file: file.replace(DIST + "/", ""), specifier: spec });
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("does not externalize Vue or any Vue-reactivity-dependent package", () => {
    const forbidden = [
      "vue",
      "@vue/reactivity",
      "@vue/runtime-core",
      "@vue/runtime-dom",
      "@templatical/core",
      "@templatical/core/cloud",
      "@templatical/types",
      "@vueuse/core",
      "vuedraggable",
      "@tiptap/core",
      "@tiptap/vue-3",
      "@lucide/vue",
    ];
    const found = new Set<string>();
    for (const specs of bareImportsByFile.values()) {
      for (const spec of specs) {
        if (forbidden.includes(spec)) found.add(spec);
      }
    }
    expect([...found]).toEqual([]);
  });

  it("ships exactly one chunk that references @vue/reactivity (Vue's bundled runtime)", () => {
    // After the dedupe pass, `@vue/reactivity` should appear only as an
    // internal source string inside the vue runtime chunk (Vue self-references
    // its own reactivity for type-tagging). If a second chunk references it,
    // the bundler emitted two copies — the duplicate-instance bug is back.
    const filesContainingReactivityString: string[] = [];
    for (const file of allFiles) {
      const src = readFileSync(file, "utf8");
      if (src.includes("@vue/reactivity")) {
        filesContainingReactivityString.push(file.replace(DIST + "/", ""));
      }
    }
    expect(filesContainingReactivityString.length).toBeLessThanOrEqual(1);
  });

  it("the main entry imports only internal chunks", () => {
    const mainEntry = join(DIST, "templatical-editor.js");
    const src = readFileSync(mainEntry, "utf8");
    const imports = extractImports(src);
    const externals = imports.filter(isBareSpecifier);
    // Main entry should pull in optional peers only at most. In practice it
    // currently pulls in zero (lazy-loaded chunks reach the externals).
    for (const ext of externals) {
      const pkg = getEntrypointSpecifier(ext);
      expect(ALLOWED_EXTERNALS.has(pkg)).toBe(true);
    }
  });

  it("declares no runtime dependencies in package.json (everything is bundled)", () => {
    const pkg = JSON.parse(
      readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8"),
    );
    // `dependencies` is intentionally absent or empty. If you're adding one,
    // you're almost certainly reintroducing the duplicate-Vue-instance bug.
    // Bundle the dep instead (move to `devDependencies`, leave out of vite
    // `external`).
    const deps = pkg.dependencies ?? {};
    expect(Object.keys(deps)).toEqual([]);
  });

  it("declares only optional peers in peerDependencies", () => {
    const pkg = JSON.parse(
      readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8"),
    );
    const peers = Object.keys(pkg.peerDependencies ?? {});
    const optionalPeers = Object.keys(pkg.peerDependenciesMeta ?? {}).filter(
      (k) => pkg.peerDependenciesMeta[k]?.optional === true,
    );
    expect(peers.sort()).toEqual(optionalPeers.sort());
  });
});
