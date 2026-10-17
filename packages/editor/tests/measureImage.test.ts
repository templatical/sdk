// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { measureImage } from "../src/utils/measureImage";
import { FAKE_IMAGE_LOAD_MS, stubImages } from "./helpers/fakeImage";

describe("measureImage", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("resolves the image's natural size", async () => {
    vi.useFakeTimers();
    stubImages({ "https://cdn.test/a.jpg": { width: 1200, height: 800 } });
    const size = measureImage("https://cdn.test/a.jpg");
    await vi.advanceTimersByTimeAsync(FAKE_IMAGE_LOAD_MS);
    await expect(size).resolves.toEqual({ width: 1200, height: 800 });
  });

  it("resolves null when the image fails to load", async () => {
    vi.useFakeTimers();
    stubImages({});
    const size = measureImage("https://cdn.test/missing.jpg");
    await vi.advanceTimersByTimeAsync(FAKE_IMAGE_LOAD_MS);
    await expect(size).resolves.toBeNull();
  });

  it("resolves null for an image that reports no size", async () => {
    vi.useFakeTimers();
    stubImages({ "https://cdn.test/empty.svg": { width: 0, height: 0 } });
    const size = measureImage("https://cdn.test/empty.svg");
    await vi.advanceTimersByTimeAsync(FAKE_IMAGE_LOAD_MS);
    await expect(size).resolves.toBeNull();
  });
});
