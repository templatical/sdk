import type { MediaFolder } from "@templatical/types";

/**
 * A folder plus the children derived from {@link MediaFolder.parentId}.
 *
 * {@link MediaFoldersProvider.list} is flat; the tree is a UI concern so a
 * store never has to return nested nodes.
 */
export interface MediaFolderNode extends MediaFolder {
  children: MediaFolderNode[];
}

/**
 * Group a flat folder list into a tree via `parentId`.
 *
 * A `parentId` that is null, omitted, or not in the list is a root — a
 * dangling reference must still render rather than vanish.
 */
export function treeFolders(folders: MediaFolder[]): MediaFolderNode[] {
  const nodes = new Map<string, MediaFolderNode>();
  for (const folder of folders) {
    nodes.set(folder.id, { ...folder, children: [] });
  }

  const roots: MediaFolderNode[] = [];
  for (const node of nodes.values()) {
    const parentId = node.parentId ?? null;
    const parent = parentId ? nodes.get(parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}
