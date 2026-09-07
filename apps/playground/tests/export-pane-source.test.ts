import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Structural guards over `ExportPane.vue`, the same pattern
 * `controls-pane-source.test.ts` uses: the pane is not mountable here (the
 * playground has no `@vue/test-utils` and its `vitest.config.ts` carries no
 * Vue plugin config for that, deliberately), so source text is what is left.
 */

const source = readFileSync(
  join(import.meta.dirname, "../src/shell/ExportPane.vue"),
  "utf8",
);

describe("ExportPane", () => {
  it("sets inheritAttrs: false, like every other registered drawer pane", () => {
    expect(source).toContain("defineOptions({ inheritAttrs: false });");
  });

  it("calls both toMjml() and toHtml() on the live editor", () => {
    expect(source).toContain("editor.toMjml()");
    expect(source).toContain("editor.toHtml()");
  });

  it("renders each rejection's message verbatim rather than a paraphrase", () => {
    expect(source).toContain(
      "error.value = err instanceof Error ? err.message : String(err);",
    );
  });

  it("resets mjml, html and error on editor identity change", () => {
    const watchBlock = source.match(
      /watch\(\s*\(\)\s*=>\s*props\.editor,\s*\(\)\s*=>\s*\{([^}]*)\}/,
    );
    expect(watchBlock).not.toBeNull();
    expect(watchBlock![1]).toContain("mjml.value = \"\"");
    expect(watchBlock![1]).toContain("html.value = \"\"");
    expect(watchBlock![1]).toContain("error.value = \"\"");
  });

  it("does not add syntax highlighting — plain monospace text, like the Config tab", () => {
    expect(source).not.toContain("codemirror");
    expect(source).not.toContain("CodeMirror");
  });
});
