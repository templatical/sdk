import { describe, expect, it } from "vitest";
import {
  createButtonBlock, createDefaultTemplateContent, createHtmlBlock, createImageBlock,
  createMenuBlock, createParagraphBlock, createSocialIconsBlock, createTitleBlock,
  createVideoBlock,
} from "@templatical/types";
import { DEFAULT_SHORTENER_HOSTS, lintDeliverability } from "../../src";

const id = "deliverability.url-shortener";
function check(url: string, options = {}) {
  const content = createDefaultTemplateContent();
  const block = createButtonBlock({ url });
  content.blocks = [block];
  return { block, issues: lintDeliverability(content, options).filter((issue) => issue.ruleId === id) };
}

describe(id, () => {
  it("reports the exact shortener issue", () => {
    const { block, issues } = check("https://bit.ly/x");
    expect(issues).toEqual([{
      blockId: block.id, ruleId: id, severity: "warning",
      message: "This link goes through the URL shortener bit.ly. Spam filters treat shortener links with suspicion because they hide the destination.",
      suggestion: "Link to the destination instead.",
      reference: "https://docs.rspamd.com/modules/phishing/",
      fix: undefined,
    }]);
  });

  it("reads every walkUrls source, including anchors in all HTML-like blocks", () => {
    const content = createDefaultTemplateContent();
    const url = "https://bit.ly/x";
    const menu = createMenuBlock({ items: [{ id: "m", text: "Go", url, openInNewTab: false, bold: false, underline: false }] });
    content.blocks = [
      createTitleBlock({ content: `<a href="${url}">Go</a>` }),
      createParagraphBlock({ content: `<a href="${url}">Go</a>` }),
      createHtmlBlock({ content: `<a href="${url}">Go</a>` }),
      createButtonBlock({ url }),
      createImageBlock({ src: "https://example.com/a.png", linkUrl: url }),
      createVideoBlock({ url }), menu,
      createSocialIconsBlock({ icons: [{ id: "s", platform: "facebook", url }] }),
    ];
    expect(lintDeliverability(content).filter((issue) => issue.ruleId === id).map((issue) => issue.blockId))
      .toEqual(content.blocks.map((block) => block.id));
  });

  it.each(["https://www.bit.ly/x", "https://sub.bit.ly/x"])("flags %s", (url) => {
    const host = new URL(url).hostname.replace(/^www\./, "");
    expect(check(url).issues.map(({ ruleId, severity, message }) => ({ ruleId, severity, message }))).toEqual([{
      ruleId: id,
      severity: "warning",
      message: `This link goes through the URL shortener ${host}. Spam filters treat shortener links with suspicion because they hide the destination.`,
    }]);
  });

  it.each(["https://notbit.ly/x", "mailto:hi@bit.ly", "https://{{domain}}/x"])("passes %s", (url) => {
    expect(check(url).issues).toEqual([]);
  });

  it("replaces or extends the default host list", () => {
    expect(check("https://bit.ly/x", { deliverability: { shortenerHosts: ["go.example.com"] } }).issues).toEqual([]);
    expect(check("https://go.example.com/x", { deliverability: { shortenerHosts: ["go.example.com"] } }).issues.map((issue) => issue.ruleId)).toEqual([id]);
    expect(check("https://bit.ly/x", { deliverability: { shortenerHosts: [...DEFAULT_SHORTENER_HOSTS, "go.example.com"] } }).issues.map((issue) => issue.ruleId)).toEqual([id]);
    expect(check("https://go.example.com/x", { deliverability: { shortenerHosts: [...DEFAULT_SHORTENER_HOSTS, "go.example.com"] } }).issues.map((issue) => issue.ruleId)).toEqual([id]);
  });

  it("respects severity and category switches", () => {
    expect(check("https://bit.ly/x", { deliverability: { rules: { [id]: "error" } } }).issues[0].severity).toBe("error");
    expect(check("https://bit.ly/x", { deliverability: { rules: { [id]: "off" } } }).issues).toEqual([]);
    expect(check("https://bit.ly/x", { deliverability: false }).issues).toEqual([]);
    expect(check("https://bit.ly/x", { disabled: true }).issues).toEqual([]);
  });
});
