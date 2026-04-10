import { useToggle } from "@vueuse/core";
import { shallowRef, watch } from "vue";
import type { EmojiCategory, EmojiCategoryKey } from "./emojiData";

export type { EmojiCategoryKey, EmojiCategory };

export function useEmoji() {
  const [isOpen, toggleValue] = useToggle(false);
  const categories = shallowRef<EmojiCategory[]>([]);

  // Lazy-load emoji data on first open
  watch(isOpen, async (open) => {
    if (open && categories.value.length === 0) {
      const { emojiCategories } = await import("./emojiData");
      categories.value = emojiCategories;
    }
  });

  function toggle(): void {
    toggleValue();
  }

  function close(): void {
    isOpen.value = false;
  }

  return {
    categories,
    isOpen,
    toggle,
    close,
  };
}
