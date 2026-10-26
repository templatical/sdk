import { describe, expect, it } from "vitest";
import { useEditor } from "@templatical/core";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createSectionBlock,
  safeClone,
} from "@templatical/types";
import { updateBlockList } from "../src/utils/updateBlockList";

function setup() {
  const content = createDefaultTemplateContent();
  content.settings.locale = "en";
  content.settings.locales = ["de"];
  content.blocks = [
    createParagraphBlock({ id: "one" }),
    createParagraphBlock({ id: "two" }),
    createSectionBlock({ id: "section" }),
  ];
  return useEditor({ content });
}

describe("Sortable block-list updates", () => {
  it.each([undefined, -1, 0.5, 3, NaN])(
    "ignores an invalid destination index %s without dirtying the template",
    (to) => {
      const editor = setup();
      const before = safeClone(editor.content.value);
      updateBlockList(editor, [...before.blocks].reverse(), undefined, 0, {
        oldIndex: 0,
        newIndex: to,
      });
      expect(editor.content.value).toEqual(before);
      expect(editor.state.isDirty).toBe(false);
    },
  );

  it("clones a new palette block into the destination and keeps its language layer", () => {
    const editor = setup();
    const palette = createParagraphBlock({
      id: "new",
      content: "Hello",
      l10n: { de: { hidden: true } },
    });
    updateBlockList(editor, [palette], "section", 0);
    const section = editor.content.value.blocks[2];
    expect(section).toMatchObject({ children: [[palette]] });
    expect(editor.state.isDirty).toBe(true);
    if (section.type !== "section") throw new Error("Expected a section");
    expect(section.children[0][0]).not.toBe(palette);
    palette.content = "Changed palette";
    expect(section.children[0][0]).toMatchObject({
      content: "Hello",
      l10n: { de: { hidden: true } },
    });
  });

  it("ignores source removals and moves the original block only at the destination", () => {
    const editor = setup();
    const original = editor.content.value.blocks[0];
    updateBlockList(editor, editor.content.value.blocks.slice(1));
    expect(editor.content.value.blocks[0]).toBe(original);
    expect(editor.state.isDirty).toBe(false);
    updateBlockList(editor, [safeClone(original)], "section", 0);
    expect(editor.content.value.blocks.map((block) => block.id)).toEqual([
      "two",
      "section",
    ]);
    expect(editor.content.value.blocks[1]).toMatchObject({
      children: [[{ id: "one" }]],
    });
  });
});
