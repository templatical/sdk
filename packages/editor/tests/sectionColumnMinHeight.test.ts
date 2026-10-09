// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it } from "vitest";
import { computed } from "vue";
import { useEditor } from "@templatical/core";
import {
  createDefaultTemplateContent,
  createSectionBlock,
  createSpacerBlock,
  type Block,
} from "@templatical/types";
import enTranslations from "../src/i18n/locales/en";
import {
  APPLIES_CONDITION_FILTER_KEY,
  CONDITION_PREVIEW_KEY,
  EDITOR_KEY,
  TRANSLATIONS_KEY,
} from "../src/keys";
import { mountEditor } from "./helpers/mount";
import SectionBlock from "../src/components/blocks/SectionBlock.vue";

/**
 * A column showing no blocks needs a drop target's height. A column showing
 * blocks is exactly as tall as they are, so a short band (a one-line strip, a
 * footer note) is no taller on the canvas than in the sent email.
 */

const DROP_HEIGHT = "tpl:min-h-[60px]";

function columnLists(
  children: Block[][],
  provides: Record<symbol, unknown> = {},
): HTMLElement[] {
  const block = createSectionBlock({ columns: "2", children });
  const content = createDefaultTemplateContent();
  content.blocks = [block];
  const wrapper = mountEditor(SectionBlock, {
    props: { block, viewport: "desktop" },
    provides: {
      [EDITOR_KEY]: useEditor({ content }),
      [TRANSLATIONS_KEY]: enTranslations,
      ...provides,
    },
  });
  const row = wrapper.element.firstElementChild as HTMLElement;
  return Array.from(row.children).map(
    (column) => column.firstElementChild as HTMLElement,
  );
}

describe("section column minimum height", () => {
  it("gives only an empty column the drop-zone height", () => {
    const [empty, filled] = columnLists([
      [],
      [createSpacerBlock({ height: 8 })],
    ]);

    expect(empty.classList.contains(DROP_HEIGHT)).toBe(true);
    expect(filled.classList.contains(DROP_HEIGHT)).toBe(false);
  });

  it("keeps the height on a column whose blocks the condition preview hides", () => {
    const hidden = createSpacerBlock({ height: 8 });
    const [, filled] = columnLists([[], [hidden]], {
      [APPLIES_CONDITION_FILTER_KEY]: computed(() => true),
      [CONDITION_PREVIEW_KEY]: { isHidden: (id: string) => id === hidden.id },
    });

    expect(filled.classList.contains(DROP_HEIGHT)).toBe(true);
  });

  it("ignores the condition preview where the surface turns the filter off", () => {
    const hidden = createSpacerBlock({ height: 8 });
    const [, filled] = columnLists([[], [hidden]], {
      [APPLIES_CONDITION_FILTER_KEY]: computed(() => false),
      [CONDITION_PREVIEW_KEY]: { isHidden: (id: string) => id === hidden.id },
    });

    expect(filled.classList.contains(DROP_HEIGHT)).toBe(false);
  });

  it("keeps the height while the column's only block is dragged out", () => {
    const [, list] = columnLists([[], [createSpacerBlock({ height: 8 })]]);
    // The Tailwind arbitrary variant, read back as the selector it compiles to.
    const variant = Array.from(list.classList).find((c) =>
      c.endsWith(`]:${DROP_HEIGHT.slice("tpl:".length)}`),
    );
    expect(variant).toBeDefined();
    const selector = variant!
      .slice("tpl:[&".length, -`]:${DROP_HEIGHT.slice("tpl:".length)}`.length)
      .replaceAll("_", " ");
    const [shown] = Array.from(list.children);

    // A shown block: no drop height from the static rule.
    expect(list.matches(selector)).toBe(false);

    // Sortable moves the block out and leaves its floating clone.
    shown.remove();
    const clone = document.createElement("div");
    clone.className = "sortable-fallback";
    list.append(clone);
    expect(list.matches(selector)).toBe(true);

    // A block the condition preview hides doesn't count either.
    const hidden = document.createElement("div");
    hidden.style.display = "none";
    list.append(hidden);
    expect(list.matches(selector)).toBe(true);
  });
});
