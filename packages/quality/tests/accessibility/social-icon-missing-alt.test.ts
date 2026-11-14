import { describe, expect, it } from "vitest";
import {
  createDefaultTemplateContent,
  createSocialIconsBlock,
  type SocialIcon,
} from "@templatical/types";
import { lintAccessibility, lintTemplate } from "../../src";
import type { LintOptions } from "../../src";

const RULE = "a11y.social-icon-missing-alt";

function hits(icons: SocialIcon[], options: LintOptions = {}) {
  const content = createDefaultTemplateContent();
  content.settings.preheaderText = "x";
  const block = createSocialIconsBlock({ icons });
  content.blocks = [block];
  return {
    block,
    issues: lintAccessibility(content, options).filter((i) => i.ruleId === RULE),
  };
}

function custom(id: string, imageUrl: string, alt?: string): SocialIcon {
  return {
    id,
    platform: "custom",
    url: `https://example.com/${id}`,
    imageUrl,
    ...(alt === undefined ? {} : { alt }),
  };
}

describe(RULE, () => {
  it("does not fire when a custom icon has alt text", () => {
    expect(
      hits([custom("gh", "https://cdn.example/gh.png", "GitHub")]).issues,
    ).toEqual([]);
  });

  it("fires once per custom icon whose alt is missing or blank", () => {
    const { block, issues } = hits([
      custom("missing", "https://cdn.example/a.png"),
      { id: "fb", platform: "facebook", url: "https://facebook.com" },
      custom("blank", "https://cdn.example/b.png", "   "),
    ]);
    expect(issues).toHaveLength(2);
    expect(issues.map((issue) => issue.blockId)).toEqual([block.id, block.id]);
    expect(issues[0]).toMatchObject({
      severity: "warning",
      message: "Icon 1 is a custom icon with no text alternative.",
      suggestion: "Add alt text. The image is the link's only content.",
      reference: "https://www.w3.org/WAI/tutorials/images/",
    });
    expect(issues[1].message).toBe(
      "Icon 3 is a custom icon with no text alternative.",
    );
  });

  it("ignores built-in icons", () => {
    expect(
      hits([
        { id: "fb", platform: "facebook", url: "https://facebook.com" },
        { id: "tw", platform: "twitter", url: "https://twitter.com" },
      ]).issues,
    ).toEqual([]);
  });

  it("does not fire when the custom image is blank, because the icon is not rendered", () => {
    expect(hits([custom("gh", "  ")]).issues).toEqual([]);
  });

  it("treats a merge-tag imageUrl as present", () => {
    expect(hits([custom("brand", "{{ brand_icon }}", "Brand")]).issues).toEqual(
      [],
    );
    const { issues } = hits([custom("brand", "{{ brand_icon }}")]);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toBe(
      "Icon 1 is a custom icon with no text alternative.",
    );
  });

  it("explains in German", () => {
    const { issues } = hits([custom("gh", "https://cdn.example/gh.png")], {
      locale: "de",
    });
    expect(issues[0].message).toBe(
      "Symbol 1 ist ein benutzerdefiniertes Symbol ohne Alternativtext.",
    );
    expect(issues[0].suggestion).toBe(
      "Füge einen Alt-Text hinzu. Das Bild ist der einzige Inhalt des Links.",
    );
  });

  it("treats a non-string alt as missing when the image URL is present", () => {
    const icon = custom("gh", "https://cdn.example/gh.png", "GitHub");
    (icon as { alt: unknown }).alt = 5;
    const { issues } = hits([icon]);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toBe(
      "Icon 1 is a custom icon with no text alternative.",
    );
  });

  it("does not fire when imageUrl is missing, null, or not a string", () => {
    const icons = [
      custom("missing", "x"),
      custom("nil", "x"),
      custom("num", "x"),
    ];
    delete (icons[0] as { imageUrl?: string }).imageUrl;
    (icons[1] as { imageUrl: unknown }).imageUrl = null;
    (icons[2] as { imageUrl: unknown }).imageUrl = 12;
    expect(hits(icons).issues).toEqual([]);
  });

  it("lintTemplate reports each malformed image and no alt hit for it", () => {
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = "Preview";
    const icons = [
      { id: "fb", platform: "facebook" as const, url: "https://facebook.com" },
      custom("missing", "x"),
      custom("nil", "x"),
      custom("num", "x"),
    ];
    delete (icons[1] as { imageUrl?: string }).imageUrl;
    (icons[2] as { imageUrl: unknown }).imageUrl = null;
    (icons[3] as { imageUrl: unknown }).imageUrl = 7;
    content.blocks = [createSocialIconsBlock({ icons })];
    const issues = lintTemplate(content);
    expect(
      issues
        .filter((issue) => issue.ruleId === "structure.social-icon-missing-image")
        .map((issue) => issue.message),
    ).toEqual([
      "Icon 2 is a custom icon with no image.",
      "Icon 3 is a custom icon with no image.",
      "Icon 4 is a custom icon with no image.",
    ]);
    expect(issues.filter((issue) => issue.ruleId === RULE)).toEqual([]);
  });

  describe("severity override", () => {
    const bare = () => [custom("gh", "https://cdn.example/gh.png")];

    it("raises to error", () => {
      const { issues } = hits(bare(), {
        accessibility: { rules: { [RULE]: "error" } },
      });
      expect(issues[0].severity).toBe("error");
    });

    it("turns off", () => {
      expect(
        hits(bare(), { accessibility: { rules: { [RULE]: "off" } } }).issues,
      ).toEqual([]);
    });

    it("is silent when linting is disabled", () => {
      expect(hits(bare(), { disabled: true }).issues).toEqual([]);
    });
  });
});
