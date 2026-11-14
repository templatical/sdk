import { describe, expect, it } from "vitest";
import {
  createDefaultTemplateContent,
  createSectionBlock,
  createSocialIconsBlock,
  type SocialIcon,
} from "@templatical/types";
import { lintStructure } from "../../src";
import type { LintOptions } from "../../src";

const RULE = "structure.social-icon-missing-image";

function hits(icons: SocialIcon[], options: LintOptions = {}) {
  const content = createDefaultTemplateContent();
  const block = createSocialIconsBlock({ icons });
  content.blocks = [block];
  return {
    block,
    issues: lintStructure(content, options).filter((i) => i.ruleId === RULE),
  };
}

const custom = (
  id: string,
  imageUrl: string,
): SocialIcon => ({
  id,
  platform: "custom",
  url: `https://example.com/${id}`,
  imageUrl,
  alt: "Example",
});

describe(RULE, () => {
  it("does not fire when a custom icon has an image URL", () => {
    expect(hits([custom("gh", "https://cdn.example/gh.png")]).issues).toEqual(
      [],
    );
  });

  it("fires once per custom icon whose image is missing, not a string, or blank", () => {
    const icons: SocialIcon[] = [
      custom("missing", "https://cdn.example/placeholder.png"),
      { id: "fb", platform: "facebook", url: "https://facebook.com" },
      custom("blank", "  \n"),
      custom("spaces", "   "),
    ];
    delete (icons[0] as { imageUrl?: string }).imageUrl;
    (icons as { imageUrl?: unknown }[]).splice(3, 0, {
      id: "number",
      platform: "custom",
      url: "https://example.com/number",
      imageUrl: 5,
    });
    const { block, issues } = hits(icons);
    expect(issues.map((issue) => issue.message)).toEqual([
      "Icon 1 is a custom icon with no image.",
      "Icon 3 is a custom icon with no image.",
      "Icon 4 is a custom icon with no image.",
      "Icon 5 is a custom icon with no image.",
    ]);
    expect(issues.map((issue) => issue.blockId)).toEqual([
      block.id,
      block.id,
      block.id,
      block.id,
    ]);
    expect(issues[0]).toMatchObject({
      severity: "error",
      suggestion:
        "Add an image URL, or choose a platform or remove the icon.",
      reference:
        "https://docs.templatical.com/quality/structure/rule-catalog#social-icons",
    });
  });

  it("ignores built-in icons", () => {
    expect(
      hits([
        { id: "fb", platform: "facebook", url: "https://facebook.com" },
        { id: "tw", platform: "twitter", url: "https://twitter.com" },
      ]).issues,
    ).toEqual([]);
  });

  it("treats a merge-tag imageUrl as present", () => {
    expect(hits([custom("brand", "{{ brand_icon }}")]).issues).toEqual([]);
  });

  it("explains in German", () => {
    const { issues } = hits([custom("gh", "")], { locale: "de" });
    expect(issues[0].message).toBe(
      "Symbol 1 ist ein benutzerdefiniertes Symbol ohne Bild.",
    );
    expect(issues[0].suggestion).toBe(
      "Füge eine Bild-URL hinzu, wähle eine Plattform oder entferne das Symbol.",
    );
  });

  it("fires for a social block nested in a section", () => {
    const content = createDefaultTemplateContent();
    const social = createSocialIconsBlock({
      icons: [custom("gh", "")],
    });
    const section = createSectionBlock();
    section.children = [[social]];
    content.blocks = [section];
    const issues = lintStructure(content).filter((i) => i.ruleId === RULE);
    expect(issues).toHaveLength(1);
    expect(issues[0].blockId).toBe(social.id);
    expect(issues[0].message).toBe("Icon 1 is a custom icon with no image.");
  });

  describe("severity override", () => {
    const blank = () => [custom("gh", "")];

    it("lowers to warning", () => {
      const { issues } = hits(blank(), {
        structure: { rules: { [RULE]: "warning" } },
      });
      expect(issues[0].severity).toBe("warning");
    });

    it("turns off", () => {
      expect(
        hits(blank(), { structure: { rules: { [RULE]: "off" } } }).issues,
      ).toEqual([]);
    });

    it("is silent when linting is disabled", () => {
      expect(hits(blank(), { disabled: true }).issues).toEqual([]);
    });
  });
});
