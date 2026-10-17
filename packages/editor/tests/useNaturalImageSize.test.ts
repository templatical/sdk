import { afterEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import { useNaturalImageSize } from "../src/composables/useNaturalImageSize";
import {
  naturalSizeFields,
  naturalSizeOf,
  toNaturalSize,
} from "../src/utils/imageNaturalSize";

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
