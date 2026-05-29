<script setup lang="ts">
import { inject, type ComputedRef } from "vue";
import { CUSTOM_BLOCK_STYLESHEETS_KEY } from "../keys";

/**
 * Renders one `<style>` tag per unique custom-block definition stylesheet
 * currently in use by the editor's content. Mounted near the top of the
 * editor's root template (both OSS `Editor.vue` and `CloudEditor.vue`) so the
 * rules sit early in the document order and apply to the canvas.
 *
 * In shadow-DOM mode (`shadowDom: true`, default) the styles scope to the
 * editor's shadow root. In light-DOM mode they leak globally, matching the
 * existing behavior of the editor's published `dist/style.css` in that mode
 * — no new global-leak vector.
 *
 * `v-html` on a `<style>` element sets its `innerHTML` (i.e., the raw CSS
 * text) without escaping; safe because the source is the consumer-authored
 * `CustomBlockDefinition.stylesheet` string they passed to `init()`. We don't
 * sanitize it — same trust model as `template`.
 */
const stylesheets = inject<ComputedRef<string[]> | null>(
  CUSTOM_BLOCK_STYLESHEETS_KEY,
  null,
);
</script>

<template>
  <template v-if="stylesheets">
    <style
      v-for="(css, i) in stylesheets"
      :key="i"
      data-tpl-custom-block-stylesheet
      v-html="css"
    ></style>
  </template>
</template>
