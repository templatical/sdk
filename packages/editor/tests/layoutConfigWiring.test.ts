import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// `config.layout` must be forwarded from the public config all the way to
// `useEditorCore`'s provide — a dropped field silently disables the overlay,
// and a per-component test (which injects LAYOUT_KEY directly) can't catch
// it. These source-pattern guards lock the wiring, mirroring
// htmlBlockPreviewWiring.test.ts. Kept in a node-env file (no happy-dom) so
// `import.meta.url` resolves to the real file path for readFileSync.

function readSrc(path: string): string {
  return readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
}

describe("layout config wiring", () => {
  it("Editor.vue forwards config.layout to useEditorCore", () => {
    expect(readSrc("Editor.vue")).toContain("layout: props.config.layout");
  });

  // `initCloud()` forwards it by mapping its own config onto `init()`'s — there
  // is one `useEditorCore` call site now, so this is the only hop left.
  it("initCloud forwards config.layout into the init() config", () => {
    expect(readSrc("index.ts")).toContain("layout: config.layout");
  });

  it("useEditorCore provides LAYOUT_KEY from config.layout", () => {
    const src = readSrc("composables/useEditorCore.ts");
    expect(src).toContain("LAYOUT_KEY");
    expect(src).toContain("config.layout");
    expect(src).toContain("provide(LAYOUT_KEY, config.layout)");
  });

  it("both public config types expose layout", () => {
    expect(readSrc("index.ts")).toContain("layout?: TemplateContent");
    expect(readSrc("cloud/cloudConfig.ts")).toContain(
      "layout?: TemplateContent",
    );
  });

  it("keys.ts declares LAYOUT_KEY", () => {
    expect(readSrc("keys.ts")).toContain("export const LAYOUT_KEY");
    expect(readSrc("keys.ts")).toContain('Symbol("layout")');
  });

  it("init/mountEditor normalizes layout then validateLayout, and refuses slot/wrapper in content", () => {
    const src = readSrc("index.ts");
    expect(src).toContain(
      "config.layout = normalizeContentForConfig(config.layout, config.mergeTags)",
    );
    expect(src).toContain("validateLayout(config.layout)");
    expect(src).toContain("assertNoSlotInContent(config.content)");
    expect(src).toContain("assertNoWrapperInContent(config.content)");
  });

  it("re-exports layout helpers from @templatical/types", () => {
    expect(readSrc("index.ts")).toContain(`export {
  applyLayout,
  validateLayout,
  createSlotBlock,
  createWrapperBlock,
  createParagraphBlock,
  createDefaultTemplateContent,
  isSlot,
  isWrapper,
  layoutWrapsSlot,
} from "@templatical/types";`);
  });
});
