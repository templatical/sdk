// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import type { MediaAsset } from "@templatical/types";
import { MEDIA_LIMITS_KEY, UI_LOCALE_KEY } from "../src/keys";
import { ref } from "vue";
import type { MediaFolderNode } from "../src/utils/treeFolders";
import MediaBreadcrumb from "../src/components/media/MediaBreadcrumb.vue";
import MediaFolderTree from "../src/components/media/MediaFolderTree.vue";
import MediaImportUrlModal from "../src/components/media/MediaImportUrlModal.vue";
import MediaPreviewPanel from "../src/components/media/MediaPreviewPanel.vue";

const drop = vi.hoisted(() => ({
  onDrop: null as null | ((files: File[] | null) => void),
  open: vi.fn(),
  onChange: null as null | ((files: FileList | null) => void),
  isOver: false,
}));

vi.mock("@vueuse/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@vueuse/core")>();
  return {
    ...actual,
    useDropZone: (
      _el: unknown,
      opts: { onDrop: (files: File[] | null) => void },
    ) => {
      drop.onDrop = opts.onDrop;
      return { isOverDropZone: { value: drop.isOver } };
    },
    useFileDialog: () => ({
      open: drop.open,
      onChange: (cb: (files: FileList | null) => void) => {
        drop.onChange = cb;
      },
    }),
  };
});

import MediaUploadZone from "../src/components/media/MediaUploadZone.vue";

function node(
  id: string,
  name: string,
  children: MediaFolderNode[] = [],
): MediaFolderNode {
  return { id, name, parentId: null, children };
}

function asset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: "hero",
    url: "https://cdn.example.com/hero.jpg",
    filename: "hero.jpg",
    mimeType: "image/jpeg",
    size: 2048,
    width: 800,
    height: 600,
    alt: "Launch",
    folderId: "2024",
    createdAt: "2026-01-15T00:00:00Z",
    ...overrides,
  };
}

const wrappers: VueWrapper[] = [];

afterEach(() => {
  while (wrappers.length) {
    wrappers.pop()?.unmount();
  }
  document.body.innerHTML = "";
  drop.onDrop = null;
  drop.onChange = null;
  drop.open.mockClear();
});

const transitionStub = {
  Transition: {
    inheritAttrs: false,
    setup(_props: unknown, { slots }: { slots: { default?: () => unknown } }) {
      return () => slots.default?.();
    },
  },
};

describe("MediaBreadcrumb", () => {
  const tree = [node("photos", "Photos", [node("2024", "2024")])];

  it("renders nothing at the root", () => {
    const wrapper = mount(MediaBreadcrumb, {
      props: { folders: tree, currentFolderId: null },
    });
    wrappers.push(wrapper);
    expect(wrapper.find("button").exists()).toBe(false);
  });

  it("walks nested folders and navigates ancestors, not the leaf", async () => {
    const wrapper = mount(MediaBreadcrumb, {
      props: { folders: tree, currentFolderId: "2024" },
    });
    wrappers.push(wrapper);
    expect(wrapper.text()).toContain("All Files");
    expect(wrapper.text()).toContain("Photos");
    expect(wrapper.text()).toContain("2024");

    await wrapper.findAll("button")[0].trigger("click");
    expect(wrapper.emitted("navigate")?.[0]).toEqual([null]);

    await wrapper.findAll("button")[1].trigger("click");
    expect(wrapper.emitted("navigate")?.[1]).toEqual(["photos"]);
    expect(wrapper.findAll("button")).toHaveLength(2);
  });
});

describe("MediaUploadZone", () => {
  function mountZone(extra: Record<string, unknown> = {}) {
    const wrapper = mount(MediaUploadZone, {
      props: { isUploading: false, uploadProgress: null, ...extra },
      global: {
        provide: {
          [MEDIA_LIMITS_KEY]: {
            mimeTypes: { images: ["image/jpeg", "image/png"] },
            maxFileSize: 10 * 1024 * 1024,
          },
        },
      },
    });
    wrappers.push(wrapper);
    return wrapper;
  }

  it("opens the file picker and emits only accepted files", async () => {
    const wrapper = mountZone();
    await wrapper.get('[data-testid="media-upload-zone"]').trigger("click");
    expect(drop.open).toHaveBeenCalled();

    const ok = new File(["x"], "hero.jpg", { type: "image/jpeg" });
    const pdf = new File(["y"], "doc.pdf", { type: "application/pdf" });
    drop.onDrop?.([ok, pdf]);
    expect(wrapper.emitted("upload")).toEqual([[[ok]]]);
  });

  it("ignores an empty drop and shows multi-file progress copy", () => {
    const wrapper = mountZone({
      isUploading: true,
      uploadProgress: { current: 2, total: 4 },
    });
    drop.onDrop?.([]);
    expect(wrapper.emitted("upload")).toBeUndefined();
    expect(wrapper.text()).toContain("2");
    expect(wrapper.text()).toContain("4");
  });
});

