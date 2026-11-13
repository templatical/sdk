// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it } from "vitest";
import { useEditor } from "@templatical/core";
import { getWidthPercentages } from "@templatical/renderer";
import {
  createDefaultTemplateContent,
  createSectionBlock,
  getColumnCount,
  type ColumnLayout,
} from "@templatical/types";
import { EDITOR_KEY, TRANSLATIONS_KEY } from "../src/keys";
import enTranslations from "../src/i18n/locales/en";
import { mountEditor } from "./helpers/mount";
import PreviewSectionBlock from "../src/components/blocks/PreviewSectionBlock.vue";
import SectionBlock from "../src/components/blocks/SectionBlock.vue";

/**
 * The canvas and the saved-block preview use exactly the renderer's
 * percentages, from `sectionColumnPercents`: a preset row, or the scaled
 * `columnWidths` when the section sets one.
 */

const LAYOUTS: ColumnLayout[] = [
  "1",
  "2",
  "3",
  "4",
  "1-2",
  "2-1",
  "1-3",
  "3-1",
  "1-2-1",
];

function canvasWidths(layout: ColumnLayout): string[] {
  if (layout === "3") return ["33.33%", "33.33%", "33.34%"];
  return getWidthPercentages(layout);
}

function readWidths(element: Element): string[] {
  const row = element.firstElementChild as HTMLElement;
  return Array.from(row.children).map(
    (column) => (column as HTMLElement).style.width,
  );
}

describe("section canvas column widths", () => {
  it.each(LAYOUTS)("%s matches on the canvas and in the preview", (layout) => {
    const block = createSectionBlock({
      columns: layout,
      children: Array.from({ length: getColumnCount(layout) }, () => []),
    });
    const content = createDefaultTemplateContent();
    content.blocks = [block];
    const canvas = mountEditor(SectionBlock, {
      props: { block, viewport: "desktop" },
      provides: {
        [EDITOR_KEY]: useEditor({ content }),
        [TRANSLATIONS_KEY]: enTranslations,
      },
    });
    const preview = mountEditor(PreviewSectionBlock, {
      props: { block, viewport: "desktop" },
    });
    const expected = canvasWidths(layout);

    expect(readWidths(canvas.element)).toEqual(expected);
    expect(readWidths(preview.element)).toEqual(expected);
  });

  it("draws columnWidths [25, 25, 50] on the canvas and in the preview", () => {
    const block = createSectionBlock({
      columns: "3",
      columnWidths: [25, 25, 50],
      children: [[], [], []],
    });
    const content = createDefaultTemplateContent();
    content.blocks = [block];
    const canvas = mountEditor(SectionBlock, {
      props: { block, viewport: "desktop" },
      provides: {
        [EDITOR_KEY]: useEditor({ content }),
        [TRANSLATIONS_KEY]: enTranslations,
      },
    });
    const preview = mountEditor(PreviewSectionBlock, {
      props: { block, viewport: "desktop" },
    });

    expect(readWidths(canvas.element)).toEqual(["25%", "25%", "50%"]);
    expect(readWidths(preview.element)).toEqual(["25%", "25%", "50%"]);
  });
});
