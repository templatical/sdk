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
  SectionBlock,
  SocialIconsBlock,
  SpacerBlock,
  SpacingValue,
  TableBlock,
  TableCellData,
  TableRowData,
  TextBlock,
  VideoBlock,
} from "./blocks";
import type { CustomBlockDefinition, CustomBlockField } from "./custom-blocks";

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

export function createTextBlock(partial: Partial<TextBlock> = {}): TextBlock {
  return {
    id: generateId(),
    type: "text",
    content: "<p>Enter your text here</p>",
    fontSize: 16,
    color: "#333333",
    textAlign: "left",
    fontWeight: "normal",
    styles: createDefaultStyles(),
    ...partial,
  };
}

export function createImageBlock(
  partial: Partial<ImageBlock> = {},
): ImageBlock {
  return {
    id: generateId(),
    type: "image",
    src: "",
    alt: "",
    width: "full",
    align: "center",
    styles: createDefaultStyles(),
    ...partial,
  };
}

export function createButtonBlock(
  partial: Partial<ButtonBlock> = {},
): ButtonBlock {
  return {
    id: generateId(),
    type: "button",
    text: "Click Here",
    url: "",
    backgroundColor: "#007bff",
    textColor: "#ffffff",
    borderRadius: 4,
    fontSize: 16,
    buttonPadding: { top: 12, right: 24, bottom: 12, left: 24 },
    styles: createDefaultStyles(),
    ...partial,
  };
}

export function createDividerBlock(
  partial: Partial<DividerBlock> = {},
): DividerBlock {
  return {
    id: generateId(),
    type: "divider",
    lineStyle: "solid",
    color: "#cccccc",
    thickness: 1,
    width: "full",
    styles: createDefaultStyles(20),
    ...partial,
  };
}

export function createSectionBlock(
  partial: Partial<SectionBlock> = {},
): SectionBlock {
  return {
    id: generateId(),
    type: "section",
    columns: "1",
    children: [[]],
    styles: createDefaultStyles(20),
    ...partial,
  };
}

export function createVideoBlock(
  partial: Partial<VideoBlock> = {},
): VideoBlock {
  return {
    id: generateId(),
    type: "video",
    url: "",
    thumbnailUrl: "",
    alt: "Video",
    width: "full",
    align: "center",
    styles: createDefaultStyles(),
    ...partial,
  };
}

export function createSocialIconsBlock(
  partial: Partial<SocialIconsBlock> = {},
): SocialIconsBlock {
  return {
    id: generateId(),
    type: "social",
    icons: [],
    iconStyle: "solid",
    iconSize: "medium",
    spacing: 10,
    align: "center",
    styles: createDefaultStyles(),
    ...partial,
  };
}

export function createSpacerBlock(
  partial: Partial<SpacerBlock> = {},
): SpacerBlock {
  return {
    id: generateId(),
    type: "spacer",
    height: 20,
    styles: createDefaultStyles(0),
    ...partial,
  };
}

export function createHtmlBlock(partial: Partial<HtmlBlock> = {}): HtmlBlock {
  return {
    id: generateId(),
    type: "html",
    content: "",
    styles: createDefaultStyles(),
    ...partial,
  };
}

export function createMenuBlock(partial: Partial<MenuBlock> = {}): MenuBlock {
  return {
    id: generateId(),
    type: "menu",
    items: [],
    fontSize: 14,
    color: "#333333",
    textAlign: "center",
    separator: "|",
    separatorColor: "#cccccc",
    spacing: 10,
    styles: createDefaultStyles(),
    ...partial,
  };
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
  return {
    id: generateId(),
    type: "table",
    rows: createDefaultTableRows(3, 3),
    hasHeaderRow: true,
    borderColor: "#dddddd",
    borderWidth: 1,
    cellPadding: 8,
    fontSize: 14,
    color: "#333333",
    textAlign: "left",
    styles: createDefaultStyles(),
    ...partial,
  };
}

export function createCountdownBlock(
  partial: Partial<CountdownBlock> = {},
): CountdownBlock {
  return {
    id: generateId(),
    type: "countdown",
    targetDate: "",
    timezone: "UTC",
    showDays: true,
    showHours: true,
    showMinutes: true,
    showSeconds: true,
    separator: ":",
    digitFontSize: 32,
    digitColor: "#333333",
    labelColor: "#666666",
    labelFontSize: 12,
    backgroundColor: "#ffffff",
    labelDays: "Days",
    labelHours: "Hours",
    labelMinutes: "Minutes",
    labelSeconds: "Seconds",
    expiredMessage: "This offer has expired",
    expiredImageUrl: "",
    hideOnExpiry: false,
    styles: createDefaultStyles(),
    ...partial,
  };
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

export function createBlock(type: BlockType): Block {
  switch (type) {
    case "section":
      return createSectionBlock();
    case "text":
      return createTextBlock();
    case "image":
      return createImageBlock();
    case "button":
      return createButtonBlock();
    case "divider":
      return createDividerBlock();
    case "video":
      return createVideoBlock();
    case "social":
      return createSocialIconsBlock();
    case "spacer":
      return createSpacerBlock();
    case "html":
      return createHtmlBlock();
    case "menu":
      return createMenuBlock();
    case "table":
      return createTableBlock();
    case "countdown":
      return createCountdownBlock();
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
