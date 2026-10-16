// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createTitleBlock,
} from "@templatical/types";
import { renderToMjml } from "@templatical/renderer";
import ParagraphBlock from "../src/components/blocks/ParagraphBlock.vue";
import TitleBlock from "../src/components/blocks/TitleBlock.vue";
import { mountEditor } from "./helpers/mount";

/**
 * A blank line the author types is one line tall on the canvas, as it is in
 * the edit surface and in the email (#930). TipTap stores it as `<p></p>`;
 * the canvas fills it for display with the renderer's own helper, and the
 * stored content keeps the empty paragraph.
 */

const NBSP = " ";
const WITH_BLANK_LINE = "<p>First</p><p></p><p>Second</p>";

function paragraphs(root: Element): string[] {
  return [...root.querySelectorAll("p")].map((p) => p.textContent ?? "");
}

describe("blank lines on the canvas", () => {
  it("fills a paragraph block's blank line and leaves the stored content alone", () => {
    const block = createParagraphBlock({ content: WITH_BLANK_LINE });
    const wrapper = mountEditor(ParagraphBlock, {
      props: { block, viewport: "desktop" as const },
    });
    const view = wrapper.find(".tpl-text-content").element;
    expect(paragraphs(view)).toEqual(["First", NBSP, "Second"]);
    expect(block.content).toBe(WITH_BLANK_LINE);
  });

  it("fills a multi-paragraph title's blank line", () => {
    const block = createTitleBlock({ content: WITH_BLANK_LINE, level: 2 });
    const wrapper = mountEditor(TitleBlock, {
      props: { block, viewport: "desktop" as const },
    });
    expect(paragraphs(wrapper.find("h2").element)).toEqual([
      "First",
      NBSP,
      "Second",
    ]);
  });

  it("shows nothing for a cleared paragraph, which the renderer drops", () => {
    const block = createParagraphBlock({ content: "<p></p>" });
    const wrapper = mountEditor(ParagraphBlock, {
      props: { block, viewport: "desktop" as const },
    });
    expect(wrapper.find(".tpl-text-content").element.innerHTML).toBe(
      "<p></p>",
    );
  });

  it("fills exactly the paragraphs the exported email fills", async () => {
    const html =
      '<p style="text-align: left;"></p><p style="text-align: left;">A</p><p style="text-align: left;"></p><p style="text-align: left;"></p><p style="text-align: left;">B</p>';
    const block = createParagraphBlock({ content: html });
    const wrapper = mountEditor(ParagraphBlock, {
      props: { block, viewport: "desktop" as const },
    });
    const canvas = paragraphs(wrapper.find(".tpl-text-content").element);

    const content = createDefaultTemplateContent();
    content.blocks = [block];
    const mjml = await renderToMjml(content);
    const emitted = mjml.match(/<mj-text[^>]*>([\s\S]*?)<\/mj-text>/)?.[1] ?? "";
    const exported = [...emitted.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map(
      (m) => m[1].replace(/&nbsp;/g, NBSP),
    );

    expect(canvas).toEqual([NBSP, "A", NBSP, NBSP, "B"]);
    expect(exported).toEqual(canvas);
  });
});
