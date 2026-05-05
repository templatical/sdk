import { describe, expect, it } from "vitest";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createSectionBlock,
  createImageBlock,
} from "@templatical/types";
import type { Block } from "@templatical/types";
import { walkBlocks } from "../src/walk";
import type { WalkContext } from "../src/types";

function visited(content: ReturnType<typeof createDefaultTemplateContent>) {
  const calls: { id: string; ctx: WalkContext }[] = [];
  walkBlocks(content, (block: Block, ctx) => {
    calls.push({ id: block.id, ctx });
  });
  return calls;
}

describe("walkBlocks", () => {
  it("visits top-level blocks in document order", () => {
    const content = createDefaultTemplateContent();
    const a = createParagraphBlock({ id: "a" });
    const b = createParagraphBlock({ id: "b" });
    content.blocks = [a, b];
    const calls = visited(content);
    expect(calls.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("descends into section columns and tracks section/columnIndex", () => {
    const content = createDefaultTemplateContent();
    const inner1 = createParagraphBlock({ id: "p1" });
    const inner2 = createParagraphBlock({ id: "p2" });
    const section = createSectionBlock({
      id: "s",
      columns: "2",
      children: [[inner1], [inner2]],
    });
    content.blocks = [section];

    const calls = visited(content);
    expect(calls.map((c) => c.id)).toEqual(["s", "p1", "p2"]);
    expect(calls[0].ctx.section).toBeNull();
    expect(calls[0].ctx.depth).toBe(0);
    expect(calls[1].ctx.section?.id).toBe("s");
    expect(calls[1].ctx.columnIndex).toBe(0);
    expect(calls[1].ctx.depth).toBe(1);
    expect(calls[2].ctx.columnIndex).toBe(1);
  });

  it("propagates section background to children when opaque", () => {
    const content = createDefaultTemplateContent();
    const inner = createImageBlock({ id: "img", src: "x.png", alt: "x" });
    const section = createSectionBlock({
      id: "s",
      columns: "1",
      styles: {
        backgroundColor: "#112233",
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      },
      children: [[inner]],
    });
    content.blocks = [section];

    const calls = visited(content);
    const innerCtx = calls.find((c) => c.id === "img")!.ctx;
    expect(innerCtx.resolvedBackgroundColor).toBe("#112233");
  });

  it("falls back to template background when section bg is missing", () => {
    const content = createDefaultTemplateContent();
    content.settings.backgroundColor = "#abcdef";
    const inner = createParagraphBlock({ id: "p" });
    const section = createSectionBlock({
      id: "s",
      columns: "1",
      children: [[inner]],
    });
    content.blocks = [section];

    const calls = visited(content);
    const innerCtx = calls.find((c) => c.id === "p")!.ctx;
    expect(innerCtx.resolvedBackgroundColor).toBe("#abcdef");
  });

  it("falls back to white when template bg is not opaque hex", () => {
    const content = createDefaultTemplateContent();
    content.settings.backgroundColor = "transparent";
    const block = createParagraphBlock({ id: "p" });
    content.blocks = [block];

    const calls = visited(content);
    expect(calls[0].ctx.resolvedBackgroundColor).toBe("#ffffff");
  });
});
