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

const RULE = "structure.nested-background-image";
const IMAGE = createBackgroundImage("https://cdn.test/hero.jpg");
const BAND = createBackgroundImage("https://cdn.test/band.jpg");

function hits(blocks: Block[], options: LintOptions = {}) {
  const content = createDefaultTemplateContent();
  content.blocks = blocks;
  return lintStructure(content, options).filter((i) => i.ruleId === RULE);
}

describe(RULE, () => {
  it("does not fire when only the wrapper has an image", () => {
    const section = createSectionBlock({ wrapper: { backgroundImage: BAND } });
    expect(hits([section])).toEqual([]);
  });

  it("does not fire when only the section has an image", () => {
    const section = createSectionBlock({
      backgroundImage: IMAGE,
      wrapper: { backgroundColor: "" },
    });
    expect(hits([section])).toEqual([]);
  });

  it("does not fire when the wrapper image url is blank", () => {
    const section = createSectionBlock({
      backgroundImage: IMAGE,
      wrapper: { backgroundImage: { ...BAND, url: "" } },
    });
    expect(hits([section])).toEqual([]);
  });

  it("fires when section.wrapper and the section both have an image", () => {
    const section = createSectionBlock({
      backgroundImage: IMAGE,
      wrapper: { backgroundImage: BAND },
    });
    const issues = hits([section]);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].blockId).toBe(section.id);
    expect(issues[0].message).toContain("Outlook");
  });

  it("fires when a layout band and its section both have an image", () => {
    const section = createSectionBlock({ backgroundImage: IMAGE });
    const band = createWrapperBlock({
      children: [section],
      backgroundImage: BAND,
    });
    const issues = hits([band]);
    expect(issues).toHaveLength(1);
    expect(issues[0].blockId).toBe(section.id);
  });

  describe("severity override", () => {
    const both = () =>
      createSectionBlock({
        backgroundImage: IMAGE,
        wrapper: { backgroundImage: BAND },
      });

    it("raises to error", () => {
      const issues = hits([both()], {
        structure: { rules: { [RULE]: "error" } },
      });
      expect(issues[0].severity).toBe("error");
    });

    it("turns off", () => {
      expect(
        hits([both()], { structure: { rules: { [RULE]: "off" } } }),
      ).toEqual([]);
    });

    it("is silent when linting is disabled", () => {
      expect(hits([both()], { disabled: true })).toEqual([]);
    });
  });
});
