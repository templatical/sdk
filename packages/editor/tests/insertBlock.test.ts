// @vitest-environment happy-dom
//
// `editor.insertBlock()`: a host inserts a block from its own UI (a library of
// ready-made sections, say) and it lands where a palette click would put it.
// The palette and the method share `insertBlockAtSelection`, so these pin the
// method's own contract: a fresh copy, placed by the selection, then selected
// and scrolled to, so repeated calls stack in order.

import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import type { Block, SectionBlock, TemplateContent } from "@templatical/types";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createSectionBlock,
  createSlotBlock,
  createTableBlock,
} from "@templatical/types";
import Editor from "../src/Editor.vue";
import { useFonts } from "../src/composables";
import { loadTranslations } from "../src/i18n";
import { insertBlockAtSelection } from "../src/utils/insertBlockAtSelection";

interface Exposed {
  insertBlock(block: Block): string | null;
  getContent(): TemplateContent;
}

const mounted: VueWrapper[] = [];

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  vi.restoreAllMocks();
});

/**
 * The real `Editor.vue`, attached to the document so the canvas's blocks are
 * reachable by the scroll lookup. Dropping the `defineExpose` line would make
 * the public method undefined here, which is the point of mounting it.
 */
async function mountRealEditor(
  blocks: Block[],
  config: Record<string, unknown> = {},
) {
  const wrapper = mount(Editor, {
    attachTo: document.body,
    props: {
      config: {
        container: document.createElement("div"),
        content: { ...createDefaultTemplateContent(), blocks },
        ...config,
      },
      translations: await loadTranslations("en"),
      fontsManager: useFonts(undefined),
    } as never,
    global: { stubs: { teleport: true } },
  });
  mounted.push(wrapper);
  return { wrapper, editor: wrapper.vm as unknown as Exposed };
}

function topLevelIds(editor: Exposed): string[] {
  return editor.getContent().blocks.map((block) => block.id);
}

describe("insertBlock", () => {
  it("inserts below the selected block, then below the block it inserted", async () => {
    const first = createParagraphBlock({ content: "<p>First</p>" });
    const last = createParagraphBlock({ content: "<p>Last</p>" });
    const { wrapper, editor } = await mountRealEditor([first, last]);

    await wrapper.find(`[data-block-id="${first.id}"]`).trigger("click");
    const a = editor.insertBlock(createParagraphBlock());
    const b = editor.insertBlock(createParagraphBlock());

    expect(topLevelIds(editor)).toEqual([first.id, a, b, last.id]);
  });

  it("appends when nothing is selected", async () => {
    const only = createParagraphBlock();
    const { editor } = await mountRealEditor([only]);

    const id = editor.insertBlock(createParagraphBlock());

    expect(topLevelIds(editor)).toEqual([only.id, id]);
  });

  it("inserts a copy, so the same block can be inserted twice", async () => {
    const { editor } = await mountRealEditor([]);
    const block = createParagraphBlock({ content: "<p>Reused</p>" });

    const a = editor.insertBlock(block);
    const b = editor.insertBlock(block);

    expect(a).not.toBe(block.id);
    expect(b).not.toBe(block.id);
    expect(a).not.toBe(b);
    expect(editor.getContent().blocks).toHaveLength(2);
    expect(editor.getContent().blocks[0]).not.toBe(block);
  });

  it("gives a section's children fresh ids too", async () => {
    const { editor } = await mountRealEditor([]);
    const child = createParagraphBlock();
    const section = createSectionBlock({ children: [[child]] });

    editor.insertBlock(section);

    const inserted = editor.getContent().blocks[0] as SectionBlock;
    expect(inserted.children[0]).toHaveLength(1);
    expect(inserted.children[0][0].id).not.toBe(child.id);
  });

  it("gives a table's rows and cells fresh ids", async () => {
    const { editor } = await mountRealEditor([]);
    const table = createTableBlock();

    editor.insertBlock(table);

    const inserted = editor.getContent().blocks[0];
    if (inserted.type !== "table") throw new Error("expected a table");
    expect(inserted.rows[0].id).not.toBe(table.rows[0].id);
    expect(inserted.rows[0].cells[0].id).not.toBe(table.rows[0].cells[0].id);
  });

  it("refuses while the editor is in preview mode", async () => {
    const only = createParagraphBlock();
    const { wrapper, editor } = await mountRealEditor([only]);

    await wrapper.find(".tpl-preview-toggle").trigger("click");

    expect(editor.insertBlock(createParagraphBlock())).toBeNull();
    expect(topLevelIds(editor)).toEqual([only.id]);
  });

  it("throws for a slot, as setContent does", async () => {
    const { editor } = await mountRealEditor([]);

    expect(() => editor.insertBlock(createSlotBlock())).toThrow(/slot/);
  });

  it("scrolls the inserted block into view", async () => {
    const scroll = vi
      .spyOn(Element.prototype, "scrollIntoView")
      .mockImplementation(() => {});
    const { editor } = await mountRealEditor([createParagraphBlock()]);

    const id = editor.insertBlock(createParagraphBlock());
    await nextTick();
    await nextTick();

    expect(scroll).toHaveBeenCalledTimes(1);
    expect(
      (scroll.mock.contexts[0] as Element).getAttribute("data-block-id"),
    ).toBe(id);
  });
});

describe("insertBlockAtSelection", () => {
  function fakeEditor(accepts: boolean) {
    const blocks: Block[] = [];
    return {
      state: { selectedBlockId: "kept" as string | null },
      findBlockLocation: (id: string) => {
        const index = blocks.findIndex((block) => block.id === id);
        return index === -1 ? null : { index };
      },
      isBlockLocked: () => false,
      addBlock: vi.fn((block: Block) => {
        if (accepts) blocks.push(block);
      }),
      selectBlock: vi.fn(),
    };
  }

  it("selects the block once it has landed", () => {
    const editor = fakeEditor(true);
    const block = createParagraphBlock();

    expect(insertBlockAtSelection(editor, block)).toBe(true);
    expect(editor.selectBlock).toHaveBeenCalledWith(block.id);
  });

  it("leaves the selection alone when addBlock refuses the block", () => {
    const editor = fakeEditor(false);

    expect(insertBlockAtSelection(editor, createParagraphBlock())).toBe(false);
    expect(editor.addBlock).toHaveBeenCalledOnce();
    expect(editor.selectBlock).not.toHaveBeenCalled();
  });
});
