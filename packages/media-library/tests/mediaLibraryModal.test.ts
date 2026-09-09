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
});
