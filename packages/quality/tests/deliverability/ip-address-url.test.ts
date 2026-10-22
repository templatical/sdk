import { describe, expect, it } from "vitest";
import { createButtonBlock, createDefaultTemplateContent, createImageBlock, createParagraphBlock } from "@templatical/types";
import { lintDeliverability } from "../../src";

const id = "deliverability.ip-address-url";
function check(url: string, options = {}) {
  const content = createDefaultTemplateContent();
  const block = createButtonBlock({ url });
  content.blocks = [block];
  return { block, issues: lintDeliverability(content, options).filter((issue) => issue.ruleId === id) };
}

describe(id, () => {
  it("reports the exact raw-IP issue", () => {
    const { block, issues } = check("http://203.0.113.7/a");
    expect(issues).toEqual([{
      blockId: block.id, ruleId: id, severity: "warning",
      message: "This link points to the IP address 203.0.113.7 instead of a domain. Spam filters score links like this as spam. Link to your domain.",
      fix: undefined,
    }]);
  });

  it.each([
    ["http://3232235777/", "192.168.1.1"],
    ["http://[2001:db8::1]/", "[2001:db8::1]"],
    ["http://10.0.0.1/", "10.0.0.1"],
  ])("normalizes and flags %s", (url, host) => {
    expect(check(url).issues.map(({ ruleId, severity, message }) => ({ ruleId, severity, message }))).toEqual([{
      ruleId: id,
      severity: "warning",
      message: `This link points to the IP address ${host} instead of a domain. Spam filters score links like this as spam. Link to your domain.`,
    }]);
  });

  it.each([
    "http://127.0.0.1", "http://127.0.0.2", "http://0.0.0.0", "http://[::1]",
    "mailto:hi@203.0.113.7", "https://{{domain}}/x", "https://example.com/x",
  ])("passes %s", (url) => {
    expect(check(url).issues).toEqual([]);
  });

  it("reads anchor and image-link sources while ignoring image src", () => {
    const content = createDefaultTemplateContent();
    const paragraph = createParagraphBlock({ content: '<a href="http://203.0.113.7/">Go</a>' });
    const image = createImageBlock({ src: "http://203.0.113.7/p.png", linkUrl: "http://203.0.113.8/" });
    content.blocks = [paragraph, image];
    expect(lintDeliverability(content).filter((issue) => issue.ruleId === id).map((issue) => issue.blockId))
      .toEqual([paragraph.id, image.id]);
  });

  it("respects severity and category switches", () => {
    expect(check("http://203.0.113.7", { deliverability: { rules: { [id]: "info" } } }).issues[0].severity).toBe("info");
    expect(check("http://203.0.113.7", { deliverability: { rules: { [id]: "off" } } }).issues).toEqual([]);
    expect(check("http://203.0.113.7", { deliverability: false }).issues).toEqual([]);
    expect(check("http://203.0.113.7", { disabled: true }).issues).toEqual([]);
  });
});
