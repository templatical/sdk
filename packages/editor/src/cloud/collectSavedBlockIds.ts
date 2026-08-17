/**
 * Just enough of a stored template to walk its ids — deliberately structural
 * rather than `Template`, because the caller reads `editor.state`, which is
 * `DeepReadonly` and so not assignable to the mutable contract type.
 */
interface SavedBlockIdSource {
  content?: {
    blocks?: readonly {
      id: string;
      type: string;
      children?: readonly (readonly { id: string }[])[];
    }[];
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
  const blocks = template?.content?.blocks;
  if (!blocks) return ids;

  for (const block of blocks) {
    ids.add(block.id);
    if (block.type === "section" && block.children) {
      for (const column of block.children) {
        for (const child of column) {
          ids.add(child.id);
        }
      }
    }
  }
  return ids;
}
