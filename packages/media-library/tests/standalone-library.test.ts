// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import type { MediaAsset, MediaProvider } from "@templatical/types";
import MediaLibrary from "../src/standalone/MediaLibrary.vue";
import en from "../src/i18n/locales/en";

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

async function mountLibrary(
  provider: MediaProvider,
  extra: Record<string, unknown> = {},
): Promise<VueWrapper> {
  const wrapper = mount(MediaLibrary, {
    props: {
      provider,
      translations: en,
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

describe("standalone MediaLibrary source", () => {
  it("takes a provider and derives chrome from typeof, not hardcoded true", () => {
    const source = readSrc("standalone/MediaLibrary.vue");
    expect(source).toContain("provider: MediaProvider");
    expect(source).not.toContain("authManager");
    expect(source).not.toContain("planConfig");
    expect(source).not.toContain("projectId");
    expect(source).toMatch(/typeof props\.provider\.update === "function"/);
    expect(source).toMatch(/typeof props\.provider\.replace === "function"/);
    expect(source).toMatch(/typeof folders\.create === "function"/);
    expect(source).not.toMatch(/const canUpdate = true/);
    expect(source).not.toMatch(/const canReplace = true/);
    expect(source).not.toContain("sortNewest");
  });

  it("declares provider as a required prop", () => {
    const props = MediaLibrary.props as Record<string, { required?: boolean }>;
    expect(Object.keys(props).sort()).toEqual([
      "accept",
      "locale",
      "onSelect",
      "provider",
      "translations",
    ]);
    expect(props.provider.required).toBe(true);
    expect(props.translations.required).toBe(true);
  });
});

describe("standalone MediaLibrary chrome", () => {
  it("hides the upload zone when create is false", async () => {
    await mountLibrary(fakeProvider());
    expect(
      document.querySelector('[data-testid="media-upload-zone"]'),
    ).not.toBeNull();

    wrappers.pop()?.unmount();
    document.body.innerHTML = "";

    await mountLibrary(fakeProvider({ create: false }));
    expect(
      document.querySelector('[data-testid="media-upload-zone"]'),
    ).toBeNull();
  });

  it("hides the folder tree and toggle when folders is false", async () => {
    await mountLibrary(fakeProvider());
    expect(
      document.querySelector('[data-testid="media-folder-toggle"]'),
    ).not.toBeNull();

    wrappers.pop()?.unmount();
    document.body.innerHTML = "";

    await mountLibrary(fakeProvider({ folders: false }));
    expect(
      document.querySelector('[data-testid="media-folder-toggle"]'),
    ).toBeNull();
    expect(
      document.querySelector('[data-testid="media-folder-tree"]'),
    ).toBeNull();
  });

  it("hides import when importFromUrl is false", async () => {
    await mountLibrary(fakeProvider());
    expect(
      document.querySelector('[data-testid="media-import-url"]'),
    ).not.toBeNull();

    wrappers.pop()?.unmount();
    document.body.innerHTML = "";

    await mountLibrary(fakeProvider({ importFromUrl: false }));
    expect(
      document.querySelector('[data-testid="media-import-url"]'),
    ).toBeNull();
  });

  it("hides edit and replace when those methods are false", async () => {
    const asset = createAsset("hero");
    await mountLibrary(
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

    await mountLibrary(
      fakeProvider({
        list: vi.fn(async () => ({ items: [asset] })),
        update: false,
        replace: false,
      }),
    );
    expect(document.querySelector('[data-testid="media-edit"]')).toBeNull();
    expect(document.querySelector('[data-testid="media-replace"]')).toBeNull();
  });

  it("hides delete when delete is false", async () => {
    const asset = createAsset("hero");
    await mountLibrary(
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

  it("hides the quota ring when storage is false", async () => {
    await mountLibrary(
      fakeProvider({
        storage: vi.fn(async () => ({ usedBytes: 10, limitBytes: 100 })),
      }),
    );
    expect(
      document.querySelector('[data-testid="media-storage-ring"]'),
    ).not.toBeNull();

    wrappers.pop()?.unmount();
    document.body.innerHTML = "";

    await mountLibrary(fakeProvider({ storage: false }));
    expect(
      document.querySelector('[data-testid="media-storage-ring"]'),
    ).toBeNull();
  });

  it("hides the frequently-used tab when frequentlyUsed is false", async () => {
    await mountLibrary(
      fakeProvider({
        frequentlyUsed: vi.fn(async () => [createAsset("freq")]),
      }),
    );
    document
      .querySelector<HTMLElement>('[data-testid="media-folder-toggle"]')!
      .click();
    await flushPromises();
    expect(
      document.querySelector('[data-testid="media-frequently-used"]'),
    ).not.toBeNull();

    wrappers.pop()?.unmount();
    document.body.innerHTML = "";

    await mountLibrary(fakeProvider({ frequentlyUsed: false }));
    document
      .querySelector<HTMLElement>('[data-testid="media-folder-toggle"]')!
      .click();
    await flushPromises();
    expect(
      document.querySelector('[data-testid="media-frequently-used"]'),
    ).toBeNull();
  });

  it("lists with category when accept has a single entry", async () => {
    const list = vi.fn(async () => ({ items: [] }));
    await mountLibrary(fakeProvider({ list }), { accept: ["images"] });

    expect(list).toHaveBeenCalledWith({ category: "images" });
  });

  it("omits Select unless onSelect is passed, then emits the preview asset", async () => {
    const asset = createAsset("hero");
    const onSelect = vi.fn();
    await mountLibrary(
      fakeProvider({
        list: vi.fn(async () => ({ items: [asset] })),
      }),
    );
    expect(document.querySelector('[data-testid="media-select"]')).toBeNull();

    wrappers.pop()?.unmount();
    document.body.innerHTML = "";

    await mountLibrary(
      fakeProvider({
        list: vi.fn(async () => ({ items: [asset] })),
      }),
      { onSelect },
    );

    const select = document.querySelector<HTMLButtonElement>(
      '[data-testid="media-select"]',
    );
    expect(select).not.toBeNull();
    expect(select!.disabled).toBe(true);

    document
      .querySelector<HTMLElement>(".tpl-media-item")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();
    expect(select!.disabled).toBe(false);

    select!.click();
    await flushPromises();
    expect(onSelect).toHaveBeenCalledWith(asset);
  });
});
