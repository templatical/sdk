import { describe, expect, it } from "vitest";
import {
  createButtonBlock,
  createDefaultTemplateContent,
  createImageBlock,
  createMenuBlock,
  createParagraphBlock,
  createSocialIconsBlock,
  createVideoBlock,
} from "@templatical/types";
import { lintLinks } from "../src";

function buildTroubledTemplate() {
  const content = createDefaultTemplateContent();

  // Anchor → bad scheme inside paragraph content.
  const paragraph = createParagraphBlock({
    content:
      '<p>Hi <a href="javascript:alert(1)">click</a> and ' +
      '<a href="http://localhost:3000">staging</a></p>',
  });

  // Button → unsupported protocol.
  const button = createButtonBlock({ url: "ftp://example.com/file" });

  // Image → linkUrl pointing at staging.
  const image = createImageBlock({
    src: "https://example.com/x.png",
    linkUrl: "https://app.staging.acme.com/preview",
  });

  // Video → javascript: URL.
  const video = createVideoBlock({ url: "javascript:alert(2)" });

  // Menu → one malformed mailto, one localhost.
  const menu = createMenuBlock({
    items: [
      {
        id: "m1",
        text: "Contact",
        url: "mailto:not-an-email",
        openInNewTab: false,
        bold: false,
        underline: false,
      },
      {
        id: "m2",
        text: "Local",
        url: "http://127.0.0.1:8080/x",
        openInNewTab: false,
        bold: false,
        underline: false,
      },
    ],
  });

  // Social → malformed tel.
  const social = createSocialIconsBlock({
    icons: [{ id: "s1", platform: "facebook", url: "tel:CALL-NOW" }],
  });

  content.blocks = [paragraph, button, image, video, menu, social];
  return { content, paragraph, button, image, video, menu, social };
}

describe("lintLinks integration", () => {
  it("emits issues across every URL source with the default options", () => {
    const { content, paragraph, button, image, video, menu, social } =
      buildTroubledTemplate();
    const issues = lintLinks(content);

    const byRule = (id: string) => issues.filter((i) => i.ruleId === id);

    // javascript-protocol: paragraph anchor + video.url
    const js = byRule("link.javascript-protocol");
    expect(js.map((i) => i.blockId).sort()).toEqual(
      [paragraph.id, video.id].sort(),
    );

    // unsupported-protocol: button ftp:
    const unsupp = byRule("link.unsupported-protocol");
    expect(unsupp).toHaveLength(1);
    expect(unsupp[0].blockId).toBe(button.id);

    // malformed-mailto: menu item
    const mailto = byRule("link.malformed-mailto");
    expect(mailto).toHaveLength(1);
    expect(mailto[0].blockId).toBe(menu.id);

    // malformed-tel: social icon
    const tel = byRule("link.malformed-tel");
    expect(tel).toHaveLength(1);
    expect(tel[0].blockId).toBe(social.id);

    // localhost-or-staging: paragraph anchor (localhost) + image.linkUrl
    // (staging) + menu item (127.0.0.1)
    const staging = byRule("link.localhost-or-staging");
    expect(staging.map((i) => i.blockId).sort()).toEqual(
      [paragraph.id, image.id, menu.id].sort(),
    );
  });

  it("silences localhost-or-staging when nonProductionHosts is empty", () => {
    const { content } = buildTroubledTemplate();
    const issues = lintLinks(content, {
      links: { nonProductionHosts: [] },
    });
    expect(
      issues.filter((i) => i.ruleId === "link.localhost-or-staging"),
    ).toEqual([]);
  });

  it("custom nonProductionHosts fires for the custom pattern only", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createButtonBlock({ url: "https://x.preview.example.com" }),
      createButtonBlock({ url: "http://localhost:3000" }),
    ];
    const issues = lintLinks(content, {
      links: { nonProductionHosts: ["*.preview.*"] },
    }).filter((i) => i.ruleId === "link.localhost-or-staging");
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("preview");
  });
});
