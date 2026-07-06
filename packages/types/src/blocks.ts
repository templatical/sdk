export interface SpacingValue {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface BlockStyles {
  padding: SpacingValue;
  backgroundColor?: string;
}

export interface BlockVisibility {
  desktop: boolean;
  mobile: boolean;
}

export interface BaseBlock {
  id: string;
  type: string;
  styles: BlockStyles;
  visibility?: BlockVisibility;
  displayCondition?: {
    label: string;
    before: string;
    after: string;
    group?: string;
    description?: string;
  };
}

export type ColumnLayout = "1" | "2" | "3" | "2-1" | "1-2";

/**
 * Optional outer frame for a section. When present, the section is rendered
 * inside an `mj-wrapper` — a full-width band (its own background + padding)
 * that frames the section, e.g. a white card sitting on a colored band.
 */
export interface SectionWrapper {
  backgroundColor?: string;
  padding?: SpacingValue;
  /** Corner radius in px for the outer frame. Omitted/0 = square corners. */
  borderRadius?: number;
}

export interface SectionBlock extends BaseBlock {
  type: "section";
  columns: ColumnLayout;
  children: Block[][];
  /** Corner radius in px. Omitted/0 = square corners. */
  borderRadius?: number;
  /** Optional outer frame (rendered as an `mj-wrapper` around the section). */
  wrapper?: SectionWrapper;
}

export type HeadingLevel = 1 | 2 | 3 | 4;

export const HEADING_LEVEL_FONT_SIZE: Record<HeadingLevel, number> = {
  1: 36,
  2: 28,
  3: 22,
  4: 18,
};

export interface TitleBlock extends BaseBlock {
  type: "title";
  content: string;
  level: HeadingLevel;
  color: string;
  textAlign: "left" | "center" | "right";
  fontFamily?: string;
}

export interface ParagraphBlock extends BaseBlock {
  type: "paragraph";
  content: string;
}

export interface ImageBlock extends BaseBlock {
  type: "image";
  src: string;
  alt: string;
  width: number | "full";
  align: "left" | "center" | "right";
  linkUrl?: string;
  linkOpenInNewTab?: boolean;
  placeholderUrl?: string;
  decorative?: boolean;
}

export interface ButtonBlock extends BaseBlock {
  type: "button";
  text: string;
  url: string;
  openInNewTab?: boolean;
  backgroundColor: string;
  textColor: string;
  borderRadius: number;
  fontSize: number;
  buttonPadding: SpacingValue;
  fontFamily?: string;
  width?: number | "full";
}

export interface DividerBlock extends BaseBlock {
  type: "divider";
  lineStyle: "solid" | "dashed" | "dotted";
  color: string;
  thickness: number;
  width: number | "full";
}

export interface VideoBlock extends BaseBlock {
  type: "video";
  url: string;
  openInNewTab?: boolean;
  thumbnailUrl: string;
  alt: string;
  width: number | "full";
  align: "left" | "center" | "right";
  placeholderUrl?: string;
}

export type SocialPlatform =
  | "facebook"
  | "twitter"
  | "instagram"
  | "linkedin"
  | "youtube"
  | "tiktok"
  | "pinterest"
  | "email"
  | "whatsapp"
  | "telegram"
  | "discord"
  | "snapchat"
  | "reddit"
  | "github"
  | "dribbble"
  | "behance"
  | "website";

export type SocialIconStyle =
  "solid" | "outlined" | "rounded" | "square" | "circle";

export type SocialIconSize = "small" | "medium" | "large";

export interface SocialIcon {
  id: string;
  platform: SocialPlatform;
  url: string;
}

export interface SocialIconsBlock extends BaseBlock {
  type: "social";
  icons: SocialIcon[];
  iconStyle: SocialIconStyle;
  iconSize: SocialIconSize;
  spacing: number;
  align: "left" | "center" | "right";
}

export interface SpacerBlock extends BaseBlock {
  type: "spacer";
  height: number;
}

export interface HtmlBlock extends BaseBlock {
  type: "html";
  content: string;
}

export interface MenuItemData {
  id: string;
  text: string;
  url: string;
  openInNewTab: boolean;
  bold: boolean;
  underline: boolean;
  color?: string;
}

export interface MenuBlock extends BaseBlock {
  type: "menu";
  items: MenuItemData[];
  fontSize: number;
  fontFamily?: string;
  color: string;
  linkColor?: string;
  textAlign: "left" | "center" | "right";
  separator: string;
  separatorColor: string;
  spacing: number;
}

export interface TableCellData {
  id: string;
  content: string;
}

export interface TableRowData {
  id: string;
  cells: TableCellData[];
}

export interface TableBlock extends BaseBlock {
  type: "table";
  rows: TableRowData[];
  hasHeaderRow: boolean;
  headerBackgroundColor?: string;
  borderColor: string;
  borderWidth: number;
  cellPadding: number;
  fontSize: number;
  fontFamily?: string;
  color: string;
  textAlign: "left" | "center" | "right";
}

export interface CountdownBlock extends BaseBlock {
  type: "countdown";
  targetDate: string;
  timezone: string;
  showDays: boolean;
  showHours: boolean;
  showMinutes: boolean;
  showSeconds: boolean;
  separator: ":" | "-" | " ";
  digitFontSize: number;
  digitColor: string;
  labelColor: string;
  labelFontSize: number;
  backgroundColor: string;
  fontFamily?: string;
  labelDays: string;
  labelHours: string;
  labelMinutes: string;
  labelSeconds: string;
  expiredMessage: string;
  expiredImageUrl: string;
  hideOnExpiry: boolean;
}

export interface CustomBlock extends BaseBlock {
  type: "custom";
  customType: string;
  fieldValues: Record<string, unknown>;
  renderedHtml?: string;
  dataSourceFetched?: boolean;
}

export type Block =
  | SectionBlock
  | TitleBlock
  | ParagraphBlock
  | ImageBlock
  | ButtonBlock
  | DividerBlock
  | VideoBlock
  | SocialIconsBlock
  | SpacerBlock
  | HtmlBlock
  | MenuBlock
  | TableBlock
  | CountdownBlock
  | CustomBlock;

export type BlockType = Block["type"];
