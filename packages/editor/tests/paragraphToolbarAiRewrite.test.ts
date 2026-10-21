import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(
  resolve(__dirname, "../src/components/blocks/ParagraphToolbar.vue"),
  "utf-8",
);

describe("ParagraphToolbar AI rewrite button (D22)", () => {
  it("loads the menu lazily, never statically", () => {
    expect(SRC).toMatch(
      /defineAsyncComponent\(\s*\(\) => import\("\.\.\/ai\/AiRewriteMenu\.vue"\),?\s*\)/,
    );
    expect(SRC).not.toMatch(/import AiRewriteMenu from/);
  });

  it("shows only while the provider rewrites and a template is loaded", () => {
    expect(SRC).toContain('caps.ai?.isFeatureEnabled("rewrite")');
    expect(SRC).toContain('v-if="canRewriteWithAi"');
    expect(SRC).toContain('<AiRewriteMenu :editor="editor" />');
  });
});