describe("MediaImportUrlModal", () => {
  function mountImport(extra: Record<string, unknown> = {}) {
    const wrapper = mount(MediaImportUrlModal, {
      props: {
        visible: true,
        isImporting: false,
        error: null,
        ...extra,
      },
      attachTo: document.body,
      global: { stubs: transitionStub },
    });
    wrappers.push(wrapper);
    return wrapper;
  }

  function button(label: string) {
    const match = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === label,
    );
    if (!match) throw new Error(`button "${label}" not found`);
    return match as HTMLButtonElement;
  }

  it("imports a trimmed URL on click and Enter, and ignores a blank one", async () => {
    const wrapper = mountImport();
    await flushPromises();
    expect(button("Import").disabled).toBe(true);

    const input =
      document.querySelector<HTMLInputElement>('input[type="url"]')!;
    input.value = "  https://cdn.example.com/a.png  ";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();

    button("Import").click();
    await flushPromises();
    expect(wrapper.emitted("import")).toEqual([
      ["https://cdn.example.com/a.png"],
    ]);

    document
      .querySelector('[role="dialog"]')!
      .parentElement!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    await flushPromises();
    expect(wrapper.emitted("import")).toHaveLength(2);
  });

  it("closes on Escape unless an import is in flight", async () => {
    const wrapper = mountImport();
    await flushPromises();
    document
      .querySelector('[role="dialog"]')!
      .parentElement!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    await flushPromises();
    expect(wrapper.emitted("close")).toHaveLength(1);

    const busy = mountImport({ isImporting: true });
    await flushPromises();
    document
      .querySelector('[role="dialog"]')!
      .parentElement!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    await flushPromises();
    expect(busy.emitted("close")).toBeUndefined();
    expect(document.body.textContent).toContain("Importing");
  });

  it("wires an import error onto the field", async () => {
    mountImport({ error: "not found" });
    await flushPromises();
    const input =
      document.querySelector<HTMLInputElement>('input[type="url"]')!;
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(
      document.querySelector("#tpl-media-import-error")?.textContent,
    ).toContain("not found");
  });
});

describe("MediaPreviewPanel", () => {
  const folders = [node("photos", "Photos", [node("2024", "2024")])];

  it("shows image dimensions, alt, size and folder path", () => {
    const wrapper = mount(MediaPreviewPanel, {
      props: { item: asset(), folders },
      global: {
        provide: {
          [MEDIA_LIMITS_KEY]: {},
          [UI_LOCALE_KEY]: ref("en"),
        },
      },
    });
    wrappers.push(wrapper);
    expect(wrapper.get("img").attributes("src")).toBe(asset().url);
    expect(wrapper.text()).toContain("Launch");
    expect(wrapper.text()).toContain("800");
    expect(wrapper.text()).toContain("Photos/2024");
    expect(wrapper.text()).toContain("2.0 KB");
  });

  it("falls back to the url when filename is missing and skips the image chrome for a pdf", () => {
    const wrapper = mount(MediaPreviewPanel, {
      props: {
        item: asset({
          filename: "",
          mimeType: "application/pdf",
          url: "https://cdn.example.com/brief.pdf",
          alt: undefined,
          width: undefined,
          height: undefined,
        }),
        folders,
      },
      global: { provide: { [MEDIA_LIMITS_KEY]: {} } },
    });
    wrappers.push(wrapper);
    expect(wrapper.find("img").exists()).toBe(false);
    expect(wrapper.text()).toContain("https://cdn.example.com/brief.pdf");
    expect(wrapper.text()).not.toContain("Launch");
  });
});

describe("MediaFolderTree", () => {
  it("navigates to root, creates a folder, and shows frequently used", async () => {
    const wrapper = mount(MediaFolderTree, {
      props: {
        folders: [node("photos", "Photos")],
        currentFolderId: "photos",
        viewMode: "files",
        hasFrequentlyUsed: true,
        canCreateFolder: true,
      },
    });
    wrappers.push(wrapper);

    await wrapper.findAll("button")[0].trigger("click");
    expect(wrapper.emitted("navigate")?.[0]).toEqual([null]);

    await wrapper
      .findAll("button")
      .find((b) => b.text().includes("New Folder"))!
      .trigger("click");
    await wrapper.get("input").setValue("   ");
    await wrapper.get("input").trigger("keydown.enter");
    expect(wrapper.emitted("createFolder")).toBeUndefined();

    await wrapper
      .findAll("button")
      .find((b) => b.text().includes("New Folder"))!
      .trigger("click");
    await wrapper.get("input").setValue("Heroes");
    await wrapper.get("input").trigger("keydown.enter");
    expect(wrapper.emitted("createFolder")).toEqual([["Heroes"]]);

    await wrapper.get('[data-testid="media-frequently-used"]').trigger("click");
    expect(wrapper.emitted("showFrequentlyUsed")).toHaveLength(1);
  });

  it("hides new-folder and frequently-used when they are not available", () => {
    const wrapper = mount(MediaFolderTree, {
      props: {
        folders: [],
        currentFolderId: null,
        viewMode: "files",
        hasFrequentlyUsed: false,
        canCreateFolder: false,
      },
    });
    wrappers.push(wrapper);
    expect(wrapper.text()).not.toContain("New Folder");
    expect(wrapper.find('[data-testid="media-frequently-used"]').exists()).toBe(
      false,
    );
  });
});
