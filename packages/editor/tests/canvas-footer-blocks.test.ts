// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it } from "vitest";
import { useEditor } from "@templatical/core";
import {
  createParagraphBlock,
  createDefaultTemplateContent,
} from "@templatical/types";
import type { Block } from "@templatical/types";
import Canvas from "../src/components/Canvas.vue";
import { mountEditor } from "./helpers/mount";
import { EDITOR_KEY, FOOTER_BLOCKS_KEY } from "../src/keys";

/**
 * `footerBlocks` renders consumer-supplied blocks after the template's own,
 * read-only. The property that makes them useful is what they are NOT: they
 * never enter `content`, so a host application can show an author the footer it
 * appends at send time without that footer becoming part of the template — and
 * therefore without it being saved, exported, or editable.
 */
function mountCanvasWith(footerBlocks?: Block[]) {
  const content = createDefaultTemplateContent();
  content.blocks = [createParagraphBlock({ content: "<p>authored</p>" })];
  const editor = useEditor({ content });

  const wrapper = mountEditor(Canvas, {
    props: {
      viewport: "desktop",
      content: editor.content.value,
      selectedBlockId: null,
      darkMode: false,
      previewMode: false,
    },
    provides: {
      [EDITOR_KEY]: editor,
      [FOOTER_BLOCKS_KEY]: footerBlocks,
    },
  } as never);

  return { wrapper, editor };
}

function footerParagraph() {
  return createParagraphBlock({ content: "<p>Sent with Acme</p>" });
}

describe("Canvas footerBlocks", () => {
  it("renders the consumer's blocks after the template's own", () => {
    const { wrapper } = mountCanvasWith([footerParagraph()]);

    const footer = wrapper.find('[data-testid="footer-blocks"]');
    expect(footer.exists()).toBe(true);
    expect(footer.text()).toContain("Sent with Acme");

    // After, not before: the authored paragraph still comes first in the DOM.
    const html = wrapper.html();
    expect(html.indexOf("authored")).toBeLessThan(html.indexOf("Sent with Acme"));
  });

  it("renders nothing when the consumer supplies none", () => {
    expect(
      mountCanvasWith(undefined).wrapper.find('[data-testid="footer-blocks"]').exists(),
    ).toBe(false);

    expect(
      mountCanvasWith([]).wrapper.find('[data-testid="footer-blocks"]').exists(),
    ).toBe(false);
  });

  // The whole point. A footer block that reached `content` would be saved by
  // the consumer, exported by `toMjml()`, and would then be appended twice by
  // any host that also adds it at send time.
  it("keeps them out of the editor's content", () => {
    const footer = footerParagraph();
    const { editor } = mountCanvasWith([footer]);

    expect(editor.content.value.blocks).toHaveLength(1);
    expect(editor.content.value.blocks[0]!.type).toBe("paragraph");
    expect(editor.content.value.blocks.map((b) => b.id)).not.toContain(footer.id);
  });

  // Read-only: they are rendered outside the draggable list, so none of the
  // editing affordances the authored blocks carry appear on them.
  it("gives them no block chrome, so they cannot be selected or dragged", () => {
    const { wrapper } = mountCanvasWith([footerParagraph()]);

    const footer = wrapper.find('[data-testid="footer-blocks"]');
    expect(footer.find("[data-block-id]").exists()).toBe(false);
    expect(footer.find(".tpl-block-actions").exists()).toBe(false);
  });
});
