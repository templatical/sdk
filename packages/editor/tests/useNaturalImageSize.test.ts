import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, effectScope, nextTick, ref } from "vue";
import {
  useMeasureNaturalSize,
  useNaturalImageSize,
} from "../src/composables/useNaturalImageSize";
import {
  createImageUrlResolver,
  type ResolveImageUrl,
} from "../src/composables/useImageUrlResolver";
import { NATURAL_SIZE_TIMEOUT_MS } from "../src/constants/timeouts";
import { IMAGE_URL_RESOLVER_KEY } from "../src/keys";
import {
  measureNaturalSize,
  naturalSizeFields,
  naturalSizeOf,
  toNaturalSize,
} from "../src/utils/imageNaturalSize";
import { FAKE_IMAGE_LOAD_MS, stubImages } from "./helpers/fakeImage";

// Records every image the composable loads, so a test decides when (and in
// what order) they finish.
const loads: FakeImage[] = [];
class FakeImage {
  naturalWidth = 0;
  naturalHeight = 0;
  onload: (() => void) | null = null;
  src = "";
  constructor() {
    loads.push(this);
  }
  finish(width: number, height: number): void {
    this.naturalWidth = width;
    this.naturalHeight = height;
    this.onload?.();
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  loads.length = 0;
});

function measure(initial: string | undefined) {
  vi.stubGlobal("Image", FakeImage);
  const url = ref(initial);
  const scope = effectScope();
  const size = scope.run(() => useNaturalImageSize(() => url.value))!;
  return { url, size };
}

describe("useNaturalImageSize", () => {
  it("measures the image at the URL", () => {
    const { size } = measure("https://cdn.test/a.png");
    expect(loads.map((image) => image.src)).toEqual(["https://cdn.test/a.png"]);
    expect(size.value).toBeNull();
    loads[0].finish(1200, 400);
    expect(size.value).toEqual({ width: 1200, height: 400 });
  });

  it("loads nothing without a URL", () => {
    const { size } = measure(undefined);
    expect(loads).toHaveLength(0);
    expect(size.value).toBeNull();
  });

  it("drops a load that finishes after the URL moved on", async () => {
    const { url, size } = measure("https://cdn.test/a.png");
    url.value = "https://cdn.test/b.png";
    await nextTick();
    loads[1].finish(300, 300);
    loads[0].finish(1200, 400);
    expect(size.value).toEqual({ width: 300, height: 300 });
  });

  it("resets while a new URL loads, and when the URL goes away", async () => {
    const { url, size } = measure("https://cdn.test/a.png");
    loads[0].finish(1200, 400);
    url.value = undefined;
    await nextTick();
    expect(size.value).toBeNull();
  });

  it("reads a broken image (0 × 0) as no size", () => {
    const { size } = measure("https://cdn.test/a.png");
    loads[0].finish(0, 0);
    expect(size.value).toBeNull();
  });
});

describe("imageNaturalSize", () => {
  it("needs both dimensions, positive and finite", () => {
    expect(toNaturalSize(1200, 400)).toEqual({ width: 1200, height: 400 });
    expect(toNaturalSize(1200, undefined)).toBeNull();
    expect(toNaturalSize(0, 400)).toBeNull();
    expect(toNaturalSize(Number.POSITIVE_INFINITY, 400)).toBeNull();
    expect(toNaturalSize("1200", 400)).toBeNull();
  });

  it("reads a block's stored size", () => {
    expect(naturalSizeOf({ naturalWidth: 10, naturalHeight: 20 })).toEqual({
      width: 10,
      height: 20,
    });
    expect(naturalSizeOf({ naturalWidth: 10 })).toBeNull();
  });

  it("sets both fields or clears both", () => {
    expect(naturalSizeFields({ width: 10, height: 20 })).toStrictEqual({
      naturalWidth: 10,
      naturalHeight: 20,
    });
    expect(naturalSizeFields(null)).toStrictEqual({
      naturalWidth: undefined,
      naturalHeight: undefined,
    });
  });
});

