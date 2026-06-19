import type { Block } from "@templatical/types";
import {
  createButtonBlock,
  createCountdownBlock,
  createDividerBlock,
  createHtmlBlock,
  createImageBlock,
  createMenuBlock,
  createParagraphBlock,
  createSectionBlock,
  createSocialIconsBlock,
  createSpacerBlock,
  createTableBlock,
  createTitleBlock,
  createVideoBlock,
} from "@templatical/types";
import type { Component } from "vue";
import type { UseBlockRegistryReturn } from "../composables/useBlockRegistry";

interface BuiltInBlockDef {
  type: string;
  createBlock: () => Block;
}

const BUILT_IN_BLOCKS: BuiltInBlockDef[] = [
  { type: "section", createBlock: createSectionBlock },
  { type: "title", createBlock: createTitleBlock },
  { type: "paragraph", createBlock: createParagraphBlock },
  { type: "image", createBlock: createImageBlock },
  { type: "button", createBlock: createButtonBlock },
  { type: "divider", createBlock: createDividerBlock },
  { type: "video", createBlock: createVideoBlock },
  { type: "social", createBlock: createSocialIconsBlock },
  { type: "menu", createBlock: createMenuBlock },
  { type: "table", createBlock: createTableBlock },
  { type: "spacer", createBlock: createSpacerBlock },
  { type: "html", createBlock: createHtmlBlock },
  { type: "countdown", createBlock: createCountdownBlock },
];

export function registerBuiltInBlocks(
  registry: UseBlockRegistryReturn,
  componentMap: Record<string, Component>,
): void {
  for (const def of BUILT_IN_BLOCKS) {
    const component = componentMap[def.type];
    if (component) {
      registry.registerBuiltIn(def.type, {
        component,
        createBlock: def.createBlock,
      });
    }
  }
}
