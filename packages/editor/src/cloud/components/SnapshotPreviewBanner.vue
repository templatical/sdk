<script setup lang="ts">
import { Clock } from "@lucide/vue";
import { useCloudI18nStrict } from "../../composables/useCloudI18n";

defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: "cancel"): void;
  (e: "confirm"): void;
}>();

const { t: cloudT } = useCloudI18nStrict();
</script>

<template>
  <div
    v-if="visible"
    class="tpl-preview-banner tpl:absolute tpl:top-14 tpl:right-0 tpl:left-0 tpl:z-40 tpl:flex tpl:items-center tpl:justify-center tpl:gap-4 tpl:px-4 tpl:py-3 tpl:bg-[var(--tpl-primary-light)] tpl:border-b tpl:border-[var(--tpl-primary)]"
  >
    <div
      class="tpl:flex tpl:items-center tpl:gap-2 tpl:text-sm tpl:text-[var(--tpl-text)]"
    >
      <Clock
        :size="18"
        :stroke-width="2"
        class="tpl:text-[var(--tpl-primary)]"
      />
      <span>{{ cloudT.snapshotPreview.message }}</span>
    </div>
    <div class="tpl:flex tpl:items-center tpl:gap-2">
      <button
        class="tpl:rounded-md tpl:px-3 tpl:py-1.5 tpl:text-sm tpl:font-medium tpl:transition-all tpl:duration-150 tpl:text-[var(--tpl-text-muted)] tpl:border tpl:border-[var(--tpl-border)]"
        style="background-color: transparent"
        @click="emit('cancel')"
      >
        {{ cloudT.snapshotPreview.cancel }}
      </button>
      <button
        class="tpl:rounded-md tpl:px-3 tpl:py-1.5 tpl:text-sm tpl:font-medium tpl:transition-all tpl:duration-150 tpl:hover:opacity-90 tpl:bg-[var(--tpl-primary)] tpl:text-[var(--tpl-bg)]"
        @click="emit('confirm')"
      >
        {{ cloudT.snapshotPreview.restore }}
      </button>
    </div>
  </div>
</template>
