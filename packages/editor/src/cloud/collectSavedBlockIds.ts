/**
 * Just enough of a stored template to walk its ids — deliberately structural
 * rather than `Template`, because the caller reads `editor.state`, which is
 * `DeepReadonly` and so not assignable to the mutable contract type.
 *
 * `children` is a union: a section stores columns (`Block[][]`); a layout
 * `wrapper` stores a flat `Block[]`. Both appear on the `Block` union, so a
 * shape that only named the section form is not assignable from
 * `DeepReadonly<Template>`.
 */
interface SavedBlockIdNode {
  readonly id: string;
  readonly type: string;
  readonly children?:
    readonly SavedBlockIdNode[] | readonly (readonly SavedBlockIdNode[])[];
}

interface SavedBlockIdSource {
  content?: {
    blocks?: readonly SavedBlockIdNode[];
  };
}

/**
 * Every block id present in the **stored** template, sections' children
 * included.
 *
 * This is the last thing the deleted Cloud editor core carried over the OSS one
 * (`savedBlockIds`), and it never belonged there: its only reader gates a
 * comment filter on whether the block exists server-side, which makes it a
 * *comments* dependency. It travels with that feature accordingly, and reaches
 * `CommentsSidebar` through `capabilities.comments.isBlockSaved`.
 *
 * Derived on demand rather than memoised: `state.template` only changes on a
 * create / load / save round-trip, and the one caller runs on a user filtering
 * the comments panel.
 */
export function collectSavedBlockIds(
  template: SavedBlockIdSource | null | undefined,
): Set<string> {
  const ids = new Set<string>();
  collectFromBlocks(template?.content?.blocks, ids);
  return ids;
}

function collectFromBlocks(
  blocks: readonly SavedBlockIdNode[] | undefined,
  ids: Set<string>,
): void {
  if (!blocks) return;
  for (const block of blocks) {
    ids.add(block.id);
    if (!block.children) continue;
    if (block.type === "section") {
      for (const column of block.children as readonly (readonly SavedBlockIdNode[])[]) {
        collectFromBlocks(column, ids);
      }
      continue;
    }
    if (block.type === "wrapper") {
      collectFromBlocks(block.children as readonly SavedBlockIdNode[], ids);
    }
  }
}
