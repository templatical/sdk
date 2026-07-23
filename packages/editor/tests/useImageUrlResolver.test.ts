// @vitest-environment happy-dom
import "./dom-stubs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref, type Ref } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import {
  createImageUrlResolver,
  useResolvedImageSrc,
  type ResolveImageUrl,
} from "../src/composables/useImageUrlResolver";
import { RESOLVE_IMAGE_DEBOUNCE_MS } from "../src/constants/timeouts";
import { IMAGE_URL_RESOLVER_KEY } from "../src/keys";

// ---------------------------------------------------------------------------
// createImageUrlResolver — per-editor cache around the host callback
// ---------------------------------------------------------------------------

describe("createImageUrlResolver", () => {
  it("caches a sync string result and never calls the resolver twice for one src", () => {
    const resolve = vi.fn((src: string) => `blob:resolved/${src}`);
    const resolver = createImageUrlResolver(resolve);

    resolver.lookup("logo.png");
    expect(resolver.get("logo.png")).toBe("blob:resolved/logo.png");
    expect(resolver.has("logo.png")).toBe(true);

    resolver.lookup("logo.png");
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledWith("logo.png");
  });

  it("caches a sync null result (use-as-is) without retrying", () => {
    const resolve = vi.fn(() => null);
    const resolver = createImageUrlResolver(resolve);

    resolver.lookup("https://cdn.example.com/a.png");
    expect(resolver.get("https://cdn.example.com/a.png")).toBe(null);
    expect(resolver.has("https://cdn.example.com/a.png")).toBe(true);

    resolver.lookup("https://cdn.example.com/a.png");
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it("resolves async values: in-flight lookups report has()=true and settle into the cache", async () => {
    let settle!: (value: string | null) => void;
    const resolve = vi.fn(
      () => new Promise<string | null>((res) => (settle = res)),
    );
    const resolver = createImageUrlResolver(resolve);

    resolver.lookup("logo.png");
    expect(resolver.has("logo.png")).toBe(true);
    expect(resolver.get("logo.png")).toBe(undefined);

    settle("blob:abc123");
    await flushPromises();
    expect(resolver.get("logo.png")).toBe("blob:abc123");
  });

  it("dedupes concurrent lookups for the same src", async () => {
    const resolve = vi.fn(async () => "blob:once");
    const resolver = createImageUrlResolver(resolve);

    resolver.lookup("logo.png");
    resolver.lookup("logo.png");
    resolver.lookup("logo.png");
    await flushPromises();

    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolver.get("logo.png")).toBe("blob:once");
  });

  it("caches null when the resolver throws synchronously", () => {
    const resolve = vi.fn(() => {
      throw new Error("boom");
    });
    const resolver = createImageUrlResolver(resolve);

    resolver.lookup("logo.png");
    expect(resolver.get("logo.png")).toBe(null);

    resolver.lookup("logo.png");
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it("caches null when the resolver rejects", async () => {
    const resolve = vi.fn(() => Promise.reject(new Error("offline")));
    const resolver = createImageUrlResolver(resolve);

    resolver.lookup("logo.png");
    await flushPromises();
    expect(resolver.get("logo.png")).toBe(null);

    resolver.lookup("logo.png");
    await flushPromises();
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it("normalizes a non-string async result (undefined) to null", async () => {
    const resolve = vi.fn(
      () => Promise.resolve(undefined) as unknown as Promise<string | null>,
    );
    const resolver = createImageUrlResolver(resolve);

    resolver.lookup("logo.png");
    await flushPromises();
    expect(resolver.get("logo.png")).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// useResolvedImageSrc — component-facing display value
// ---------------------------------------------------------------------------

interface HarnessResult {
  display: Ref<string | undefined>;
}

function mountHarness(
  src: Ref<string | undefined>,
  resolver: ReturnType<typeof createImageUrlResolver> | null,
) {
  const result = {} as HarnessResult;
  const wrapper = mount(
    defineComponent({
      setup() {
        result.display = useResolvedImageSrc(() => src.value);
        return () => h("div");
      },
    }),
    {
      global: {
        provide: { [IMAGE_URL_RESOLVER_KEY as symbol]: resolver },
      },
    },
  );
  return { wrapper, result };
}

describe("useResolvedImageSrc", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("passes the src through unchanged when no resolver is configured", async () => {
    const src = ref<string | undefined>("logo.png");
    const { result } = mountHarness(src, null);

    expect(result.display.value).toBe("logo.png");

    src.value = "other.png";
    await nextTick();
    expect(result.display.value).toBe("other.png");
  });

  it("resolves the initial src immediately (no debounce) and swaps in the preview URL", async () => {
    const resolve = vi.fn(async (src: string) => `blob:${src}`);
    const resolver = createImageUrlResolver(resolve);
    const src = ref<string | undefined>("logo.png");
    const { result } = mountHarness(src, resolver);

    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledWith("logo.png");
    // Pending: display the canonical src until the lookup settles.
    expect(result.display.value).toBe("logo.png");

    await flushPromises();
    expect(result.display.value).toBe("blob:logo.png");
  });

  it("debounces lookups for subsequent src changes and only resolves the final value", async () => {
    vi.useFakeTimers();
    const resolve = vi.fn((src: string) => `blob:${src}`);
    const resolver = createImageUrlResolver(resolve);
    const src = ref<string | undefined>("initial.png");
    const { result } = mountHarness(src, resolver);
    expect(resolve).toHaveBeenCalledTimes(1);

    // Simulate typing "logo.png" committed per keystroke.
    for (const partial of ["l", "lo", "logo.p", "logo.png"]) {
      src.value = partial;
      await nextTick();
      await vi.advanceTimersByTimeAsync(RESOLVE_IMAGE_DEBOUNCE_MS - 1);
    }
    // No partial value ever reached the host resolver.
    expect(resolve).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(RESOLVE_IMAGE_DEBOUNCE_MS);
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(resolve).toHaveBeenLastCalledWith("logo.png");
    expect(result.display.value).toBe("blob:logo.png");
  });

  it("applies an already-cached src without waiting for the debounce", async () => {
    vi.useFakeTimers();
    const resolve = vi.fn((src: string) => `blob:${src}`);
    const resolver = createImageUrlResolver(resolve);
    resolver.lookup("cached.png");
    expect(resolve).toHaveBeenCalledTimes(1);

    const src = ref<string | undefined>("initial.png");
    const { result } = mountHarness(src, resolver);

    src.value = "cached.png";
    await nextTick();
    expect(result.display.value).toBe("blob:cached.png");
    // Cached hit — no second lookup scheduled for it.
    await vi.advanceTimersByTimeAsync(RESOLVE_IMAGE_DEBOUNCE_MS * 2);
    expect(resolve).toHaveBeenCalledTimes(2); // initial.png + cached.png only
  });

  it("displays the canonical src when the resolver returns null", async () => {
    const resolve = vi.fn(async () => null);
    const resolver = createImageUrlResolver(resolve);
    const src = ref<string | undefined>("https://cdn.example.com/a.png");
    const { result } = mountHarness(src, resolver);

    await flushPromises();
    expect(result.display.value).toBe("https://cdn.example.com/a.png");
  });

  it("never calls the resolver for an empty or undefined src", async () => {
    const resolve = vi.fn(async (src: string) => `blob:${src}`);
    const resolver = createImageUrlResolver(resolve);
    const src = ref<string | undefined>("");
    const { result } = mountHarness(src, resolver);

    src.value = undefined;
    await nextTick();
    await flushPromises();

    expect(resolve).not.toHaveBeenCalled();
    expect(result.display.value).toBe(undefined);
  });

  it("cancels a pending debounced lookup on unmount", async () => {
    vi.useFakeTimers();
    const resolve = vi.fn((src: string) => `blob:${src}`);
    const resolver = createImageUrlResolver(resolve);
    const src = ref<string | undefined>("initial.png");
    const { wrapper } = mountHarness(src, resolver);
    expect(resolve).toHaveBeenCalledTimes(1);

    src.value = "typed.png";
    await nextTick();
    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(RESOLVE_IMAGE_DEBOUNCE_MS * 2);

    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolve).not.toHaveBeenCalledWith("typed.png");
  });

  it("reacts to late resolution while the src is unchanged (cache write is reactive)", async () => {
    let settle!: (value: string | null) => void;
    const resolve: ResolveImageUrl = () =>
      new Promise<string | null>((res) => (settle = res));
    const resolver = createImageUrlResolver(resolve);
    const src = ref<string | undefined>("logo.png");
    const { result } = mountHarness(src, resolver);

    expect(result.display.value).toBe("logo.png");
    settle("blob:late");
    await flushPromises();
    expect(result.display.value).toBe("blob:late");
  });
});
