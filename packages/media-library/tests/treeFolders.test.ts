import { describe, expect, it } from "vitest";
import { treeFolders } from "../src/utils/treeFolders";
import type { MediaFolder } from "@templatical/types";

describe("treeFolders", () => {
  it("returns root folders with nested children via parentId", () => {
    const folders: MediaFolder[] = [
      { id: "root", name: "Photos", parentId: null },
      { id: "child", name: "2024", parentId: "root" },
      { id: "orphan", name: "Other" },
    ];

    const tree = treeFolders(folders);

    expect(tree.map((node) => node.id)).toEqual(["root", "orphan"]);
    expect(tree[0].children.map((node) => node.id)).toEqual(["child"]);
    expect(tree[1].children).toEqual([]);
  });

  it("treats a missing parent as a root rather than dropping the folder", () => {
    const tree = treeFolders([
      { id: "dangling", name: "Lost", parentId: "gone" },
    ]);

    expect(tree).toEqual([
      { id: "dangling", name: "Lost", parentId: "gone", children: [] },
    ]);
  });
});
