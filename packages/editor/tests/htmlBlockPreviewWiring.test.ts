import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// `config.htmlBlockPreview` must be forwarded from the public config all the
// way to `useEditorCore`'s provide — a dropped field silently disables the
// feature, and the per-component test (which injects the key directly) can't
// catch it. These source-pattern guards lock the wiring, mirroring
// logicTagsConfigWiring.test.ts. Kept in a node-env file (no happy-dom) so
// `import.meta.url` resolves to the real file path for readFileSync.

function readSrc(path: string): string {
  return readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
}

describe("htmlBlockPreview config wiring", () => {
  it("Editor.vue forwards config.htmlBlockPreview to useEditorCore", () => {
    expect(readSrc("Editor.vue")).toContain(
      "htmlBlockPreview: props.config.htmlBlockPreview",
    );
  });

  it("useCloudInitialization forwards config.htmlBlockPreview to useEditorCore", () => {
    expect(readSrc("cloud/composables/useCloudInitialization.ts")).toContain(
      "htmlBlockPreview: config.htmlBlockPreview",
    );
  });

  it("useEditorCore provides the normalized HTML_BLOCK_PREVIEW_KEY", () => {
    const src = readSrc("composables/useEditorCore.ts");
    expect(src).toContain("HTML_BLOCK_PREVIEW_KEY");
    expect(src).toContain("resolveHtmlBlockPreview(config.htmlBlockPreview)");
  });

  it("both public config types expose htmlBlockPreview", () => {
    expect(readSrc("index.ts")).toContain(
      "htmlBlockPreview?: HtmlBlockPreviewConfig",
    );
    expect(readSrc("cloud/cloudConfig.ts")).toContain(
      "htmlBlockPreview?: HtmlBlockPreviewConfig",
    );
  });
});
