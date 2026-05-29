<script lang="ts">
import { defineComponent, h, inject, type ComputedRef } from "vue";
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
 * Why a render function instead of `<template>`: Vue's template compiler
 * treats `<style>` inside `<template>` as a side-effect tag and refuses to
 * emit it in strict client-render compilation paths (notably the one used
 * by `vue-tsc` and Vitest's Vue plugin). The render function below
 * bypasses the template compiler entirely and produces the same DOM at
 * runtime — and `innerHTML` on a `<style>` element sets the CSS rules
 * directly, no escape/parse pass between authoring and the cssom.
 */
export default defineComponent({
  name: "CustomBlockStylesheets",
  setup() {
    const stylesheets = inject<ComputedRef<string[]> | null>(
      CUSTOM_BLOCK_STYLESHEETS_KEY,
      null,
    );

    return () => {
      if (!stylesheets) return null;
      return stylesheets.value.map((css, i) =>
        h("style", {
          key: i,
          "data-tpl-custom-block-stylesheet": "",
          innerHTML: css,
        }),
      );
    };
  },
});
</script>
