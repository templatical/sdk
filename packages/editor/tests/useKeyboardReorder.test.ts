import "./dom-stubs";
import { describe, expect, it, beforeEach } from "vitest";
import { nextTick } from "vue";
import { useEditor } from "@templatical/core";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createTitleBlock,
  createImageBlock,
  createSectionBlock,
} from "@templatical/types";
import { useKeyboardReorder } from "../src/composables/useKeyboardReorder";
import en from "../src/i18n/locales/en";
import { useI18n } from "../src/composables/useI18n";

function createFixture() {
  const content = createDefaultTemplateContent();
  content.blocks = [
    createTitleBlock({ content: "<h1>A</h1>" }),
    createParagraphBlock({ content: "<p>B</p>" }),
    createParagraphBlock({ content: "<p>C</p>" }),
    createSectionBlock({
      children: [
        [createImageBlock({ src: "1.png" }), createImageBlock({ src: "2.png" })],
      ],
    }),
  ];
  const editor = useEditor({ content });
  const i18n = useI18n(en);
  const reorder = useKeyboardReorder(editor, i18n);
  return { editor, reorder, blocks: content.blocks };
}

describe("useKeyboardReorder", () => {
  let fixture: ReturnType<typeof createFixture>;

  beforeEach(() => {
    fixture = createFixture();
  });

  describe("lift", () => {
    it("marks block as lifted and announces position", async () => {
      const { reorder, blocks } = fixture;
      const block = blocks[1];

      reorder.lift(block.id);
      await nextTick();
      await nextTick();

      expect(reorder.liftedBlockId.value).toBe(block.id);
      expect(reorder.isLifted(block.id)).toBe(true);
      expect(reorder.announcement.value).toContain("Position 2 of 4");
    });

    it("does nothing when block id is unknown", () => {
      const { reorder } = fixture;
      reorder.lift("nonexistent");
      expect(reorder.liftedBlockId.value).toBe(null);
    });

    it("isLifted returns false for non-lifted blocks", () => {
      const { reorder, blocks } = fixture;
      reorder.lift(blocks[0].id);
      expect(reorder.isLifted(blocks[0].id)).toBe(true);
      expect(reorder.isLifted(blocks[1].id)).toBe(false);
    });
  });

  describe("moveUp / moveDown (top-level)", () => {
    it("moveDown shifts block toward end", () => {
      const { editor, reorder, blocks } = fixture;
      const second = blocks[1];

      reorder.lift(second.id);
      reorder.moveDown(second.id);

      expect(editor.content.value.blocks[2].id).toBe(second.id);
    });

    it("moveUp shifts block toward start", () => {
      const { editor, reorder, blocks } = fixture;
      const third = blocks[2];

      reorder.lift(third.id);
      reorder.moveUp(third.id);

      expect(editor.content.value.blocks[1].id).toBe(third.id);
    });

    it("moveUp at index 0 is a no-op", () => {
      const { editor, reorder, blocks } = fixture;
      const first = blocks[0];
      const originalOrder = editor.content.value.blocks.map((b) => b.id);

      reorder.lift(first.id);
      reorder.moveUp(first.id);

      expect(editor.content.value.blocks.map((b) => b.id)).toEqual(
        originalOrder,
      );
    });

    it("moveDown at last index is a no-op", () => {
      const { editor, reorder, blocks } = fixture;
      const last = blocks[blocks.length - 1];
      const originalOrder = editor.content.value.blocks.map((b) => b.id);

      reorder.lift(last.id);
      reorder.moveDown(last.id);

      expect(editor.content.value.blocks.map((b) => b.id)).toEqual(
        originalOrder,
      );
    });
  });

  describe("moveUp / moveDown (section children)", () => {
    it("moves a block within a section column", () => {
      const { editor, reorder, blocks } = fixture;
      const section = blocks[3] as { children: Array<Array<{ id: string }>> };
      const firstChild = section.children[0][0];
      const secondChild = section.children[0][1];

      reorder.lift(firstChild.id);
      reorder.moveDown(firstChild.id);

      const updatedSection = editor.content.value.blocks[3] as unknown as {
        children: Array<Array<{ id: string }>>;
      };
      expect(updatedSection.children[0][0].id).toBe(secondChild.id);
      expect(updatedSection.children[0][1].id).toBe(firstChild.id);
    });
  });

  describe("drop", () => {
    it("clears lifted state and announces final position", async () => {
      const { reorder, blocks } = fixture;
      reorder.lift(blocks[0].id);
      reorder.drop(blocks[0].id);
      await nextTick();
      await nextTick();

      expect(reorder.liftedBlockId.value).toBe(null);
      expect(reorder.announcement.value).toContain("position 1 of 4");
    });

    it("drop is safe when nothing is lifted", () => {
      const { reorder, blocks } = fixture;
      reorder.drop(blocks[0].id);
      expect(reorder.liftedBlockId.value).toBe(null);
    });
  });

  describe("cancel", () => {
    it("restores the block to its original position", () => {
      const { editor, reorder, blocks } = fixture;
      const second = blocks[1];

      reorder.lift(second.id);
      reorder.moveDown(second.id);
      reorder.moveDown(second.id);
      reorder.cancel();

      expect(editor.content.value.blocks[1].id).toBe(second.id);
      expect(reorder.liftedBlockId.value).toBe(null);
    });

    it("cancel without a lift is a no-op", () => {
      const { editor, reorder, blocks } = fixture;
      const originalOrder = editor.content.value.blocks.map((b) => b.id);

      reorder.cancel();

      expect(editor.content.value.blocks.map((b) => b.id)).toEqual(
        originalOrder,
      );
      expect(reorder.liftedBlockId.value).toBe(null);
    });

    it("restores block to original container when moved across containers while lifted", () => {
      const { editor, reorder } = fixture;
      const section = editor.content.value.blocks[3] as any;
      const image = section.children[0][0];

      reorder.lift(image.id);
      // Simulate cross-container move (e.g. via concurrent drag) — image
      // travels from section column 0 index 0 to top-level index 0. The
      // index happens to match the original.
      editor.moveBlock(image.id, 0);

      reorder.cancel();

      const sectionAfter = editor.content.value.blocks.find(
        (b) => b.id === section.id,
      ) as any;
      expect(sectionAfter.children[0][0].id).toBe(image.id);
      expect(editor.content.value.blocks[0].id).not.toBe(image.id);
    });

    it("announces cancellation with original position", async () => {
      const { reorder, blocks } = fixture;
      reorder.lift(blocks[1].id);
      reorder.moveDown(blocks[1].id);
      reorder.cancel();
      await nextTick();
      await nextTick();

      expect(reorder.announcement.value.toLowerCase()).toContain("cancelled");
      expect(reorder.announcement.value).toContain("position 2.");
    });
  });
});
