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
  /**
   * Whether columns stack vertically on mobile. Absent or `true` keeps MJML's
   * default responsive behavior (columns stack below 480px). `false` renders
   * the columns inside an `<mj-group>` so they stay side-by-side on mobile,
   * proportionally shrunk to fit.
   */
  stackOnMobile?: boolean;
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

/**
 * Spacing (px) for the HTML a rich-text block stores — the `<p>`, `<ul>`,
 * `<ol>` and `<li>` elements TipTap produces.
 *
 * The editor canvas and the exported email must agree on these to the pixel,
 * so this is the one place they are stated. `@templatical/renderer` reads them
 * to build the global rule it emits; the editor's canvas CSS restates them as
 * literals (CSS cannot import a constant) and a parity test holds the two
 * together.
 *
 * Fixed px, never a `rem`- or base-size-derived scale: an email body is a
 * fixed-width document, so content spacing must not move when a consumer
 * scales the editor chrome.
 */
export const RICH_TEXT_SPACING = {
  /** Gap below every `<p>` except the last — the space between paragraphs. */
  paragraphGap: 8,
  /** Vertical margin on `<ul>` / `<ol>`. */
  listMarginY: 8,
  /** Left padding on `<ul>` / `<ol>` — the bullet indent. */
  listPaddingLeft: 24,
  /** Vertical margin on `<li>`. */
  listItemMarginY: 4,
} as const;

export interface TitleBlock extends BaseBlock {
  type: "title";
  content: string;
  level: HeadingLevel;
  /** Text color. Unset = inherit the document-level `textColor`. */
  color?: string;
  textAlign: "left" | "center" | "right";
  fontFamily?: string;
}

export interface ParagraphBlock extends BaseBlock {
  type: "paragraph";
  content: string;
  /**
   * Gap in px between this block's paragraphs — the space below every `<p>`
   * except the last. Absent means `RICH_TEXT_SPACING.paragraphGap`.
   *
   * Only affects a block holding more than one paragraph; a single `<p>` has no
   * internal gap, and the space around the block is `styles.padding`.
   *
   * `0` is a valid choice (paragraphs butted together) and is distinct from the
   * field being absent, so readers must test for `undefined` rather than
   * falsiness.
   */
  paragraphSpacing?: number;
}

export interface ImageBlock extends BaseBlock {
  type: "image";
  src: string;
  alt: string;
  width: number | "full";
  /**
   * Height in pixels. Absent means the height is derived from the width, so the
   * image keeps its aspect ratio — setting both stretches it, since email
   * clients don't support `object-fit`.
   */
  height?: number;
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
  /**
   * Placement of the button within its column. No visible effect when `width`
   * is `"full"`, since the button then spans the column.
   */
  align: "left" | "center" | "right";
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
  /**
   * Height in pixels for the thumbnail. Absent means the height is derived from
   * the width, so the thumbnail keeps its aspect ratio — setting both stretches
   * it, since email clients don't support `object-fit`.
   */
  height?: number;
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
  /** Base text/link color. Unset = inherit the document-level `textColor`. */
  color?: string;
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
  /** Text color. Unset = inherit the document-level `textColor`. */
  color?: string;
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
