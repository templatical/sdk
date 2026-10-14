// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it } from "vitest";
import { computed, nextTick } from "vue";
import { VueDraggable } from "vue-draggable-plus";
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

function mountSection(
  children: Block[][],
  provides: Record<symbol, unknown> = {},
) {
  const block = createSectionBlock({ columns: "2", children });
  const content = createDefaultTemplateContent();
  content.blocks = [block];
  return mountEditor(SectionBlock, {
    props: { block, viewport: "desktop" },
    provides: {
      [EDITOR_KEY]: useEditor({ content }),
      [TRANSLATIONS_KEY]: enTranslations,
      ...provides,
    },
  });
}

function columnLists(
  children: Block[][],
  provides: Record<symbol, unknown> = {},
): HTMLElement[] {
  const row = mountSection(children, provides).element
    .firstElementChild as HTMLElement;
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

  it("keeps the height on the source column while its only block is dragged out", async () => {
    const wrapper = mountSection([[createSpacerBlock({ height: 8 })], []]);
    const [source, other] = wrapper.findAllComponents(VueDraggable);
    expect(source.classes()).not.toContain(DROP_HEIGHT);

    source.vm.$emit("start");
    await nextTick();
    expect(source.classes()).toContain(DROP_HEIGHT);
    expect(other.classes()).toContain(DROP_HEIGHT);

    source.vm.$emit("end");
    await nextTick();
    expect(source.classes()).not.toContain(DROP_HEIGHT);
  });

  it("holds the height only on the column the drag started from", async () => {
    const wrapper = mountSection([
      [createSpacerBlock({ height: 8 })],
      [createSpacerBlock({ height: 8 })],
    ]);
    const [source, other] = wrapper.findAllComponents(VueDraggable);

    source.vm.$emit("start");
    await nextTick();
    expect(source.classes()).toContain(DROP_HEIGHT);
    expect(other.classes()).not.toContain(DROP_HEIGHT);
  });

  it("counts only shown blocks when a drag starts", async () => {
    const hidden = createSpacerBlock({ height: 8 });
    const wrapper = mountSection(
      [[createSpacerBlock({ height: 8 }), hidden], []],
      {
        [APPLIES_CONDITION_FILTER_KEY]: computed(() => true),
        [CONDITION_PREVIEW_KEY]: { isHidden: (id: string) => id === hidden.id },
      },
    );
    const [source] = wrapper.findAllComponents(VueDraggable);

    source.vm.$emit("start");
    await nextTick();
    expect(source.classes()).toContain(DROP_HEIGHT);
  });

  it("leaves the height off a source column that keeps other shown blocks", async () => {
    const wrapper = mountSection([
      [createSpacerBlock({ height: 8 }), createSpacerBlock({ height: 8 })],
      [],
    ]);
    const [source] = wrapper.findAllComponents(VueDraggable);

    source.vm.$emit("start");
    await nextTick();
    expect(source.classes()).not.toContain(DROP_HEIGHT);
  });
});
