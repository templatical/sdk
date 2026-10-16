import { describe, expect, it, vi } from "vitest";
import { inlineStyleCssPlugin } from "../scripts/inline-style-css-plugin";

/**
 * `virtual:editor-css` is the stylesheet every shadow-mounted editor adopts, so
 * it must hold the editor's CSS and nothing else. In the editor's own builds
 * every emitted CSS asset is editor CSS. A host app that compiles the editor
 * from source (the playground) also emits its own CSS, and before `ownedRoots`
 * the plugin inlined that too: the playground's Tailwind preflight reached the
 * canvas and rendered every title at 400 instead of the 700 that real
 * installs and the exported email show.
 */

const PLACEHOLDER = '"__TPL_INLINE_EDITOR_CSS__"';
const ROOTS = ["/repo/packages/editor/src", "/repo/packages/media-library/src"];

interface FakeChunk {
  type: "chunk";
  fileName: string;
  code: string;
  moduleIds: string[];
  viteMetadata?: { importedCss: Set<string> };
}

interface FakeAsset {
  type: "asset";
  fileName: string;
  source: string;
}

type FakeBundle = Record<string, FakeChunk | FakeAsset>;

function asset(fileName: string, source: string): FakeAsset {
  return { type: "asset", fileName, source };
}

function chunk(
  fileName: string,
  moduleIds: string[],
  importedCss: string[],
  code = "",
): FakeChunk {
  return {
    type: "chunk",
    fileName,
    code,
    moduleIds,
    viteMetadata: { importedCss: new Set(importedCss) },
  };
}

/** The chunk that imports `virtual:editor-css` and receives the CSS string. */
function consumer(): FakeChunk {
  return chunk(
    "assets/editor-entry.js",
    ["/repo/packages/editor/src/index.ts"],
    [],
    `const css = ${PLACEHOLDER};`,
  );
}

function bundleOf(...files: Array<FakeChunk | FakeAsset>): FakeBundle {
  return Object.fromEntries(files.map((f) => [f.fileName, f]));
}

function runGenerateBundle(
  bundle: FakeBundle,
  options: { ownedRoots?: string[] } = {},
) {
  const plugin = inlineStyleCssPlugin({
    fallbackSourcePath: "/repo/packages/editor/src/styles/index.css",
    ...options,
  });
  const ctx = {
    error: vi.fn((message: string) => {
      throw new Error(message);
    }),
    warn: vi.fn(),
    info: vi.fn(),
  };
  (plugin.configResolved as (config: unknown) => void)({ command: "build" });
  (
    plugin.generateBundle as (
      this: typeof ctx,
      options: unknown,
      bundle: FakeBundle,
    ) => void
  ).call(ctx, {}, bundle);
  return ctx;
}

/** The CSS string the consumer chunk now carries. */
function inlinedCss(bundle: FakeBundle): string {
  const code = (bundle["assets/editor-entry.js"] as FakeChunk).code;
  return JSON.parse(code.slice("const css = ".length, -1)) as string;
}

function loadVirtualModule(
  command: "build" | "serve",
  options: { ownedRoots?: string[] } = {},
): string {
  const plugin = inlineStyleCssPlugin({
    fallbackSourcePath: "/repo/packages/editor/src/styles/index.css",
    ...options,
  });
  (plugin.configResolved as (config: unknown) => void)({ command });
  return (plugin.load as (id: string) => string)("\0virtual:editor-css");
}

