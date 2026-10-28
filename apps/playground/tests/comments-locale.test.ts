import { afterEach, describe, expect, it, vi } from "vitest";
import { commentsProviderFor } from "../src/host/providers";

afterEach(() => vi.unstubAllGlobals());

describe("playground comment languages", () => {
  it.each(["en", "de"])(
    "persists %s on roots and replies through list",
    async (locale) => {
      const storage = new Map<string, string>();
      vi.stubGlobal("localStorage", {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      });
      const provider = commentsProviderFor(`comment-locale-${locale}`);
      if (!provider.create) throw new Error("Comments must be writable");
      const root = await provider.create("tpl-1", { body: "Root", locale });
      const reply = await provider.create("tpl-1", {
        body: "Reply",
        parentId: root.id,
        locale,
      });
      expect(root.locale).toBe(locale);
      expect(reply.locale).toBe(locale);
      const [stored] = await provider.list("tpl-1");
      expect(stored.locale).toBe(locale);
      expect(stored.replies?.[0].locale).toBe(locale);
    },
  );
});
