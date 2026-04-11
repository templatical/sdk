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
  SocialIconsBlock,
  SpacerBlock,
  SpacingValue,
  TableBlock,
  TableCellData,
  TableRowData,
  TitleBlock,
  VideoBlock,
} from "./blocks";
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

function applyDefaults<T extends object>(
  base: T,
  partial: Partial<T> | undefined,
): T {
  if (!partial || Object.keys(partial).length === 0) return base;
  return deepMergeDefaults(base, partial);
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
    margin: createDefaultSpacing(0),
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
    cells: Array.from(
      { length: columns },
      (): TableCellData => ({
        id: generateId(),
        content: "",
      }),
    ),
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
    fieldValues[field.key] = getFieldDefault(field);
  }

  return {
    id: generateId(),
    type: "custom",
    customType: definition.type,
    fieldValues,
    styles: createDefaultStyles(),
    ...(definition.dataSource ? { dataSourceFetched: false } : {}),
  };
}

export function createBlock(
  type: BlockType,
  blockDefaults?: BlockDefaults,
): Block {
  switch (type) {
    case "section":
      return createSectionBlock(blockDefaults?.section);
    case "title":
      return createTitleBlock(blockDefaults?.title);
    case "paragraph":
      return createParagraphBlock(blockDefaults?.paragraph);
    case "image":
      return createImageBlock(blockDefaults?.image);
    case "button":
      return createButtonBlock(blockDefaults?.button);
    case "divider":
      return createDividerBlock(blockDefaults?.divider);
    case "video":
      return createVideoBlock(blockDefaults?.video);
    case "social":
      return createSocialIconsBlock(blockDefaults?.social);
    case "spacer":
      return createSpacerBlock(blockDefaults?.spacer);
    case "html":
      return createHtmlBlock(blockDefaults?.html);
    case "menu":
      return createMenuBlock(blockDefaults?.menu);
    case "table":
      return createTableBlock(blockDefaults?.table);
    case "countdown":
      return createCountdownBlock(blockDefaults?.countdown);
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

  return cloned;
}
