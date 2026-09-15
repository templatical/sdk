<script setup lang="ts">
import { computed } from "vue";
import { useData } from "vitepress";

/**
 * The editor screenshot. The file lives on templatical.com — README.md
 * uses this same URL. Do not copy the PNG into apps/docs/public/.
 */
const SRC = "https://templatical.com/preview.png";

const { lang } = useData();
const alt = computed(() =>
  lang.value.startsWith("de")
    ? "Templatical E-Mail-Editor"
    : "Templatical email editor",
);
</script>

<template>
  <img
    class="tpl-hero-preview"
    :src="SRC"
    :alt="alt"
    width="900"
    height="537"
  />
</template>
