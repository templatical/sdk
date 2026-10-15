// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it, vi } from "vitest";
import { ref, type Component } from "vue";
import type { Block, CustomFont } from "@templatical/types";
import {
  createButtonBlock,
  createCountdownBlock,
  createMenuBlock,
  createTableBlock,
  createTitleBlock,
  generateId,
  parseFontFamilies,
} from "@templatical/types";
import { useEditor } from "@templatical/core";
import { createDefaultTemplateContent, createParagraphBlock } from "@templatical/types";
import { RenderContext } from "@templatical/renderer";
import BlockPreviewCanvas from "../src/components/BlockPreviewCanvas.vue";
import Canvas from "../src/components/Canvas.vue";
import ButtonBlock from "../src/components/blocks/ButtonBlock.vue";
import CountdownBlock from "../src/components/blocks/CountdownBlock.vue";
import MenuBlock from "../src/components/blocks/MenuBlock.vue";
import TableBlock from "../src/components/blocks/TableBlock.vue";
import TitleBlock from "../src/components/blocks/TitleBlock.vue";
import { useFonts } from "../src/composables/useFonts";
import enTranslations from "../src/i18n/locales/en";
import { EDITOR_KEY, FONTS_MANAGER_KEY, TRANSLATIONS_KEY } from "../src/keys";
import { mountEditor } from "./helpers/mount";

/**
 * The canvas applies a block's font the way the email does: for every block
 * with a font select, the family on the canvas equals what the renderer emits
 * for the same value and fonts config. Both go through `resolveFontStack`, so
 * this pins the wiring, and fails if a block applies the stored value raw.
 */

const CUSTOM_FONTS: CustomFont[] = [
  {
    name: "Inter",
    url: "https://fonts.example.com/inter.css",
    fallback: "Helvetica, sans-serif",
  },
];
const DEFAULT_FALLBACK = "Georgia, serif";

const FONTS = [
  "Roboto",
  "georgia",
  "Inter",
  "'Inter'",
  "Montserrat, Trebuchet MS, sans-serif",
  "sans-serif",
];

const BLOCKS: [string, Component, (fontFamily: string) => Block][] = [
  [
    "title",
    TitleBlock,
    (fontFamily) => createTitleBlock({ content: "<p>Hi</p>", fontFamily }),
  ],
  ["button", ButtonBlock, (fontFamily) => createButtonBlock({ fontFamily })],
  [
    "menu",
    MenuBlock,
    (fontFamily) =>
      createMenuBlock({
        items: [
          {
            id: generateId(),
            text: "Home",
            url: "https://example.com",
            openInNewTab: false,
            bold: false,
            underline: false,
          },
        ],
        fontFamily,
      }),
  ],
  ["table", TableBlock, (fontFamily) => ({ ...createTableBlock(), fontFamily })],
  [
    "countdown",
    CountdownBlock,
    (fontFamily) =>
      createCountdownBlock({
        targetDate: new Date(Date.now() + 86_400_000).toISOString(),
        fontFamily,
      }),
  ],
];

/**
 * A `font-family` as its family names. The DOM re-quotes what it serialises
 * (`Trebuchet MS` comes back as `'Trebuchet MS'`), so quoting can't be compared.
 */
function familyNames(fontFamily: string): string[] {
  return parseFontFamilies(fontFamily).map((family) => family.name);
}

/** Every inline `font-family` the mounted block sets, as family names. */
function canvasFontFamilies(component: Component, block: Block): string[][] {
  const wrapper = mountEditor(component, {
    props: { block, viewport: "desktop" as const },
    provides: {
      [FONTS_MANAGER_KEY]: useFonts({
        customFonts: CUSTOM_FONTS,
        defaultFallback: DEFAULT_FALLBACK,
      }),
      [EDITOR_KEY]: { selectBlock: vi.fn(), updateBlock: vi.fn() },
    },
  });
  return wrapper
    .findAll("[style]")
    .map((node) => (node.element as HTMLElement).style.fontFamily)
    .filter((fontFamily) => fontFamily !== "")
    .map(familyNames);
}

describe("canvas font parity with the renderer", () => {
  const renderer = new RenderContext(600, CUSTOM_FONTS, DEFAULT_FALLBACK, true);

  describe.each(BLOCKS)("%s block", (_, component, build) => {
    it.each(FONTS)("applies %s as the email emits it", (fontFamily) => {
      const families = canvasFontFamilies(component, build(fontFamily));

      expect(families.length).toBeGreaterThan(0);
      for (const family of families) {
        expect(family).toEqual(
          familyNames(renderer.resolveFontFamily(fontFamily)),
        );
      }
    });
  });
});

describe("canvas template font parity with the renderer", () => {
  const renderer = new RenderContext(600, CUSTOM_FONTS, DEFAULT_FALLBACK, true);

  function fontsManager() {
    return useFonts({ customFonts: CUSTOM_FONTS, defaultFallback: DEFAULT_FALLBACK });
  }

  function contentWith(fontFamily: string) {
    const content = createDefaultTemplateContent();
    content.settings = { ...content.settings, fontFamily };
    content.blocks = [createParagraphBlock({ content: "<p>Body</p>" })];
    return content;
  }

  it.each(FONTS)("the editing canvas applies %s as <mj-all> does", (fontFamily) => {
    const content = contentWith(fontFamily);
    const wrapper = mountEditor(Canvas, {
      props: {
        viewport: "desktop",
        content,
        selectedBlockId: null,
        darkMode: false,
        previewMode: false,
      },
      provides: {
        [EDITOR_KEY]: useEditor({ content }),
        [TRANSLATIONS_KEY]: enTranslations,
        [FONTS_MANAGER_KEY]: fontsManager(),
      },
    });
    const canvas = wrapper.find(".tpl-canvas").element as HTMLElement;

    expect(familyNames(canvas.style.fontFamily)).toEqual(
      familyNames(renderer.resolveFontFamily(fontFamily)),
    );
  });

  it.each(FONTS)("the block preview applies %s as <mj-all> does", (fontFamily) => {
    const content = contentWith(fontFamily);
    const wrapper = mountEditor(BlockPreviewCanvas, {
      props: { blocks: content.blocks },
      provides: {
        [EDITOR_KEY]: { content: ref(content), state: {} },
        [FONTS_MANAGER_KEY]: fontsManager(),
      },
    } as never);
    const column = wrapper.find('[data-testid="block-preview-canvas"]')
      .element as HTMLElement;

    expect(familyNames(column.style.fontFamily)).toEqual(
      familyNames(renderer.resolveFontFamily(fontFamily)),
    );
  });
});
