import { describe, expect, it } from "vitest";
import { useEmoji } from "../src/composables/useEmoji";
import { emojiCategories } from "../src/composables/emojiData";
import { nextTick } from "vue";

/** Flush both microtasks and Vue's reactivity queue */
async function flushAll(): Promise<void> {
  await nextTick();
  await new Promise((r) => setTimeout(r, 0));
  await nextTick();
}

describe("useEmoji", () => {
  it("starts closed", () => {
    const { isOpen } = useEmoji();
    expect(isOpen.value).toBe(false);
  });

  it("toggles open", () => {
    const { isOpen, toggle } = useEmoji();

    toggle();
    expect(isOpen.value).toBe(true);

    toggle();
    expect(isOpen.value).toBe(false);
  });

  it("close sets to false", () => {
    const { isOpen, toggle, close } = useEmoji();

    toggle(); // open
    close();
    expect(isOpen.value).toBe(false);
  });

  it("close is idempotent", () => {
    const { isOpen, close } = useEmoji();

    close();
    expect(isOpen.value).toBe(false);
  });

  it("categories starts empty (lazy-loaded)", () => {
    const { categories } = useEmoji();
    expect(categories.value).toEqual([]);
  });

  it("loads categories after first open", async () => {
    const { categories, toggle } = useEmoji();

    toggle(); // open
    await flushAll();

    expect(categories.value).toHaveLength(3);
    expect(categories.value.map((c) => c.key)).toEqual([
      "smileys",
      "gestures",
      "objects",
    ]);
  });

  it("does not re-load categories on subsequent opens", async () => {
    const { categories, toggle, close } = useEmoji();

    toggle(); // open
    await flushAll();
    const firstLoad = categories.value;
    expect(firstLoad).toHaveLength(3);

    close();
    toggle(); // re-open
    await flushAll();

    // Same reference — not re-loaded
    expect(categories.value).toBe(firstLoad);
  });
});

describe("emojiData", () => {
  it("has three emoji categories", () => {
    expect(emojiCategories).toHaveLength(3);
    expect(emojiCategories.map((c) => c.key)).toEqual([
      "smileys",
      "gestures",
      "objects",
    ]);
  });

  it("each category has emojis", () => {
    for (const category of emojiCategories) {
      expect(category.emojis.length).toBeGreaterThan(0);
    }
  });

  it("all emojis are non-empty strings", () => {
    for (const category of emojiCategories) {
      for (const emoji of category.emojis) {
        expect(typeof emoji).toBe("string");
        expect(emoji.length).toBeGreaterThan(0);
      }
    }
  });
});
