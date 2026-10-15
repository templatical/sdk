import type {
  Block,
  BlockStyles,
  BlockType,
  ButtonBlock,
  CountdownBlock,
  CustomBlock,
  DividerBlock,
  HtmlBlock,
  ImageBlock,
  MenuBlock,
  ParagraphBlock,
  SectionBlock,
  SlotBlock,
  SocialIconsBlock,
  SpacerBlock,
  SpacingValue,
  TableBlock,
  TableCellData,
  TableRowData,
  TitleBlock,
  VideoBlock,
  WrapperBlock,
} from "./blocks";
import { safeClone } from "./clone";
import type { CustomBlockDefinition, CustomBlockField } from "./custom-blocks";
import type { BlockDefaults } from "./defaults";
import {
  BUTTON_BLOCK_DEFAULTS,
  COUNTDOWN_BLOCK_DEFAULTS,
  deepMergeDefaults,
  DIVIDER_BLOCK_DEFAULTS,
  HTML_BLOCK_DEFAULTS,
  IMAGE_BLOCK_DEFAULTS,
  MENU_BLOCK_DEFAULTS,
  PARAGRAPH_BLOCK_DEFAULTS,
  SECTION_BLOCK_DEFAULTS,
  SOCIAL_ICONS_BLOCK_DEFAULTS,
  SPACER_BLOCK_DEFAULTS,
  TABLE_BLOCK_DEFAULTS,
  TITLE_BLOCK_DEFAULTS,
  VIDEO_BLOCK_DEFAULTS,
} from "./defaults";

/**
 * `base` is copied because it carries the `*_BLOCK_DEFAULTS` constants' own
 * nested objects (e.g. `buttonPadding`): every block made from it would share
 * them, and mutating one block's would change the defaults and every other
 * block. `partial` is the caller's and is merged as given — whatever it passes
 * directly lands in the block by reference.
 */
function applyDefaults<T extends object>(
  base: T,
  partial: Partial<T> | undefined,
): T {
  const ownBase = safeClone(base);
  if (!partial || Object.keys(partial).length === 0) return ownBase;
  return deepMergeDefaults(ownBase, partial);
}

/**
 * A defaults entry copied for one block. Defaults seed every block of their
 * type, so a nested value merged in as-is would be shared by all of them.
 */
function copyDefaults<T>(defaults: T | undefined): T | undefined {
  return defaults === undefined ? undefined : safeClone(defaults);
}

export function generateId(): string {
  return crypto.randomUUID();
}

function createDefaultSpacing(value = 0): SpacingValue {
  return { top: value, right: value, bottom: value, left: value };
}

function createDefaultStyles(padding = 10): BlockStyles {
  return {
    padding: createDefaultSpacing(padding),
  };
}

export function createTitleBlock(
  partial: Partial<TitleBlock> = {},
): TitleBlock {
  const base: TitleBlock = {
    id: generateId(),
    type: "title",
    ...TITLE_BLOCK_DEFAULTS,
    styles: createDefaultStyles(),
  } as TitleBlock;
  return applyDefaults(base, partial);
}

export function createParagraphBlock(
  partial: Partial<ParagraphBlock> = {},
): ParagraphBlock {
  const base: ParagraphBlock = {
    id: generateId(),
    type: "paragraph",
    ...PARAGRAPH_BLOCK_DEFAULTS,
    styles: createDefaultStyles(),
  } as ParagraphBlock;
  return applyDefaults(base, partial);
}

export function createImageBlock(
  partial: Partial<ImageBlock> = {},
): ImageBlock {
  const base: ImageBlock = {
    id: generateId(),
    type: "image",
    ...IMAGE_BLOCK_DEFAULTS,
    styles: createDefaultStyles(),
  } as ImageBlock;
  return applyDefaults(base, partial);
}

export function createButtonBlock(
  partial: Partial<ButtonBlock> = {},
): ButtonBlock {
  const base: ButtonBlock = {
    id: generateId(),
    type: "button",
    ...BUTTON_BLOCK_DEFAULTS,
    styles: createDefaultStyles(),
  } as ButtonBlock;
  return applyDefaults(base, partial);
}

export function createDividerBlock(
  partial: Partial<DividerBlock> = {},
): DividerBlock {
  const base: DividerBlock = {
    id: generateId(),
    type: "divider",
    ...DIVIDER_BLOCK_DEFAULTS,
    styles: createDefaultStyles(20),
  } as DividerBlock;
  return applyDefaults(base, partial);
}

export function createSectionBlock(
  partial: Partial<SectionBlock> = {},
): SectionBlock {
  const base: SectionBlock = {
    id: generateId(),
    type: "section",
    ...SECTION_BLOCK_DEFAULTS,
    children: [[]],
    styles: createDefaultStyles(20),
  } as SectionBlock;
  return applyDefaults(base, partial);
}

export function createVideoBlock(
  partial: Partial<VideoBlock> = {},
): VideoBlock {
  const base: VideoBlock = {
    id: generateId(),
    type: "video",
    ...VIDEO_BLOCK_DEFAULTS,
    styles: createDefaultStyles(),
  } as VideoBlock;
  return applyDefaults(base, partial);
}

export function createSocialIconsBlock(
  partial: Partial<SocialIconsBlock> = {},
): SocialIconsBlock {
  const base: SocialIconsBlock = {
    id: generateId(),
    type: "social",
    icons: [],
    ...SOCIAL_ICONS_BLOCK_DEFAULTS,
    styles: createDefaultStyles(),
  } as SocialIconsBlock;
  return applyDefaults(base, partial);
}

