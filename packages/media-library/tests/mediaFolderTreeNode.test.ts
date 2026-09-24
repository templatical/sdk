// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import type { MediaFolderNode } from "../src/utils/treeFolders";
import MediaFolderTreeNode from "../src/components/media/MediaFolderTreeNode.vue";

function node(
  id: string,
  name: string,
  children: MediaFolderNode[] = [],
): MediaFolderNode {
  return { id, name, parentId: null, children };
}

const wrappers: VueWrapper[] = [];

function mountNode(
  folder: MediaFolderNode,
  extra: {
    currentFolderId?: string | null;
    depth?: number;
    canCreateFolder?: boolean;
    canRenameFolder?: boolean;
    canDeleteFolder?: boolean;
  } = {},
): VueWrapper {
  const wrapper = mount(MediaFolderTreeNode, {
    props: {
      folder,
      currentFolderId: extra.currentFolderId ?? null,
      depth: extra.depth ?? 0,
      canCreateFolder: extra.canCreateFolder ?? true,
      canRenameFolder: extra.canRenameFolder ?? true,
      canDeleteFolder: extra.canDeleteFolder ?? true,
    },
    attachTo: document.body,
  });
  wrappers.push(wrapper);
  return wrapper;
}

afterEach(() => {
  while (wrappers.length) {
    wrappers.pop()?.unmount();
  }
  document.body.innerHTML = "";
});

describe("MediaFolderTreeNode", () => {
  it("navigates on the folder name", async () => {
    const wrapper = mountNode(node("photos", "Photos"));
    await wrapper
      .findAll("button")
      .find((b) => b.text().includes("Photos"))!
      .trigger("click");
    expect(wrapper.emitted("navigate")).toEqual([["photos"]]);
  });

  it("renames on Enter and ignores a no-op rename", async () => {
    const wrapper = mountNode(node("photos", "Photos"));
    await wrapper.find("button[aria-label='Rename folder']").trigger("click");
    await nextTick();

    const input = wrapper.get("input");
    await input.setValue("Photos");
    await input.trigger("keydown.enter");
    expect(wrapper.emitted("renameFolder")).toBeUndefined();

    await wrapper.find("button[aria-label='Rename folder']").trigger("click");
    await nextTick();
    await wrapper.get("input").setValue("Heroes");
    await wrapper.get("input").trigger("keydown.enter");
    expect(wrapper.emitted("renameFolder")).toEqual([["photos", "Heroes"]]);
  });

  it("cancels rename on Escape", async () => {
    const wrapper = mountNode(node("photos", "Photos"));
    await wrapper.find("button[aria-label='Rename folder']").trigger("click");
    await nextTick();
    await wrapper.get("input").setValue("Heroes");
    await wrapper.get("input").trigger("keydown.escape");
    await nextTick();
    expect(wrapper.emitted("renameFolder")).toBeUndefined();
    expect(wrapper.find("input").exists()).toBe(false);
    expect(wrapper.text()).toContain("Photos");
  });

  it("creates a subfolder and ignores an empty name", async () => {
    const wrapper = mountNode(node("photos", "Photos"));
    await wrapper.find("button[aria-label='Add subfolder']").trigger("click");
    await nextTick();

    const input = wrapper.get("input");
    await input.setValue("   ");
    await input.trigger("keydown.enter");
    expect(wrapper.emitted("createFolder")).toBeUndefined();

    await wrapper.find("button[aria-label='Add subfolder']").trigger("click");
    await nextTick();
    await wrapper.get("input").setValue("2024");
    await wrapper.get("input").trigger("keydown.enter");
    expect(wrapper.emitted("createFolder")).toEqual([["2024", "photos"]]);
  });

  it("asks for a second click before deleting", async () => {
    const wrapper = mountNode(node("photos", "Photos"));
    const trash = wrapper.get('[data-testid="media-folder-delete"]');

    await trash.trigger("click");
    expect(wrapper.emitted("deleteFolder")).toBeUndefined();
    expect(trash.attributes("aria-label")).toBe("Confirm delete");

    await trash.trigger("click");
    expect(wrapper.emitted("deleteFolder")).toEqual([["photos"]]);
  });

  it("clears the delete confirm when focus leaves the row", async () => {
    const wrapper = mountNode(node("photos", "Photos"));
    const trash = wrapper.get('[data-testid="media-folder-delete"]');
    await trash.trigger("click");
    expect(trash.attributes("aria-label")).toBe("Confirm delete");

    await wrapper
      .find(".tpl\\:group")
      .trigger("focusout", { relatedTarget: document.body });
    await nextTick();
    expect(
      wrapper
        .get('[data-testid="media-folder-delete"]')
        .attributes("aria-label"),
    ).toBe("Delete folder");
  });

  it("expands when a descendant is the current folder", () => {
    const wrapper = mountNode(
      node("photos", "Photos", [node("2024", "2024")]),
      { currentFolderId: "2024" },
    );
    expect(wrapper.text()).toContain("2024");
    expect(
      wrapper.get("button[aria-expanded]").attributes("aria-expanded"),
    ).toBe("true");
  });

  it("does not offer a subfolder at the depth cap", () => {
    const wrapper = mountNode(node("leaf", "Leaf"), { depth: 4 });
    expect(wrapper.find("button[aria-label='Add subfolder']").exists()).toBe(
      false,
    );
  });

  it("hides mutations the provider withheld", () => {
    const wrapper = mountNode(node("photos", "Photos"), {
      canCreateFolder: false,
      canRenameFolder: false,
      canDeleteFolder: false,
    });
    expect(wrapper.find("button[aria-label='Add subfolder']").exists()).toBe(
      false,
    );
    expect(wrapper.find("button[aria-label='Rename folder']").exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="media-folder-delete"]').exists()).toBe(
      false,
    );
  });
});
