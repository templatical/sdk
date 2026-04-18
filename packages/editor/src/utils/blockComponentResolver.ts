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
  const { padding, margin, backgroundColor } = block.styles;
  return {
    padding: `${padding.top}px ${padding.right}px ${padding.bottom}px ${padding.left}px`,
    margin: `${margin.top}px ${margin.right}px ${margin.bottom}px ${margin.left}px`,
    backgroundColor: backgroundColor || "transparent",
  };
}
