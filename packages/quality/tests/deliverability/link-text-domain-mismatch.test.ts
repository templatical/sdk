import { describe, expect, it } from "vitest";
import {
  createButtonBlock, createDefaultTemplateContent, createImageBlock,
  createMenuBlock, createParagraphBlock,
} from "@templatical/types";
import { lintDeliverability } from "../../src";

const id = "deliverability.link-text-domain-mismatch";
function button(label: string, url: string) {
  const content = createDefaultTemplateContent();
  const block = createButtonBlock({ text: label, url });
  content.blocks = [block];
  return { content, block };
}
const hits = (content: ReturnType<typeof createDefaultTemplateContent>, options = {}) =>
  lintDeliverability(content, options).filter((issue) => issue.ruleId === id);

describe(id, () => {
  it("reports the exact mismatch issue", () => {
    const { content, block } = button("https://example.com/x", "https://other.com");
    expect(hits(content)).toEqual([{
      blockId: block.id, ruleId: id, severity: "warning",
      message: "The link text shows example.com, but the link goes to other.com. Spam filters flag links like this as phishing.",
      suggestion: "Make the text match the destination, or use words instead of an address.",
      reference: "https://docs.rspamd.com/modules/phishing/",
      fix: undefined,
    }]);
  });

  it.each([
    ["www.example.com", "https://example.com/a"],
    ["https://example.com/reset", "https://example.com/reset"],
    ["Visit example.com", "https://other.com"],
    ["news.vw.de", "https://click.vw.de"],
    ["example.com", "mailto:hi@other.com"],
    ["example.com", "https://{{domain}}/x"],
  ])("passes %s linked to %s", (label, url) => {
    expect(hits(button(label, url).content)).toEqual([]);
  });

  it.each([
    ["ASP.NET", "https://microsoft.com", "asp.net", "microsoft.com"],
    ["<https://EXAMPLE.com/x>", "https://other.com", "example.com", "other.com"],
    ["example.com).", "https://other.com", "example.com", "other.com"],
    ["example.co.uk", "https://evil.co.uk", "example.co.uk", "evil.co.uk"],
    ["bücher.de", "https://other.com", "xn--bcher-kva.de", "other.com"],
  ])("flags domain-like label %s", (label, url, textHost, linkHost) => {
    const issues = hits(button(label, url).content);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain(`shows ${textHost}, but the link goes to ${linkHost}`);
  });

  it("reads anchor and menu-item, and ignores image-link alt", () => {
    const content = createDefaultTemplateContent();
    const paragraph = createParagraphBlock({ content: '<a href="https://other.com">example.com</a>' });
    const menu = createMenuBlock({ items: [{ id: "m", text: "example.com", url: "https://other.com", openInNewTab: false, bold: false, underline: false }] });
    const image = createImageBlock({ src: "https://example.com/img.png", alt: "example.com", linkUrl: "https://other.com" });
    content.blocks = [paragraph, menu, image];
    expect(hits(content).map((issue) => issue.blockId)).toEqual([paragraph.id, menu.id]);
  });

  it("respects severity and category switches", () => {
    const { content } = button("example.com", "https://other.com");
    expect(hits(content, { deliverability: { rules: { [id]: "error" } } })[0].severity).toBe("error");
    expect(hits(content, { deliverability: { rules: { [id]: "off" } } })).toEqual([]);
    expect(hits(content, { deliverability: false })).toEqual([]);
    expect(hits(content, { disabled: true })).toEqual([]);
  });
});
