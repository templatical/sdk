import type { Component } from "vue";
import { VueNodeViewRenderer } from "@tiptap/vue-3";

/**
 * Typed wrapper for VueNodeViewRenderer that handles the known type mismatch
 * between Vue SFC default exports and TipTap's expected component type.
 */
export function renderVueNodeView(component: Component) {
  return VueNodeViewRenderer(
    component as Parameters<typeof VueNodeViewRenderer>[0],
  );
}
