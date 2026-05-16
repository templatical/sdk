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
import { lintLinks } from "../../src";

describe("link.javascript-protocol", () => {
  it("does not fire on plain http/https URLs", () => {
    const content = createDefaultTemplateContent();
    const button = createButtonBlock({ url: "https://example.com" });
    content.blocks = [button];
    const issues = lintLinks(content).filter(
      (i) => i.ruleId === "link.javascript-protocol",
    );
    expect(issues).toEqual([]);
  });

  it("fires on a button.url with javascript: scheme", () => {
    const content = createDefaultTemplateContent();
    const button = createButtonBlock({ url: "javascript:alert(1)" });
    content.blocks = [button];
    const issues = lintLinks(content).filter(
      (i) => i.ruleId === "link.javascript-protocol",
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].blockId).toBe(button.id);
  });

  it("fires on a paragraph anchor with javascript: href", () => {
    const content = createDefaultTemplateContent();
    const paragraph = createParagraphBlock({
      content: '<p><a href="javascript:void(0)">click</a></p>',
    });
    content.blocks = [paragraph];
    const issues = lintLinks(content).filter(
      (i) => i.ruleId === "link.javascript-protocol",
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].blockId).toBe(paragraph.id);
  });

  it("fires on image.linkUrl", () => {
    const content = createDefaultTemplateContent();
    const image = createImageBlock({
      src: "https://example.com/x.png",
      linkUrl: "javascript:alert(1)",
    });
    content.blocks = [image];
    const issues = lintLinks(content).filter(
      (i) => i.ruleId === "link.javascript-protocol",
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].blockId).toBe(image.id);
  });

  it("fires on video.url", () => {
    const content = createDefaultTemplateContent();
    const video = createVideoBlock({ url: "javascript:alert(1)" });
    content.blocks = [video];
    const issues = lintLinks(content).filter(
      (i) => i.ruleId === "link.javascript-protocol",
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].blockId).toBe(video.id);
  });

  it("fires on menu.items[i].url", () => {
    const content = createDefaultTemplateContent();
    const menu = createMenuBlock({
      items: [
        {
          id: "m1",
          text: "Home",
          url: "javascript:alert(1)",
          openInNewTab: false,
          bold: false,
          underline: false,
        },
      ],
    });
    content.blocks = [menu];
    const issues = lintLinks(content).filter(
      (i) => i.ruleId === "link.javascript-protocol",
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].blockId).toBe(menu.id);
  });

  it("fires on social.icons[i].url", () => {
    const content = createDefaultTemplateContent();
    const social = createSocialIconsBlock({
      icons: [
        { id: "i1", platform: "facebook", url: "javascript:alert(1)" },
      ],
    });
    content.blocks = [social];
    const issues = lintLinks(content).filter(
      (i) => i.ruleId === "link.javascript-protocol",
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].blockId).toBe(social.id);
  });

  it("catches whitespace-padded and mixed-case variants", () => {
    const content = createDefaultTemplateContent();
    const a = createButtonBlock({ url: " JaVaScRiPt:alert(1)" });
    const b = createButtonBlock({ url: "\tjavascript:alert(1)" });
    content.blocks = [a, b];
    const issues = lintLinks(content).filter(
      (i) => i.ruleId === "link.javascript-protocol",
    );
    expect(issues).toHaveLength(2);
  });

  it("respects severity override and `off` disables the rule", () => {
    const content = createDefaultTemplateContent();
    const button = createButtonBlock({ url: "javascript:alert(1)" });
    content.blocks = [button];

    const warned = lintLinks(content, {
      links: { rules: { "link.javascript-protocol": "warning" } },
    }).find((i) => i.ruleId === "link.javascript-protocol");
    expect(warned?.severity).toBe("warning");

    const off = lintLinks(content, {
      links: { rules: { "link.javascript-protocol": "off" } },
    }).filter((i) => i.ruleId === "link.javascript-protocol");
    expect(off).toEqual([]);

    expect(lintLinks(content, { disabled: true })).toEqual([]);
    expect(lintLinks(content, { links: false })).toEqual([]);
  });
});
