<script setup lang="ts">
import SocialIconSvg from "./SocialIconSvg.vue";
import { useI18n } from "../../composables/useI18n";
import type {
  SocialIconsBlock as SocialIconsBlockType,
  ViewportSize,
} from "@templatical/types";
import { Share2 } from "@lucide/vue";
import { computed } from "vue";

const props = defineProps<{
  block: SocialIconsBlockType;
  viewport: ViewportSize;
}>();

const { t } = useI18n();

const containerStyle = computed(() => ({
  display: "flex",
  flexWrap: "wrap" as const,
  gap: `${props.block.spacing}px`,
  justifyContent:
    props.block.align === "left"
      ? "flex-start"
      : props.block.align === "right"
        ? "flex-end"
        : "center",
}));

const hasIcons = computed(() => props.block.icons.length > 0);
</script>

<template>
  <div class="tpl:w-full">
    <div v-if="hasIcons" :style="containerStyle">
      <a
        v-for="icon in block.icons"
        :key="icon.id"
        :href="icon.url || '#'"
        class="tpl:cursor-default"
        @click.prevent
      >
        <SocialIconSvg
          :platform="icon.platform"
          :icon-style="block.iconStyle"
          :icon-size="block.iconSize"
        />
      </a>
    </div>
    <div
      v-else
      class="tpl:flex tpl:items-center tpl:justify-center tpl:gap-2 tpl:rounded tpl:border tpl:border-dashed tpl:py-4 tpl:text-sm"
      style="border-color: var(--tpl-border); color: var(--tpl-text-dim)"
    >
      <Share2 :size="16" />
      <span>{{ t.social.addIcons }}</span>
    </div>
  </div>
</template>
