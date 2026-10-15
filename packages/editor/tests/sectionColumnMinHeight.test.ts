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

/**
 * Preview shows the email as it will be sent, so a column carries none of the
 * drop chrome there. A column with no blocks is exactly as tall as the
 * renderer's placeholder for it; one whose blocks the condition filter hides
 * holds nothing in the email and is no taller in the preview.
 */
describe("section column chrome in preview", () => {
  const DASHED_BORDER = [
    "tpl:border",
    "tpl:border-dashed",
    "tpl:border-[var(--tpl-border)]",
  ];
  const PLACEHOLDER_HEIGHT = "tpl:min-h-[34px]";

  function previewEditor() {
    const editor = useEditor({ content: createDefaultTemplateContent() });
    editor.setPreviewMode(true);
    return editor;
  }

  function columnParts(wrapper: ReturnType<typeof mountSection>) {
    const row = wrapper.element.firstElementChild as HTMLElement;
    return Array.from(row.children).map((column) => ({
      column: column as HTMLElement,
      list: column.firstElementChild as HTMLElement,
      hint: column.querySelector('[data-testid="section-drop-hint"]'),
    }));
  }

  it("gives an empty column the dashed border, drop height and hint while editing", () => {
    const [empty, filled] = columnParts(
      mountSection([[], [createSpacerBlock({ height: 8 })]]),
    );

    expect([...empty.column.classList]).toEqual(
      expect.arrayContaining(DASHED_BORDER),
    );
    expect(empty.list.classList.contains(DROP_HEIGHT)).toBe(true);
    expect(empty.list.classList.contains(PLACEHOLDER_HEIGHT)).toBe(false);
    expect(empty.hint?.textContent?.trim()).toBe(
      enTranslations.section.dropHere,
    );

    for (const cls of DASHED_BORDER) {
      expect(filled.column.classList.contains(cls)).toBe(false);
    }
    expect(filled.hint).toBeNull();
  });

  it("renders an empty column as the email's placeholder, with no drop chrome", () => {
    const [empty] = columnParts(
      mountSection([[], [createSpacerBlock({ height: 8 })]], {
        [EDITOR_KEY]: previewEditor(),
      }),
    );

    for (const cls of DASHED_BORDER) {
      expect(empty.column.classList.contains(cls)).toBe(false);
    }
    expect(empty.list.classList.contains(DROP_HEIGHT)).toBe(false);
    expect(empty.list.classList.contains(PLACEHOLDER_HEIGHT)).toBe(true);
    expect(empty.hint).toBeNull();
  });

  it("gives a filled column neither height", () => {
    const [, filled] = columnParts(
      mountSection([[], [createSpacerBlock({ height: 8 })]], {
        [EDITOR_KEY]: previewEditor(),
      }),
    );

    expect(filled.list.classList.contains(DROP_HEIGHT)).toBe(false);
    expect(filled.list.classList.contains(PLACEHOLDER_HEIGHT)).toBe(false);
  });

  it("collapses a column whose blocks the condition filter hides", () => {
    const hidden = createSpacerBlock({ height: 8 });
    const [, conditionHidden] = columnParts(
      mountSection([[], [hidden]], {
        [EDITOR_KEY]: previewEditor(),
        [APPLIES_CONDITION_FILTER_KEY]: computed(() => true),
        [CONDITION_PREVIEW_KEY]: { isHidden: (id: string) => id === hidden.id },
      }),
    );

    expect(conditionHidden.list.classList.contains(DROP_HEIGHT)).toBe(false);
    expect(conditionHidden.list.classList.contains(PLACEHOLDER_HEIGHT)).toBe(
      false,
    );
    for (const cls of DASHED_BORDER) {
      expect(conditionHidden.column.classList.contains(cls)).toBe(false);
    }
    expect(conditionHidden.hint).toBeNull();
  });

  it("restores the drop chrome when the preview closes", async () => {
    const editor = previewEditor();
    const wrapper = mountSection([[], []], { [EDITOR_KEY]: editor });
    expect(columnParts(wrapper)[0].hint).toBeNull();

    editor.setPreviewMode(false);
    await nextTick();

    const [empty] = columnParts(wrapper);
    expect([...empty.column.classList]).toEqual(
      expect.arrayContaining(DASHED_BORDER),
    );
    expect(empty.list.classList.contains(DROP_HEIGHT)).toBe(true);
    expect(empty.list.classList.contains(PLACEHOLDER_HEIGHT)).toBe(false);
    expect(empty.hint).not.toBeNull();
  });
});
