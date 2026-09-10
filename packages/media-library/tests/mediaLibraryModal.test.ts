// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import type { MediaAsset, MediaProvider } from "@templatical/types";
import MediaLibraryModal from "../src/components/MediaLibraryModal.vue";

const SRC = join(import.meta.dirname, "..", "src");

function readSrc(relPath: string): string {
  return readFileSync(join(SRC, relPath), "utf8");
}

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
      list: vi.fn(async () => []),
      create: vi.fn(async ({ name }) => ({ id: "f1", name })),
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

async function mountModal(
  provider: MediaProvider,
  extra: Record<string, unknown> = {},
): Promise<VueWrapper> {
  const wrapper = mount(MediaLibraryModal, {
    props: {
      visible: true,
      provider,
      locale: "en",
      ...extra,
    },
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

describe("MediaLibraryModal source contract", () => {
  it("does not contain conversion picker, AuthManager, or plan config", () => {
    const source = readSrc("components/MediaLibraryModal.vue");
    for (const banned of [
      "small_url",
      "medium_url",
      "large_url",
      "selectedConversion",
      "authManager",
      "planConfig",
    ]) {
      expect(source, banned).not.toContain(banned);
    }
    expect(source).toContain("provider");
    expect(source).toMatch(/max-height:\s*90%/);
    expect(source).toMatch(/tpl:z-10/);
    expect(source).not.toMatch(/z-\[9999\]/);
  });

  it("preview panel has no conversion picker", () => {
    const source = readSrc("components/media/MediaPreviewPanel.vue");
    for (const banned of [
      "small_url",
      "medium_url",
      "large_url",
      "selectedConversion",
      "conversionLabel",
      "conversionSmall",
      "conversionMedium",
      "conversionLarge",
      "conversionOriginal",
    ]) {
      expect(source, banned).not.toContain(banned);
    }
  });

  it("grid thumbs from thumbnailUrl falling back to url", () => {
    const source = readSrc("components/media/MediaGrid.vue");
    expect(source).toContain("thumbnailUrl");
    expect(source).not.toContain("small_url");
  });

  it("declares provider as a required prop", () => {
    const props = MediaLibraryModal.props as Record<
      string,
      { required?: boolean }
    >;
    expect(Object.keys(props).sort()).toEqual([
      "accept",
      "locale",
      "onError",
      "popoverTarget",
      "provider",
      "templateId",
      "uiTheme",
      "visible",
    ]);
    expect(props.provider.required).toBe(true);
    expect(props.visible.required).toBe(true);
    expect(props.templateId.required).toBeFalsy();
  });
});

describe("MediaLibraryModal chrome", () => {
  it("hides the upload zone when create is false", async () => {
    const shown = fakeProvider();
    await mountModal(shown);
    expect(
      document.querySelector('[data-testid="media-upload-zone"]'),
    ).not.toBeNull();

    wrappers.pop()?.unmount();
    document.body.innerHTML = "";

    await mountModal(fakeProvider({ create: false }));
    expect(
      document.querySelector('[data-testid="media-upload-zone"]'),
    ).toBeNull();
  });

  it("hides the folder tree and toggle when folders is false", async () => {
    const withFolders = fakeProvider();
    await mountModal(withFolders);
    expect(
      document.querySelector('[data-testid="media-folder-toggle"]'),
    ).not.toBeNull();

    wrappers.pop()?.unmount();
    document.body.innerHTML = "";

    await mountModal(fakeProvider({ folders: false }));
    expect(
      document.querySelector('[data-testid="media-folder-toggle"]'),
    ).toBeNull();
    expect(
      document.querySelector('[data-testid="media-folder-tree"]'),
    ).toBeNull();
  });

  it("disables Confirm until a preview item is selected", async () => {
    const asset = createAsset("hero");
    const provider = fakeProvider({
      list: vi.fn(async () => ({ items: [asset] })),
    });
    const wrapper = await mountModal(provider);

    const confirm = document.querySelector<HTMLButtonElement>(
      '[data-testid="media-confirm"]',
    );
    expect(confirm).not.toBeNull();
    expect(confirm!.disabled).toBe(true);

    const item = document.querySelector<HTMLElement>(".tpl-media-item");
    expect(item).not.toBeNull();
    await item!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();

    expect(confirm!.disabled).toBe(false);

    await confirm!.click();
    await flushPromises();

    const emitted = wrapper.emitted("select");
    expect(emitted).toEqual([[asset]]);
  });

  it("keeps Confirm disabled when the preview item does not match accept", async () => {
    const pdf = createAsset("doc", { mimeType: "application/pdf" });
    const provider = fakeProvider({
      list: vi.fn(async () => ({ items: [pdf] })),
      mimeTypes: {
        images: ["image/jpeg"],
        documents: ["application/pdf"],
      },
    });
    await mountModal(provider, { accept: ["images"] });

    const item = document.querySelector<HTMLElement>(".tpl-media-item");
    expect(item).not.toBeNull();
    item!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();

    const confirm = document.querySelector<HTMLButtonElement>(
      '[data-testid="media-confirm"]',
    );
    expect(confirm).not.toBeNull();
    expect(confirm!.disabled).toBe(true);
  });

  it("lists with category when accept has a single entry", async () => {
    const list = vi.fn(async () => ({ items: [] }));
    await mountModal(fakeProvider({ list }), { accept: ["images"] });

    expect(list).toHaveBeenCalledWith({ category: "images" });
  });

  it("reopens without the previous search", async () => {
    vi.useFakeTimers();
    const list = vi.fn(async () => ({ items: [] }));
    const wrapper = await mountModal(fakeProvider({ list }));

    const input = document.querySelector<HTMLInputElement>(
      '.tpl-media-modal input[type="text"]',
    );
    expect(input).not.toBeNull();
    input!.value = "logo";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    expect(list).toHaveBeenCalledWith({ search: "logo" });

    await wrapper.setProps({ visible: false });
    await flushPromises();
    await wrapper.setProps({ visible: true });
    await flushPromises();

    expect(list.mock.calls.at(-1)?.[0]).toEqual({});
    expect(list.mock.calls.at(-1)?.[0]).not.toHaveProperty("search");
    vi.useRealTimers();
  });

  it("hides import when importFromUrl is false", async () => {
    await mountModal(fakeProvider());
    expect(
      document.querySelector('[data-testid="media-import-url"]'),
    ).not.toBeNull();

    wrappers.pop()?.unmount();
    document.body.innerHTML = "";

    await mountModal(fakeProvider({ importFromUrl: false }));
    expect(
      document.querySelector('[data-testid="media-import-url"]'),
    ).toBeNull();
  });

  it("hides edit and replace when those methods are false", async () => {
    const asset = createAsset("hero");
    await mountModal(
      fakeProvider({
        list: vi.fn(async () => ({ items: [asset] })),
      }),
    );
    expect(document.querySelector('[data-testid="media-edit"]')).not.toBeNull();
    expect(
      document.querySelector('[data-testid="media-replace"]'),
    ).not.toBeNull();

    wrappers.pop()?.unmount();
    document.body.innerHTML = "";

    await mountModal(
      fakeProvider({
        list: vi.fn(async () => ({ items: [asset] })),
        update: false,
        replace: false,
      }),
    );
    expect(document.querySelector('[data-testid="media-edit"]')).toBeNull();
    expect(document.querySelector('[data-testid="media-replace"]')).toBeNull();
  });

  it("hides per-entry edit and delete when canUpdate/canDelete are false", async () => {
    const locked = createAsset("locked", {
      canUpdate: false,
      canDelete: false,
    });
    const open = createAsset("open");
    await mountModal(
      fakeProvider({
        list: vi.fn(async () => ({ items: [locked, open] })),
      }),
    );

    expect(
      document.querySelector(
        '[data-media-id="locked"] [data-testid="media-edit"]',
      ),
    ).toBeNull();
    expect(
      document.querySelector(
        '[data-media-id="locked"] [data-testid="media-replace"]',
      ),
    ).toBeNull();
    expect(
      document.querySelector(
        '[data-media-id="open"] [data-testid="media-edit"]',
      ),
    ).not.toBeNull();

    document
      .querySelector<HTMLElement>('[data-media-id="locked"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();
    expect(document.querySelector('[data-testid="media-delete"]')).toBeNull();

    document
      .querySelector<HTMLElement>('[data-media-id="open"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();
    expect(
      document.querySelector('[data-testid="media-delete"]'),
    ).not.toBeNull();
  });

  it("hides delete when delete is false", async () => {
    const asset = createAsset("hero");
    await mountModal(
      fakeProvider({
        list: vi.fn(async () => ({ items: [asset] })),
        delete: false,
      }),
    );
    document
      .querySelector<HTMLElement>(".tpl-media-item")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();
    expect(document.querySelector('[data-testid="media-delete"]')).toBeNull();
  });

  it("hides the frequently-used tab when frequentlyUsed is false", async () => {
    const shown = fakeProvider({
      frequentlyUsed: vi.fn(async () => [createAsset("freq")]),
    });
    await mountModal(shown);
    document
      .querySelector<HTMLElement>('[data-testid="media-folder-toggle"]')!
      .click();
    await flushPromises();
    expect(
      document.querySelector('[data-testid="media-frequently-used"]'),
    ).not.toBeNull();

    wrappers.pop()?.unmount();
    document.body.innerHTML = "";

    await mountModal(fakeProvider({ frequentlyUsed: false }));
    document
      .querySelector<HTMLElement>('[data-testid="media-folder-toggle"]')!
      .click();
    await flushPromises();
    expect(
      document.querySelector('[data-testid="media-frequently-used"]'),
    ).toBeNull();
  });

  it("hides the quota ring when storage is false", async () => {
    await mountModal(
      fakeProvider({
        storage: vi.fn(async () => ({ usedBytes: 10, limitBytes: 100 })),
      }),
    );
    expect(
      document.querySelector('[data-testid="media-storage-ring"]'),
    ).not.toBeNull();

    wrappers.pop()?.unmount();
    document.body.innerHTML = "";

    await mountModal(fakeProvider({ storage: false }));
    expect(
      document.querySelector('[data-testid="media-storage-ring"]'),
    ).toBeNull();
  });

  it("shows the usage warning when checkUsage reports templates", async () => {
    const asset = createAsset("hero");
    await mountModal(
      fakeProvider({
        list: vi.fn(async () => ({ items: [asset] })),
        checkUsage: vi.fn(async () => ({
          hero: { templateCount: 2, templateNames: ["Welcome", "Digest"] },
        })),
      }),
    );
    document
      .querySelector<HTMLElement>(".tpl-media-item")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();
    document
      .querySelector<HTMLButtonElement>('[data-testid="media-delete"]')!
      .click();
    await flushPromises();

    expect(
      document.querySelector('[data-testid="media-delete-usage"]'),
    ).not.toBeNull();
  });
});

describe("MediaLibraryModal onError", () => {
  it("forwards list failures to the onError prop", async () => {
    const onError = vi.fn();
    await mountModal(
      fakeProvider({
        list: vi.fn(async () => {
          throw new Error("list failed");
        }),
      }),
      { onError },
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message).toBe("list failed");
  });
});

describe("standalone shell mutation flags", () => {
  it("derives canUpdate/canReplace/folder flags from typeof, not hardcoded true", () => {
    const source = readSrc("standalone/MediaLibrary.vue");
    expect(source).toMatch(/:can-update="/);
    expect(source).toMatch(/:can-replace="/);
    expect(source).toMatch(/:can-create-folder="/);
    expect(source).toMatch(/:can-rename-folder="/);
    expect(source).toMatch(/:can-delete-folder="/);
    expect(source).toMatch(/typeof props\.provider\.update === "function"/);
    expect(source).toMatch(/typeof props\.provider\.replace === "function"/);
    expect(source).not.toMatch(/const canUpdate = true/);
    expect(source).not.toMatch(/const canReplace = true/);
  });
});
