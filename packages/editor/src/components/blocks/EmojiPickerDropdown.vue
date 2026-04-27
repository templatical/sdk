<script setup lang="ts">
import { useEmoji, useI18n } from "../../composables";
import { useFocusTrap } from "../../composables/useFocusTrap";
import { onClickOutside } from "@vueuse/core";
import { Smile } from "@lucide/vue";
import { computed, ref } from "vue";

const emit = defineEmits<{
  (e: "insert", emoji: string): void;
}>();

const {
  categories: emojiCategories,
  isOpen: showEmojiPicker,
  toggle: toggleEmojiPicker,
  close: closeEmojiPicker,
} = useEmoji();

const { t, format } = useI18n();

const pickerRef = ref<HTMLElement | null>(null);
const rootRef = ref<HTMLElement | null>(null);

const isOpenRef = computed(() => showEmojiPicker.value);
useFocusTrap(pickerRef, isOpenRef);

onClickOutside(rootRef, () => {
  if (showEmojiPicker.value) {
    closeEmojiPicker();
  }
});

function handleInsert(emoji: string): void {
  emit("insert", emoji);
  closeEmojiPicker();
}
</script>

<template>
  <div ref="rootRef" class="tpl:relative">
    <button
      type="button"
      class="tpl-text-toolbar-btn"
      :class="{
        'tpl-text-toolbar-btn--active': showEmojiPicker,
      }"
      :aria-label="t.paragraphEditor.insertEmoji"
      :title="t.paragraphEditor.insertEmoji"
      :aria-expanded="showEmojiPicker"
      aria-haspopup="dialog"
      aria-controls="tpl-emoji-picker"
      @click="toggleEmojiPicker"
    >
      <Smile :size="16" :stroke-width="2" />
    </button>
    <div
      v-if="showEmojiPicker"
      id="tpl-emoji-picker"
      ref="pickerRef"
      role="dialog"
      aria-modal="false"
      :aria-label="t.paragraphEditor.insertEmoji"
      tabindex="-1"
      class="tpl-emoji-picker tpl:absolute tpl:top-full tpl:left-0 tpl:z-10 tpl:mt-2 tpl:w-72 tpl:rounded-lg tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:p-2 tpl:shadow-lg"
      @keydown.esc.stop.prevent="closeEmojiPicker"
    >
      <div
        v-for="category in emojiCategories"
        :key="category.key"
        class="tpl:mb-2 tpl:last:mb-0"
      >
        <div
          class="tpl:mb-1.5 tpl:text-[10px] tpl:font-medium tpl:tracking-wide tpl:text-[var(--tpl-text-muted)] tpl:uppercase"
        >
          {{ t.emoji[category.key] }}
        </div>
        <div class="tpl:grid tpl:grid-cols-10 tpl:gap-0.5">
          <button
            v-for="emoji in category.emojis"
            :key="emoji"
            type="button"
            :aria-label="format(t.paragraphEditor.emojiItemLabel, { emoji })"
            class="tpl:flex tpl:size-6 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded tpl:border-none tpl:bg-transparent tpl:text-base tpl:transition-all tpl:duration-100 tpl:hover:scale-125 tpl:hover:bg-[var(--tpl-bg-active)]"
            @click="handleInsert(emoji)"
          >
            {{ emoji }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
