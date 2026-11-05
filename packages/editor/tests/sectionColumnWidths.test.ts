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
 * The canvas and the saved-block preview size columns with the same
 * percentages the renderer writes on `mj-column`. A three-column section is
 * the exception already on the canvas: each column is 33.33%, while the
 * renderer gives the last column 33.34% so the widths sum to 100%.
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
  if (layout === "3") return ["33.33%", "33.33%", "33.33%"];
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
});
