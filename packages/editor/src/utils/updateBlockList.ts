import type { DraggableEvent } from "vue-draggable-plus";
import type { Block } from "@templatical/types";
import type { BaseEditorReturn } from "../composables/useEditorCore";

/** Route a Sortable destination update through the editor's structural actions. */
export function updateBlockList(
  editor: BaseEditorReturn,
  next: Block[],
  sectionId?: string,
  columnIndex = 0,
  event?: Partial<
    Pick<
      DraggableEvent<Block>,
      | "oldIndex"
      | "newIndex"
      | "oldDraggableIndex"
      | "newDraggableIndex"
      | "data"
    >
  >,
): void {
  const section = sectionId
    ? editor.content.value.blocks.find((block) => block.id === sectionId)
    : undefined;
  const current = sectionId
    ? section?.type === "section"
      ? (section.children[columnIndex] ?? [])
      : []
    : editor.content.value.blocks;
  const ids = next.map((block) => block.id);
  // Sortable emits a removal on the source too. The destination performs the
  // move atomically, preserving the original block and its language layers.
  if (current.some((block) => !ids.includes(block.id))) return;
  const added = next.filter(
    (block) => !current.some((old) => old.id === block.id),
  );
  let moved: Block | undefined;
  let index = -1;
  if (added.length === 1) {
    moved = added[0];
    index = ids.indexOf(moved.id);
  } else if (added.length === 0 && event) {
    const from = event.oldDraggableIndex ?? event.oldIndex;
    const to = event.newDraggableIndex ?? event.newIndex;
    if (
      to === undefined ||
      !Number.isInteger(to) ||
      to < 0 ||
      to >= current.length
    )
      return;
    moved = event.data?.id
      ? current.find((block) => block.id === event.data!.id)
      : from === undefined
        ? undefined
        : current[from];
    if (!moved || current.indexOf(moved) === to) return;
    index = to;
  }
  if (!moved) return;
  const source = editor.findBlockLocation(moved.id);
  if (source) editor.moveBlock(moved.id, index, sectionId, columnIndex);
  else
    editor.addBlock(
      JSON.parse(JSON.stringify(moved)) as Block,
      sectionId,
      columnIndex,
      index,
    );
}
