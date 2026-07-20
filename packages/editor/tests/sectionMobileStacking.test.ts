// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it } from "vitest";
import { useEditor } from "@templatical/core";
import {
  createDefaultTemplateContent,
  createSectionBlock,
} from "@templatical/types";
import type { SectionBlock as SectionBlockType } from "@templatical/types";
import enTranslations from "../src/i18n/locales/en";
import { EDITOR_KEY, TRANSLATIONS_KEY } from "../src/keys";
import { mountEditor } from "./helpers/mount";
import SectionBlock from "../src/components/blocks/SectionBlock.vue";

/**
 * #395 / #396 — the canvas mobile preview must mirror MJML's responsive
 * output. On the mobile viewport a multi-column section stacks (each column
 * full-width), matching MJML's default; a section that opts out with
 * `stackOnMobile: false` (rendered as `<mj-group>`) keeps its columns
 * side-by-side at their proportional widths. On desktop, columns always sit
 * side-by-side.
 *
 * Empty columns keep the mount light (no nested block components) while still
 * exercising the layout: the column count comes from the layout, not children.
 */

function mountSection(
  block: SectionBlockType,
  viewport: "desktop" | "mobile",
) {
  const content = createDefaultTemplateContent();
  content.blocks = [block];
  const editor = useEditor({ content });
  return mountEditor(SectionBlock, {
    props: { block, viewport },
    provides: {
      [EDITOR_KEY]: editor,
      [TRANSLATIONS_KEY]: enTranslations,
    },
  });
}

// Root is `<div class="tpl:w-full">`; its only child is the column row, whose
// children are the column cells carrying the inline width.
function readLayout(wrapper: ReturnType<typeof mountSection>) {
  const row = wrapper.element.firstElementChild as HTMLElement;
  const cells = Array.from(row.children) as HTMLElement[];
  return { rowClass: row.className, widths: cells.map((c) => c.style.width) };
}

const twoCol = (stackOnMobile?: boolean) =>
  createSectionBlock({ columns: "2", stackOnMobile, children: [[], []] });

describe("section mobile stacking preview (#395/#396)", () => {
  it("stacks columns full-width on the mobile viewport by default", () => {
    const { rowClass, widths } = readLayout(mountSection(twoCol(), "mobile"));
    expect(rowClass).toContain("tpl:flex-col");
    expect(widths).toEqual(["100%", "100%"]);
  });

  it("keeps columns at proportional widths on the desktop viewport", () => {
    const { rowClass, widths } = readLayout(mountSection(twoCol(), "desktop"));
    expect(rowClass).not.toContain("tpl:flex-col");
    expect(widths).toEqual(["50%", "50%"]);
  });

  it("keeps columns side-by-side on mobile when stackOnMobile is false", () => {
    const { rowClass, widths } = readLayout(
      mountSection(twoCol(false), "mobile"),
    );
    expect(rowClass).not.toContain("tpl:flex-col");
    expect(widths).toEqual(["50%", "50%"]);
  });
});
