<script setup lang="ts">
import { useI18n } from "../composables/useI18n";
import { LoaderCircle, Upload } from "@lucide/vue";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    uploading: boolean;
    size?: "field" | "canvas";
  }>(),
  {
    size: "field",
  },
);

const { t } = useI18n();

// The canvas overlay covers a whole image block, so it draws larger and lets
// a little more of the image show through than a sidebar field's.
const SIZES = {
  field: { gap: "tpl:gap-1.5", icon: 18, veil: "90%" },
  canvas: { gap: "tpl:gap-2", icon: 20, veil: "85%" },
} as const;

const sizing = computed(() => SIZES[props.size]);
</script>

<template>
  <div
    class="tpl:pointer-events-none tpl:absolute tpl:inset-0 tpl:z-10 tpl:flex tpl:flex-col tpl:items-center tpl:justify-center tpl:rounded tpl:border-2 tpl:border-dashed tpl:text-xs tpl:font-medium tpl:border-[var(--tpl-primary)] tpl:text-[var(--tpl-primary)]"
    :class="sizing.gap"
    :style="{
      backgroundColor: `color-mix(in srgb, var(--tpl-bg) ${sizing.veil}, transparent)`,
    }"
  >
    <template v-if="uploading">
      <LoaderCircle class="tpl-spinner" :size="sizing.icon" :stroke-width="2" />
      {{ t.image.uploading }}
    </template>
    <template v-else>
      <Upload :size="sizing.icon" :stroke-width="1.5" />
      {{ t.image.dropToUpload }}
    </template>
  </div>
</template>
