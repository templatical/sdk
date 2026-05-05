import { describe, expect, it } from "vitest";
import {
  createDefaultTemplateContent,
  createImageBlock,
} from "@templatical/types";
import { lintAccessibility } from "../../src";

function lintFor(block: ReturnType<typeof createImageBlock>) {
  const content = createDefaultTemplateContent();
  content.settings.preheaderText = "x";
  content.blocks = [block];
  return lintAccessibility(content).filter(
    (i) => i.ruleId === "img-missing-alt",
  );
}

describe("img-missing-alt", () => {
  it("fires when alt is empty and image has src", () => {
    const block = createImageBlock({ src: "hero.png", alt: "" });
    const issues = lintFor(block);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].blockId).toBe(block.id);
  });

  it("fires when alt is whitespace only", () => {
    const block = createImageBlock({ src: "hero.png", alt: "   " });
    expect(lintFor(block)).toHaveLength(1);
  });

  it("does not fire when alt is set", () => {
    const block = createImageBlock({ src: "hero.png", alt: "Hero" });
    expect(lintFor(block)).toEqual([]);
  });

  it("does not fire when block is decorative", () => {
    const block = createImageBlock({
      src: "hero.png",
      alt: "",
      decorative: true,
    });
    expect(lintFor(block)).toEqual([]);
  });

  it("does not fire when src is empty (image not rendered)", () => {
    const block = createImageBlock({ src: "", alt: "" });
    expect(lintFor(block)).toEqual([]);
  });

  it("respects severity override", () => {
    const block = createImageBlock({ src: "hero.png", alt: "" });
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = "x";
    content.blocks = [block];
    const issues = lintAccessibility(content, {
      rules: { "img-missing-alt": "warning" },
    }).filter((i) => i.ruleId === "img-missing-alt");
    expect(issues[0].severity).toBe("warning");
  });

  it("does not fire when rule is off", () => {
    const block = createImageBlock({ src: "hero.png", alt: "" });
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = "x";
    content.blocks = [block];
    const issues = lintAccessibility(content, {
      rules: { "img-missing-alt": "off" },
    }).filter((i) => i.ruleId === "img-missing-alt");
    expect(issues).toEqual([]);
  });

  it("returns empty array when entire linter is disabled", () => {
    const block = createImageBlock({ src: "hero.png", alt: "" });
    const content = createDefaultTemplateContent();
    content.blocks = [block];
    expect(lintAccessibility(content, { disabled: true })).toEqual([]);
  });
});
