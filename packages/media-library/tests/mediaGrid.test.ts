// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import type { MediaAsset } from "@templatical/types";
import { MEDIA_LIMITS_KEY, UI_LOCALE_KEY } from "../src/keys";

const observers = vi.hoisted(() => ({
  cbs: [] as Array<(entries: Array<{ isIntersecting: boolean }>) => void>,
}));

vi.mock("@vueuse/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@vueuse/core")>();
  return {
    ...actual,
    useIntersectionObserver: (
      _el: unknown,
      cb: (entries: Array<{ isIntersecting: boolean }>) => void,
    ) => {
      observers.cbs.push(cb);
      return { stop: vi.fn() };
    },
  };
});

import MediaGrid from "../src/components/media/MediaGrid.vue";

function createAsset(
  id: string,
  overrides: Partial<MediaAsset> = {},
): MediaAsset {
  return {
    id,
    url: `https://cdn.example.com/${id}.jpg`,
    filename: `${id}.jpg`,
    mimeType: "image/jpeg",
    size: 2048,
    thumbnailUrl: `https://cdn.example.com/${id}-thumb.jpg`,
    width: 800,
    height: 600,
    createdAt: "2026-01-15T00:00:00Z",
    ...overrides,
  };
}

const wrappers: VueWrapper[] = [];

function mountGrid(
  extra: Record<string, unknown> = {},
  limits: Record<string, unknown> = {},
): VueWrapper {
  const wrapper = mount(MediaGrid, {
    props: {
      items: [createAsset("hero")],
      selectedIds: new Set<string>(),
      isLoading: false,
      hasMore: false,
      canUpdate: true,
      canReplace: true,
      ...extra,
    },
    global: {
      provide: {
        [MEDIA_LIMITS_KEY]: limits,
        [UI_LOCALE_KEY]: ref("en"),
      },
    },
  });
  wrappers.push(wrapper);
  return wrapper;
}

afterEach(() => {
  while (wrappers.length) {
    wrappers.pop()?.unmount();
  }
  observers.cbs = [];
});

describe("MediaGrid", () => {
  it("selects on click, toggles on modifier-click, confirms on double-click", async () => {
    const wrapper = mountGrid();
    const item = wrapper.get('[data-testid="media-library-item"]');

    await item.trigger("click");
    expect(wrapper.emitted("select")?.[0]?.[0]).toMatchObject({ id: "hero" });

    await item.trigger("click", { metaKey: true });
    expect(wrapper.emitted("toggle")).toEqual([["hero"]]);

    await item.trigger("dblclick");
    expect(wrapper.emitted("confirm")?.[0]?.[0]).toMatchObject({ id: "hero" });
  });

  it("selects from Enter and Space", async () => {
    const wrapper = mountGrid();
    const item = wrapper.get('[data-testid="media-library-item"]');
    await item.trigger("keydown", { key: "Enter" });
    await item.trigger("keydown", { key: " " });
    await item.trigger("keydown", { key: "a" });
    expect(wrapper.emitted("select")).toHaveLength(2);
  });

  it("does not confirm a file the accept filter rejects", async () => {
    const wrapper = mountGrid(
      {
        items: [
          createAsset("doc", {
            mimeType: "application/pdf",
            filename: "doc.pdf",
            url: "https://cdn.example.com/doc.pdf",
          }),
        ],
        accept: ["images"],
      },
      {
        mimeTypes: {
          images: ["image/jpeg"],
          documents: ["application/pdf"],
        },
      },
    );
    await wrapper.get('[data-testid="media-library-item"]').trigger("dblclick");
    expect(wrapper.emitted("confirm")).toBeUndefined();
  });

  it("hides edit and replace when the provider or the entry forbids them", () => {
    const wrapper = mountGrid({
      items: [createAsset("locked", { canUpdate: false }), createAsset("open")],
      canUpdate: true,
      canReplace: true,
    });
    expect(
      wrapper
        .find('[data-media-id="locked"] [data-testid="media-edit"]')
        .exists(),
    ).toBe(false);
    expect(
      wrapper
        .find('[data-media-id="open"] [data-testid="media-edit"]')
        .exists(),
    ).toBe(true);

    const noMutations = mountGrid({ canUpdate: false, canReplace: false });
    wrappers.push(noMutations);
    expect(noMutations.find('[data-testid="media-edit"]').exists()).toBe(false);
    expect(noMutations.find('[data-testid="media-replace"]').exists()).toBe(
      false,
    );
  });

  it("emits edit and replace without selecting the card", async () => {
    const wrapper = mountGrid();
    await wrapper.get('[data-testid="media-edit"]').trigger("click");
    await wrapper.get('[data-testid="media-replace"]').trigger("click");
    expect(wrapper.emitted("select")).toBeUndefined();
    expect(wrapper.emitted("edit")?.[0]?.[0]).toMatchObject({ id: "hero" });
    expect(wrapper.emitted("replace")?.[0]?.[0]).toMatchObject({
      id: "hero",
    });
  });

  it("falls back to url when there is no thumbnail", () => {
    const wrapper = mountGrid({
      items: [createAsset("hero", { thumbnailUrl: undefined })],
    });
    expect(wrapper.get("img").attributes("src")).toBe(
      "https://cdn.example.com/hero.jpg",
    );
  });

  it("shows the search empty state rather than the generic one", () => {
    const searching = mountGrid({ items: [], searchQuery: "logo" });
    expect(searching.text()).toBe("No files match your search");

    const empty = mountGrid({ items: [], searchQuery: "" });
    expect(empty.text()).toBe("No files found");
  });

  it("formats byte sizes on the card", () => {
    const wrapper = mountGrid({
      items: [
        createAsset("tiny", { size: 512 }),
        createAsset("kilo", { size: 2048 }),
        createAsset("mega", { size: 2 * 1024 * 1024 }),
      ],
    });
    expect(wrapper.text()).toContain("512 B");
    expect(wrapper.text()).toContain("2.0 KB");
    expect(wrapper.text()).toContain("2.0 MB");
  });

  it("asks for the next page when the sentinel intersects", async () => {
    const wrapper = mountGrid({ hasMore: true, isLoading: false });
    expect(observers.cbs).toHaveLength(1);

    observers.cbs[0]([{ isIntersecting: false }]);
    expect(wrapper.emitted("loadMore")).toBeUndefined();

    observers.cbs[0]([{ isIntersecting: true }]);
    expect(wrapper.emitted("loadMore")).toHaveLength(1);

    await wrapper.setProps({ isLoading: true, items: [createAsset("hero")] });
    await nextTick();
    observers.cbs[0]([{ isIntersecting: true }]);
    expect(wrapper.emitted("loadMore")).toHaveLength(1);
  });

  it("renders list layout with the created date", () => {
    const wrapper = mountGrid({ layout: "list" });
    expect(wrapper.find(".tpl-media-list-item").exists()).toBe(true);
    expect(wrapper.text()).toContain("Jan");
  });
});
