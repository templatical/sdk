export interface SpacingValue {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ResponsiveStyles {
  tablet?: Partial<BlockStyles>;
  mobile?: Partial<BlockStyles>;
}

export interface BlockStyles {
  padding: SpacingValue;
  margin: SpacingValue;
  backgroundColor?: string;
  responsive?: ResponsiveStyles;
}

export interface BlockVisibility {
  desktop: boolean;
  tablet: boolean;
  mobile: boolean;
}

export interface BaseBlock {
  id: string;
  type: string;
  styles: BlockStyles;
  customCss?: string;
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

export interface SectionBlock extends BaseBlock {
  type: "section";
  columns: ColumnLayout;
  children: Block[][];
}

export interface TextBlock extends BaseBlock {
  type: "text";
  content: string;
  fontSize: number;
  color: string;
  textAlign: "left" | "center" | "right";
  fontWeight: "normal" | "bold";
  fontFamily?: string;
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
  | "behance";

export type SocialIconStyle =
  | "solid"
  | "outlined"
  | "rounded"
  | "square"
  | "circle";

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
  | TextBlock
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
