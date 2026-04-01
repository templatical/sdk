/** @see https://templatical.com/docs/v1/custom-blocks */

import type {
  Block,
  CustomBlock,
  CustomBlockDefinition,
} from "@templatical/types";
import { createCustomBlock } from "@templatical/types";
import { type Component, shallowRef } from "vue";

export interface SidebarItem {
  type: string;
  label: string;
  icon?: string;
  description?: string;
  isCustom: boolean;
}

export interface BlockRegistration {
  component: Component;
  createBlock: () => Block;
  sidebarItem: SidebarItem;
  definition?: CustomBlockDefinition;
}

export interface UseBlockRegistryReturn {
  registerBuiltIn: (type: string, registration: BlockRegistration) => void;
  registerCustom: (
    definition: CustomBlockDefinition,
    component: Component,
  ) => void;
  getComponent: (block: Block) => Component | undefined;
  createBlock: (type: string) => Block | undefined;
  getSidebarItems: () => SidebarItem[];
  getDefinition: (customType: string) => CustomBlockDefinition | undefined;
  renderCustomBlock: (block: CustomBlock) => Promise<string>;
  isRegistered: (type: string) => boolean;
}

export function useBlockRegistry(): UseBlockRegistryReturn {
  const registry = shallowRef(new Map<string, BlockRegistration>());

  function registerBuiltIn(
    type: string,
    registration: BlockRegistration,
  ): void {
    const map = new Map(registry.value);
    map.set(type, registration);
    registry.value = map;
  }

  function registerCustom(
    definition: CustomBlockDefinition,
    component: Component,
  ): void {
    const registrationKey = `custom:${definition.type}`;
    const registration: BlockRegistration = {
      component,
      createBlock: () => createCustomBlock(definition),
      sidebarItem: {
        type: registrationKey,
        label: definition.name,
        icon: definition.icon,
        description: definition.description,
        isCustom: true,
      },
      definition,
    };

    const map = new Map(registry.value);
    map.set(registrationKey, registration);
    registry.value = map;
  }

  function getComponent(block: Block): Component | undefined {
    if (block.type === "custom") {
      const key = `custom:${(block as CustomBlock).customType}`;
      return registry.value.get(key)?.component;
    }

    return registry.value.get(block.type)?.component;
  }

  function createBlockFromType(type: string): Block | undefined {
    return registry.value.get(type)?.createBlock();
  }

  function getSidebarItems(): SidebarItem[] {
    const builtIn: SidebarItem[] = [];
    const custom: SidebarItem[] = [];

    for (const registration of registry.value.values()) {
      if (registration.sidebarItem.isCustom) {
        custom.push(registration.sidebarItem);
      } else {
        builtIn.push(registration.sidebarItem);
      }
    }

    return [...builtIn, ...custom];
  }

  function getDefinition(
    customType: string,
  ): CustomBlockDefinition | undefined {
    const key = `custom:${customType}`;
    return registry.value.get(key)?.definition;
  }

  async function renderCustomBlockHtml(block: CustomBlock): Promise<string> {
    const definition = getDefinition(block.customType);
    if (!definition) {
      return '<div style="color: var(--tpl-text-muted, #6c757d); padding: 16px; text-align: center; border: 1px dashed var(--tpl-border, #dee2e6); border-radius: var(--tpl-radius-sm, 4px); font-family: var(--tpl-font-family, sans-serif); font-size: 14px;">Block definition not found</div>';
    }

    // Lazy-load liquidjs for template rendering
    const { Liquid } = await import("liquidjs");
    const engine = new Liquid({
      strictVariables: false,
      strictFilters: false,
    });

    return await engine.parseAndRender(definition.template, block.fieldValues);
  }

  function isRegistered(type: string): boolean {
    return registry.value.has(type);
  }

  return {
    registerBuiltIn,
    registerCustom,
    getComponent,
    createBlock: createBlockFromType,
    getSidebarItems,
    getDefinition,
    renderCustomBlock: renderCustomBlockHtml,
    isRegistered,
  };
}