describe("inline-style-css plugin: which CSS reaches the shadow root", () => {
  it("inlines every CSS asset when no ownedRoots are given (the editor's own builds)", () => {
    const bundle = bundleOf(
      consumer(),
      chunk(
        "assets/editor.js",
        [
          "/repo/packages/editor/src/Editor.vue?vue&type=style&index=0&lang.css",
        ],
        ["assets/editor.css"],
      ),
      chunk(
        "assets/host.js",
        ["/repo/apps/playground/src/style.css"],
        ["assets/host.css"],
      ),
      asset("assets/editor.css", ".tpl-a{color:red}"),
      asset("assets/host.css", "h1,h2{font-weight:inherit}"),
    );

    runGenerateBundle(bundle);

    expect(inlinedCss(bundle)).toBe(
      ".tpl-a{color:red}\n\nh1,h2{font-weight:inherit}",
    );
  });

  it("with ownedRoots, leaves the host app's CSS out", () => {
    const bundle = bundleOf(
      consumer(),
      chunk(
        "assets/editor.js",
        [
          "/repo/packages/editor/src/Editor.vue",
          "/repo/packages/editor/src/Editor.vue?vue&type=style&index=0&lang.css",
          "/repo/packages/editor/src/styles/index.css",
        ],
        ["assets/editor.css"],
      ),
      chunk(
        "assets/media.js",
        [
          "/repo/packages/media-library/src/components/Grid.vue?vue&type=style&index=0&scoped=ab12&lang.css",
        ],
        ["assets/media.css"],
      ),
      chunk(
        "assets/index.js",
        [
          "/repo/apps/playground/src/main.ts",
          "/repo/apps/playground/src/style.css",
        ],
        ["assets/index.css"],
      ),
      asset("assets/editor.css", ".tpl-a{color:red}"),
      asset("assets/media.css", ".tpl-media{color:blue}"),
      asset("assets/index.css", "h1,h2{font-weight:inherit}"),
    );

    runGenerateBundle(bundle, { ownedRoots: ROOTS });

    expect(inlinedCss(bundle)).toBe(
      ".tpl-a{color:red}\n\n.tpl-media{color:blue}",
    );
  });

  it("keeps third-party CSS that owned code imports", () => {
    // MediaEditModal imports vue-advanced-cropper's stylesheet; the cropper
    // renders inside the shadow root and needs it.
    const bundle = bundleOf(
      consumer(),
      chunk(
        "assets/MediaEditModal.js",
        [
          "/repo/node_modules/.pnpm/vue-advanced-cropper@2.8.9/node_modules/vue-advanced-cropper/dist/style.css",
          "/repo/packages/media-library/src/components/media/MediaEditModal.vue?vue&type=style&index=0&lang.css",
        ],
        ["assets/MediaEditModal.css"],
      ),
      asset(
        "assets/MediaEditModal.css",
        ".vue-advanced-cropper{position:relative}",
      ),
    );

    runGenerateBundle(bundle, { ownedRoots: ROOTS });

    expect(inlinedCss(bundle)).toBe(".vue-advanced-cropper{position:relative}");
  });

  it("attributes third-party-only CSS to the first-party code of its chunk", () => {
    const bundle = bundleOf(
      consumer(),
      chunk(
        "assets/editor-vendor.js",
        [
          "/repo/node_modules/editor-lib/style.css",
          "/repo/packages/editor/src/components/Picker.vue",
        ],
        ["assets/editor-vendor.css"],
      ),
      chunk(
        "assets/host-vendor.js",
        [
          "/repo/node_modules/host-lib/style.css",
          "/repo/apps/playground/src/Page.vue",
        ],
        ["assets/host-vendor.css"],
      ),
      asset("assets/editor-vendor.css", ".editor-lib{color:red}"),
      asset("assets/host-vendor.css", ".host-lib{color:blue}"),
    );

    runGenerateBundle(bundle, { ownedRoots: ROOTS });

    expect(inlinedCss(bundle)).toBe(".editor-lib{color:red}");
  });

  it("matches roots given with Windows separators against normalized module ids", () => {
    const bundle = bundleOf(
      consumer(),
      chunk(
        "assets/editor.js",
        ["C:/repo/packages/editor/src/styles/index.css"],
        ["assets/editor.css"],
      ),
      chunk(
        "assets/index.js",
        ["C:/repo/apps/playground/src/style.css"],
        ["assets/index.css"],
      ),
      asset("assets/editor.css", ".tpl-a{color:red}"),
      asset("assets/index.css", "h1{font-weight:inherit}"),
    );

    runGenerateBundle(bundle, {
      ownedRoots: ["C:\\repo\\packages\\editor\\src"],
    });

    expect(inlinedCss(bundle)).toBe(".tpl-a{color:red}");
  });

  it("does not treat a sibling directory that shares the root's prefix as owned", () => {
    const bundle = bundleOf(
      consumer(),
      chunk(
        "assets/other.js",
        ["/repo/packages/editor/src-legacy/old.css"],
        ["assets/other.css"],
      ),
      chunk(
        "assets/editor.js",
        ["/repo/packages/editor/src/styles/index.css"],
        ["assets/editor.css"],
      ),
      asset("assets/other.css", ".legacy{color:red}"),
      asset("assets/editor.css", ".tpl-a{color:red}"),
    );

    runGenerateBundle(bundle, { ownedRoots: ["/repo/packages/editor/src"] });

    expect(inlinedCss(bundle)).toBe(".tpl-a{color:red}");
  });

  it("fails the build when one CSS asset mixes owned and host CSS", () => {
    // A chunk-graph change (say, the host importing the editor statically)
    // can merge both into one asset. It cannot be split, so the build stops
    // instead of shipping either half to the wrong place.
    const bundle = bundleOf(
      consumer(),
      chunk(
        "assets/index.js",
        [
          "/repo/apps/playground/src/style.css",
          "/repo/packages/editor/src/styles/index.css",
        ],
        ["assets/index.css"],
      ),
      asset("assets/index.css", "h1{font-weight:inherit}.tpl-a{color:red}"),
    );

    expect(() => runGenerateBundle(bundle, { ownedRoots: ROOTS })).toThrow(
      /assets\/index\.css mixes the editor's CSS with the host app's/,
    );
  });

  it("fails the build when a CSS asset cannot be attributed to any chunk", () => {
    const bundle = bundleOf(
      consumer(),
      asset("assets/orphan.css", ".x{color:red}"),
    );

    expect(() => runGenerateBundle(bundle, { ownedRoots: ROOTS })).toThrow(
      /assets\/orphan\.css/,
    );
  });

  it("exports the owned roots to the dev mirror, normalized with a trailing slash", () => {
    const code = loadVirtualModule("serve", {
      ownedRoots: [
        "/repo/packages/editor/src",
        "C:\\repo\\packages\\media-library\\src\\",
      ],
    });

    expect(code).toContain(
      'export const ownedStyleRoots = ["/repo/packages/editor/src/","C:/repo/packages/media-library/src/"];',
    );
  });

  it("exports null roots when none are given, in dev and in builds", () => {
    expect(loadVirtualModule("serve")).toContain(
      "export const ownedStyleRoots = null;",
    );
    expect(loadVirtualModule("build")).toContain(
      "export const ownedStyleRoots = null;",
    );
  });
});
