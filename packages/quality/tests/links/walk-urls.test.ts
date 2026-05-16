import { describe, expect, it } from "vitest";
import {
  createButtonBlock,
  createDefaultTemplateContent,
  createHtmlBlock,
  createImageBlock,
  createMenuBlock,
  createParagraphBlock,
  createSectionBlock,
  createSocialIconsBlock,
  createTitleBlock,
  createVideoBlock,
} from "@templatical/types";
import { walkUrls } from "../../src";

describe("walkUrls", () => {
  it("returns an empty list for an empty template", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [];
    expect(walkUrls(content)).toEqual([]);
  });

  it("emits one occurrence per anchor across title / paragraph / html", () => {
    const content = createDefaultTemplateContent();
    const title = createTitleBlock({
      content: '<h2><a href="https://t.com">t</a></h2>',
    });
    const paragraph = createParagraphBlock({
      content: '<p><a href="https://p.com">p</a></p>',
    });
    const html = createHtmlBlock({
      content: '<div><a href="https://h.com">h</a></div>',
    });
    content.blocks = [title, paragraph, html];

    const occurrences = walkUrls(content);
    expect(occurrences).toHaveLength(3);
    expect(occurrences.map((o) => o.url).sort()).toEqual([
      "https://h.com",
      "https://p.com",
      "https://t.com",
    ]);
    expect(occurrences.every((o) => o.source === "anchor")).toBe(true);
  });

  it("emits button, image-link, video, menu-item, social-icon sources", () => {
    const content = createDefaultTemplateContent();
    const button = createButtonBlock({ url: "https://btn.com" });
    const image = createImageBlock({
      src: "https://example.com/x.png",
      linkUrl: "https://img.com",
    });
    const video = createVideoBlock({ url: "https://video.com" });
    const menu = createMenuBlock({
      items: [
        {
          id: "m1",
          text: "Home",
          url: "https://menu.com",
          openInNewTab: false,
          bold: false,
          underline: false,
        },
      ],
    });
    const social = createSocialIconsBlock({
      icons: [{ id: "i1", platform: "facebook", url: "https://fb.com" }],
    });
    content.blocks = [button, image, video, menu, social];

    const bySource = Object.fromEntries(
      walkUrls(content).map((o) => [o.source, o.url]),
    );
    expect(bySource).toEqual({
      button: "https://btn.com",
      "image-link": "https://img.com",
      video: "https://video.com",
      "menu-item": "https://menu.com",
      "social-icon": "https://fb.com",
    });
  });

  it("skips image.linkUrl when empty/missing", () => {
    const content = createDefaultTemplateContent();
    const image = createImageBlock({ src: "https://example.com/x.png" });
    content.blocks = [image];
    expect(walkUrls(content)).toEqual([]);
  });

  it("descends into section columns", () => {
    const content = createDefaultTemplateContent();
    const section = createSectionBlock();
    const inner = createButtonBlock({ url: "https://nested.com" });
    section.children = [[inner]];
    content.blocks = [section];

    const occurrences = walkUrls(content);
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].blockId).toBe(inner.id);
    expect(occurrences[0].source).toBe("button");
  });

  it("preserves anchor text as label", () => {
    const content = createDefaultTemplateContent();
    const paragraph = createParagraphBlock({
      content: '<p><a href="https://x.com">click me</a></p>',
    });
    content.blocks = [paragraph];
    const [occ] = walkUrls(content);
    expect(occ.label).toBe("click me");
  });
});
