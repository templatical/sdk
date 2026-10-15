import { describe, expect, it } from "vitest";
import {
  createBackgroundImage,
  createDefaultTemplateContent,
  createSectionBlock,
  createWrapperBlock,
  type Block,
} from "@templatical/types";
import { lintStructure } from "../../src";
import type { LintOptions } from "../../src";

const RULE = "structure.wrapper-color-over-background-image";
const IMAGE = createBackgroundImage("https://cdn.test/hero.jpg");

function hits(blocks: Block[], options: LintOptions = {}) {
  const content = createDefaultTemplateContent();
  content.blocks = blocks;
  return lintStructure(content, options).filter((i) => i.ruleId === RULE);
}

describe(RULE, () => {
  it("does not fire for a section image without a wrapper", () => {
    expect(hits([createSectionBlock({ backgroundImage: IMAGE })])).toEqual([]);
  });

  it("does not fire when the wrapper has no color", () => {
    const section = createSectionBlock({
      backgroundImage: IMAGE,
      wrapper: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    });
    expect(hits([section])).toEqual([]);
  });

  it.each(["", "transparent", "TRANSPARENT"])(
    "does not fire for wrapper color %j",
    (backgroundColor) => {
      const section = createSectionBlock({
        backgroundImage: IMAGE,
        wrapper: { backgroundColor },
      });
      expect(hits([section])).toEqual([]);
    },
  );

  it("does not fire when the section has no usable image", () => {
    const section = createSectionBlock({
      backgroundImage: { ...IMAGE, url: "  " },
      wrapper: { backgroundColor: "#f1f5f9" },
    });
    expect(hits([section])).toEqual([]);
  });

  it("fires for a colored section.wrapper around an image", () => {
    const section = createSectionBlock({
      backgroundImage: IMAGE,
      wrapper: { backgroundColor: "#f1f5f9" },
    });
    const issues = hits([section]);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].blockId).toBe(section.id);
    expect(issues[0].message).toContain("Outlook");
  });

  it("fires for a colored layout wrapper band around an image", () => {
    const section = createSectionBlock({ backgroundImage: IMAGE });
    const band = createWrapperBlock({
      children: [section],
      styles: {
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        backgroundColor: "#f1f5f9",
      },
    });
    const issues = hits([band]);
    expect(issues).toHaveLength(1);
    expect(issues[0].blockId).toBe(section.id);
  });

  it("checks the section's own wrapper before the layout band", () => {
    const section = createSectionBlock({
      backgroundImage: IMAGE,
      wrapper: {},
    });
    const band = createWrapperBlock({
      children: [section],
      styles: {
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        backgroundColor: "#f1f5f9",
      },
    });
    expect(hits([band])).toEqual([]);
  });

  describe("severity override", () => {
    const colored = () =>
      createSectionBlock({
        backgroundImage: IMAGE,
        wrapper: { backgroundColor: "#f1f5f9" },
      });

    it("raises to error", () => {
      const issues = hits([colored()], {
        structure: { rules: { [RULE]: "error" } },
      });
      expect(issues[0].severity).toBe("error");
    });

    it("turns off", () => {
      expect(
        hits([colored()], { structure: { rules: { [RULE]: "off" } } }),
      ).toEqual([]);
    });

    it("is silent when linting is disabled", () => {
      expect(hits([colored()], { disabled: true })).toEqual([]);
    });
  });
});
