import type { Block } from "@templatical/types";
import type { Component } from "vue";
import type { UseBlockRegistryReturn } from "../composables/useBlockRegistry";

/**
 * Resolves a block to its Vue component, checking the registry first
 * and falling back to the provided component map.
 */
export function resolveBlockComponent(
  block: Block,
  registry: UseBlockRegistryReturn | null | undefined,
  componentMap: Record<string, Component>,
): Component | null {
  if (registry) {
    const component = registry.getComponent(block);
    if (component) {
      return component;
    }
  }

  return componentMap[block.type] ?? null;
}

/**
 * Computes inline styles for a block wrapper from its styles config.
 */
export function getBlockWrapperStyle(block: Block): Record<string, string> {
  const { padding, backgroundColor } = block.styles;
  const style: Record<string, string> = {
    padding: `${padding.top}px ${padding.right}px ${padding.bottom}px ${padding.left}px`,
    backgroundColor: backgroundColor || "transparent",
  };
  // borderRadius is section-specific (it lives on SectionBlock, not `styles`).
  // Mirror it into the editor box style so the canvas/preview match the
  // exported MJML, which renders it as `border-radius` on the `mj-section`.
  if (
    block.type === "section" &&
    block.borderRadius &&
    block.borderRadius > 0
  ) {
    style.borderRadius = `${block.borderRadius}px`;
  }
  return style;
}
