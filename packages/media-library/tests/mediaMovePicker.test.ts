// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import type { MediaFolderNode } from "../src/utils/treeFolders";

const outside = vi.hoisted(() => ({ handler: null as null | (() => void) }));

vi.mock("@vueuse/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@vueuse/core")>();
  return {
    ...actual,
    onClickOutside: (_el: unknown, cb: () => void) => {
      outside.handler = cb;
    },
  };
});

import MediaMovePicker from "../src/components/media/MediaMovePicker.vue";

function node(
  id: string,
  name: string,
  children: MediaFolderNode[] = [],
): MediaFolderNode {
  return { id, name, parentId: null, children };
}

const wrappers: VueWrapper[] = [];

function mountPicker(
  folders: MediaFolderNode[],
  currentFolderId: string | null,
): VueWrapper {
  const wrapper = mount(MediaMovePicker, {
    props: { folders, currentFolderId },
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
  outside.handler = null;
});

describe("MediaMovePicker", () => {
  it("flattens nested folders and disables the current one", async () => {
    const wrapper = mountPicker(
      [node("photos", "Photos", [node("2024", "2024"), node("2025", "2025")])],
      "2024",
    );

    const labels = wrapper.findAll("button").map((b) => b.text());
    expect(labels.some((t) => t.includes("All Files"))).toBe(true);
    expect(labels.some((t) => t.includes("Photos"))).toBe(true);
    expect(labels.some((t) => t.includes("2024"))).toBe(true);
    expect(labels.some((t) => t.includes("2025"))).toBe(true);

    const current = wrapper
      .findAll("button")
      .find((b) => b.text().includes("2024"))!;
    expect((current.element as HTMLButtonElement).disabled).toBe(true);
    expect(current.text()).toContain("(current)");
  });

  it("hides All Files when already at the root", () => {
    const wrapper = mountPicker([node("photos", "Photos")], null);
    expect(
      wrapper.findAll("button").some((b) => b.text().includes("All Files")),
    ).toBe(false);
  });

  it("emits the chosen folder, including the root", async () => {
    const wrapper = mountPicker([node("photos", "Photos")], "photos");

    await wrapper
      .findAll("button")
      .find((b) => b.text().includes("All Files"))!
      .trigger("click");
    expect(wrapper.emitted("select")).toEqual([[null]]);

    await wrapper
      .findAll("button")
      .find((b) => b.text().includes("Photos"))!
      .trigger("click");
    // Current folder is disabled, so Photos must not have emitted.
    expect(wrapper.emitted("select")).toEqual([[null]]);
  });

  it("closes on a click outside", () => {
    const wrapper = mountPicker([node("photos", "Photos")], null);
    expect(outside.handler).not.toBeNull();
    outside.handler!();
    expect(wrapper.emitted("close")).toHaveLength(1);
  });
});
