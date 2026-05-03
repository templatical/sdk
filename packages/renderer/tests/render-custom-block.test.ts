import { describe, expect, it, vi } from "vitest";
import {
  createCustomBlock,
  createSectionBlock,
  createDefaultTemplateContent,
} from "@templatical/types";
import type {
  CustomBlock,
  CustomBlockDefinition,
  TemplateContent,
} from "@templatical/types";
import { renderToMjml } from "../src";

const definition: CustomBlockDefinition = {
  type: "event-card",
  name: "Event Card",
  template: "<div>{{ title }}</div>",
  fields: [{ key: "title", type: "text", label: "Title" }],
};

function makeCustomBlock(fieldValues: Record<string, unknown>): CustomBlock {
  const block = createCustomBlock(definition);
  block.fieldValues = { ...block.fieldValues, ...fieldValues };
  return block;
}

function makeContent(blocks: TemplateContent["blocks"]): TemplateContent {
  return { ...createDefaultTemplateContent(), blocks };
}

describe("renderToMjml — custom block resolution", () => {
  it("calls the renderCustomBlock callback once per custom block in tree order", async () => {
    const block1 = makeCustomBlock({ title:"First" });
    const block2 = makeCustomBlock({ title:"Second" });
    const callback = vi
      .fn<(block: CustomBlock) => Promise<string>>()
      .mockImplementation(async (block) => `<p>rendered:${block.id}</p>`);

    const content = makeContent([block1, block2]);
    const mjml = await renderToMjml(content, { renderCustomBlock: callback });

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenNthCalledWith(1, block1);
    expect(callback).toHaveBeenNthCalledWith(2, block2);
    expect(mjml).toContain(`<p>rendered:${block1.id}</p>`);
    expect(mjml).toContain(`<p>rendered:${block2.id}</p>`);
  });

  it("walks into section columns to find nested custom blocks", async () => {
    const nested = makeCustomBlock({ title:"Nested" });
    const section = createSectionBlock();
    section.children = [[nested]];

    const callback = vi
      .fn<(block: CustomBlock) => Promise<string>>()
      .mockResolvedValue("<p>nested-html</p>");

    const content = makeContent([section]);
    const mjml = await renderToMjml(content, { renderCustomBlock: callback });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(nested);
    expect(mjml).toContain("<p>nested-html</p>");
  });

  it("resolves custom blocks in parallel", async () => {
    const block1 = makeCustomBlock({ title:"1" });
    const block2 = makeCustomBlock({ title:"2" });

    let pendingCount = 0;
    let maxPending = 0;
    const callback = vi
      .fn<(block: CustomBlock) => Promise<string>>()
      .mockImplementation(async () => {
        pendingCount++;
        maxPending = Math.max(maxPending, pendingCount);
        await new Promise((resolve) => setTimeout(resolve, 10));
        pendingCount--;
        return "<p>done</p>";
      });

    const content = makeContent([block1, block2]);
    await renderToMjml(content, { renderCustomBlock: callback });

    expect(maxPending).toBe(2);
  });

  it("falls back to block.renderedHtml when no callback provided", async () => {
    const block = makeCustomBlock({ title:"x" });
    block.renderedHtml = "<p>pre-rendered</p>";

    const content = makeContent([block]);
    const mjml = await renderToMjml(content);

    expect(mjml).toContain("<p>pre-rendered</p>");
  });

  it("omits custom block from output when neither callback nor renderedHtml provided", async () => {
    const block = makeCustomBlock({ title:"x" });
    expect(block.renderedHtml).toBeUndefined();

    const content = makeContent([block]);
    const mjml = await renderToMjml(content);

    // Block should be wrapped in default mj-section but produce empty inner content.
    expect(mjml).not.toContain("rendered");
    expect(mjml).not.toContain("<mj-text>\n</mj-text>");
  });

  it("callback result takes precedence over block.renderedHtml", async () => {
    const block = makeCustomBlock({ title:"x" });
    block.renderedHtml = "<p>stale</p>";

    const callback = vi
      .fn<(block: CustomBlock) => Promise<string>>()
      .mockResolvedValue("<p>fresh</p>");

    const content = makeContent([block]);
    const mjml = await renderToMjml(content, { renderCustomBlock: callback });

    expect(mjml).toContain("<p>fresh</p>");
    expect(mjml).not.toContain("<p>stale</p>");
  });

  it("rejects when the callback throws — caller decides recovery policy", async () => {
    const block = makeCustomBlock({ title:"x" });
    const callback = vi
      .fn<(block: CustomBlock) => Promise<string>>()
      .mockRejectedValue(new Error("liquid syntax error"));

    const content = makeContent([block]);
    await expect(
      renderToMjml(content, { renderCustomBlock: callback }),
    ).rejects.toThrow("liquid syntax error");
  });

  it("does not invoke callback when content has no custom blocks", async () => {
    const callback = vi.fn<(block: CustomBlock) => Promise<string>>();

    const content = makeContent([]);
    await renderToMjml(content, { renderCustomBlock: callback });

    expect(callback).not.toHaveBeenCalled();
  });
});
