// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { h } from "vue";
import { createParagraphBlock, RICH_TEXT_SPACING } from "@templatical/types";
import type { ParagraphBlock } from "@templatical/types";
import BlockWrapper from "../src/components/blocks/BlockWrapper.vue";
import ParagraphToolbar from "../src/components/toolbar/ParagraphToolbar.vue";
import { getBlockWrapperStyle } from "../src/utils/blockComponentResolver";
import { mountEditor } from "./helpers/mount";

/**
 * Per-block paragraph spacing on the canvas side (issue #616 follow-up).
 *
 * The renderer emits one rule per distinct gap; the canvas gets there with a
 * CSS variable on the block wrapper, which the `.tpl-text-content p` rule
 * reads. Both fall back to `RICH_TEXT_SPACING.paragraphGap` when a block sets
 * nothing, so a block's canvas gap always equals its exported gap.
 */

function paragraph(paragraphSpacing?: number): ParagraphBlock {
  const block = createParagraphBlock();
  if (paragraphSpacing !== undefined) {
    block.paragraphSpacing = paragraphSpacing;
  }
  return block;
}

describe("paragraph spacing on the block wrapper", () => {
  it("sets the variable the canvas paragraph rule reads", () => {
    expect(
      getBlockWrapperStyle(paragraph(20))["--tpl-doc-paragraph-spacing"],
    ).toBe("20px");
  });

  it("sets a zero gap rather than dropping it as falsy", () => {
    expect(
      getBlockWrapperStyle(paragraph(0))["--tpl-doc-paragraph-spacing"],
    ).toBe("0px");
  });

  it("falls back to the built-in gap for a block that sets none", () => {
    expect(
      getBlockWrapperStyle(paragraph())["--tpl-doc-paragraph-spacing"],
    ).toBe(`${RICH_TEXT_SPACING.paragraphGap}px`);
  });

  it("leaves the variable off blocks that hold no rich text", () => {
    const block = createParagraphBlock();
    const spacer = { ...block, type: "spacer" as const, height: 20 };

    // Only rich-text blocks read the variable; setting it everywhere would
    // imply the gap means something on an image or a divider.
    expect(getBlockWrapperStyle(spacer)).not.toHaveProperty(
      "--tpl-doc-paragraph-spacing",
    );
  });
});

/**
 * `getBlockWrapperStyle` returning the variable is not enough — `BlockWrapper`
 * copies named properties out of it onto `.tpl-block-content` rather than
 * spreading the whole object, so a new property reaches the canvas only if it
 * is copied too. Asserting the helper's return value alone passed while the
 * canvas showed no change at all.
 */
describe("paragraph spacing reaches the rendered canvas", () => {
  function mountWrapper(block: ParagraphBlock) {
    return mountEditor(BlockWrapper, {
      props: {
        block,
        isSelected: false,
        viewport: "desktop" as const,
        previewMode: false,
      },
      slots: { default: () => h("div", { class: "tpl-text-content" }, "x") },
    });
  }

  function contentVar(block: ParagraphBlock): string | undefined {
    const el = mountWrapper(block).find(".tpl-block-content")
      .element as HTMLElement;
    return el.style.getPropertyValue("--tpl-doc-paragraph-spacing") || undefined;
  }

  it("sets the variable on the element that wraps the block's content", () => {
    // `.tpl-text-content` is a descendant of `.tpl-block-content`, so the
    // variable has to land here for the paragraph rule to inherit it.
    expect(contentVar(paragraph(20))).toBe("20px");
  });

  it("sets a zero gap on the rendered wrapper too", () => {
    expect(contentVar(paragraph(0))).toBe("0px");
  });

  it("falls back to the built-in gap on the rendered wrapper", () => {
    expect(contentVar(paragraph())).toBe(
      `${RICH_TEXT_SPACING.paragraphGap}px`,
    );
  });
});

describe("paragraph spacing control", () => {
  function mountToolbar(block: ParagraphBlock) {
    return mountEditor(ParagraphToolbar, { props: { block } });
  }

  it("shows the block's current gap", () => {
    const input = mountToolbar(paragraph(12)).find("input[type=number]");

    expect((input.element as HTMLInputElement).value).toBe("12");
  });

  it("shows the built-in gap when the block sets none", () => {
    const input = mountToolbar(paragraph()).find("input[type=number]");

    expect((input.element as HTMLInputElement).value).toBe(
      String(RICH_TEXT_SPACING.paragraphGap),
    );
  });

  it("emits the new gap as a number", async () => {
    const wrapper = mountToolbar(paragraph());

    await wrapper.find("input[type=number]").setValue("16");

    expect(wrapper.emitted("update")?.at(-1)).toEqual([
      { paragraphSpacing: 16 },
    ]);
  });

  it("constrains the input to a sane pixel range", () => {
    const input = mountToolbar(paragraph()).find("input[type=number]");

    expect(input.attributes("min")).toBe("0");
    expect(input.attributes("max")).toBe("64");
  });
});
