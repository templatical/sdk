import { describe, expect, it } from "vitest";
import {
  createBackgroundImage,
  createDefaultTemplateContent,
  createSectionBlock,
  type BackgroundImage,
  type Block,
  type SectionHero,
} from "@templatical/types";
import { lintStructure } from "../../src";
import type { LintOptions } from "../../src";

const RULE = "structure.hero-not-applied";
const MEASURED: BackgroundImage = {
  ...createBackgroundImage("https://cdn.test/hero.jpg"),
  naturalWidth: 1200,
  naturalHeight: 800,
};
const MATCH: SectionHero = { height: "image", verticalAlign: "middle" };

function hits(blocks: Block[], options: LintOptions = {}) {
  const content = createDefaultTemplateContent();
  content.blocks = blocks;
  return lintStructure(content, options).filter((i) => i.ruleId === RULE);
}

describe(RULE, () => {
  it("does not fire without hero", () => {
    expect(hits([createSectionBlock({ backgroundImage: MEASURED })])).toEqual(
      [],
    );
  });

  it("does not fire for a hero that applies", () => {
    expect(
      hits([createSectionBlock({ backgroundImage: MEASURED, hero: MATCH })]),
    ).toEqual([]);
  });

  it("does not fire for a fixed height over an unmeasured image", () => {
    const section = createSectionBlock({
      backgroundImage: createBackgroundImage("https://cdn.test/hero.jpg"),
      hero: { height: 300, verticalAlign: "top" },
    });
    expect(hits([section])).toEqual([]);
  });

  it("explains a hero with more than one column", () => {
    const section = createSectionBlock({
      columns: "2",
      children: [[], []],
      backgroundImage: MEASURED,
      hero: MATCH,
    });
    const issues = hits([section]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      blockId: section.id,
      severity: "warning",
    });
    expect(issues[0].message).toBe(
      "Hero mode needs a one-column section, so this section renders as a regular one.",
    );
    expect(issues[0].suggestion).toBe("Switch it back to one column, or turn hero mode off.");
  });

  it("explains a hero without a background image", () => {
    const issues = hits([createSectionBlock({ hero: MATCH })]);
    expect(issues[0].message).toBe(
      "Hero mode needs a background image, so this section renders as a regular one until it has one.",
    );
    expect(issues[0].suggestion).toBe("Add a background image or turn hero mode off.");
  });

  it("explains a hero that can't match an image of unknown size", () => {
    const issues = hits([
      createSectionBlock({
        backgroundImage: createBackgroundImage("{{ hero_url }}"),
        hero: MATCH,
      }),
    ]);
    expect(issues[0].message).toBe(
      "Hero mode can't match this background image's shape because its size is unknown (a merge-tag URL, or an image the editor didn't measure), so the section renders as a regular one.",
    );
    expect(issues[0].suggestion).toBe("Give it a fixed height, or set the image file's size.");
  });

  it("explains in German", () => {
    const issues = hits([createSectionBlock({ hero: MATCH })], {
      locale: "de",
    });
    expect(issues[0].message).toBe(
      "Der Hero-Modus braucht ein Hintergrundbild, deshalb wird diese Sektion bis dahin als normale Sektion dargestellt.",
    );
    expect(issues[0].suggestion).toBe("Ergänze ein Hintergrundbild oder schalte den Hero-Modus aus.");
  });

  describe("severity override", () => {
    const imageless = () => createSectionBlock({ hero: MATCH });

    it("raises to error", () => {
      const issues = hits([imageless()], {
        structure: { rules: { [RULE]: "error" } },
      });
      expect(issues[0].severity).toBe("error");
    });

    it("turns off", () => {
      expect(
        hits([imageless()], { structure: { rules: { [RULE]: "off" } } }),
      ).toEqual([]);
    });

    it("is silent when linting is disabled", () => {
      expect(hits([imageless()], { disabled: true })).toEqual([]);
    });
  });
});
