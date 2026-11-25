// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import { useCountdownImage } from "../src/composables/useCountdownImage";

class FakeImage {
  static instances: FakeImage[] = [];
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = "";
  constructor() { FakeImage.instances.push(this); }
  load() { this.onload?.(); }
  error() { this.onerror?.(); }
}

function setup(initial: string) {
  const scope = effectScope();
  const target = ref(initial);
  const image = scope.run(() => useCountdownImage(() => target.value))!;
  return { scope, target, ...image };
}

beforeEach(() => {
  FakeImage.instances = [];
  vi.stubGlobal("Image", FakeImage);
});
afterEach(() => vi.unstubAllGlobals());

describe("useCountdownImage", () => {
  it("loads the first URL and exposes it only after load", async () => {
    const state = setup("https://example.com/first.gif");
    expect(FakeImage.instances.map((image) => image.src)).toEqual(["https://example.com/first.gif"]);
    expect(state.shownUrl.value).toBe("");
    expect(state.isUpdating.value).toBe(true);
    FakeImage.instances[0].load();
    await nextTick();
    expect(state.shownUrl.value).toBe("https://example.com/first.gif");
    expect(state.isUpdating.value).toBe(false);
    expect(state.failedUrl.value).toBe("");
    state.scope.stop();
  });

  it("records an error only for the current URL", async () => {
    const state = setup("https://example.com/first.gif");
    FakeImage.instances[0].error();
    await nextTick();
    expect(state.shownUrl.value).toBe("");
    expect(state.isUpdating.value).toBe(false);
    expect(state.failedUrl.value).toBe("https://example.com/first.gif");
    state.scope.stop();
  });

  it("ignores stale load and error callbacks and cancels the prior request", async () => {
    const state = setup("https://example.com/first.gif");
    const staleLoad = FakeImage.instances[0].onload;
    const staleError = FakeImage.instances[0].onerror;
    state.target.value = "https://example.com/second.gif";
    await nextTick();
    expect(FakeImage.instances[0].src).toBe("");
    expect(FakeImage.instances[0].onload).toBeNull();
    expect(FakeImage.instances[0].onerror).toBeNull();
    expect(FakeImage.instances[1].src).toBe("https://example.com/second.gif");
    staleLoad?.();
    staleError?.();
    expect(state.shownUrl.value).toBe("");
    expect(state.failedUrl.value).toBe("");
    FakeImage.instances[1].load();
    expect(state.shownUrl.value).toBe("https://example.com/second.gif");
    state.scope.stop();
  });

  it("clears all state when the target becomes empty", async () => {
    const state = setup("https://example.com/first.gif");
    FakeImage.instances[0].load();
    state.target.value = "https://example.com/second.gif";
    await nextTick();
    expect(state.isUpdating.value).toBe(true);
    state.target.value = "";
    await nextTick();
    expect(state.shownUrl.value).toBe("");
    expect(state.isUpdating.value).toBe(false);
    expect(state.failedUrl.value).toBe("");
    expect(FakeImage.instances[1].src).toBe("");
    state.scope.stop();
  });

  it("detaches handlers and cancels the request on scope dispose", () => {
    const state = setup("https://example.com/first.gif");
    state.scope.stop();
    expect(FakeImage.instances[0].onload).toBeNull();
    expect(FakeImage.instances[0].onerror).toBeNull();
    expect(FakeImage.instances[0].src).toBe("");
  });
});
