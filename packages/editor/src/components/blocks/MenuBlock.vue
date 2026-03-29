<script setup lang="ts">
import { useI18n } from "../../composables/useI18n";
import type {
  MenuBlock as MenuBlockType,
  ViewportSize,
} from "@templatical/types";
import { Navigation } from "lucide-vue-next";
import { computed } from "vue";

const props = defineProps<{
  block: MenuBlockType;
  viewport: ViewportSize;
}>();

const { t } = useI18n();

const containerStyle = computed(() => ({
  display: "flex",
  flexWrap: "wrap" as const,
  gap: `0 ${props.block.spacing}px`,
  justifyContent:
    props.block.textAlign === "left"
      ? "flex-start"
      : props.block.textAlign === "right"
        ? "flex-end"
        : "center",
  fontSize: `${props.block.fontSize}px`,
  fontFamily: props.block.fontFamily || "inherit",
  alignItems: "center",
}));

const hasItems = computed(() => props.block.items.length > 0);

function getLinkColor(itemColor?: string): string {
  return itemColor || props.block.linkColor || props.block.color;
}
</script>

<template>
  <div class="tpl:w-full">
    <div v-if="hasItems" :style="containerStyle">
      <template v-for="(item, index) in block.items" :key="item.id">
        <a
          :href="item.url || '#'"
          class="tpl:cursor-default tpl:no-underline"
          :style="{
            color: getLinkColor(item.color),
            fontWeight: item.bold ? 'bold' : 'normal',
            textDecoration: item.underline ? 'underline' : 'none',
          }"
          @click.prevent
        >
          {{ item.text || "..." }}
        </a>
        <span
          v-if="index < block.items.length - 1"
          :style="{
            color: block.separatorColor,
            padding: `0 ${block.spacing}px`,
          }"
        >
          {{ block.separator }}
        </span>
      </template>
    </div>
    <div
      v-else
      class="tpl:flex tpl:items-center tpl:justify-center tpl:gap-2 tpl:rounded tpl:border tpl:border-dashed tpl:py-4 tpl:text-sm"
      style="border-color: var(--tpl-border); color: var(--tpl-text-dim)"
    >
      <Navigation :size="16" />
      <span>{{ t.menu.addLinks }}</span>
    </div>
  </div>
</template>