export function createSpacerBlock(
  partial: Partial<SpacerBlock> = {},
): SpacerBlock {
  const base: SpacerBlock = {
    id: generateId(),
    type: "spacer",
    ...SPACER_BLOCK_DEFAULTS,
    styles: createDefaultStyles(0),
  } as SpacerBlock;
  return applyDefaults(base, partial);
}

export function createHtmlBlock(partial: Partial<HtmlBlock> = {}): HtmlBlock {
  const base: HtmlBlock = {
    id: generateId(),
    type: "html",
    ...HTML_BLOCK_DEFAULTS,
    styles: createDefaultStyles(),
  } as HtmlBlock;
  return applyDefaults(base, partial);
}

export function createMenuBlock(partial: Partial<MenuBlock> = {}): MenuBlock {
  const base: MenuBlock = {
    id: generateId(),
    type: "menu",
    items: [],
    ...MENU_BLOCK_DEFAULTS,
    styles: createDefaultStyles(),
  } as MenuBlock;
  return applyDefaults(base, partial);
}

function createDefaultTableRows(columns: number, rows: number): TableRowData[] {
  return Array.from({ length: rows }, () => ({
    id: generateId(),
    cells: Array.from({ length: columns }, (): TableCellData => ({
      id: generateId(),
      content: "",
    })),
  }));
}

export function createTableBlock(
  partial: Partial<TableBlock> = {},
): TableBlock {
  const base: TableBlock = {
    id: generateId(),
    type: "table",
    rows: createDefaultTableRows(3, 3),
    ...TABLE_BLOCK_DEFAULTS,
    styles: createDefaultStyles(),
  } as TableBlock;
  return applyDefaults(base, partial);
}

export function createCountdownBlock(
  partial: Partial<CountdownBlock> = {},
): CountdownBlock {
  const base: CountdownBlock = {
    id: generateId(),
    type: "countdown",
    ...COUNTDOWN_BLOCK_DEFAULTS,
    styles: createDefaultStyles(),
  } as CountdownBlock;
  return applyDefaults(base, partial);
}

function getFieldDefault(field: CustomBlockField): unknown {
  if (field.type === "repeatable") {
    return field.default ?? [];
  }
  if (field.type === "boolean") {
    return field.default ?? false;
  }
  if (field.type === "number") {
    return field.default ?? 0;
  }

  return field.default ?? "";
}

export function createCustomBlock(
  definition: CustomBlockDefinition,
): CustomBlock {
  const fieldValues: Record<string, unknown> = {};

  for (const field of definition.fields) {
    fieldValues[field.key] = copyDefaults(getFieldDefault(field));
  }

  const styles = applyDefaults(
    createDefaultStyles(),
    copyDefaults(definition.defaultStyles),
  );

  return {
    id: generateId(),
    type: "custom",
    customType: definition.type,
    fieldValues,
    styles,
    ...(definition.dataSource ? { dataSourceFetched: false } : {}),
  };
}

/** Layout-only. Use this to build a layout; createBlock("slot") throws. */
export function createSlotBlock(): SlotBlock {
  return {
    id: generateId(),
    type: "slot",
    styles: createDefaultStyles(0),
  };
}

/** Layout-only. Use this to build a layout; createBlock("wrapper") throws. */
export function createWrapperBlock(
  partial: Partial<WrapperBlock> = {},
): WrapperBlock {
  const base: WrapperBlock = {
    id: generateId(),
    type: "wrapper",
    children: [],
    styles: createDefaultStyles(0),
  };
  return applyDefaults(base, partial);
}

export function createBlock(
  type: BlockType,
  blockDefaults?: BlockDefaults,
): Block {
  switch (type) {
    case "section":
      return createSectionBlock(copyDefaults(blockDefaults?.section));
    case "title":
      return createTitleBlock(copyDefaults(blockDefaults?.title));
    case "paragraph":
      return createParagraphBlock(copyDefaults(blockDefaults?.paragraph));
    case "image":
      return createImageBlock(copyDefaults(blockDefaults?.image));
    case "button":
      return createButtonBlock(copyDefaults(blockDefaults?.button));
    case "divider":
      return createDividerBlock(copyDefaults(blockDefaults?.divider));
    case "video":
      return createVideoBlock(copyDefaults(blockDefaults?.video));
    case "social":
      return createSocialIconsBlock(copyDefaults(blockDefaults?.social));
    case "spacer":
      return createSpacerBlock(copyDefaults(blockDefaults?.spacer));
    case "html":
      return createHtmlBlock(copyDefaults(blockDefaults?.html));
    case "menu":
      return createMenuBlock(copyDefaults(blockDefaults?.menu));
    case "table":
      return createTableBlock(copyDefaults(blockDefaults?.table));
    case "countdown":
      return createCountdownBlock(copyDefaults(blockDefaults?.countdown));
    case "slot":
      throw new Error(
        "[Templatical] slot cannot be inserted into content. Use createSlotBlock() to build a layout.",
      );
    case "wrapper":
      throw new Error(
        "[Templatical] wrapper cannot be inserted into content. Use createWrapperBlock() to build a layout.",
      );
    default:
      throw new Error(`Unknown block type: ${type}`);
  }
}

export function cloneBlock(block: Block): Block {
  const cloned = JSON.parse(JSON.stringify(block)) as Block;
  cloned.id = generateId();

  if (cloned.type === "section") {
    cloned.children = cloned.children.map((column) =>
      column.map((child) => cloneBlock(child)),
    );
  }

  if (cloned.type === "wrapper") {
    cloned.children = cloned.children.map((c) => cloneBlock(c));
  }

  return cloned;
}
