import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const EDITOR_SRC = resolve(import.meta.dirname, "../src");
const CORE_CLOUD = resolve(import.meta.dirname, "../../core/src/cloud");
const read = (path: string) => readFileSync(path, "utf8");

describe("Cloud without its old AI (A1 PR 2, until S7)", () => {
  it("ships no Cloud-only AI composable", () => {
    for (const file of [
      "ai-chat.ts",
      "ai-rewrite.ts",
      "ai-config.ts",
      "template-scoring.ts",
      "design-reference.ts",
    ]) {
      expect(existsSync(resolve(CORE_CLOUD, file)), file).toBe(false);
    }
    const index = read(resolve(CORE_CLOUD, "index.ts"));
    for (const name of [
      "useAiChat",
      "useAiRewrite",
      "useAiConfig",
      "useTemplateScoring",
      "useDesignReference",
    ]) {
      expect(index).not.toContain(name);
    }
    expect(read(resolve(CORE_CLOUD, "url-builder.ts"))).not.toContain('"ai.');
  });

  it("ships no Cloud-only AI panel", () => {
    for (const file of [
      "cloud/components/AiChatSidebar.vue",
      "cloud/components/AiFeatureMenu.vue",
      "cloud/components/TemplateScoringPanel.vue",
      "cloud/components/DesignReferenceSidebar.vue",
      "cloud/utils/scoringStyles.ts",
    ]) {
      expect(existsSync(resolve(EDITOR_SRC, file)), file).toBe(false);
    }
    expect(read(resolve(EDITOR_SRC, "keys.ts"))).not.toMatch(
      /AI_CONFIG_KEY|SCORING_KEY/,
    );
  });

  it("gates no shared component on Cloud's old AI plan feature", () => {
    const canvas = read(resolve(EDITOR_SRC, "components/Canvas.vue"));
    expect(canvas).not.toContain("aiGeneration");
    expect(canvas).not.toContain("open-ai-chat");
    expect(canvas).not.toContain("cloudT.aiMenu");
  });
});
