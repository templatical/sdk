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
  label: string;
  createBlock: () => Block;
}

const BUILT_IN_BLOCKS: BuiltInBlockDef[] = [
  { type: "section", label: "Section", createBlock: createSectionBlock },
  { type: "title", label: "Title", createBlock: createTitleBlock },
  { type: "paragraph", label: "Paragraph", createBlock: createParagraphBlock },
  { type: "image", label: "Image", createBlock: createImageBlock },
  { type: "button", label: "Button", createBlock: createButtonBlock },
  { type: "divider", label: "Divider", createBlock: createDividerBlock },
  { type: "video", label: "Video", createBlock: createVideoBlock },
  { type: "social", label: "Social", createBlock: createSocialIconsBlock },
  { type: "menu", label: "Menu", createBlock: createMenuBlock },
  { type: "table", label: "Table", createBlock: createTableBlock },
  { type: "spacer", label: "Spacer", createBlock: createSpacerBlock },
  { type: "html", label: "HTML", createBlock: createHtmlBlock },
  {
    type: "countdown",
    label: "Countdown",
    createBlock: createCountdownBlock,
  },
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
        sidebarItem: { type: def.type, label: def.label, isCustom: false },
      });
    }
  }
}