describe("measureNaturalSize", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves the image's natural size", async () => {
    vi.useFakeTimers();
    stubImages({ "https://cdn.test/a.jpg": { width: 1200, height: 800 } });
    const size = measureNaturalSize("https://cdn.test/a.jpg");
    await vi.advanceTimersByTimeAsync(FAKE_IMAGE_LOAD_MS);
    await expect(size).resolves.toEqual({ width: 1200, height: 800 });
  });

  it("resolves null when the image fails to load", async () => {
    vi.useFakeTimers();
    stubImages({});
    const size = measureNaturalSize("https://cdn.test/missing.jpg");
    await vi.advanceTimersByTimeAsync(FAKE_IMAGE_LOAD_MS);
    await expect(size).resolves.toBeNull();
  });

  it("resolves null for an image that reports no size", async () => {
    vi.useFakeTimers();
    stubImages({ "https://cdn.test/empty.svg": { width: 0, height: 0 } });
    const size = measureNaturalSize("https://cdn.test/empty.svg");
    await vi.advanceTimersByTimeAsync(FAKE_IMAGE_LOAD_MS);
    await expect(size).resolves.toBeNull();
  });

  it("gives up on an image that never loads", async () => {
    vi.useFakeTimers();
    let settled: unknown = "pending";
    vi.stubGlobal(
      "Image",
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        src = "";
      },
    );
    void measureNaturalSize("https://cdn.test/stalled.jpg").then((size) => {
      settled = size;
    });
    await vi.advanceTimersByTimeAsync(NATURAL_SIZE_TIMEOUT_MS - 1);
    expect(settled).toBe("pending");
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBeNull();
  });
});

describe("useMeasureNaturalSize", () => {
  const STORED = "logo.png";

  afterEach(() => {
    vi.useRealTimers();
  });

  function measurer(resolve?: ResolveImageUrl) {
    const app = createApp({});
    if (resolve) app.provide(IMAGE_URL_RESOLVER_KEY, createImageUrlResolver(resolve));
    return app.runWithContext(() => useMeasureNaturalSize());
  }

  it("measures the stored url without a resolver", async () => {
    vi.useFakeTimers();
    const images = stubImages({ [STORED]: { width: 40, height: 20 } });
    const size = measurer()(STORED);
    await vi.advanceTimersByTimeAsync(FAKE_IMAGE_LOAD_MS);
    await expect(size).resolves.toEqual({ width: 40, height: 20 });
    expect(images.requested).toEqual([STORED]);
  });

  it("measures the url a resolver displays", async () => {
    vi.useFakeTimers();
    const images = stubImages({ "blob:logo": { width: 40, height: 20 } });
    const size = measurer(() => "blob:logo")(STORED);
    await vi.advanceTimersByTimeAsync(FAKE_IMAGE_LOAD_MS);
    await expect(size).resolves.toEqual({ width: 40, height: 20 });
    expect(images.requested).toEqual(["blob:logo"]);
  });

  it("waits for an async resolver before loading", async () => {
    vi.useFakeTimers();
    const images = stubImages({ "blob:logo": { width: 40, height: 20 } });
    let answer: (url: string) => void = () => {};
    const size = measurer(
      () => new Promise<string>((resolve) => (answer = resolve)),
    )(STORED);
    await vi.advanceTimersByTimeAsync(FAKE_IMAGE_LOAD_MS);
    expect(images.requested).toEqual([]);

    answer("blob:logo");
    await vi.advanceTimersByTimeAsync(FAKE_IMAGE_LOAD_MS);
    await expect(size).resolves.toEqual({ width: 40, height: 20 });
    expect(images.requested).toEqual(["blob:logo"]);
  });

  it("measures the stored url when the resolver opts out", async () => {
    vi.useFakeTimers();
    const images = stubImages({ [STORED]: { width: 40, height: 20 } });
    const size = measurer(async () => null)(STORED);
    await vi.advanceTimersByTimeAsync(FAKE_IMAGE_LOAD_MS);
    await expect(size).resolves.toEqual({ width: 40, height: 20 });
    expect(images.requested).toEqual([STORED]);
  });
});

describe("measuring without an Image constructor", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reports no size, as on a server render", async () => {
    vi.stubGlobal("Image", undefined);
    await expect(
      measureNaturalSize("https://cdn.test/a.jpg"),
    ).resolves.toBeNull();
  });
});
