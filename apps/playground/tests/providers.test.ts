import { describe, expect, it } from "vitest";
import {
  commentsProviderFor,
  providerCacheKey,
  savedBlocksProviderFor,
  templatesProviderFor,
  versionHistoryProviderFor,
} from "../src/host/providers";

const memory = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
    clear: () => memory.clear(),
  },
  configurable: true,
});

describe("providerCacheKey", () => {
  it("includes readonly, delay, and autosave so variants do not collide", () => {
    expect(providerCacheKey("templates")).toBe("templates:rw:delay=0:manual");
    expect(providerCacheKey("templates", { readonly: true })).toBe(
      "templates:readonly:delay=0:manual",
    );
    expect(providerCacheKey("saved-blocks", { delay: 2000 })).toBe(
      "saved-blocks:rw:delay=2000:manual",
    );
    expect(providerCacheKey("templates", { autosave: true })).toBe(
      "templates:rw:delay=0:autosave",
    );
  });
});

describe("provider caches", () => {
  it("does not reuse a readonly templates provider for the writable variant", () => {
    const ro = templatesProviderFor("unit-templates-pin", { readonly: true });
    const rw = templatesProviderFor("unit-templates-pin");
    expect(ro.create).toBe(false);
    expect(typeof rw.create).toBe("function");
    expect(ro).not.toBe(rw);
  });

  it("does not reuse a delayed saved-blocks provider for the default variant", () => {
    const slow = savedBlocksProviderFor("unit-saved-blocks-pin", {
      delay: 2000,
    });
    const fast = savedBlocksProviderFor("unit-saved-blocks-pin");
    expect(slow).not.toBe(fast);
  });

  it("does not reuse a readonly comments provider for the writable variant", () => {
    const ro = commentsProviderFor("unit-comments-pin", { readonly: true });
    const rw = commentsProviderFor("unit-comments-pin");
    expect(ro.create).toBe(false);
    expect(typeof rw.create).toBe("function");
  });

  it("does not reuse a readonly version-history provider for the writable variant", () => {
    const ro = versionHistoryProviderFor("unit-version-history-pin", {
      readonly: true,
    });
    const rw = versionHistoryProviderFor("unit-version-history-pin");
    expect(ro.restore).toBe(false);
    expect(typeof rw.restore).toBe("function");
  });
});
