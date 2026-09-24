// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import type { MediaAsset, MediaProvider } from "@templatical/types";

const { CropperStub } = vi.hoisted(() => ({
  CropperStub: {
    name: "Cropper",
    template: '<div data-testid="cropper" />',
    methods: { getResult: () => ({ canvas: null }) },
  },
}));

vi.mock("vue-advanced-cropper", () => ({
  Cropper: CropperStub,
}));

vi.mock("vue-advanced-cropper/dist/style.css", () => ({}));

import MediaLibraryModal from "../src/components/MediaLibraryModal.vue";

function createAsset(
  id: string,
  overrides: Partial<MediaAsset> = {},
): MediaAsset {
  return {
    id,
    url: `https://cdn.example.com/${id}.jpg`,
    filename: `file-${id}.jpg`,
    mimeType: "image/jpeg",
    size: 1024,
    thumbnailUrl: `https://cdn.example.com/${id}-thumb.jpg`,
    alt: "Hero",
    ...overrides,
  };
}

function fakeProvider(overrides: Partial<MediaProvider> = {}): MediaProvider {
  return {
    list: vi.fn(async () => ({ items: [] })),
    create: vi.fn(async ({ file }) =>
      createAsset("uploaded", { url: `https://cdn.example/${file.name}` }),
    ),
    update: vi.fn(async (id) => createAsset(id)),
    delete: vi.fn(async () => {}),
    folders: {
      list: vi.fn(async () => [{ id: "f1", name: "Heroes", parentId: null }]),
      create: vi.fn(async ({ name }) => ({ id: "f2", name })),
      update: vi.fn(async (id, { name }) => ({ id, name })),
      delete: vi.fn(async () => {}),
      move: vi.fn(async () => []),
    },
    replace: vi.fn(async (id) => createAsset(id)),
    importFromUrl: vi.fn(async (url) => createAsset("imported", { url })),
    checkUsage: false,
    frequentlyUsed: false,
    storage: false,
    ...overrides,
  };
}

const wrappers: VueWrapper[] = [];

async function mountModal(provider: MediaProvider): Promise<VueWrapper> {
  const wrapper = mount(MediaLibraryModal, {
    props: { visible: true, provider, locale: "en" },
    attachTo: document.body,
  });
  wrappers.push(wrapper);
  await flushPromises();
  return wrapper;
}

afterEach(() => {
  while (wrappers.length) {
    wrappers.pop()?.unmount();
  }
  document.body.innerHTML = "";
});

describe("MediaLibraryModal edit / replace / move", () => {
  it("saves filename and alt through the edit dialog", async () => {
    const asset = createAsset("hero", { filename: "hero.jpg" });
    const update = vi.fn(async (id: string) => createAsset(id));
    await mountModal(
      fakeProvider({
        list: vi.fn(async () => ({ items: [asset] })),
        update,
      }),
    );

    document
      .querySelector<HTMLButtonElement>('[data-testid="media-edit"]')!
      .click();
    await vi.waitFor(() => {
      expect(document.querySelector("#tpl-media-filename")).not.toBeNull();
    });

    const filename = document.querySelector<HTMLInputElement>(
      "#tpl-media-filename",
    );
    expect(filename!.value).toBe("hero.jpg");

    filename!.value = "hero-renamed.jpg";
    filename!.dispatchEvent(new Event("input", { bubbles: true }));
    const alt = document.querySelector<HTMLInputElement>("#tpl-media-alt")!;
    alt.value = "New alt";
    alt.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();

    const save = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Save",
    );
    expect(save).not.toBeUndefined();
    save!.click();
    await flushPromises();

    expect(update).toHaveBeenCalledWith("hero", {
      filename: "hero-renamed.jpg",
      alt: "New alt",
    });
  });

  it("replaces the file through the replace dialog", async () => {
    const asset = createAsset("hero", { filename: "hero.jpg" });
    const replace = vi.fn(async (id: string) => createAsset(id));
    await mountModal(
      fakeProvider({
        list: vi.fn(async () => ({ items: [asset] })),
        replace,
      }),
    );

    document
      .querySelector<HTMLButtonElement>('[data-testid="media-replace"]')!
      .click();
    await flushPromises();

    expect(document.querySelector("#tpl-media-replace-title")).not.toBeNull();

    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(["bytes"], "hero.jpg", { type: "image/jpeg" });
    Object.defineProperty(input, "files", { value: { 0: file, length: 1 } });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await flushPromises();

    const go = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Replace",
    )!;
    go.click();
    await flushPromises();

    expect(replace).toHaveBeenCalledWith("hero", file);
  });

  it("moves the selection into a folder from the picker", async () => {
    const asset = createAsset("hero");
    const move = vi.fn(async () => [asset]);
    await mountModal(
      fakeProvider({
        list: vi.fn(async () => ({ items: [asset] })),
        folders: {
          list: vi.fn(async () => [
            { id: "f1", name: "Heroes", parentId: null },
          ]),
          create: vi.fn(async ({ name }) => ({ id: "f2", name })),
          update: vi.fn(async (id, { name }) => ({ id, name })),
          delete: vi.fn(async () => {}),
          move,
        },
      }),
    );

    document
      .querySelector<HTMLElement>('[data-testid="media-library-item"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();

    document
      .querySelector<HTMLButtonElement>('[data-testid="media-folder-toggle"]')!
      .click();
    await flushPromises();

    const moveBtn = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Move",
    );
    expect(moveBtn).not.toBeUndefined();
    moveBtn!.click();
    await flushPromises();

    const picker = document.querySelector('[data-testid="media-move-picker"]');
    expect(picker).not.toBeNull();
    const target = Array.from(picker!.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Heroes"),
    );
    expect(target).not.toBeUndefined();
    target!.click();
    await flushPromises();

    expect(move).toHaveBeenCalledWith(["hero"], "f1");
  });
});
