import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// `config.resolveImageUrl` must be forwarded from the public config all the
// way to `useEditorCore`'s provide — a dropped field silently disables the
// feature, and the per-component test (which injects the key directly) can't
// catch it. These source-pattern guards lock the wiring, mirroring
// htmlBlockPreviewWiring.test.ts. Kept in a node-env file (no happy-dom) so
// `import.meta.url` resolves to the real file path for readFileSync.

function readSrc(path: string): string {
  return readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
}

describe("resolveImageUrl config wiring", () => {
  it("Editor.vue forwards config.resolveImageUrl to useEditorCore", () => {
    expect(readSrc("Editor.vue")).toContain(
      "resolveImageUrl: props.config.resolveImageUrl",
    );
  });

  it("useEditorCore provides IMAGE_URL_RESOLVER_KEY from config.resolveImageUrl", () => {
    const src = readSrc("composables/useEditorCore.ts");
    expect(src).toContain("IMAGE_URL_RESOLVER_KEY");
    expect(src).toContain("createImageUrlResolver(config.resolveImageUrl)");
  });

  it("the public OSS config exposes resolveImageUrl", () => {
    expect(readSrc("index.ts")).toContain("resolveImageUrl?: ResolveImageUrl");
  });

  it("ImageBlock renders through the resolved display src, not raw block.src", () => {
    const src = readSrc("components/blocks/ImageBlock.vue");
    expect(src).toContain("useResolvedImageSrc");
    // The canvas <img> bindings must go through the resolver composable.
    expect(src).not.toContain(':src="block.src"');
    expect(src).not.toContain(':src="block.placeholderUrl"');
  });
});
