<script setup lang="ts">
import { getScene } from "@/scenes";
import { usePlaygroundI18n } from "@/i18n";

const { t } = usePlaygroundI18n();
const minimum = getScene("minimum");
</script>

<template>
  <main data-testid="catalog-screen">
    <h1>{{ t.host.catalog }}</h1>
    <a v-if="minimum" data-testid="scene-link-minimum" href="/scenes/minimum">{{
      minimum.title
    }}</a>
  </main>
</template>
