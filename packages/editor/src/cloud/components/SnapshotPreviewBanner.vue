<script setup lang="ts">
import { Clock } from "@lucide/vue";
import { useI18n } from "../../composables/useI18n";

defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: "cancel"): void;
  (e: "confirm"): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div
    v-if="visible"
    class="tpl-preview-banner tpl:absolute tpl:top-14 tpl:right-0 tpl:left-0 tpl:z-40 tpl:flex tpl:items-center tpl:justify-center tpl:gap-4 tpl:px-4 tpl:py-3"
    style="
      background-color: var(--tpl-primary-light);
      border-bottom: 1px solid var(--tpl-primary);
    "
  >
    <div
      class="tpl:flex tpl:items-center tpl:gap-2 tpl:text-sm"
      style="color: var(--tpl-text)"
    >
      <Clock :size="18" :stroke-width="2" style="color: var(--tpl-primary)" />
      <span>{{ t.snapshotPreview.message }}</span>
    </div>
    <div class="tpl:flex tpl:items-center tpl:gap-2">
      <button
        class="tpl:rounded-md tpl:px-3 tpl:py-1.5 tpl:text-sm tpl:font-medium tpl:transition-all tpl:duration-150"
        style="
          background-color: transparent;
          color: var(--tpl-text-muted);
          border: 1px solid var(--tpl-border);
        "
        @click="emit('cancel')"
      >
        {{ t.snapshotPreview.cancel }}
      </button>
      <button
        class="tpl:rounded-md tpl:px-3 tpl:py-1.5 tpl:text-sm tpl:font-medium tpl:transition-all tpl:duration-150 tpl:hover:opacity-90"
        style="background-color: var(--tpl-primary); color: var(--tpl-bg)"
        @click="emit('confirm')"
      >
        {{ t.snapshotPreview.restore }}
      </button>
    </div>
  </div>
</template>
