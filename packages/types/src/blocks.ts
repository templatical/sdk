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

export type BorderStyle = "solid" | "dashed" | "dotted";

export type BorderSide = "top" | "right" | "bottom" | "left";

export const BORDER_SIDES: readonly BorderSide[] = [
  "top",
  "right",
  "bottom",
  "left",
];

/** One side of a border. A width of `0` leaves that side undrawn. */
export interface BorderSideValue {
  /** Width in px. `0` means no border on this side. */
  width: number;
  style: BorderStyle;
  color: string;
}

/**
 * A border described per side, like `SpacingValue`. Only elements MJML can
 * border natively carry one: sections, images and buttons.
 */
export interface BorderValue {
  top: BorderSideValue;
  right: BorderSideValue;
  bottom: BorderSideValue;
  left: BorderSideValue;
}

/** The same side value on all four sides. */
export function uniformBorder(side: BorderSideValue): BorderValue {
  return {
    top: { ...side },
    right: { ...side },
    bottom: { ...side },
    left: { ...side },
  };
}

/**
 * Convert one side of a border to a CSS `border` value like
 * `"1px solid #cccccc"`. Returns `null` when the side is absent or its width is
 * not a positive number, so callers emit nothing rather than a `0px` border.
 */
export function toBorderCss(side: BorderSideValue | undefined): string | null {
  if (
    !side ||
    typeof side.width !== "number" ||
    !Number.isFinite(side.width) ||
    side.width <= 0
  ) {
    return null;
  }

  return `${side.width}px ${side.style} ${side.color}`;
}

/**
 * Resolve a border to the CSS declarations that draw it, keyed by kebab-case
 * property: one `border` when all four sides are drawn identically, otherwise
 * one `border-<side>` per drawn side. Empty when there is nothing to draw.
 *
 * The keys double as MJML attribute names (`mj-section`, `mj-image` and
 * `mj-button` accept `border` and every `border-<side>`), so the renderer and
 * the editor canvas both go through this and can't disagree about a border.
 */
export function toBorderDeclarations(
  border: BorderValue | undefined,
): Partial<Record<"border" | `border-${BorderSide}`, string>> {
  if (!border) {
    return {};
  }

  const css = BORDER_SIDES.map((side) => toBorderCss(border[side]));
  if (css[0] !== null && css.every((value) => value === css[0])) {
    return { border: css[0] };
  }

  const declarations: Partial<Record<`border-${BorderSide}`, string>> = {};
  BORDER_SIDES.forEach((side, index) => {
    const value = css[index];
    if (value !== null) {
      declarations[`border-${side}`] = value;
    }
  });
  return declarations;
}

export type BorderCorner =
  "topLeft" | "topRight" | "bottomRight" | "bottomLeft";

/** In CSS shorthand order: top-left, top-right, bottom-right, bottom-left. */
export const BORDER_CORNERS: readonly BorderCorner[] = [
  "topLeft",
  "topRight",
  "bottomRight",
  "bottomLeft",
];

/** A radius per corner, in px. */
export type CornerRadius = Record<BorderCorner, number>;

/**
 * A corner radius in px: one number for all four corners, or a radius per
 * corner.
 */
export type BorderRadiusValue = number | CornerRadius;

function cornerPx(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

/**
 * Convert a corner radius to a CSS `border-radius` value: `"8px"` when all
 * corners match, otherwise the four-value shorthand `"8px 8px 0px 0px"`
 * (top-left, top-right, bottom-right, bottom-left). Returns `null` when every
 * corner is square, so callers emit nothing.
 *
 * A non-finite or negative corner counts as square — hand-authored JSON is the
 * only way to produce one, and the export must not carry it.
 */
export function toBorderRadiusCss(
  radius: BorderRadiusValue | undefined,
): string | null {
  if (radius === undefined || radius === null) {
    return null;
  }

  const corners =
    typeof radius === "number"
      ? BORDER_CORNERS.map(() => cornerPx(radius))
      : BORDER_CORNERS.map((corner) => cornerPx(radius[corner]));

  if (corners.every((value) => value === 0)) {
    return null;
  }
  if (corners.every((value) => value === corners[0])) {
    return `${corners[0]}px`;
  }
  return corners.map((value) => `${value}px`).join(" ");
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
  /**
   * Corner radius in px for the outer frame — one number, or a radius per
   * corner. Omitted/0 = square corners.
   */
  borderRadius?: BorderRadiusValue;
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
  /**
   * Corner radius in px — one number, or a radius per corner. Omitted/0 =
   * square corners.
   */
  borderRadius?: BorderRadiusValue;
  /**
   * Border around the section box, per side. Omitted = no border; a side with
   * width 0 is not drawn.
   */
  border?: BorderValue;
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
  /**
   * Corner radius in px. Omitted/0 = square corners. A radius of at least half
   * the rendered size rounds a square image to a circle, which is how avatar
   * and portrait layouts are built. A radius per corner is also accepted.
   */
  borderRadius?: BorderRadiusValue;
  /**
   * Border around the image itself, per side. Omitted = no border; a side with
   * width 0 is not drawn.
   */
  border?: BorderValue;
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
  /** Corner radius in px — one number, or a radius per corner. */
  borderRadius: BorderRadiusValue;
  /**
   * Border around the button itself, per side. Omitted = no border; a side
   * with width 0 is not drawn. For an outline ("ghost") button, set
   * `backgroundColor` to the keyword `"transparent"` and set `textColor` too —
   * a new button is `#333333` with white text.
   */
  border?: BorderValue;
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

/**
 * Layout-only hole where authored content is spliced in. Extends BaseBlock so
 * Block walkers stay typed (`styles` unused; spliced out before render).
 */
export interface SlotBlock extends BaseBlock {
  type: "slot";
}

/**
 * Layout-only band rendered as `mj-wrapper`. The block is the band:
 * `styles.backgroundColor` / `styles.padding` / `borderRadius` map to the
 * wrapper. Legal in layout only this ship.
 */
export interface WrapperBlock extends BaseBlock {
  type: "wrapper";
  children: Block[];
  borderRadius?: number;
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
  | CustomBlock
  | SlotBlock
  | WrapperBlock;

export type BlockType = Block["type"];
