import { describe, expect, it } from "vitest";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
} from "@templatical/types";
import { lintAccessibility } from "../../src";

function lint(html: string) {
  const block = createParagraphBlock({ content: html });
  const content = createDefaultTemplateContent();
  content.settings.preheaderText = "x";
  content.blocks = [block];
  return {
    issues: lintAccessibility(content).filter(
      (i) => i.ruleId === "link-empty",
    ),
    blockId: block.id,
  };
}

describe("link-empty", () => {
  it("fires when anchor has no text and no image", () => {
    const { issues, blockId } = lint('<p><a href="/x"></a></p>');
    expect(issues).toHaveLength(1);
    expect(issues[0].blockId).toBe(blockId);
  });

  it("does not fire when anchor has text", () => {
    const { issues } = lint('<p><a href="/x">Buy now</a></p>');
    expect(issues).toEqual([]);
  });

  it("does not fire when anchor wraps an image with alt", () => {
    const { issues } = lint(
      '<p><a href="/x"><img src="h.png" alt="Hero"/></a></p>',
    );
    expect(issues).toEqual([]);
  });

  it("fires when anchor wraps an image with empty alt", () => {
    const { issues } = lint(
      '<p><a href="/x"><img src="h.png" alt=""/></a></p>',
    );
    expect(issues).toHaveLength(1);
  });
});
