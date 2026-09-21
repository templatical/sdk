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
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".js") &&
        !entry.name.endsWith(".map"),
    )
    .map((entry) => join(dir, entry.name));
}

function extractImports(source: string): string[] {
  // Use a real ES module lexer — regex-based extraction triggers false
  // positives on string literals and template literals that happen to
  // contain `from "..."` substrings.
  // es-module-lexer v3: specifier lives on `specifier`, not `n`; type-only
  // imports are reported with `typeOnly: true` and never emit a runtime edge.
  const [imports] = parse(source);
  return imports
    .filter((i) => i.type === "static" && !i.typeOnly)
    .map((i) => i.specifier)
    .filter((n): n is string => typeof n === "string");
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
    await initLexer();
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
          violations.push({
            file: file.replace(DIST + "/", ""),
            specifier: spec,
          });
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
      "@templatical/media-library",
      "@vueuse/core",
      "vue-draggable-plus",
      "@tiptap/core",
      "@tiptap/vue-3",
      "@lucide/vue",
      "vue-advanced-cropper",
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
    expect(peers).not.toContain("@templatical/media-library");
  });

  it("ships the media library modal in an npm chunk", () => {
    // Browse UI is compiled into the editor, not left as a consumer peer.
    // The testid is the stable marker; Vite may split the chunk as it likes.
    const matchingChunks = allFiles.filter((file) => {
      const src = readFileSync(file, "utf8");
      return src.includes("media-library-modal");
    });
    expect(matchingChunks.length).toBeGreaterThan(0);
  });

  it("does not stamp the standalone media SDK global", () => {
    // The editor aliases `@templatical/media-library` to `editor-modal.ts`
    // (the picker only). Pulling `standalone/visual.ts` would assign
    // `window.TemplaticalMedia` the first time someone opens Browse.
    for (const file of allFiles) {
      expect(readFileSync(file, "utf8")).not.toContain("TemplaticalMedia");
    }
  });

  it("the merge tag picker modal ships somewhere in the bundle", () => {
    // The modal is statically imported by Editor.vue.
    // Vite is free to place it in the main chunk or split it as it sees
    // fit — we only care that it's present, not where. Search by stable
    // marker (the `data-testid` we render).
    const matchingChunks = allFiles.filter((file) => {
      const src = readFileSync(file, "utf8");
      return src.includes("merge-tag-picker-modal");
    });
    expect(matchingChunks.length).toBeGreaterThan(0);
  });

  it("ships no UMD/AMD wrapper in any npm chunk", () => {
    // Turbopack rejects a UMD wrapper outright — `error TP1200 unsupported AMD
    // define() dependency element form` — and refuses to compile the consumer,
    // so a single UMD-shipping dep in the bundled set breaks every Next.js 15+
    // app that imports the editor. Vite and Webpack both tolerate the form,
    // which is why it shipped: issue #67, from `vuedraggable` before the move
    // to `vue-draggable-plus`. `define.amd` is a property read on a global, so
    // no minifier can rename it — the marker survives every output mode.
    //
    // `turbopack-consumer` covers this too, but only after a full `next build`;
    // this fails in the `test` job in milliseconds and names the chunk.
    //
    // Scope is deliberately the npm `dist/` alone. The CDN build inlines every
    // optional peer including pusher-js, which ships UMD, so
    // `dist/cdn/chunks/pusher-*.js` carries the marker legitimately — that
    // bundle is loaded as an ES module straight by a browser and never passes
    // through Turbopack. Widening this scan would fail on that and invite
    // someone to weaken the assertion instead.
    const UMD_MARKERS = ["define.amd", 'define["amd"]', "define['amd']"];
    for (const chunk of allFiles) {
      const code = readFileSync(chunk, "utf8");
      const marker = UMD_MARKERS.find((m) => code.includes(m));
      expect(
        marker,
        `Chunk ${chunk} contains a UMD/AMD wrapper (${marker}). Turbopack ` +
          `fails the consumer build with TP1200 (issue #67). Find the dep that ` +
          `ships it and either swap it for an ESM-only equivalent or import its ` +
          `ESM source directly so the wrapper isn't bundled.`,
      ).toBeUndefined();
    }
  });

  it("does not ship the inline-style-css placeholder in any chunk", () => {
    // Regression: `inline-style-css-plugin` emits a `__TPL_INLINE_EDITOR_CSS__`
    // placeholder at `load()` time and `generateBundle()` swaps it for the
    // full library CSS string. If a downstream bundler re-emits the
    // placeholder in a quote form the plugin's variant matcher misses, the
    // literal placeholder token ships in the chunk and `replaceSync()`
    // adopts garbage into the shadow root — broken styling for every
    // `shadowDom: true` consumer. Hit historically when Rolldown app-mode
    // minification promoted long single-line strings to backtick template
    // literals.
    //
    // The plugin itself now hard-fails the build on this condition, but
    // keep the assertion here as the second line of defense — independent
    // of the plugin's internal self-check, catches the bug class even if
    // someone disables that check.
    const PLACEHOLDER = "__TPL_INLINE_EDITOR_CSS__";
    for (const chunk of allFiles) {
      const code = readFileSync(chunk, "utf8");
      expect(
        code.includes(PLACEHOLDER),
        `Chunk ${chunk} still contains the inline-style-css placeholder. ` +
          `inline-style-css-plugin failed to substitute the CSS string — ` +
          `shadow-DOM consumers would see an empty adopted stylesheet.`,
      ).toBe(false);
    }
  });

  it("keeps @tiptap and prosemirror out of the entry's static-import closure", () => {
    // Same leak the CDN granularity test covers, on the npm graph that
    // `bundle-stats.json` reports. Field autocomplete statically imported the
    // TipTap MergeTagSuggestion module for a shared popup helper, so
    // `@tiptap/core` + prosemirror (~100 KB gzip) landed in every session.
    // npm dist has no sourcemaps; the bundler leaves `node_modules/.pnpm/@tiptap`
    // / `prosemirror-` region comments in the chunk, which is the marker.
    const STATIC_IMPORT_RE =
      /(?:^|[\s;])(?:import|export)[^;]*?from\s*["']\.\/([^"']+)["']/g;
    const TIPTAP = /node_modules\/\.pnpm\/(?:@tiptap|prosemirror-)/;
    const eager = new Set<string>();
    const walk = (name: string) => {
      if (eager.has(name)) return;
      const abs = join(DIST, name);
      if (!existsSync(abs)) return;
      eager.add(name);
      const text = readFileSync(abs, "utf8");
      STATIC_IMPORT_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = STATIC_IMPORT_RE.exec(text))) walk(match[1]);
    };
    walk("templatical-editor.js");

    const offenders: string[] = [];
    for (const name of eager) {
      const text = readFileSync(join(DIST, name), "utf8");
      if (TIPTAP.test(text)) offenders.push(name);
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the Toolbar and TemplateSettings chunks out of the entry's static-import closure", () => {
    // npm dist has no sourcemaps. ColorPicker inlines into these two chunks
    // (the only chrome that import it). Both must exist and must not be in
    // the entry walk — a static import in RightSidebar would pull them eager.
    const STATIC_IMPORT_RE =
      /(?:^|[\s;])(?:import|export)[^;]*?from\s*["']\.\/([^"']+)["']/g;
    const eager = new Set<string>();
    const walk = (name: string) => {
      if (eager.has(name)) return;
      const abs = join(DIST, name);
      if (!existsSync(abs)) return;
      eager.add(name);
      const text = readFileSync(abs, "utf8");
      STATIC_IMPORT_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = STATIC_IMPORT_RE.exec(text))) walk(match[1]);
    };
    walk("templatical-editor.js");

    const names = allFiles.map((file) => file.replace(DIST + "/", ""));
    const toolbar = names.filter((name) => name.startsWith("Toolbar-"));
    const settings = names.filter((name) =>
      name.startsWith("TemplateSettings-"),
    );
    expect(toolbar.length).toBeGreaterThan(0);
    expect(settings.length).toBeGreaterThan(0);
    expect(toolbar.filter((name) => eager.has(name))).toEqual([]);
    expect(settings.filter((name) => eager.has(name))).toEqual([]);
  });
});
