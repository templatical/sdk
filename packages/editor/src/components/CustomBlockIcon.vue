<script setup lang="ts">
import { Box } from "lucide-vue-next";
import { computed } from "vue";

const props = defineProps<{
  icon?: string;
  size?: number;
}>();

const iconSize = computed(() => props.size ?? 20);

const isSvg = computed(
  () =>
    props.icon &&
    (props.icon.trimStart().startsWith("<svg") ||
      props.icon.trimStart().startsWith("<SVG")),
);

const isUrl = computed(
  () =>
    props.icon &&
    !isSvg.value &&
    (props.icon.startsWith("http") || props.icon.startsWith("/")),
);
</script>

<template>
  <!-- eslint-disable vue/no-v-html -->
  <span
    v-if="isSvg"
    class="tpl:inline-flex tpl:items-center tpl:justify-center"
    :style="{ width: `${iconSize}px`, height: `${iconSize}px` }"
    v-html="icon"
  />
  <!-- eslint-enable vue/no-v-html -->
  <img
    v-else-if="isUrl"
    :src="icon"
    :width="iconSize"
    :height="iconSize"
    class="tpl:inline-block"
    alt=""
  />
  <Box v-else :size="iconSize" :stroke-width="1.5" />
</template>
