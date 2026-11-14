import { localeTag, text, warn } from "./localization";
import {
  BORDER_SIDES,
  BUTTON_LINE_HEIGHT,
  canonicalFontStack,
  roundHundredths,
  findOpenTagEnd,
  isSafeHtmlUrl,
  HEADING_LEVEL_FONT_SIZE,
  isBlankRichText,
  createTitleBlock,
  createParagraphBlock,
  createImageBlock,
  createButtonBlock,
  createDividerBlock,
  createSpacerBlock,
  createHtmlBlock,
  createSocialIconsBlock,
  createMenuBlock,
  createTableBlock,
  createVideoBlock,
  generateId,
} from "@templatical/types";
import type {
  Block,
  ButtonBlock,
  BorderStyle,
  BorderValue,
  DividerBlock,
  HeadingLevel,
  ImageBlock,
  BuiltInSocialPlatform,
  SocialIcon,
  SocialIconSize,
  SocialIconStyle,
  SocialIconsBlock,
  SocialIconTone,
  MenuItemData,
  SpacingValue,
  TableRowData,
  TableCellData,
  VideoBlock,
} from "@templatical/types";
import type {
  BeeFreeeIconItem,
  BeeFreeeModule,
  BeeFreeeModuleDescriptor,
  BeeFreeeSocialIcon,
  BeeFreeeTableRow,
  ImportReportEntry,
} from "./types";
import {
  decodeEntitiesInHtml,
  decodeEntitiesInTokens,
  decodePlainTextEntities,
  restoreDoubledNbsp,
  trimHighlightedTokenPadding,
  unwrapMergeTagCode,
} from "./merge-tokens";
import {
  parseImageBorderRadius,
  parsePxValue,
  parseColor,
  isTransparentColor,
  parseBorderTop,
  extractPadding,
  readButtonPadding,
  readPxLength,
  parseDividerWidth,
} from "./style-parser";

/**
 * The template text color the import writes when the body sets none.
 */
export const FALLBACK_TEXT_COLOR = "#1a1a1a";

/**
 * What the caller knows about where a module lands.
 */
export interface ModuleContext {
  /**
   * Width in px of the Templatical column the block renders in. Without it a
   * px divider width is kept as pixels.
   */
  columnWidth?: number;
  /**
   * The template's `textColor`, which every text block without a color of
   * its own inherits. Defaults to `FALLBACK_TEXT_COLOR`.
   */
  textColor?: string;
  /**
   * A blank paragraph module becomes a spacer. A translation sets this to
   * false so its content stays a paragraph and can be stored in `l10n`.
   */
  blankParagraphAsSpacer?: boolean;
  /**
   * The page body font: `canonicalFontStack` of
   * `page.body.content.style["font-family"]`. Unset when the body sets no
   * font. An HTML module writes it on its wrapper.
   */
  bodyFontFamily?: string;
}

/**
 * Maps BeeFree module type strings to short keys.
 */
const MODULE_TYPE_MAP: Record<string, string> = {
  "mailup-bee-newsletter-modules-text": "paragraph",
  "mailup-bee-newsletter-modules-paragraph": "paragraph",
  "mailup-bee-newsletter-modules-heading": "title",
  "mailup-bee-newsletter-modules-list": "list",
  "mailup-bee-newsletter-modules-image": "image",
  "mailup-bee-newsletter-modules-button": "button",
  "mailup-bee-newsletter-modules-divider": "divider",
  "mailup-bee-newsletter-modules-spacer": "spacer",
  "mailup-bee-newsletter-modules-html": "html",
  "mailup-bee-newsletter-modules-social": "social",
  "mailup-bee-newsletter-modules-video": "video",
  "mailup-bee-newsletter-modules-menu": "menu",
  "mailup-bee-newsletter-modules-table": "table",
  "mailup-bee-newsletter-modules-icons": "icons",
};

const ADDON_MODULE = "mailup-bee-newsletter-modules-addon";
const EMPTY_MODULE = "mailup-bee-newsletter-modules-empty";
const PARAGRAPH_MODULE = "mailup-bee-newsletter-modules-paragraph";
const HTML_MODULE = "mailup-bee-newsletter-modules-html";

/**
 * An addon keeps the payload of the module it stands in for, so the payload it
 * carries names the converter. Checked in this order.
 */
const ADDON_PAYLOADS = [
  ["image", "image"],
  ["html", "html"],
  ["heading", "title"],
  ["paragraph", "paragraph"],
  ["text", "paragraph"],
  ["list", "list"],
  ["button", "button"],
  ["divider", "divider"],
  ["menuItemsList", "menu"],
  ["iconsList", "icons"],
] as const;

/** The converter a module goes to, or `undefined` when there is none. */
function moduleKind(module: BeeFreeeModule): string | undefined {
  if (module.type !== ADDON_MODULE) return MODULE_TYPE_MAP[module.type];
  return ADDON_PAYLOADS.find(
    ([key]) => module.descriptor[key] !== undefined,
  )?.[1];
}

const SOCIAL_PLATFORM_MAP: Record<string, BuiltInSocialPlatform> = {
  facebook: "facebook",
  twitter: "twitter",
  x: "twitter",
  instagram: "instagram",
  linkedin: "linkedin",
  xing: "xing",
  youtube: "youtube",
  tiktok: "tiktok",
  pinterest: "pinterest",
  email: "email",
  whatsapp: "whatsapp",
  telegram: "telegram",
  discord: "discord",
  snapchat: "snapchat",
  reddit: "reddit",
  github: "github",
  dribbble: "dribbble",
  behance: "behance",
};

type Align = "left" | "center" | "right";
type LineStyle = "solid" | "dashed" | "dotted";

function toAlign(value: string | undefined, fallback: Align = "left"): Align {
  if (value === "left" || value === "center" || value === "right") return value;
  return fallback;
}

function toLineStyle(
  value: string | undefined,
  fallback: LineStyle = "solid",
): LineStyle {
  if (value === "solid" || value === "dashed" || value === "dotted")
    return value;
  return fallback;
}

/**
 * Strip every `<…>` from a button label and reject any stray `<` or `>`
 * left behind (e.g. a truncated `<script`). The original
 * `value.replace(/<[^>]*>/g, "")` was both polynomial-ReDoS over
 * `<<<<…` inputs and an incomplete sanitizer — an unterminated `<script`
 * would survive the strip. Downstream HTML-escapes the label at render
 * time, but stripping here keeps the imported JSON clean.
 */
function stripTagsPlain(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    if (text[i] === "<") {
      const close = text.indexOf(">", i + 1);
      if (close === -1) {
        // Unterminated tag — discard the rest.
        break;
      }
      i = close + 1;
      continue;
    }
    if (text[i] === ">") {
      i++;
      continue;
    }
    out += text[i];
    i++;
  }
  return out;
}

/**
 * Rich text keeps the markup around a merge tag. Unwrap the BeeFree `<code>`
 * before decoding, so a token quoted inside `data-bee-code` is not decoded
 * in the attribute. A quote inside a token stays encoded in an attribute
 * and is decoded in a text node.
 */
function importedHtml(html: string): string {
  return restoreDoubledNbsp(
    decodeEntitiesInHtml(trimHighlightedTokenPadding(unwrapMergeTagCode(html))),
  );
}

/**
 * Text, paragraph and list HTML after empty paragraphs are dropped on the
 * source, once merge-tag chips are unwrapped and before character references
 * inside tokens are decoded. A chip that remains is unwrapped here, and an
 * `&nbsp;` is still a non-breaking space.
 */
function finishTextHtml(html: string): string {
  const unwrapped = trimHighlightedTokenPadding(unwrapMergeTagCode(html));
  return restoreDoubledNbsp(decodeEntitiesInHtml(unwrapped));
}

/**
 * A `<p>` BeeFree does not draw. The decision reads the module's source
 * HTML, before the style pass and before merge-tag chips are unwrapped. It
 * has no text other than ASCII whitespace, no non-breaking space, and no
 * replaced or void element, and its subtree at any depth holds an element
 * other than `<span>` (`strong`, `em`, `code`, and the rest). An empty
 * `<code data-bee-type="mergetag">` is that element, so its paragraph is
 * dropped. An empty `<p>`, or one that holds only nested empty `<span>`
 * elements, is a blank line and stays, so `fillEmptyParagraphs` paints it.
 * `<p>&nbsp;</p>` and `<p><br></p>` stay. A `<p>` whose own `style` paints
 * a box stays, and so does one whose subtree holds an element whose style
 * paints a box or sets `display` to `inline-block` or `block` with a
 * non-zero width and height. A `<p>` that opens while another `<p>` is open
 * stays as written. When dropping leaves no visible content, the HTML stays,
 * so a blank text module is unchanged. A box, on the `<p>` or on a
 * descendant, is visible content, so a formatting sibling of one is dropped
 * and an empty sibling stays.
 */
const LINE_BOX_TAGS = new Set([
  "area",
  "audio",
  "base",
  "br",
  "canvas",
  "col",
  "embed",
  "hr",
  "iframe",
  "img",
  "input",
  "link",
  "math",
  "meta",
  "object",
  "param",
  "picture",
  "select",
  "source",
  "svg",
  "textarea",
  "track",
  "video",
  "wbr",
]);

function isAsciiLetter(char: string | undefined): boolean {
  if (char === undefined) return false;
  const code = char.charCodeAt(0);
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isTagNameChar(char: string): boolean {
  const code = char.charCodeAt(0);
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122)
  );
}

function isAsciiSpace(char: string): boolean {
  return (
    char === " " ||
    char === "\t" ||
    char === "\n" ||
    char === "\r" ||
    char === "\f"
  );
}

function rangeHasInk(html: string, from: number, to: number): boolean {
  for (let i = from; i < to; i++) {
    if (!isAsciiSpace(html[i])) return true;
  }
  return false;
}

function tagSelfCloses(html: string, end: number): boolean {
  let i = end - 1;
  while (i >= 0 && isAsciiSpace(html[i])) i--;
  return html[i] === "/";
}

function isNoneOrHidden(token: string): boolean {
  const value = token.toLowerCase();
  return value === "none" || value === "hidden";
}

/**
 * Units that are a length, so `0` in that unit is zero. A bare `0` has an
 * empty unit. Membership is one lookup: each unit is not its own branch.
 */
const ZERO_LENGTH_UNITS = new Set([
  "",
  "px",
  "em",
  "rem",
  "%",
  "pt",
  "pc",
  "in",
  "cm",
  "mm",
  "ex",
  "ch",
  "vw",
  "vh",
  "vmin",
  "vmax",
]);

/**
 * A zero length. `0px` is zero, the same way a module's letter-spacing
 * treats it.
 */
function isZeroLength(token: string): boolean {
  const value = token.toLowerCase();
  let i = 0;
  if (value[i] !== "0") return false;
  while (value[i] === "0") i++;
  if (value[i] === ".") {
    i++;
    if (value[i] !== "0") return false;
    while (value[i] === "0") i++;
  }
  return ZERO_LENGTH_UNITS.has(value.slice(i));
}

/** A zero length, `none`, or `hidden`. */
function isInertBoxToken(token: string): boolean {
  return isNoneOrHidden(token) || isZeroLength(token);
}

const BORDER_SHORTHANDS = new Set([
  "border",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
]);

/** `border-style` and `border-*-style`. A style alone draws at medium width. */
function isBorderStyleProperty(name: string): boolean {
  return (
    name === "border-style" ||
    (name.startsWith("border-") && name.endsWith("-style"))
  );
}

/**
 * Whether one border declaration paints. Shorthands paint unless a token is
 * a zero length or `none`/`hidden`. Style longhands paint unless every token
 * is `none`/`hidden`. Width, color, radius and every other longhand do not.
 */
function borderDeclarationPaints(name: string, tokens: string[]): boolean {
  if (BORDER_SHORTHANDS.has(name)) {
    return !tokens.some(
      (token) => isZeroLength(token) || isNoneOrHidden(token),
    );
  }
  if (isBorderStyleProperty(name)) return !tokens.every(isNoneOrHidden);
  return false;
}

function isBoxProperty(name: string): boolean {
  return (
    name === "height" ||
    name === "min-height" ||
    name.startsWith("padding") ||
    name.startsWith("border") ||
    name.startsWith("margin")
  );
}

/**
 * A trailing `!important`, including `! important`, and the value with that
 * flag cut off. The flag is not part of the value.
 */
function splitImportant(value: string): { text: string; important: boolean } {
  const text = value.trim();
  const bang = text.lastIndexOf("!");
  if (
    bang !== -1 &&
    text
      .slice(bang + 1)
      .trim()
      .toLowerCase() === "important"
  ) {
    return { text: text.slice(0, bang), important: true };
  }
  return { text, important: false };
}

/**
 * Tokens of one declaration value. A trailing `!important`, including
 * `! important`, is cut off. ASCII whitespace splits tokens only at
 * parenthesis depth 0, so `rgb(0 0 0)` stays one token.
 */
function boxValueTokens(value: string): string[] {
  const text = splitImportant(value).text;

  const tokens: string[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "(") depth++;
    else if (char === ")" && depth > 0) depth--;
    if (depth === 0 && isAsciiSpace(char)) {
      if (start !== -1) {
        tokens.push(text.slice(start, i));
        start = -1;
      }
      continue;
    }
    if (start === -1) start = i;
  }
  if (start !== -1) tokens.push(text.slice(start));
  return tokens;
}

/**
 * The winning declaration for each property `accept` keeps. The last one
 * wins, and an `!important` declaration beats a later normal one for that
 * name.
 */
function cascadeWinners(
  css: string,
  accept: (name: string) => boolean,
): Map<string, { value: string; important: boolean }> {
  const winners = new Map<string, { value: string; important: boolean }>();
  for (const part of css.split(";")) {
    const colon = part.indexOf(":");
    if (colon === -1) continue;
    const name = part.slice(0, colon).trim().toLowerCase();
    if (!accept(name)) continue;
    const value = part.slice(colon + 1);
    const important = splitImportant(value).important;
    const current = winners.get(name);
    if (current !== undefined && current.important && !important) continue;
    winners.set(name, { value, important });
  }
  return winners;
}

function isTypographyProperty(name: string): boolean {
  return name === "font-size" || name === "line-height";
}

/**
 * Whether a `<p>` `style` paints a box. Typography (`font-size`,
 * `line-height`, `text-align`, `color`, `font-family`) does not. Padding,
 * height, min-height and margin do, unless every token of the value is
 * zero, `none` or `hidden`. Border declarations follow `borderDeclarationPaints`.
 * Declarations are collected by lowercased property name. The last one wins,
 * and an `!important` declaration beats a later normal one for that name.
 * A shorthand and a longhand are different names, so both are evaluated.
 */
function stylePaintsBox(css: string): boolean {
  const winners = cascadeWinners(css, isBoxProperty);
  for (const [name, winner] of winners) {
    const tokens = boxValueTokens(winner.value);
    if (tokens.length === 0) continue;
    if (name.startsWith("border")) {
      if (borderDeclarationPaints(name, tokens)) return true;
      continue;
    }
    if (!tokens.every(isInertBoxToken)) return true;
  }
  return false;
}

/** The open tag's own `style`, read inside the quote-aware tag bounds. */
function openTagPaintsBox(html: string, start: number, end: number): boolean {
  const css = findStyleAttr(html.slice(start, end + 1))?.value;
  return css !== undefined && stylePaintsBox(css);
}

/**
 * A length above zero. `24px` and `.5px` count. `0`, `auto` and an unknown
 * unit do not.
 */
function isNonZeroLength(token: string): boolean {
  const match = /^(\d+(?:\.\d+)?|\.\d+)([a-z%]*)$/i.exec(token);
  if (!match || !ZERO_LENGTH_UNITS.has(match[2].toLowerCase())) return false;
  return Number(match[1]) > 0;
}

/**
 * `display: inline-block` or `block` together with a non-zero width and
 * height. An icon anchor draws this way. Height alone is already a painted
 * box; this is the pair the display needs.
 */
function styleDrawsSizedBlock(css: string): boolean {
  const winners = cascadeWinners(
    css,
    (name) => name === "display" || name === "width" || name === "height",
  );
  const display = boxValueTokens(
    winners.get("display")?.value ?? "",
  )[0]?.toLowerCase();
  if (display !== "inline-block" && display !== "block") return false;
  const width = boxValueTokens(winners.get("width")?.value ?? "")[0];
  const height = boxValueTokens(winners.get("height")?.value ?? "")[0];
  return (
    width !== undefined &&
    height !== undefined &&
    isNonZeroLength(width) &&
    isNonZeroLength(height)
  );
}

/**
 * A descendant draws. Its own style paints a box, or it sets
 * `display:inline-block` or `block` with a non-zero width and height.
 */
function openTagDrawsBox(html: string, start: number, end: number): boolean {
  const css = findStyleAttr(html.slice(start, end + 1))?.value;
  if (css === undefined) return false;
  return styleDrawsSizedBlock(css) || stylePaintsBox(css);
}

/**
 * Paragraphs BeeFree does not draw, as source ranges. One forward pass.
 * A no-ink paragraph is listed only when it contains an element other than
 * `<span>`. An empty `<p>` holds nothing, so it is not listed.
 */
function emptyParagraphRanges(html: string): Array<[number, number]> {
  const skip: Array<[number, number]> = [];
  let open: {
    start: number;
    ink: boolean;
    depth: number;
    malformed: boolean;
    nonSpan: boolean;
  } | null = null;
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      if (open && rangeHasInk(html, i, html.length)) open.ink = true;
      break;
    }
    if (lt > i && open && rangeHasInk(html, i, lt)) open.ink = true;
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      i = end === -1 ? html.length : end + 3;
      continue;
    }
    const slash = html[lt + 1] === "/";
    const nameStart = lt + (slash ? 2 : 1);
    if (!isAsciiLetter(html[nameStart])) {
      if (open) open.ink = true;
      i = lt + 1;
      continue;
    }
    let nameEnd = nameStart + 1;
    while (nameEnd < html.length && isTagNameChar(html[nameEnd])) nameEnd++;
    const name = html.slice(nameStart, nameEnd).toLowerCase();
    if (slash) {
      const gt = html.indexOf(">", nameEnd);
      if (gt === -1) break;
      i = gt + 1;
      if (name === "p" && open) {
        open.depth -= 1;
        if (open.depth === 0) {
          if (!open.ink && !open.malformed && open.nonSpan) {
            skip.push([open.start, i]);
          }
          open = null;
        }
      }
      continue;
    }
    const end = findOpenTagEnd(html, nameEnd);
    if (end === -1) break;
    if (name === "p") {
      if (open) {
        // A paragraph opened inside another is malformed. Leave it, and the
        // paragraph around it, exactly as written.
        open.malformed = true;
        if (!tagSelfCloses(html, end)) open.depth += 1;
      } else if (!tagSelfCloses(html, end)) {
        open = {
          start: lt,
          ink: openTagPaintsBox(html, lt, end),
          depth: 1,
          malformed: false,
          nonSpan: false,
        };
      }
    } else if (open) {
      if (name !== "span") open.nonSpan = true;
      if (LINE_BOX_TAGS.has(name) || openTagDrawsBox(html, lt, end)) {
        open.ink = true;
      }
    }
    i = end + 1;
  }
  return skip;
}

/**
 * Text other than ASCII whitespace, a character reference, a line-box
 * element, a `<p>` whose own style paints a box, or a descendant whose
 * style paints a box or draws a sized block. Comments are not
 * content. One forward pass; an open tag ends at `findOpenTagEnd`, so a
 * quoted `>` does not end it.
 */
function hasVisibleContent(html: string): boolean {
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) return rangeHasInk(html, i, html.length);
    if (rangeHasInk(html, i, lt)) return true;
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      i = end === -1 ? html.length : end + 3;
      continue;
    }
    const slash = html[lt + 1] === "/";
    const nameStart = lt + (slash ? 2 : 1);
    if (!isAsciiLetter(html[nameStart])) return true;
    let nameEnd = nameStart + 1;
    while (nameEnd < html.length && isTagNameChar(html[nameEnd])) nameEnd++;
    const name = html.slice(nameStart, nameEnd).toLowerCase();
    if (!slash && LINE_BOX_TAGS.has(name)) return true;
    if (slash) {
      const gt = html.indexOf(">", nameEnd);
      if (gt === -1) return rangeHasInk(html, nameEnd, html.length);
      i = gt + 1;
      continue;
    }
    const end = findOpenTagEnd(html, nameEnd);
    if (end === -1) return rangeHasInk(html, lt, html.length);
    if (name === "p" && openTagPaintsBox(html, lt, end)) return true;
    if (name !== "p" && openTagDrawsBox(html, lt, end)) return true;
    i = end + 1;
  }
  return false;
}

/**
 * One forward pass over open `p` tags (`<p`, any case, then a non-name
 * character). Each tag is bounded with `findOpenTagEnd`; anything else is
 * skipped to the next `<`. `matches` stops the scan.
 */
function paragraphOpenTagMatches(
  html: string,
  matches: (html: string, start: number, end: number) => boolean,
): boolean {
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) return false;
    const mark = html[lt + 1];
    if (mark.toLowerCase() === "p" && !isTagNameChar(html.charAt(lt + 2))) {
      const end = findOpenTagEnd(html, lt + 2);
      if (end === -1) return false;
      if (matches(html, lt, end)) return true;
      i = end + 1;
      continue;
    }
    i = lt + 1;
  }
  return false;
}

/**
 * Whether blank rich text has a `<p>` whose own style paints a box. The
 * caller passes HTML that `isBlankRichText` already accepted, so the only
 * tags are paragraph tags and whitespace.
 */
function paragraphHtmlPaintsBox(html: string): boolean {
  return paragraphOpenTagMatches(html, openTagPaintsBox);
}

/**
 * Whether a paragraph's own tag declares `font-size` or `line-height`.
 * The cascade winner is what counts; the value is not read. No precedence
 * against `paragraph.style` is established, so the caller names it unread.
 */
function paragraphHasUnreadTypography(html: string | undefined): boolean {
  if (!html) return false;
  return paragraphOpenTagMatches(html, (source, start, end) => {
    const css = findStyleAttr(source.slice(start, end + 1))?.value;
    if (css === undefined) return false;
    return cascadeWinners(css, isTypographyProperty).size > 0;
  });
}

function withoutEmptyParagraphs(html: string): string {
  if (html.indexOf("<") === -1) return html;
  const skip = emptyParagraphRanges(html);
  if (skip.length === 0) return html;
  const parts: string[] = [];
  let cursor = 0;
  for (const [start, end] of skip) {
    if (start > cursor) parts.push(html.slice(cursor, start));
    // Ranges are emitted in order and do not overlap, so each end is past
    // the cursor.
    cursor = end;
  }
  if (cursor < html.length) parts.push(html.slice(cursor));
  const dropped = parts.join("");
  if (!hasVisibleContent(dropped)) return html;
  return dropped;
}

/**
 * A button label or table cell is plain text. Unwrap before stripping, so a
 * `>` inside a mergetag `<code>` attribute is not the end of the tag, and
 * strip before decoding, so a `&gt;` inside a token is not a stray `>`.
 * Decode references outside tokens too: the renderer escapes the whole label.
 */
function importedPlainText(value: string): string {
  return decodePlainTextEntities(
    stripTagsPlain(trimHighlightedTokenPadding(unwrapMergeTagCode(value))),
  );
}

function makeStyles(descriptor: BeeFreeeModuleDescriptor): Block["styles"] {
  const padding = extractPadding(descriptor.style);
  const bg = parseColor(descriptor.style?.["background-color"]);
  return {
    padding,
    ...(bg ? { backgroundColor: bg } : {}),
  };
}

/**
 * The room an image, a lone icon or a divider is measured in: the column
 * less the block's own left and right padding. Column padding is folded onto
 * the block after this measurement, so it is not subtracted here.
 */
function measuredRoom(
  columnWidth: number | undefined,
  padding: SpacingValue,
): number | undefined {
  if (columnWidth === undefined) return undefined;
  return columnWidth - padding.left - padding.right;
}

interface StyleDecl {
  name: string;
  value: string;
}

/**
 * A block BeeFree's text markup uses as a root. `ul` / `ol` carry the module's
 * alignment and line-height; their items carry the text styles.
 */
const TEXT_ROOTS = new Set([
  "p",
  "li",
  "div",
  "ul",
  "ol",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
]);

/**
 * BeeFree stores a text module's line-height as a percentage (`120%`, `200%`)
 * or a unitless number, and renders that — not the px value TinyMCE writes
 * into the blob. The paragraph editor stores the unitless ratio.
 */
function moduleLineHeight(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed || /^(inherit|initial|unset|revert)$/i.test(trimmed))
    return undefined;
  const percent = /^(\d+(?:\.\d+)?)\s*%$/.exec(trimmed);
  if (percent) {
    const ratio = Number(percent[1]) / 100;
    if (!Number.isFinite(ratio) || ratio <= 0) return undefined;
    return String(Math.round(ratio * 1000) / 1000);
  }
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const ratio = Number(trimmed);
    return Number.isFinite(ratio) && ratio > 0 ? String(ratio) : undefined;
  }
  const length = /^(\d+(?:\.\d+)?)\s*(px|em|rem)$/i.exec(trimmed);
  if (length) return `${length[1]}${length[2].toLowerCase()}`;
  if (/^normal$/i.test(trimmed)) return "normal";
  return undefined;
}

/** `0` and `normal` are the CSS initial value, so they add no declaration. */
function moduleLetterSpacing(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const compact = value.trim().replace(/\s+/g, "");
  if (!compact || /^(normal|inherit|initial|unset|revert)$/i.test(compact))
    return undefined;
  if (/^0+(?:\.0+)?(?:px|em|rem|%)?$/i.test(compact)) return undefined;
  return compact;
}

/**
 * The colour BeeFree paints on a text module's links: `linkColor` or
 * `link-color` on the module style, then the same keys on `computedStyle`.
 */
function moduleLinkColor(
  content:
    | { style?: Record<string, string>; computedStyle?: Record<string, string> }
    | undefined,
): string {
  if (!content) return "";
  return (
    parseColor(content.style?.linkColor) ||
    parseColor(content.style?.["link-color"]) ||
    parseColor(content.computedStyle?.linkColor) ||
    parseColor(content.computedStyle?.["link-color"]) ||
    ""
  );
}

interface StyleAttrLoc {
  /** Index of the whitespace before `style`, so removing the attribute leaves no gap. */
  attrStart: number;
  /** First character after the attribute. A separating space stays when another attribute follows. */
  attrEnd: number;
  /** First character of the value, inside the quotes when the value is quoted. */
  valueStart: number;
  /** The closing quote when quoted; otherwise `attrEnd`. */
  valueEnd: number;
  /** Decoded, so a `;` inside an entity is not a declaration break. */
  value: string;
  quote?: '"' | "'";
}

function attrWhitespaceStart(tag: string, nameStart: number): number {
  let attrStart = nameStart;
  while (attrStart > 0 && /\s/.test(tag[attrStart - 1])) attrStart--;
  return attrStart;
}

/**
 * Exclusive end of the attribute. Whitespace after it belongs to the attribute
 * only when the tag ends there; a following attribute keeps its separator.
 */
function styleAttrEnd(tag: string, end: number): number {
  let i = end;
  while (i < tag.length && /\s/.test(tag[i])) i++;
  if (i >= tag.length || tag[i] === ">" || tag[i] === "/") return i;
  return end;
}

function styleLoc(
  tag: string,
  nameStart: number,
  valueStart: number,
  rawEnd: number,
  value: string,
  quote?: '"' | "'",
): StyleAttrLoc {
  const attrEnd = styleAttrEnd(tag, rawEnd);
  return {
    attrStart: attrWhitespaceStart(tag, nameStart),
    attrEnd,
    valueStart,
    valueEnd: quote ? rawEnd - 1 : attrEnd,
    value,
    ...(quote ? { quote } : {}),
  };
}

/** The first `style` attribute on an open tag, ignoring `data-mce-style`. */
export function findStyleAttr(tag: string): StyleAttrLoc | undefined {
  let i = 1;
  if (tag[i] === "/") i++;
  while (i < tag.length && /[a-z0-9]/i.test(tag[i])) i++;
  for (;;) {
    while (i < tag.length && /\s/.test(tag[i])) i++;
    if (i >= tag.length || tag[i] === ">" || tag[i] === "/") return undefined;
    const nameStart = i;
    while (i < tag.length && !/[\s=/>]/.test(tag[i])) i++;
    const name = tag.slice(nameStart, i).toLowerCase();
    const nameEnd = i;
    while (i < tag.length && /\s/.test(tag[i])) i++;
    if (i >= tag.length || tag[i] !== "=") {
      if (name === "style")
        return styleLoc(tag, nameStart, nameEnd, nameEnd, "");
      continue;
    }
    i++;
    while (i < tag.length && /\s/.test(tag[i])) i++;
    if (i >= tag.length) return undefined;
    const quote = tag[i];
    if (quote !== '"' && quote !== "'") {
      const valueStart = i;
      while (i < tag.length && !/\s/.test(tag[i]) && tag[i] !== ">") i++;
      if (name === "style") {
        return styleLoc(
          tag,
          nameStart,
          valueStart,
          i,
          decodePlainTextEntities(tag.slice(valueStart, i)),
        );
      }
      continue;
    }
    const valueStart = i + 1;
    const valueEnd = tag.indexOf(quote, valueStart);
    if (valueEnd === -1) return undefined;
    if (name === "style") {
      return styleLoc(
        tag,
        nameStart,
        valueStart,
        valueEnd + 1,
        decodePlainTextEntities(tag.slice(valueStart, valueEnd)),
        quote,
      );
    }
    i = valueEnd + 1;
  }
}

/**
 * `additions` are appended when the declaration is absent. Names in `strip`
 * are removed first, so a module line-height replaces the blob's px value.
 * `undefined` means the attribute is empty and should be removed.
 */
function mergeStyleValue(
  existing: string,
  additions: readonly StyleDecl[],
  strip: ReadonlySet<string>,
): string | undefined {
  const kept: string[] = [];
  const present = new Set<string>();
  for (const part of existing.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(":");
    const name = (colon === -1 ? trimmed : trimmed.slice(0, colon))
      .trim()
      .toLowerCase();
    present.add(name);
    if (strip.has(name)) continue;
    kept.push(trimmed);
  }
  for (const add of additions) {
    if (strip.has(add.name) || !present.has(add.name)) {
      kept.push(`${add.name}: ${add.value}`);
    }
  }
  return kept.length > 0 ? kept.join("; ") : undefined;
}

/**
 * Double quotes. `"` and a bare `&` are escaped, then `<` and `>`, so the
 * attribute stays one value. An entity already in the value is left as
 * written. {@link decodePlainTextEntities} reads the escapes back.
 */
function quoteStyleValue(value: string): string {
  const escaped = value
    .replace(/&(?![A-Za-z][A-Za-z0-9]+;|#[0-9]+;|#x[0-9A-Fa-f]+;)/g, "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  return `"${escaped}"`;
}

function rewriteOpenTag(
  openTag: string,
  additions: readonly StyleDecl[],
  strip: ReadonlySet<string>,
): string {
  if (additions.length === 0 && strip.size === 0) return openTag;
  const loc = findStyleAttr(openTag);
  if (!loc) {
    if (additions.length === 0) return openTag;
    const value = additions
      .map((decl) => `${decl.name}: ${decl.value}`)
      .join("; ");
    const at = openTag.endsWith("/>") ? openTag.length - 2 : openTag.length - 1;
    return `${openTag.slice(0, at)} style=${quoteStyleValue(value)}${openTag.slice(at)}`;
  }
  const merged = mergeStyleValue(loc.value, additions, strip);
  if (merged === undefined) {
    return openTag.slice(0, loc.attrStart) + openTag.slice(loc.attrEnd);
  }
  if (loc.quote && merged === loc.value) return openTag;
  return (
    openTag.slice(0, loc.attrStart) +
    ` style=${quoteStyleValue(merged)}` +
    openTag.slice(loc.attrEnd)
  );
}

/** A string, or the nested pieces of a child frame. Joined once at the root. */
type Chunk = string | Chunk[];

interface TextFrame {
  name: string;
  openTag: string;
  parts: Chunk[];
  blockChild: boolean;
  /** `ul` / `ol` ancestors, counting this frame when it is one. */
  listDepth: number;
  /** A descendant open tag draws a box, so an empty leaf keeps its parts. */
  drawsBox: boolean;
}

function flattenChunks(chunks: Chunk[]): string {
  const out: string[] = [];
  const lists: Chunk[][] = [chunks];
  const index: number[] = [0];
  while (lists.length > 0) {
    const list = lists[lists.length - 1];
    const at = index[index.length - 1];
    if (at >= list.length) {
      lists.pop();
      index.pop();
      continue;
    }
    index[index.length - 1] = at + 1;
    const chunk = list[at];
    if (typeof chunk === "string") {
      if (chunk !== "") out.push(chunk);
    } else {
      lists.push(chunk);
      index.push(0);
    }
  }
  return out.join("");
}

function chunkText(chunks: Chunk[]): string {
  const bits: string[] = [];
  for (const chunk of chunks) {
    if (typeof chunk === "string") bits.push(chunk);
  }
  return bits.join("");
}

/**
 * The list box BeeFree renders, in px.
 *
 * `liIndent` is the indent (`40px` when it is absent or not a px length, the
 * UA indent). The export wraps the outer list in a -half margin against that
 * padding, so the text and bullet sit at half the indent; a nested list's
 * wrapper margin is 0, so it keeps the full indent. The head's `padding-left:
 * 20px` rule does not match a document rendered on its own.
 */
interface ListBox {
  outer: number;
  nested: number;
  rtl: boolean;
}

function listIndentPx(
  content:
    | {
        computedStyle?: Record<string, string>;
      }
    | undefined,
): number {
  const stated = content?.computedStyle?.liIndent?.trim();
  const match = stated ? /^(\d+(?:\.\d+)?)\s*px$/i.exec(stated) : null;
  if (!match) return 40;
  return Math.round(Number(match[1]));
}

function listBoxFor(content: {
  computedStyle?: Record<string, string>;
  style?: Record<string, string>;
}): ListBox {
  const indent = listIndentPx(content);
  return {
    outer: Math.round(indent / 2),
    nested: indent,
    rtl: content.style?.direction?.trim().toLowerCase() === "rtl",
  };
}

/**
 * Apply a BeeFree text module's style as TipTap-compatible inline markup.
 *
 * `text-align`, `line-height` and `font-size` go on each block root (`p`,
 * `li`, `h1`–`h6`, `div`, `ul`, `ol`). The line box uses that element's font
 * size, so a size that lives only on an inner span leaves the root at the
 * rendered text default of 14px. Color, weight, family, letter-spacing and
 * the same font size wrap the text of a root that holds no nested block. A
 * declaration the blob already sets stays; the module line-height replaces
 * one, because that is the value BeeFree renders.
 *
 * An `<a>` with no colour of its own takes `linkColor` inline, so it wins over
 * the document link colour. An anchor that already states a colour keeps it.
 *
 * `listBox` is set for a list module. It writes that box inline on `<ul>`,
 * `<ol>` and `<li>` — zero vertical margin, the indent padding, and
 * `list-style-type: revert` — so it beats the renderer's list spacing, which
 * juice would otherwise inline on top. A `margin` shorthand already on the
 * element stands, and so does a padding or marker it already sets. An item
 * margin of `0` is the shorthand: that is the property the renderer sets.
 *
 * A block with no text, break, image, or non-breaking space stays empty,
 * unless a descendant open tag draws a box. The renderer fills `<p></p>`
 * with one line; a span inside it is content and that line collapses.
 *
 * One forward scan. A regex over `[\s\S]*?</p>` is polynomial-ReDoS on
 * `<p>a<p>a<p>a…` with no closer; every cursor here only moves forward.
 * Unclosed roots stay nested. Their pieces are joined once at the root, so
 * a chain of them copies each character once.
 */
function isWordChar(char: string | undefined): boolean {
  if (char === undefined) return false;
  const code = char.charCodeAt(0);
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    char === "_"
  );
}

/** `<br` or `<img` with a word boundary after the name, as `/<br\b/i` does. */
function hasBreakOrImage(inner: string): boolean {
  let i = 0;
  while (i < inner.length) {
    const at = inner.indexOf("<", i);
    if (at === -1) return false;
    if (namedTagAt(inner, at, "br") || namedTagAt(inner, at, "img"))
      return true;
    i = at + 1;
  }
  return false;
}

function namedTagAt(html: string, at: number, name: string): boolean {
  if (at + 1 + name.length > html.length) return false;
  for (let i = 0; i < name.length; i++) {
    const char = html[at + 1 + i];
    const expect = name[i];
    if (char !== expect && char !== expect.toUpperCase()) return false;
  }
  return !isWordChar(html[at + 1 + name.length]);
}

/**
 * Drop each `<…>` that has at least one character before `>`. The result is
 * only an emptiness check: it is never written back into the markup. `<` with
 * no closer, and `<>`, stay.
 */
function withoutTags(value: string): string {
  const parts: string[] = [];
  let i = 0;
  let start = 0;
  while (i < value.length) {
    if (value[i] !== "<") {
      i++;
      continue;
    }
    let j = i + 1;
    while (j < value.length && value[j] !== ">") j++;
    if (j >= value.length || j === i + 1) {
      i++;
      continue;
    }
    if (start < i) parts.push(value.slice(start, i));
    i = j + 1;
    start = i;
  }
  if (parts.length === 0) return start === 0 ? value : value.slice(start);
  if (start < value.length) parts.push(value.slice(start));
  return parts.join("");
}

/** Text, a break, an image, or a non-breaking space inside a block. */
function frameHasInk(inner: string): boolean {
  if (hasBreakOrImage(inner)) return true;
  const text = withoutTags(inner)
    .replace(/&nbsp;|&#160;|\u00a0/gi, "x")
    .trim();
  return text.length > 0;
}

/**
 * The font-weight the importer keeps: normal / bold / bolder / lighter, a
 * CSS-wide keyword, or a CSS number (sign and exponent allowed) from 1 to
 * 1000. Anything else, including a `var()` it cannot resolve, is undefined.
 */
function cssFontWeight(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  if (
    /^(normal|bold|bolder|lighter|inherit|initial|unset|revert|revert-layer)$/i.test(
      value,
    )
  )
    return value;
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value))
    return undefined;
  const weight = Number(value);
  return weight >= 1 && weight <= 1000 ? value : undefined;
}

function inlineStylesToHtml(
  html: string,
  style: Record<string, string | undefined>,
  textColor: string,
  linkColor: string,
  listBox?: ListBox,
  notes?: string[],
): string {
  const spanDecls: StyleDecl[] = [];
  const fontSize = parsePxValue(style["font-size"]);
  if (fontSize && fontSize !== 16)
    spanDecls.push({ name: "font-size", value: `${fontSize}px` });
  const color = parseColor(style.color);
  // A paragraph inherits the template's text color, so only a different
  // color needs a span to survive.
  if (color && color !== textColor)
    spanDecls.push({ name: "color", value: color });
  const fontWeight = cssFontWeight(style["font-weight"]);
  // "400" is the numeric synonym for "normal" — neither needs an explicit
  // span (matches the import-unlayer importer).
  if (fontWeight && !/^(normal|400)$/i.test(fontWeight))
    spanDecls.push({ name: "font-weight", value: fontWeight });
  const fontFamily = canonicalFontStack(style["font-family"]);
  if (fontFamily && fontFamily.length <= 256)
    spanDecls.push({ name: "font-family", value: fontFamily });
  else if (fontFamily)
    notes?.push("Font family longer than 256 characters was dropped.");
  const letterSpacing = moduleLetterSpacing(style["letter-spacing"]);
  if (letterSpacing)
    spanDecls.push({ name: "letter-spacing", value: letterSpacing });

  const blockDecls: StyleDecl[] = [];
  // On the root, not only the span: the line box follows the element's size.
  if (fontSize > 0)
    blockDecls.push({ name: "font-size", value: `${fontSize}px` });
  const textAlign = style["text-align"];
  if (textAlign && textAlign !== "left")
    blockDecls.push({ name: "text-align", value: textAlign });
  const lineHeight = moduleLineHeight(style["line-height"]);
  if (lineHeight) blockDecls.push({ name: "line-height", value: lineHeight });

  const spanStyle = spanDecls
    .map((decl) => `${decl.name}: ${decl.value}`)
    .join("; ");
  const strip = new Set<string>();
  if (lineHeight) strip.add("line-height");
  const anchorDecls: StyleDecl[] = linkColor
    ? [{ name: "color", value: linkColor }]
    : [];

  if (
    blockDecls.length === 0 &&
    spanDecls.length === 0 &&
    anchorDecls.length === 0 &&
    !listBox
  )
    return html;

  const root: Chunk[] = [];
  const stack: TextFrame[] = [];
  const parts = (): Chunk[] =>
    stack.length > 0 ? stack[stack.length - 1].parts : root;

  const tagAdditions = (name: string, kind: "block" | "all"): StyleDecl[] => {
    const decls = kind === "block" ? blockDecls : [...blockDecls, ...spanDecls];
    return name === "a" ? [...decls, ...anchorDecls] : decls;
  };

  const declNames = (openTag: string): Set<string> => {
    const loc = findStyleAttr(openTag);
    const names = new Set<string>();
    if (!loc) return names;
    for (const part of loc.value.split(";")) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const colon = trimmed.indexOf(":");
      const name = (colon === -1 ? trimmed : trimmed.slice(0, colon))
        .trim()
        .toLowerCase();
      if (name) names.add(name);
    }
    return names;
  };

  // `depth` counts this list and its list ancestors. It is stored when the
  // frame is pushed, so emitting a chain of unclosed lists stays linear.
  const listBoxDecls = (
    name: string,
    openTag: string,
    depth: number,
  ): StyleDecl[] => {
    if (!listBox) return [];
    const present = declNames(openTag);
    if (name === "li") {
      const hasMargin = [...present].some(
        (decl) => decl === "margin" || decl.startsWith("margin-"),
      );
      return hasMargin ? [] : [{ name: "margin", value: "0" }];
    }
    if (name !== "ul" && name !== "ol") return [];
    const decls: StyleDecl[] = [];
    if (!present.has("margin") && !present.has("margin-top"))
      decls.push({ name: "margin-top", value: "0" });
    if (!present.has("margin") && !present.has("margin-bottom"))
      decls.push({ name: "margin-bottom", value: "0" });
    const padding = listBox.rtl ? "padding-right" : "padding-left";
    if (!present.has("padding") && !present.has(padding)) {
      const px = depth === 1 ? listBox.outer : listBox.nested;
      decls.push({ name: padding, value: `${px}px` });
    }
    if (!present.has("list-style") && !present.has("list-style-type"))
      decls.push({ name: "list-style-type", value: "revert" });
    return decls;
  };

  const emitFrame = (frame: TextFrame, rawClose: string): void => {
    const leaf = !frame.blockChild;
    const listRoot = frame.name === "ul" || frame.name === "ol";
    const wrap = leaf && !listRoot && spanStyle !== "";
    const parent = stack.length > 0 ? stack[stack.length - 1] : undefined;
    if (parent) parent.blockChild = true;
    const dest = parent ? parent.parts : root;
    const open = (kind: "block" | "all"): string =>
      rewriteOpenTag(
        frame.openTag,
        [
          ...tagAdditions(frame.name, kind),
          ...listBoxDecls(frame.name, frame.openTag, frame.listDepth),
        ],
        strip,
      );
    const chunk: Chunk[] = [];
    const inner = chunkText(frame.parts);
    // A descendant that draws a box is ink. The open-tag walk below sets
    // `drawsBox` with `openTagDrawsBox`, so this leaf keeps its parts.
    if (leaf && !listRoot && !frameHasInk(inner) && !frame.drawsBox) {
      chunk.push(open("block"));
      if (rawClose !== "") chunk.push(rawClose);
    } else if (wrap) {
      chunk.push(
        open("block"),
        `<span style=${quoteStyleValue(spanStyle)}>`,
        frame.parts,
        "</span>",
      );
      if (rawClose !== "") chunk.push(rawClose);
    } else {
      // A list root and a div that wraps other blocks inherit into their
      // children, which carry the text styles themselves. A paragraph or item
      // with a nested block cannot take a span around that block, so the text
      // styles go on the element.
      const kind = !leaf && !listRoot && frame.name !== "div" ? "all" : "block";
      chunk.push(open(kind), frame.parts);
      if (rawClose !== "") chunk.push(rawClose);
    }
    dest.push(chunk);
  };

  const closeFrame = (name: string, rawClose: string): void => {
    let idx = -1;
    for (let s = stack.length - 1; s >= 0; s--) {
      if (stack[s].name === name) {
        idx = s;
        break;
      }
    }
    if (idx === -1) {
      parts().push(rawClose);
      return;
    }
    while (stack.length - 1 > idx) emitFrame(stack.pop()!, "");
    emitFrame(stack.pop()!, rawClose);
  };

  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      parts().push(html.slice(i));
      break;
    }
    parts().push(html.slice(i, lt));
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      if (end === -1) {
        parts().push(html.slice(lt));
        break;
      }
      parts().push(html.slice(lt, end + 3));
      i = end + 3;
      continue;
    }
    const isClose = html[lt + 1] === "/";
    const nameStart = lt + (isClose ? 2 : 1);
    if (!/[a-z]/i.test(html[nameStart] ?? "")) {
      parts().push("<");
      i = lt + 1;
      continue;
    }
    let nameEnd = nameStart;
    while (nameEnd < html.length && /[a-z0-9]/i.test(html[nameEnd])) nameEnd++;
    const boundary = html[nameEnd];
    if (boundary !== undefined && !/[\s>/]/.test(boundary)) {
      parts().push(html.slice(lt, nameEnd));
      i = nameEnd;
      continue;
    }
    const name = html.slice(nameStart, nameEnd).toLowerCase();
    if (isClose) {
      const end = html.indexOf(">", nameEnd);
      if (end === -1) {
        parts().push(html.slice(lt));
        break;
      }
      closeFrame(name, html.slice(lt, end + 1));
      i = end + 1;
      continue;
    }
    const end = findOpenTagEnd(html, nameEnd);
    if (end === -1) {
      parts().push(html.slice(lt));
      break;
    }
    const openTag = html.slice(lt, end + 1);
    const selfClosing = html[end - 1] === "/";
    if (selfClosing || !TEXT_ROOTS.has(name)) {
      parts().push(
        rewriteOpenTag(openTag, name === "a" ? anchorDecls : [], strip),
      );
      const parent = stack[stack.length - 1];
      if (parent && openTagDrawsBox(html, lt, end)) parent.drawsBox = true;
      i = end + 1;
      continue;
    }
    const parentDepth =
      stack.length > 0 ? stack[stack.length - 1].listDepth : 0;
    stack.push({
      name,
      openTag,
      parts: [],
      blockChild: false,
      listDepth: name === "ul" || name === "ol" ? parentDepth + 1 : parentDepth,
      drawsBox: false,
    });
    i = end + 1;
  }
  while (stack.length > 0) emitFrame(stack.pop()!, "");
  return flattenChunks(root);
}

/**
 * A px length, rounded like {@link parsePxValue}, or `undefined` when it is
 * not one. Unitless `0` is `0`: CSS treats it as a length. A negative length
 * is not a gap.
 */
function explicitPx(value: string): number | undefined {
  const trimmed = value.trim();
  if (/^0+(?:\.0+)?$/.test(trimmed)) return 0;
  if (!/^\d+(?:\.\d+)?\s*px$/i.test(trimmed)) return undefined;
  return parsePxValue(trimmed);
}

/** The bottom length of a `margin` shorthand, when that side is a px length. */
function shorthandMarginBottom(value: string): number | undefined {
  const parts = value.trim().split(/\s+/);
  if (parts.length < 1 || parts.length > 4) return undefined;
  const bottom = parts.length <= 2 ? parts[0] : parts[2];
  return explicitPx(bottom);
}

/**
 * The px `margin-bottom` an opening tag states, after a `margin` shorthand
 * and a later `margin-bottom` the way CSS applies them. `undefined` when the
 * tag states none, or the winning value is not a px length.
 */
function tagMarginBottom(tag: string): number | undefined {
  const style = findStyleAttr(tag)?.value;
  if (style === undefined) return undefined;
  let gap: number | undefined;
  let set = false;
  for (const part of style.split(";")) {
    const colon = part.indexOf(":");
    if (colon === -1) continue;
    const prop = part.slice(0, colon).trim().toLowerCase();
    if (prop !== "margin" && prop !== "margin-bottom") continue;
    const value = part.slice(colon + 1).trim();
    const bottom =
      prop === "margin" ? shorthandMarginBottom(value) : explicitPx(value);
    if (bottom === undefined) {
      set = false;
      gap = undefined;
    } else {
      set = true;
      gap = bottom;
    }
  }
  return set ? gap : undefined;
}

function isParagraphOpen(html: string, open: number): boolean {
  const name = html[open + 1];
  const next = html[open + 2];
  return (
    (name === "p" || name === "P") &&
    (next === ">" ||
      next === " " ||
      next === "\t" ||
      next === "\n" ||
      next === "\r" ||
      next === "/")
  );
}

/**
 * The gap between this block's paragraphs.
 *
 * BeeFree paragraphs sit at margin 0, so the gap is 0 unless a `<p>` states a
 * px `margin-bottom` or the bottom of a `margin` shorthand. The first such
 * length wins; one block has one gap.
 */
function paragraphSpacingFromHtml(html: string): number {
  let i = 0;
  while (i < html.length) {
    const open = html.indexOf("<", i);
    if (open === -1) return 0;
    if (!isParagraphOpen(html, open)) {
      i = open + 1;
      continue;
    }
    const openEnd = html.indexOf(">", open + 2);
    if (openEnd === -1) return 0;
    const gap = tagMarginBottom(html.slice(open, openEnd + 1));
    if (gap !== undefined) return gap;
    i = openEnd + 1;
  }
  return 0;
}

/**
 * A paragraph module's gap, in px. BeeFree stores it on
 * `computedStyle.paragraphSpacing` and renders it as `margin-bottom` on every
 * paragraph but the last. That wins over a margin written into the HTML. A
 * missing or non-px value falls back to the HTML.
 */
function paragraphModuleSpacing(
  content: { computedStyle?: Record<string, string> } | undefined,
  html: string,
): number {
  const stated = content?.computedStyle?.paragraphSpacing?.trim();
  const match = stated ? /^(\d+(?:\.\d+)?)\s*px$/i.exec(stated) : null;
  if (!match) return paragraphSpacingFromHtml(html);
  return Math.round(Number(match[1]));
}

function convertText(
  descriptor: BeeFreeeModuleDescriptor,
  textColor: string,
  notes: string[] = [],
): Block {
  const textContent =
    descriptor.text ?? descriptor.paragraph ?? descriptor.list;
  const html = textContent?.html ?? "";
  const style = textContent?.style ?? {};

  const listBox =
    textContent !== undefined && textContent === descriptor.list
      ? listBoxFor(textContent)
      : undefined;

  // The style pass strips an empty inline subtree, so the drop reads the
  // source. Merge-tag chips are still `<code>` here.
  const source = withoutEmptyParagraphs(html);

  return createParagraphBlock({
    content: finishTextHtml(
      inlineStylesToHtml(
        source,
        style,
        textColor,
        moduleLinkColor(textContent),
        listBox,
        notes,
      ),
    ),
    paragraphSpacing: paragraphModuleSpacing(textContent, html),
    styles: makeStyles(descriptor),
  });
}

/**
 * A non-negative px length, including 0. `undefined` when the value is
 * missing or unreadable. A negative length does not match.
 */
function nonNegativeCssPx(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = /^(\d+(?:\.\d+)?)\s*px$/i.exec(value.trim());
  if (!match) return undefined;
  const parsed = Number(match[1]);
  // The pattern is digits only, so a match is non-negative. A long digit
  // string is Infinity, which is not a length.
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * A non-negative `em`, percentage, or unitless `line-height` ratio, or
 * `undefined` when `raw` is not one of those. `2em` is 2, `120%` is 1.2,
 * and `1.5` is 1.5. Space before `em` is allowed, as it is before `px`.
 */
function lineHeightRatio(raw: string): number | undefined {
  const em = /^(\d+(?:\.\d+)?)\s*em$/i.exec(raw);
  if (em) return Number(em[1]);
  const percent = /^(\d+(?:\.\d+)?)\s*%$/.exec(raw);
  if (percent) return Number(percent[1]) / 100;
  const unitless = /^(\d+(?:\.\d+)?)$/.exec(raw);
  if (unitless) return Number(unitless[1]);
  return undefined;
}

/**
 * The line box of a blank paragraph, in px, and every `font-size` or
 * `line-height` that was present but not read. An `em` length, a percentage,
 * or a unitless `line-height` is a ratio of the font size, including 0. A px
 * `line-height` is the line box itself. The font size is 14px, and the ratio
 * is 1.2, when the value is missing. A present value that is not one of those
 * forms, or that is not finite, uses the same fallback and is named in `unread`.
 */
function blankParagraphLineBox(style: Record<string, string> | undefined): {
  px: number;
  unread: string[];
} {
  const unread: string[] = [];
  const fontRaw = style?.["font-size"];
  const fontTrimmed = fontRaw?.trim() ?? "";
  const parsedFont = nonNegativeCssPx(fontRaw);
  let fontSize = 14;
  if (fontTrimmed !== "") {
    if (parsedFont === undefined) {
      unread.push(`font-size ${fontTrimmed} is not read, 14px is used`);
    } else {
      fontSize = parsedFont;
    }
  }

  const raw = style?.["line-height"]?.trim() ?? "";
  if (raw === "") return { px: fontSize * 1.2, unread };
  const px = /^(\d+(?:\.\d+)?)\s*px$/i.exec(raw);
  if (px) {
    const parsed = nonNegativeCssPx(raw);
    if (parsed !== undefined) return { px: parsed, unread };
  } else {
    const ratio = lineHeightRatio(raw);
    if (ratio !== undefined && Number.isFinite(ratio)) {
      return { px: fontSize * ratio, unread };
    }
  }
  unread.push(`line-height ${raw} is not read, 1.2 is used`);
  return { px: fontSize * 1.2, unread };
}

function blankParagraphHeight(descriptor: BeeFreeeModuleDescriptor): {
  height: number;
  unread: string[];
  lineBoxOverflows: boolean;
  paddingUnread: boolean;
  heightOverflows: boolean;
} {
  const padding = extractPadding(descriptor.style);
  const line = blankParagraphLineBox(descriptor.paragraph?.style);
  // A longhand of hundreds of digits is Infinity. That side is not a length,
  // so the spacer reads it as 0. Left and right never enter this height.
  // Two finite sides can still sum past Number.MAX_VALUE. That sum is not a
  // length either, so both sides are unread.
  let top = padding.top;
  let bottom = padding.bottom;
  let paddingUnread = false;
  if (!Number.isFinite(top)) {
    top = 0;
    paddingUnread = true;
  }
  if (!Number.isFinite(bottom)) {
    bottom = 0;
    paddingUnread = true;
  }
  if (!Number.isFinite(top + bottom)) {
    top = 0;
    bottom = 0;
    paddingUnread = true;
  }
  // The line-box clause is only for a line box that itself overflowed.
  // 14px at 1.2 is the documented fallback line box.
  const lineBoxOverflows = !Number.isFinite(line.px);
  const linePx = lineBoxOverflows ? 14 * 1.2 : line.px;
  let height = Math.round(top + linePx + bottom);
  // Each addend is finite, but a finite line box plus finite padding can
  // still pass Number.MAX_VALUE. The height is then the fallback line box
  // alone; putting the padding back would overflow the same way. That
  // fallback is reported, or the spacer would say it was converted.
  let heightOverflows = false;
  if (!Number.isFinite(height)) {
    height = Math.round(14 * 1.2);
    heightOverflows = true;
  }
  return {
    height,
    unread: line.unread,
    lineBoxOverflows,
    paddingUnread,
    heightOverflows,
  };
}

/** A blank paragraph module, as a spacer of one line plus its vertical padding. */
function blankParagraphSpacer(
  descriptor: BeeFreeeModuleDescriptor,
  height: number,
): Block {
  return createSpacerBlock({
    height,
    styles: {
      ...makeStyles(descriptor),
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
    },
  });
}

function parseHeadingLevel(tag: string): HeadingLevel {
  const match = tag.match(/^h(\d)$/i);
  if (match) {
    const num = Number(match[1]);
    if (num >= 1 && num <= 4) return num as HeadingLevel;
  }
  return 2;
}

const TITLE_LEVELS: readonly HeadingLevel[] = [1, 2, 3, 4];

/**
 * The title level whose renderer size is nearest `px`.
 *
 * Sizes are `HEADING_LEVEL_FONT_SIZE` in `@templatical/types`, the table
 * `renderTitle` writes onto the title's `mj-text`. That size is the line
 * box. A tie stays on the level nearer `source`.
 */
function headingLevelForSize(px: number, source: HeadingLevel): HeadingLevel {
  let best = source;
  let bestSize = Infinity;
  let bestSource = Infinity;
  for (const level of TITLE_LEVELS) {
    const size = Math.abs(HEADING_LEVEL_FONT_SIZE[level] - px);
    const toward = Math.abs(level - source);
    if (size < bestSize || (size === bestSize && toward < bestSource)) {
      best = level;
      bestSize = size;
      bestSource = toward;
    }
  }
  return best;
}

/**
 * Set when the chosen level's size is more than 1px off BeeFree's font size,
 * so the line box is not the source size. Names the source level when the
 * chosen level is a different one.
 */
function headingLevelNote(
  px: number,
  source: HeadingLevel,
  chosen: HeadingLevel,
): string | undefined {
  if (Math.abs(HEADING_LEVEL_FONT_SIZE[chosen] - px) <= 1) return undefined;
  const sourceNote = chosen === source ? "" : ` (source h${source})`;
  return `h${chosen} chosen for ${px}px${sourceNote}; line box differs`;
}

/** `text-align` inside a CSS declaration list, when it is left, center or right. */
function alignInStyle(css: string | undefined): string | undefined {
  if (!css) return undefined;
  const match = /(?:^|;)\s*text-align\s*:\s*(left|center|right)\b/i.exec(css);
  return match?.[1].toLowerCase();
}

/**
 * Alignment on a heading tag BeeFree wrapped the text in
 * (`<h1 style="text-align: center">`). The tag is stripped before the text
 * is stored, so the alignment has to be read first.
 */
function headingTagCss(text: string): string | undefined {
  const open = /^<h\d\b([^>]*)>/i.exec(text.trim());
  if (!open) return undefined;
  const quoted = /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(open[1]);
  return quoted?.[1] ?? quoted?.[2];
}

/** One declaration from a CSS list, or `undefined` when it is absent. */
function cssDecl(css: string | undefined, name: string): string | undefined {
  if (!css) return undefined;
  const match = new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`, "i").exec(css);
  const value = match?.[1]?.trim();
  return value || undefined;
}

/**
 * The heading style wins over the same declaration on the heading tag.
 * The tag is stripped before the text is stored.
 */
function headingSourceDecl(
  style: Record<string, string>,
  tagCss: string | undefined,
  name: string,
): string | undefined {
  const fromStyle = style[name]?.trim();
  return fromStyle || cssDecl(tagCss, name);
}

/**
 * Typography the title block cannot store. The renderer sizes a title from
 * its level (an `h1` is 36px), paints it bold and sets line-height 1.3, so
 * the heading's own values go on the text and override those.
 * `letter-spacing` of `0` or `normal` adds nothing.
 */
function headingTypographyStyle(
  style: Record<string, string>,
  tagCss: string | undefined,
): string | undefined {
  const decls: string[] = [];
  const fontSize = parsePxValue(headingSourceDecl(style, tagCss, "font-size"));
  if (fontSize > 0) decls.push(`font-size: ${fontSize}px`);
  const lineHeight = moduleLineHeight(
    headingSourceDecl(style, tagCss, "line-height"),
  );
  if (lineHeight) decls.push(`line-height: ${lineHeight}`);
  const weight = headingSourceDecl(style, tagCss, "font-weight");
  if (weight && !/^(inherit|initial|unset|revert)$/i.test(weight)) {
    decls.push(`font-weight: ${weight}`);
  }
  const letterSpacing = moduleLetterSpacing(
    headingSourceDecl(style, tagCss, "letter-spacing"),
  );
  if (letterSpacing) decls.push(`letter-spacing: ${letterSpacing}`);
  return decls.length > 0 ? decls.join("; ") : undefined;
}

function convertHeading(
  descriptor: BeeFreeeModuleDescriptor,
  textColor: string,
): { block: Block; note?: string } {
  const heading = descriptor.heading;
  if (!heading) {
    const notes: string[] = [];
    const block = convertText(descriptor, textColor, notes);
    return { block, ...(notes.length > 0 ? { note: notes.join(" ") } : {}) };
  }

  const style = heading.style ?? {};
  const tag = heading.title ?? "h2";
  const text = heading.text ?? "";
  // Strip heading tags — content goes inside TipTap, heading tag is rendered by the block.
  // Decode after the strip: a `{% if a &gt; 1 %}` token must keep its `>`.
  const content = text.startsWith("<")
    ? text.replace(/^<h\d[^>]*>|<\/h\d>$/gi, "")
    : text;
  const tagCss = headingTagCss(text);
  const typography = headingTypographyStyle(style, tagCss);
  const inner = typography
    ? `<span style=${quoteStyleValue(typography)}>${content}</span>`
    : content;

  // BeeFree's effective size is the module style, then the font-size on the
  // heading tag. With neither, the tag has no published pixel default
  // (`titleDefaultStyles` is `{}`), so the level stays the source tag.
  const source = parseHeadingLevel(tag);
  const px = parsePxValue(headingSourceDecl(style, tagCss, "font-size"));
  const level = px > 0 ? headingLevelForSize(px, source) : source;

  // Alignment is on the heading style, the heading tag, or only the module.
  // The first one set wins.
  return {
    block: createTitleBlock({
      content: importedHtml(
        content || typography ? `<p>${inner}</p>` : "<p></p>",
      ),
      level,
      color: parseColor(style.color) || undefined,
      textAlign: toAlign(
        style["text-align"] ??
          alignInStyle(tagCss) ??
          descriptor.style?.["text-align"],
      ),
      fontFamily: canonicalFontStack(style["font-family"]) || undefined,
      styles: makeStyles(descriptor),
    }),
    note: px > 0 ? headingLevelNote(px, source, level) : undefined,
  };
}

/**
 * The classes BeeFree records in `computedStyle.class` for an image: its
 * alignment, `autowidth` / `fixedwidth`, and in older exports `fullwidth`.
 */
function computedClasses(descriptor: BeeFreeeModuleDescriptor): string[] {
  const value = descriptor.computedStyle?.class;
  return typeof value === "string" ? value.trim().split(/\s+/) : [];
}

/**
 * A px length BeeFree computed: `"172.5px"`, or a bare number in older
 * exports. 0 when it isn't one.
 */
function computedPx(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
  }
  return typeof value === "string" ? parsePxValue(value) : 0;
}

/**
 * The width BeeFree shows an image at, as `ImageBlock.width`. BeeFree records
 * it in `computedStyle.width` for both classes: a `fixedwidth` image at the
 * width the author set, an `autowidth` one at its file's width capped at the
 * column. `image.width` and `image.height` are the file's own size, the
 * fallback for an export without `computedStyle`. No width, or one that
 * reaches `room` (the column less the image's side padding), is `"full"`.
 * Older exports class an image that fills its column `fullwidth`. Its computed
 * width leaves out the column padding, so the class decides. A computed
 * percentage under 100% becomes px of `room`, with a note:
 * px keeps its size on a phone, where the percentage would shrink.
 */
function resolveImageWidth(
  descriptor: BeeFreeeModuleDescriptor,
  room: number | undefined,
): { width: ImageBlock["width"]; note?: string } {
  if (computedClasses(descriptor).includes("fullwidth")) {
    return { width: "full" };
  }
  const percent = computedPercent(descriptor.computedStyle?.width);
  if (percent !== undefined) return percentOfRoom("Image", percent, room);
  const shown =
    computedPx(descriptor.computedStyle?.width) ||
    parsePxValue(descriptor.image?.width);
  return { width: shownWidth(shown, room) };
}

/**
 * A percentage width as the share of the room it shows at: `"full"` from
 * 100%, or when the room is unknown; otherwise px, with a note.
 */
function percentOfRoom(
  kind: "Image" | "Video",
  percent: number,
  room: number | undefined,
): { width: number | "full"; note?: string } {
  if (percent >= 100) return { width: "full" };
  const width =
    room === undefined
      ? "full"
      : shownWidth(Math.round((room * percent) / 100), room);
  const label = width === "full" ? "full width" : `${width}px`;
  return {
    width,
    note: `${kind} width ${percent}% was converted to ${label}.`,
  };
}

/** A percentage BeeFree computed (`"50%"`), or `undefined` when it isn't one. */
function computedPercent(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const match = /^(\d+(?:\.\d+)?|\.\d+)%$/.exec(value.trim());
  return match ? parseFloat(match[1]) : undefined;
}

/** A shown px width as `ImageBlock.width`: `"full"` when unknown or at `room`. */
function shownWidth(
  shown: number,
  room: number | undefined,
): ImageBlock["width"] {
  if (shown <= 0) return "full";
  return room !== undefined && shown >= room ? "full" : shown;
}

function convertImage(
  descriptor: BeeFreeeModuleDescriptor,
  columnWidth: number | undefined,
): { block: Block; notes: string[] } {
  const image = descriptor.image;
  const styles = makeStyles(descriptor);
  if (!image) {
    return { block: createImageBlock({ styles }), notes: [] };
  }

  const room = measuredRoom(columnWidth, styles.padding);
  const { width, note } = resolveImageWidth(descriptor, room);

  // `image.width` × `image.height` is the file, so the height is never carried
  // over: the image keeps its aspect ratio at the width it is shown at. A
  // percentage radius resolves against that shown size, and only when BeeFree
  // stated a width.
  const fileWidth = parsePxValue(image.width);
  const fileHeight = parsePxValue(image.height);
  const shownWidth = width === "full" ? room : width;
  const stated = fileWidth > 0 || width !== "full";
  const shownHeight =
    shownWidth !== undefined && fileWidth > 0 && fileHeight > 0
      ? Math.round((fileHeight * shownWidth) / fileWidth)
      : undefined;

  const classes = computedClasses(descriptor);
  const classAlign = (["left", "center", "right"] as const).find((side) =>
    classes.includes(side),
  );

  const block = createImageBlock({
    src: decodeEntitiesInTokens(image.src || ""),
    alt: decodeEntitiesInTokens(image.alt || ""),
    width,
    // The file's size feeds the editor's aspect-ratio lock; never rendered.
    ...(fileWidth > 0 && fileHeight > 0
      ? { naturalWidth: fileWidth, naturalHeight: fileHeight }
      : {}),
    borderRadius: parseImageBorderRadius(
      image.style?.["border-radius"],
      stated ? shownWidth : undefined,
      shownHeight,
    ),
    // Exports keep the alignment in `computedStyle.class` ("left fixedwidth")
    // and often have no image `style` at all.
    align: toAlign(image.style?.["text-align"] ?? classAlign, "center"),
    linkUrl: image.href ? decodeEntitiesInTokens(image.href) : undefined,
    styles,
  });
  return { block, notes: note ? [note] : [] };
}

/**
 * `style["line-height"]` as `ButtonBlock.lineHeight`. A percentage is that
 * number over 100, a unitless number is itself, a px length is that many
 * pixels over `fontSize`, and an `em` length is the number itself (`2em`
 * is `2`). A leading dot (`.5`, `.5%`, `.5px`, `.5em`) is read. Rounded to
 * two decimals. `1.2` and a missing value stay unset, so the label keeps
 * `BUTTON_LINE_HEIGHT`, and the button stays converted. Any other explicit
 * value that cannot be kept comes back as `unread` for the approximation note.
 */
function readButtonLineHeight(
  value: string | undefined,
  fontSize: number,
): { lineHeight?: number; unread?: string } {
  const trimmed = value?.trim() ?? "";
  if (trimmed === "") return {};

  const percent = /^((?:\d+(?:\.\d+)?|\.\d+))\s*%$/.exec(trimmed);
  const unitless = /^((?:\d+(?:\.\d+)?|\.\d+))$/.exec(trimmed);
  const px = /^((?:\d+(?:\.\d+)?|\.\d+))\s*px$/i.exec(trimmed);
  const em = /^((?:\d+(?:\.\d+)?|\.\d+))\s*em$/i.exec(trimmed);
  let ratio: number;
  if (percent) ratio = Number(percent[1]) / 100;
  else if (unitless) ratio = Number(unitless[1]);
  else if (px) ratio = Number(px[1]) / fontSize;
  else if (em) ratio = Number(em[1]);
  else return { unread: trimmed };

  if (!Number.isFinite(ratio) || !(ratio > 0)) return { unread: trimmed };
  const rounded = roundHundredths(ratio);
  if (!(rounded > 0)) return { unread: trimmed };
  if (rounded === BUTTON_LINE_HEIGHT) return {};
  return { lineHeight: rounded };
}

/**
 * A CSS font-weight as a number. `normal` is 400. `bold` and `bolder` are
 * 700 — `bolder` is relative, and with no parent weight the absolute step
 * it names is bold. Anything else unreadable is dropped.
 */
function cssFontWeightNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return undefined;
  if (trimmed === "normal") return 400;
  if (trimmed === "bold" || trimmed === "bolder") return 700;
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(trimmed)) return undefined;
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : undefined;
}

/**
 * The nearest of 400, 500 and 700. The stops are lightest first and a tie
 * keeps the lighter one, so 450 is regular and 600 is medium.
 */
function nearestButtonWeight(
  weight: number,
): NonNullable<ButtonBlock["fontWeight"]> {
  const stops = [
    ["regular", 400],
    ["medium", 500],
    ["bold", 700],
  ] as const;
  let best: NonNullable<ButtonBlock["fontWeight"]> = "regular";
  let bestDistance = Infinity;
  for (const [name, stop] of stops) {
    const distance = Math.abs(weight - stop);
    if (distance < bestDistance) {
      best = name;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Whether every label text run is bold, some are bold, or none are. Button
 * labels become plain text, so a whole bold label can use the button field
 * while a mixed label needs a note when its inline weight is lost.
 */
function buttonLabelBoldness(label: string): "all" | "mixed" | "none" {
  const html = trimHighlightedTokenPadding(unwrapMergeTagCode(label));
  const stack: Array<{ name: string; bold: boolean }> = [];
  let boldText = false;
  let plainText = false;
  // Text counts only where stripTagsPlain keeps it: every `<…>` goes, a
  // stray `>` goes, and an unclosed `<` ends the label.
  const textRun = (value: string): void => {
    if (!decodePlainTextEntities(value.replaceAll(">", "")).trim()) return;
    if (stack.at(-1)?.bold) boldText = true;
    else plainText = true;
  };

  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      textRun(html.slice(i));
      break;
    }
    textRun(html.slice(i, lt));
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      if (end === -1) break;
      i = end + 3;
      continue;
    }
    const closing = html[lt + 1] === "/";
    const nameStart = lt + (closing ? 2 : 1);
    let nameEnd = nameStart;
    while (nameEnd < html.length && /[a-z0-9]/i.test(html[nameEnd])) nameEnd++;
    if (
      nameEnd === nameStart ||
      (html[nameEnd] !== undefined && !/[\s>/]/.test(html[nameEnd]))
    ) {
      const close = html.indexOf(">", lt + 1);
      if (close === -1) break;
      i = close + 1;
      continue;
    }
    const name = html.slice(nameStart, nameEnd).toLowerCase();
    const end = closing
      ? html.indexOf(">", nameEnd)
      : findOpenTagEnd(html, nameEnd);
    if (end === -1) break;
    if (closing) {
      for (let s = stack.length - 1; s >= 0; s--) {
        if (stack[s].name === name) {
          stack.length = s;
          break;
        }
      }
    } else {
      const openTag = html.slice(lt, end + 1);
      const inlineWeight = findStyleAttr(openTag)
        ?.value.split(";")
        .map((part) => part.trim())
        .filter((part) => /^font-weight\s*:/i.test(part))
        .at(-1);
      const weight = inlineWeight
        ? cssFontWeightNumber(inlineWeight.slice(inlineWeight.indexOf(":") + 1))
        : undefined;
      const bold =
        stack.at(-1)?.bold === true ||
        name === "strong" ||
        name === "b" ||
        (weight !== undefined && weight >= 600);
      if (
        !/^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(
          name,
        ) &&
        html[end - 1] !== "/"
      ) {
        stack.push({ name, bold });
      }
    }
    i = end + 1;
  }
  return boldText ? (plainText ? "mixed" : "all") : "none";
}

/**
 * BeeFree's readable weight maps to the nearest button step unless all label
 * text is bold in the HTML, which takes precedence over the module weight.
 * An unweighted label otherwise imports as regular.
 */
function buttonFontWeight(
  value: unknown,
  label: string,
): { fontWeight: ButtonBlock["fontWeight"]; partialBold: boolean } {
  const numeric = cssFontWeightNumber(value);
  const boldness = buttonLabelBoldness(label);
  if (boldness === "all") {
    return { fontWeight: undefined, partialBold: false };
  }
  if (numeric === undefined) {
    return {
      fontWeight: "regular",
      partialBold: boldness === "mixed",
    };
  }
  const mapped = nearestButtonWeight(numeric);
  return {
    fontWeight: mapped === "bold" ? undefined : mapped,
    partialBold: mapped !== "bold" && boldness === "mixed",
  };
}

/**
 * A letter-spacing worth naming. `0` and `normal` are the CSS initial value,
 * so they are not a difference. CSS-wide keywords are unread the same way.
 */
function uncarriedLetterSpacing(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  if (
    lower === "normal" ||
    lower === "0" ||
    /^(?:inherit|initial|unset|revert)$/.test(lower) ||
    /^0+(?:\.0+)?px$/.test(lower)
  ) {
    return undefined;
  }
  return trimmed;
}

/**
 * Two decimals, trailing zeros dropped: `40` is `"40%"`, `33.333` is `"33.33%"`.
 */
function formatButtonPercent(value: number): `${number}%` {
  const share = roundHundredths(value);
  const text = share.toFixed(2).replace(/\.?0+$/, "");
  return `${Number(text)}%`;
}

/**
 * The 0 and 100 boundaries are the share rounded to two decimals. Above
 * 100 is `"full"` with a clamp note. 100, including a value that rounds to
 * 100, is `"full"` with no note. Above 0 and below 100 is that share.
 * 0 or below leaves the width unset. `button.percWidth` is not this value.
 * A leading decimal (`.5%`, `.5px`) and an exponent percentage (`1e19%`)
 * are read. A px width is that many pixels, rounded. `auto` and a missing
 * width leave the width unset with no note. A px width that rounds to 0,
 * and any other non-empty value, leave the width unset and name `uncarried`
 * so the button note says the width is not carried.
 */
function buttonWidth(value: string | undefined): {
  width?: ButtonBlock["width"];
  note?: string;
  uncarried?: string;
} {
  if (!value) return {};
  const raw = value.trim();
  if (!raw || /^auto$/i.test(raw)) return {};

  const percent = /^(-?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?)\s*%$/i.exec(raw);
  if (percent) {
    const n = Number(percent[1]);
    const share = roundHundredths(n);
    if (share > 100) {
      return { width: "full", note: `width ${raw} was clamped to 100%` };
    }
    if (share >= 100) return { width: "full" };
    if (share <= 0) return { note: `width ${raw} has no usable size` };
    return { width: formatButtonPercent(n) };
  }

  const px = /^((?:\d+(?:\.\d+)?|\.\d+))\s*px$/i.exec(raw);
  if (!px) return { uncarried: raw };
  const width = Math.round(Number(px[1]));
  return width > 0 ? { width } : { uncarried: raw };
}

/**
 * One note naming what this button does not carry: letter spacing, an
 * unreadable line-height, an unreadable width, and a partial bold label.
 * Empty when nothing was left out. A percentage clamp, and a percentage
 * with no usable size, stay separate notes.
 */
function buttonApproximationNote(
  style: Record<string, string>,
  partialBold: boolean,
  fontWeight: ButtonBlock["fontWeight"],
  unreadLineHeight: string | undefined,
  uncarriedWidth: string | undefined,
): string | undefined {
  const parts: string[] = [];
  const spacing = uncarriedLetterSpacing(style["letter-spacing"]);
  if (spacing) parts.push(`letter spacing ${spacing}`);
  if (unreadLineHeight) parts.push(`line-height ${unreadLineHeight}`);
  if (uncarriedWidth) parts.push(`width ${uncarriedWidth}`);

  if (partialBold) parts.push("partial bold in the label");

  if (parts.length === 0) return undefined;
  const verb = parts.length === 1 ? "is" : "are";
  return `${parts.join(", ")} ${verb} not carried${partialBold ? `; button imports at ${fontWeight} weight` : ""}`;
}

function toButtonBorderStyle(value: string | undefined): BorderStyle {
  if (value === "dashed" || value === "dotted" || value === "solid")
    return value;
  return "solid";
}

/**
 * The button's border. A side that paints nothing has width 0. `undefined`
 * when no side is drawn. A style other than solid, dashed or dotted is solid.
 */
function buttonBorder(style: Record<string, string>): BorderValue | undefined {
  let drawn = false;
  const border = {} as BorderValue;
  for (const side of BORDER_SIDES) {
    const raw = style[`border-${side}`];
    const parsed = raw ? parseBorderTop(raw) : undefined;
    const paints = parsed !== undefined && parsed.drawn && parsed.width > 0;
    if (paints) drawn = true;
    border[side] = {
      width: paints ? parsed.width : 0,
      style: toButtonBorderStyle(parsed?.style),
      color: parsed?.color || "#000000",
    };
  }
  return drawn ? border : undefined;
}

/**
 * An outline button stores `"transparent"`. `parseColor` returns `""` for
 * that keyword, and for `none` and the CSS-wide keywords, so other callers
 * can apply their own fallback. Only an explicit transparent fill — the
 * keyword, or an alpha of 0 — changes; a missing or unreadable fill stays
 * the default.
 */
function buttonBackgroundColor(value: string | undefined): string {
  if (isTransparentColor(value)) return "transparent";
  return parseColor(value) || "#4f46e5";
}

function convertButton(descriptor: BeeFreeeModuleDescriptor): {
  block: Block;
  notes: string[];
} {
  const button = descriptor.button;
  if (!button) {
    return {
      block: createButtonBlock({ styles: makeStyles(descriptor) }),
      notes: [],
    };
  }

  const style = button.style ?? {};
  const label = button.label ? importedPlainText(button.label) : "Button";
  const padding = readButtonPadding(style);
  const fontSize = parsePxValue(style["font-size"]) || 16;
  const { lineHeight, unread: unreadLineHeight } = readButtonLineHeight(
    style["line-height"],
    fontSize,
  );
  const {
    width,
    note: widthNote,
    uncarried: uncarriedWidth,
  } = buttonWidth(style.width);
  const border = buttonBorder(style);
  const { fontWeight, partialBold } = buttonFontWeight(
    style["font-weight"],
    button.label ?? "Button",
  );
  const note = buttonApproximationNote(
    style,
    partialBold,
    fontWeight,
    unreadLineHeight,
    uncarriedWidth,
  );

  return {
    block: createButtonBlock({
      text: label,
      url: button.href ? decodeEntitiesInTokens(button.href) : "#",
      backgroundColor: buttonBackgroundColor(style["background-color"]),
      textColor: parseColor(style.color) || "#ffffff",
      borderRadius: parsePxValue(style["border-radius"]),
      fontSize,
      ...(lineHeight !== undefined ? { lineHeight } : {}),
      fontFamily: canonicalFontStack(style["font-family"]) || undefined,
      ...(fontWeight ? { fontWeight } : {}),
      // The module style places the button in the column. The button style's
      // text-align is the label, used when the module sets none.
      align: toAlign(
        descriptor.style?.["text-align"] ?? style["text-align"],
        "center",
      ),
      ...(width !== undefined ? { width } : {}),
      ...(border ? { border } : {}),
      buttonPadding: padding,
      styles: makeStyles(descriptor),
    }),
    notes: [note, widthNote].filter(
      (item): item is string => item !== undefined,
    ),
  };
}

/**
 * `"full"` when the divider spans its column: no width, `100%`, or a px width
 * that reaches `contentWidth`. Without a `contentWidth` a px width stands as
 * stated. Any other percentage stays a percentage, clamped to 0–100%.
 */
function resolveDividerWidth(
  value: string | undefined,
  contentWidth: number | undefined,
  notes: string[],
): DividerBlock["width"] {
  const raw = (value ?? "").trim();
  if (!raw) return "full";

  const parsed = parseDividerWidth(raw);
  if (!parsed) {
    notes.push(
      `Divider width "${raw}" could not be read; imported as full width.`,
    );
    return "full";
  }

  if (parsed.unit === "%") {
    const percent = Math.min(100, Math.max(0, parsed.value));
    if (percent !== parsed.value) {
      notes.push(`Divider width ${raw} was clamped to ${percent}%.`);
    }
    // Two decimals keep the value inside `DividerPercentWidth`'s pattern,
    // which a float printed in exponent form would leave.
    const share = Math.round(percent * 100) / 100;
    return share === 100 ? "full" : `${share}%`;
  }

  const px = Math.max(0, Math.round(parsed.value));
  if (px !== Math.round(parsed.value)) {
    notes.push(`Divider width ${raw} was clamped to 0px.`);
  }
  return contentWidth !== undefined && px >= contentWidth ? "full" : px;
}

function convertDivider(
  descriptor: BeeFreeeModuleDescriptor,
  columnWidth: number | undefined,
): { block: Block; notes: string[] } {
  const style = descriptor.divider?.style ?? {};
  const border = parseBorderTop(style["border-top"]);
  const styles = makeStyles(descriptor);
  const notes: string[] = [];

  // MJML draws a full divider across its column less the divider's own
  // padding, so a px width that reaches that renders the same as "full", and
  // "full" keeps narrowing with the column on a phone.
  const contentWidth = measuredRoom(columnWidth, styles.padding);
  const width = resolveDividerWidth(style.width, contentWidth, notes);

  const align = dividerAlign(descriptor);
  if (width !== "full" && (align === "left" || align === "right")) {
    notes.push(
      `BeeFree aligns this divider ${align}; Templatical centres every divider.`,
    );
  }

  return {
    block: createDividerBlock({
      lineStyle: toLineStyle(border.style),
      color: border.color,
      thickness: border.width || 1,
      width,
      styles,
    }),
    notes,
  };
}

/**
 * BeeFree keeps a divider's alignment in `computedStyle.align`; some exports
 * also write it to the module style's `text-align`.
 */
function dividerAlign(
  descriptor: BeeFreeeModuleDescriptor,
): string | undefined {
  const computed = descriptor.computedStyle?.align;
  return typeof computed === "string"
    ? computed
    : descriptor.style?.["text-align"];
}

/**
 * The room a divider that draws no line takes: its top and bottom padding plus
 * the width of a transparent border. `undefined` when the line is drawn.
 * BeeFree templates space content this way.
 */
function undrawnDividerHeight(
  descriptor: BeeFreeeModuleDescriptor,
): number | undefined {
  const border = parseBorderTop(descriptor.divider?.style?.["border-top"]);
  if (border.drawn) return undefined;
  const padding = extractPadding(descriptor.style);
  return padding.top + border.width + padding.bottom;
}

/**
 * A divider that draws no line, as a spacer of the same height. A spacer
 * renders no padding, so the divider's padding goes into the height.
 */
function convertUndrawnDivider(
  descriptor: BeeFreeeModuleDescriptor,
  height: number,
): Block {
  return createSpacerBlock({
    height,
    styles: {
      ...makeStyles(descriptor),
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
    },
  });
}

/** BeeFree's documented height for a spacer it has no height for. */
const BEEFREE_SPACER_HEIGHT = 60;

/** A spacer's height in px; an explicit 0 stays 0. */
function spacerHeight(descriptor: BeeFreeeModuleDescriptor): number {
  return (
    readPxLength(descriptor.spacer?.style?.height) ?? BEEFREE_SPACER_HEIGHT
  );
}

function convertSpacer(descriptor: BeeFreeeModuleDescriptor): Block {
  return createSpacerBlock({
    height: spacerHeight(descriptor),
    styles: makeStyles(descriptor),
  });
}

function convertHtml(
  descriptor: BeeFreeeModuleDescriptor,
  moduleType: string,
  bodyFontFamily?: string,
): Block {
  const html = importedHtml(descriptor.html?.html ?? "");
  // BeeFree centres an HTML module and applies no font-size, line-height
  // or word-break, so the browser defaults apply: 16px, `line-height:
  // normal` and `word-break: normal`. `mj-text` overrides all three. The
  // wrapper restores them and copies the page body font; with none, it sets
  // no font-family. Blank content, and an addon that carries HTML, stay
  // unwrapped.
  const fontFamily = bodyFontFamily
    ? `font-family:${escapeHtml(bodyFontFamily)};`
    : "";
  const content =
    moduleType === HTML_MODULE && html.trim() !== ""
      ? `<div style="${fontFamily}font-size:16px;line-height:normal;word-break:normal;text-align:center" align="center">${html}</div>`
      : html;

  return createHtmlBlock({
    content,
    styles: makeStyles(descriptor),
  });
}

/** `"E-Mail"` and `"YouTube"` are network names; a blank id is not one. */
function socialKey(value: string | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function platformFromKey(
  value: string | undefined,
): BuiltInSocialPlatform | undefined {
  const key = socialKey(value);
  // Own keys only: `constructor` and friends are not networks.
  return key && Object.hasOwn(SOCIAL_PLATFORM_MAP, key)
    ? SOCIAL_PLATFORM_MAP[key]
    : undefined;
}

const SOCIAL_HOSTS: readonly (readonly [string, BuiltInSocialPlatform])[] = [
  ["youtube.com", "youtube"],
  ["youtu.be", "youtube"],
  ["facebook.com", "facebook"],
  ["fb.com", "facebook"],
  ["instagram.com", "instagram"],
  ["linkedin.com", "linkedin"],
  ["xing.com", "xing"],
  ["twitter.com", "twitter"],
  ["x.com", "twitter"],
  ["tiktok.com", "tiktok"],
  ["pinterest.com", "pinterest"],
  ["pin.it", "pinterest"],
  ["whatsapp.com", "whatsapp"],
  ["wa.me", "whatsapp"],
  ["t.me", "telegram"],
  ["telegram.me", "telegram"],
  ["telegram.org", "telegram"],
  ["discord.com", "discord"],
  ["discord.gg", "discord"],
  ["snapchat.com", "snapchat"],
  ["reddit.com", "reddit"],
  ["github.com", "github"],
  ["dribbble.com", "dribbble"],
  ["behance.net", "behance"],
];

/** The link's host when the icon's id and name are not a network. */
function platformFromHref(
  href: string | undefined,
): BuiltInSocialPlatform | undefined {
  const raw = (href ?? "").trim();
  if (!raw) return undefined;
  if (/^mailto:/i.test(raw)) return "email";
  let host: string;
  try {
    host = new URL(raw).hostname.toLowerCase();
  } catch {
    return undefined;
  }
  if (host.startsWith("www.")) host = host.slice(4);
  for (const [domain, platform] of SOCIAL_HOSTS) {
    if (host === domain || host.endsWith(`.${domain}`)) return platform;
  }
  return undefined;
}

/**
 * BeeFree stores a custom icon's id as a UUID and the network in `name`, or
 * the other way around. A blank id is not a name. The link's host is the
 * last place the network is written.
 */
function socialPlatform(
  icon: BeeFreeeSocialIcon,
): BuiltInSocialPlatform | undefined {
  return (
    platformFromKey(icon.id) ??
    platformFromKey(icon.name) ??
    platformFromKey(icon.image?.alt) ??
    platformFromKey(icon.image?.title) ??
    platformFromHref(icon.image?.href)
  );
}

/** Title, then alt, then name. `custom` when the icon names none of them. */
function socialIconLabel(icon: BeeFreeeSocialIcon): string {
  const title = icon.image?.title?.trim();
  if (title) return title;
  const alt = icon.image?.alt?.trim();
  if (alt) return alt;
  const name = icon.name?.trim();
  if (name) return name;
  return "custom";
}

function safeCopiedUrl(
  value: string,
  kind: "src" | "href",
  warnings: string[],
): string {
  if (!value) return "";
  if (isSafeHtmlUrl(value, kind)) return value;
  warnings.push(
    kind === "src"
      ? `Dropped the unsafe image "${value}" on a social icon.`
      : `Dropped the unsafe link "${value}" on a social icon.`,
  );
  return "";
}

/** A usable icon file: decoded, non-blank, and safe as an image `src`. */
function socialImageUrl(icon: BeeFreeeSocialIcon, warnings: string[]): string {
  const raw = icon.image?.src;
  if (typeof raw !== "string") return "";
  const decoded = decodeEntitiesInTokens(raw).trim();
  if (!decoded) return "";
  return safeCopiedUrl(decoded, "src", warnings);
}

/** Alt text: the image alt, then its title, then the icon name. */
function socialAlt(icon: BeeFreeeSocialIcon): string | undefined {
  for (const candidate of [icon.image?.alt, icon.image?.title, icon.name]) {
    if (typeof candidate !== "string") continue;
    const decoded = decodeEntitiesInTokens(candidate).trim();
    if (decoded) return decoded;
  }
  return undefined;
}

function imagelessSocialNote(
  icon: BeeFreeeSocialIcon,
  platform: BuiltInSocialPlatform,
): string {
  const as =
    platform === "website"
      ? "the generic website icon"
      : `the ${platform} icon`;
  return `Custom icon ${socialIconLabel(icon)} has no image file; imported as ${as}.`;
}

function socialHref(icon: BeeFreeeSocialIcon): string {
  const href = decodeEntitiesInTokens(icon.image?.href ?? "");
  const prefix = icon.image?.prefix ?? "";
  if (
    /^(?:mailto|tel|sms):$/i.test(prefix) &&
    href !== "" &&
    !href.toLowerCase().startsWith(prefix.toLowerCase())
  ) {
    return prefix + href;
  }
  return href;
}

/**
 * BeeFree names an icon set in the file URL
 * (`…/social-networks-icon-sets/circle-dark-gray/facebook.png`).
 * A gray set uses the dark tone: the block's monochrome dark is `#1f1f1f`,
 * the nearest circle that is not a brand-coloured solid. A listed name maps
 * to that entry. An unlisted name keeps a `circle-`, `rounded-`, `square-`
 * or `squared-` prefix, with at least one character after the hyphen, as
 * that shape in brand colours. Any other named set stays the solid brand
 * icons and is reported approximated.
 */
const SOCIAL_ICON_SETS: Record<
  string,
  { iconStyle: SocialIconStyle; iconTone?: SocialIconTone }
> = {
  "circle-color": { iconStyle: "circle" },
  "circle-colored": { iconStyle: "circle" },
  "circle-colour": { iconStyle: "circle" },
  "circle-black": { iconStyle: "circle", iconTone: "dark" },
  "circle-dark": { iconStyle: "circle", iconTone: "dark" },
  "circle-dark-gray": { iconStyle: "circle", iconTone: "dark" },
  "circle-dark-grey": { iconStyle: "circle", iconTone: "dark" },
  "circle-gray": { iconStyle: "circle", iconTone: "dark" },
  "circle-grey": { iconStyle: "circle", iconTone: "dark" },
  "circle-white": { iconStyle: "circle", iconTone: "light" },
  "circle-light": { iconStyle: "circle", iconTone: "light" },
  "rounded-color": { iconStyle: "rounded" },
  "rounded-colored": { iconStyle: "rounded" },
  "rounded-black": { iconStyle: "rounded", iconTone: "dark" },
  "rounded-dark": { iconStyle: "rounded", iconTone: "dark" },
  "rounded-dark-gray": { iconStyle: "rounded", iconTone: "dark" },
  "rounded-dark-grey": { iconStyle: "rounded", iconTone: "dark" },
  "rounded-white": { iconStyle: "rounded", iconTone: "light" },
  "rounded-light": { iconStyle: "rounded", iconTone: "light" },
  "square-color": { iconStyle: "square" },
  "square-colored": { iconStyle: "square" },
  "squared-color": { iconStyle: "square" },
  "squared-colored": { iconStyle: "square" },
  "square-black": { iconStyle: "square", iconTone: "dark" },
  "square-dark": { iconStyle: "square", iconTone: "dark" },
  "squared-black": { iconStyle: "square", iconTone: "dark" },
  "squared-dark": { iconStyle: "square", iconTone: "dark" },
  "square-dark-gray": { iconStyle: "square", iconTone: "dark" },
  "square-dark-grey": { iconStyle: "square", iconTone: "dark" },
  "squared-dark-gray": { iconStyle: "square", iconTone: "dark" },
  "squared-dark-grey": { iconStyle: "square", iconTone: "dark" },
  "square-white": { iconStyle: "square", iconTone: "light" },
  "square-light": { iconStyle: "square", iconTone: "light" },
  "squared-white": { iconStyle: "square", iconTone: "light" },
  "squared-light": { iconStyle: "square", iconTone: "light" },
};

function socialIconSet(
  descriptor: BeeFreeeModuleDescriptor,
): string | undefined {
  // A malformed percent-escape in one icon URL must not abort the import.
  const decodeSetName = (segment: string): string => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  };
  const icons = descriptor.iconsList?.icons;
  if (!Array.isArray(icons)) return undefined;
  for (const icon of icons) {
    if (!icon || typeof icon !== "object") continue;
    const src = (icon as BeeFreeeSocialIcon).image?.src;
    if (typeof src !== "string") continue;
    const match = /social-networks-icon-sets\/([^/?#]+)\//i.exec(src);
    if (match) return decodeSetName(match[1]).toLowerCase();
  }
  return undefined;
}

/**
 * The gap between icons. BeeFree's padding is the space on each side of an
 * icon, so two neighbours contribute both sides. Rounded once, after the sum.
 * `undefined` when the padding isn't a length, and the block keeps 10.
 */
function socialSpacing(
  descriptor: BeeFreeeModuleDescriptor,
): number | undefined {
  const padding = descriptor.computedStyle?.padding;
  if (typeof padding !== "string" || padding.trim() === "") return undefined;
  const parts = padding.trim().split(/\s+/);
  if (parts.length > 4) return undefined;
  const values: number[] = [];
  for (const part of parts) {
    const match = /^(\d+(?:\.\d+)?|\.\d+)(px)?$/i.exec(part);
    if (!match) return undefined;
    values.push(parseFloat(match[1]));
  }
  // 1 value: every side. 2 or 3: the second is both horizontals. 4: the fourth is left.
  const right = values.length === 1 ? values[0] : values[1];
  const left = values.length === 4 ? values[3] : right;
  return Math.round(left + right);
}

/** Nearest of the block's 24 / 32 / 48px presets. */
function socialIconSizeFromWidth(width: number): SocialIconSize | undefined {
  if (width <= 0) return undefined;
  if (width < 28) return "small";
  if (width < 40) return "medium";
  return "large";
}

/** A `circle-`, `rounded-`, `square-` or `squared-` prefix with at least one character after the hyphen. */
function socialSetShape(set: string): SocialIconStyle | undefined {
  // The suffix includes a line break, which a decoded set name can hold.
  const match = /^(circle|rounded|squared|square)-[\s\S]+$/.exec(set);
  if (!match) return undefined;
  if (match[1] === "circle") return "circle";
  if (match[1] === "rounded") return "rounded";
  return "square";
}

function socialAppearance(descriptor: BeeFreeeModuleDescriptor): {
  appearance: Partial<
    Pick<
      SocialIconsBlock,
      "align" | "spacing" | "iconSize" | "iconStyle" | "iconTone"
    >
  >;
  note?: string;
} {
  const spacing = socialSpacing(descriptor);
  const size = socialIconSizeFromWidth(
    computedPx(descriptor.computedStyle?.iconsDefaultWidth),
  );
  const set = socialIconSet(descriptor);
  const theme = set !== undefined ? SOCIAL_ICON_SETS[set] : undefined;
  let shape: SocialIconStyle | undefined;
  let note: string | undefined;
  if (set !== undefined && theme === undefined) {
    shape = socialSetShape(set);
    note = shape
      ? `Icon set ${set} imported as ${shape} icons in brand colours.`
      : `Icon set ${set} has no matching shape; imported as solid brand icons.`;
  }
  return {
    appearance: {
      align: toAlign(descriptor.style?.["text-align"], "center"),
      ...(spacing !== undefined ? { spacing } : {}),
      ...(size ? { iconSize: size } : {}),
      ...(theme
        ? {
            iconStyle: theme.iconStyle,
            ...(theme.iconTone ? { iconTone: theme.iconTone } : {}),
          }
        : shape
          ? { iconStyle: shape }
          : {}),
    },
    ...(note ? { note } : {}),
  };
}

/** BeeFree's inline-block icon table leaves a 4px line-box strut under the icons; MJML's column cell sets `font-size:0px`, so the importer adds it to the bottom padding. */
const SOCIAL_ROW_STRUT_PX = 4;

/**
 * One social block for the whole module, in source order. A `type: "custom"`
 * icon, and an unrecognised network, become a custom icon when the image file
 * is usable: that file, the link and the alt text stay on the icon. A custom
 * upload keeps its image even when its name is a known platform. An icon that
 * would be custom but has no usable image becomes the recognised platform, or
 * `website`, and is reported approximated.
 */
function convertSocial(
  descriptor: BeeFreeeModuleDescriptor,
  warnings: string[],
): { block: Block; extras: Block[]; notes: string[] } {
  const iconsList = descriptor.iconsList;
  const styles = makeStyles(descriptor);
  styles.padding.bottom += SOCIAL_ROW_STRUT_PX;
  const { appearance, note: setNote } = socialAppearance(descriptor);
  const notes: string[] = [];
  if (setNote) {
    notes.push(setNote);
    warnings.push(setNote);
  }
  if (!iconsList?.icons) {
    return {
      block: createSocialIconsBlock({ styles, ...appearance }),
      extras: [],
      notes,
    };
  }

  const icons: SocialIcon[] = [];
  // The Icons module keeps items of another shape under the same key.
  for (const beeIcon of iconsList.icons as BeeFreeeSocialIcon[]) {
    const recognised = socialPlatform(beeIcon);
    // Whitespace is a relative URL to isSafeHtmlUrl, so a blank link is
    // rejected here and stored as "#", the same as a missing one.
    const href = socialHref(beeIcon);
    const url =
      href.trim() === "" ? "#" : safeCopiedUrl(href, "href", warnings) || "#";
    const customCandidate =
      beeIcon.type === "custom" || recognised === undefined;
    const imageUrl = customCandidate ? socialImageUrl(beeIcon, warnings) : "";
    if (customCandidate && imageUrl) {
      const alt = socialAlt(beeIcon);
      icons.push({
        id: generateId(),
        platform: "custom",
        imageUrl,
        url,
        ...(alt ? { alt } : {}),
      });
      continue;
    }
    if (!customCandidate && recognised) {
      icons.push({ id: generateId(), platform: recognised, url });
      continue;
    }
    const platform = recognised ?? "website";
    const note = imagelessSocialNote(beeIcon, platform);
    warnings.push(note);
    notes.push(note);
    icons.push({ id: generateId(), platform, url });
  }

  return {
    block: createSocialIconsBlock({ icons, styles, ...appearance }),
    extras: [],
    notes,
  };
}

/** Escape `& < > "` for text content and attribute values. */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function iconItems(descriptor: BeeFreeeModuleDescriptor): BeeFreeeIconItem[] {
  const icons = descriptor.iconsList?.icons;
  return Array.isArray(icons) ? (icons as BeeFreeeIconItem[]) : [];
}

/** The padding BeeFree keeps around each icon, `computedStyle.iconSpacing`. */
function iconSpacing(descriptor: BeeFreeeModuleDescriptor): SpacingValue {
  const value = descriptor.computedStyle?.iconSpacing;
  if (typeof value !== "object" || value === null) return extractPadding({});
  return extractPadding(
    Object.fromEntries(
      Object.entries(value).filter(([, side]) => typeof side === "string"),
    ),
  );
}

/**
 * The height BeeFree draws every icon at, and an icon's width at that height,
 * from its file's size. The width is `undefined` when the size isn't stated.
 */
function iconSize(
  descriptor: BeeFreeeModuleDescriptor,
  item: BeeFreeeIconItem,
): { height: number; width: number | undefined } {
  const height = computedPx(descriptor.computedStyle?.iconHeight) || 32;
  const fileWidth = parsePxValue(stringField(item.width));
  const fileHeight = parsePxValue(stringField(item.height));
  return {
    height,
    width:
      fileWidth > 0 && fileHeight > 0
        ? Math.round((height * fileWidth) / fileHeight)
        : undefined,
  };
}

/**
 * A lone icon without text, as an image block at the icon height. `undefined`
 * when the module holds anything else, or the icon's file size is unknown.
 */
function convertSingleIcon(
  descriptor: BeeFreeeModuleDescriptor,
  columnWidth: number | undefined,
): Block | undefined {
  const items = iconItems(descriptor);
  if (items.length !== 1) return undefined;
  const [item] = items;
  const src = stringField(item.image);
  const { width } = iconSize(descriptor, item);
  if (!src || stringField(item.text) || width === undefined) return undefined;

  // The module's padding plus the space BeeFree keeps around the icon.
  const styles = makeStyles(descriptor);
  const spacing = iconSpacing(descriptor);
  const padding = {
    top: styles.padding.top + spacing.top,
    right: styles.padding.right + spacing.right,
    bottom: styles.padding.bottom + spacing.bottom,
    left: styles.padding.left + spacing.left,
  };
  const room = measuredRoom(columnWidth, padding);

  return createImageBlock({
    src,
    alt: stringField(item.alt),
    width: shownWidth(width, room),
    naturalWidth: parsePxValue(stringField(item.width)),
    naturalHeight: parsePxValue(stringField(item.height)),
    align: toAlign(descriptor.style?.["text-align"]),
    linkUrl: stringField(item.href) || undefined,
    styles: { ...styles, padding },
  });
}

/** The module's text style as CSS declarations, for the icons' text cells. */
function iconTextStyle(style: Record<string, string>): string {
  const color = parseColor(style.color);
  const fontFamily = canonicalFontStack(style["font-family"]);
  const fontSize = parsePxValue(style["font-size"]);
  const fontWeight = cssFontWeight(style["font-weight"]);
  return [
    color ? `color: ${color};` : "",
    fontFamily ? `font-family: ${fontFamily};` : "",
    fontSize ? `font-size: ${fontSize}px;` : "",
    fontWeight ? `font-weight: ${fontWeight};` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * The Icons module as the table BeeFree draws: the icons side by side, each at
 * the icon height inside its `iconSpacing`, with its text on the side
 * `textPosition` names, in the module's text style.
 */
function iconsHtml(descriptor: BeeFreeeModuleDescriptor): string {
  const style = descriptor.style ?? {};
  const computed = descriptor.computedStyle ?? {};
  const align = toAlign(style["text-align"]);
  const color = parseColor(style.color);
  const textStyle = iconTextStyle(style);
  // `itemSpacing` is the legacy key, read only when `itemsSpacing` is absent.
  const gap = computedPx(computed.itemsSpacing ?? computed.itemSpacing);
  const spacing = iconSpacing(descriptor);
  const iconPadding =
    spacing.top || spacing.right || spacing.bottom || spacing.left
      ? `padding: ${spacing.top}px ${spacing.right}px ${spacing.bottom}px ${spacing.left}px; `
      : "";

  const items = iconItems(descriptor).map((item, index) => {
    const position = stringField(item.textPosition);
    const stacked = position === "top" || position === "bottom";
    const cellAlign = stacked ? ' align="center"' : "";
    const href = stringField(item.href);
    const target = stringField(item.target);
    const link = (inner: string, linkStyle: string) =>
      href
        ? `<a href="${escapeHtml(href)}"${target ? ` target="${escapeHtml(target)}"` : ""} style=${quoteStyleValue(linkStyle)}>${inner}</a>`
        : inner;

    const src = stringField(item.image);
    const { height, width } = iconSize(descriptor, item);
    const title = stringField(item.title);
    const imgStyle = [
      "display: block;",
      stacked ? "margin: 0 auto;" : "",
      width === undefined ? "" : `width: ${width}px;`,
      `height: ${height}px;`,
      "border: 0;",
    ]
      .filter(Boolean)
      .join(" ");
    const img = `<img src="${escapeHtml(src)}" alt="${escapeHtml(stringField(item.alt))}"${title ? ` title="${escapeHtml(title)}"` : ""}${width === undefined ? "" : ` width="${width}"`} height="${height}" style=${quoteStyleValue(imgStyle)}>`;
    const iconCell = src
      ? `<td${cellAlign} style=${quoteStyleValue(`${iconPadding}vertical-align: middle;`)}>${link(img, "text-decoration: none;")}</td>`
      : "";

    const text = stringField(item.text);
    const textCell = text
      ? `<td${cellAlign} style=${quoteStyleValue(`vertical-align: middle;${textStyle ? ` ${textStyle}` : ""}`)}>${link(
          escapeHtml(text),
          `${color ? `color: ${color}; ` : ""}text-decoration: none;`,
        )}</td>`
      : "";

    const rows =
      position === "top"
        ? [textCell, iconCell]
        : position === "bottom"
          ? [iconCell, textCell]
          : [position === "left" ? textCell + iconCell : iconCell + textCell];
    const body = rows
      .filter(Boolean)
      .map((row) => `<tr>${row}</tr>`)
      .join("");
    const itemGap = index > 0 && gap ? `padding-left: ${gap}px; ` : "";
    return `<td style=${quoteStyleValue(`${itemGap}vertical-align: middle;`)}><table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">${body}</table></td>`;
  });

  const tableAlign = align === "left" ? "" : ` align="${align}"`;
  // `escapeHtml` re-encodes `&` and `>`. Decoding the finished table puts
  // those characters back inside tokens, and a quote in an attribute stays
  // `&quot;`.
  return decodeEntitiesInHtml(
    `<table role="presentation" border="0" cellpadding="0" cellspacing="0"${tableAlign} style="border-collapse: collapse;"><tr>${items.join("")}</tr></table>`,
  );
}

/**
 * The Icons module's items without the link and image URLs the editor's HTML
 * policy rejects (`javascript:`, `vbscript:`, a non-image `data:`), each named
 * in `warnings`. Both outputs carry these URLs into markup, and an HTML block
 * renders unsanitized.
 */
function safeIconItems(
  descriptor: BeeFreeeModuleDescriptor,
  warnings: string[],
): BeeFreeeIconItem[] {
  return iconItems(descriptor).map((item) => {
    // Decode before the URL check and before `escapeHtml`. The table decodes
    // again after escaping: a text node in full, an attribute with a quote
    // left encoded.
    const safe: BeeFreeeIconItem = {
      ...item,
      image: decodeEntitiesInTokens(stringField(item.image)),
      alt: decodeEntitiesInTokens(stringField(item.alt)),
      href: decodeEntitiesInTokens(stringField(item.href)),
      text: decodeEntitiesInTokens(stringField(item.text)),
      title: decodeEntitiesInTokens(stringField(item.title)),
      target: decodeEntitiesInTokens(stringField(item.target)),
    };
    const image = stringField(safe.image);
    if (image && !isSafeHtmlUrl(image, "src")) {
      warnings.push(`Dropped the unsafe image "${image}" on an Icons item.`);
      safe.image = "";
    }
    const href = stringField(safe.href);
    if (href && !isSafeHtmlUrl(href, "href")) {
      warnings.push(`Dropped the unsafe link "${href}" on an Icons item.`);
      safe.href = "";
    }
    return safe;
  });
}

function convertIcons(
  descriptor: BeeFreeeModuleDescriptor,
  columnWidth: number | undefined,
  warnings: string[],
): { block: Block; rebuilt: boolean } {
  const safe = {
    ...descriptor,
    iconsList: { icons: safeIconItems(descriptor, warnings) },
  };
  const single = convertSingleIcon(safe, columnWidth);
  if (single) return { block: single, rebuilt: false };
  return {
    block: createHtmlBlock({
      content: iconsHtml(safe),
      styles: makeStyles(descriptor),
    }),
    rebuilt: true,
  };
}

/**
 * Links `renderVideo` in `@templatical/renderer` derives a thumbnail for when
 * the block has none: YouTube watch, short, embed and youtu.be links, and
 * Vimeo. Keep it in step with that function's patterns.
 */
const DERIVED_THUMBNAIL_URL =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}|vimeo\.com\/(?:video\/)?\d+/;

/**
 * A video's shown width: BeeFree writes a percentage of the column
 * (`computedStyle.width`, else `style.width`), or a px length. It follows the
 * image rule: 100% or more, missing or unreadable is `"full"`, a percentage
 * under 100% is px of the room, and a px width that reaches the room is
 * `"full"`.
 */
function resolveVideoWidth(
  descriptor: BeeFreeeModuleDescriptor,
  room: number | undefined,
): { width: VideoBlock["width"]; note?: string } {
  const stated = descriptor.computedStyle?.width ?? descriptor.style?.width;
  const percent = computedPercent(stated);
  if (percent !== undefined) return percentOfRoom("Video", percent, room);
  return { width: shownWidth(computedPx(stated), room) };
}

function convertVideo(
  descriptor: BeeFreeeModuleDescriptor,
  columnWidth: number | undefined,
  warnings: string[],
): { block: Block; notes: string[] } {
  const video = descriptor.video;
  const styles = makeStyles(descriptor);
  if (!video) {
    return { block: createVideoBlock({ styles }), notes: [] };
  }

  const url = decodeEntitiesInTokens(video.src || "");
  // `embedded` and `custom` play the video on the page and carry no
  // thumbnail; an email can only link one.
  const playsInPlace = video.mode === "embedded" || video.mode === "custom";
  const thumbnailUrl = playsInPlace
    ? ""
    : decodeEntitiesInTokens(video.thumbSrc || "");
  const room = measuredRoom(columnWidth, styles.padding);
  const { width, note } = resolveVideoWidth(descriptor, room);
  const notes = note ? [note] : [];
  if (playsInPlace) {
    notes.push(
      `BeeFree plays a ${video.mode} video in place; Templatical links a thumbnail of it.`,
    );
  }
  if (!thumbnailUrl && url && !DERIVED_THUMBNAIL_URL.test(url)) {
    warnings.push(
      `Video "${url}" has no thumbnail, and Templatical derives one only for YouTube and Vimeo links, so it renders nothing until a thumbnail is set.`,
    );
  }

  const classes = computedClasses(descriptor);
  return {
    block: createVideoBlock({
      url,
      thumbnailUrl,
      alt: decodeEntitiesInTokens(video.thumbAlt ?? ""),
      width,
      align:
        (["left", "center", "right"] as const).find((side) =>
          classes.includes(side),
        ) ?? "center",
      styles,
    }),
    notes,
  };
}

/**
 * The gap on each side of a menu separator: half of BeeFree's left and right
 * item padding, so the space between two items matches. An unreadable side
 * counts as 0 when the other side reads; with neither, the factory spacing
 * applies.
 */
function menuItemSpacing(value: unknown): number | undefined {
  if (!value || typeof value !== "object") return undefined;
  const sides = value as Record<string, unknown>;
  const side = (key: string) => {
    const length = sides[key];
    return typeof length === "string" ? readPxLength(length) : undefined;
  };
  const left = side("padding-left");
  const right = side("padding-right");
  if (left === undefined && right === undefined) return undefined;
  return Math.round(((left ?? 0) + (right ?? 0)) / 2);
}

function convertMenu(
  descriptor: BeeFreeeModuleDescriptor,
  textColor: string,
): { block: Block; notes: string[] } {
  const list = descriptor.menuItemsList;
  const styles = makeStyles(descriptor);
  if (!list) {
    return { block: createMenuBlock({ styles }), notes: [] };
  }

  const style = descriptor.style ?? {};
  const computed = descriptor.computedStyle ?? {};
  const items: MenuItemData[] = (list.items ?? []).map((item) => ({
    id: generateId(),
    text: decodeEntitiesInTokens(item.text || ""),
    url: decodeEntitiesInTokens(item.link?.href || "#"),
    openInNewTab: item.link?.target === "_blank",
    bold: false,
    underline: false,
  }));
  const color = parseColor(style.color);
  const linkColor =
    typeof computed.linkColor === "string"
      ? parseColor(computed.linkColor)
      : "";

  return {
    block: createMenuBlock({
      items,
      // BeeFree writes `separator` only when the menu has one.
      separator:
        typeof computed.separator === "string"
          ? decodeEntitiesInTokens(computed.separator)
          : "",
      // The separator is drawn in the menu's text color.
      separatorColor: color || textColor,
      spacing: menuItemSpacing(computed.menuItemsSpacing),
      fontSize: readPxLength(style["font-size"]),
      color: color || undefined,
      linkColor: linkColor || undefined,
      fontFamily: canonicalFontStack(style["font-family"]) || undefined,
      textAlign: toAlign(style["text-align"], "center"),
      styles,
    }),
    notes:
      computed.layout === "vertical"
        ? ["BeeFree's vertical menu layout was imported horizontal."]
        : [],
  };
}

/**
 * A line break, or a block element's opening or closing tag. The attributes
 * stop at the next `<`, so unclosed tags are scanned in linear time.
 */
const CELL_TEXT_BOUNDARY =
  /<br\s*\/?>|<\/?(?:p|div|li|ul|ol|h[1-6]|blockquote)(?:\s[^<>]*)?>/gi;

/**
 * A table cell's plain text. Paragraphs and line breaks become one space, so
 * `<p>First</p><p>Second</p>` reads `First Second`; inline markup leaves its
 * text joined. A cell with no such boundary is read as before.
 */
function tableCellText(html: string): string {
  const spaced = html.replace(CELL_TEXT_BOUNDARY, " ");
  if (spaced === html) return importedPlainText(html);
  return importedPlainText(spaced)
    .replace(/[ \t\r\n]+/g, " ")
    .trim();
}

const TABLE_BORDER_SIDES = [
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
] as const;

/**
 * One border for every cell edge from BeeFree's four sides. Equal sides keep
 * their width and color; sides that differ take the widest drawn one, with a
 * note. A side BeeFree leaves out draws nothing. With no side stated, the
 * factory border applies.
 */
function tableBorder(style: Record<string, string>): {
  borderWidth?: number;
  borderColor?: string;
  notes: string[];
} {
  if (TABLE_BORDER_SIDES.every((side) => style[side] === undefined)) {
    return { notes: [] };
  }
  const drawn = TABLE_BORDER_SIDES.map((side) =>
    parseBorderTop(style[side] ?? "none"),
  ).filter((side) => side.drawn && side.width > 0);
  if (drawn.length === 0) return { borderWidth: 0, notes: [] };

  const widest = drawn.reduce((a, b) => (b.width > a.width ? b : a));
  const notes: string[] = [];
  const same =
    drawn.length === TABLE_BORDER_SIDES.length &&
    drawn.every(
      (side) => side.width === widest.width && side.color === widest.color,
    );
  if (!same) {
    notes.push(
      `Table borders differ by side; every cell edge uses ${widest.width}px ${widest.color}.`,
    );
  }
  const patterned = drawn.find((side) => side.style !== "solid");
  if (patterned) {
    notes.push(`Table border style ${patterned.style} is drawn solid.`);
  }
  return { borderWidth: widest.width, borderColor: widest.color, notes };
}

/**
 * What a BeeFree header row states that Templatical's does not draw: its
 * header row is bold in the body's color, size and alignment. Only stated
 * header styles are compared.
 */
function tableHeaderNote(
  computed: Record<string, string>,
  body: { color: string; fontSize: number; textAlign: string },
): string | undefined {
  const lost: string[] = [];
  const weight = cssFontWeightNumber(computed.headersFontWeight);
  if (weight !== undefined && weight < 600) lost.push(`font weight ${weight}`);
  const color = parseColor(computed.headersColor);
  if (color && color !== body.color) lost.push(`color ${color}`);
  const fontSize = readPxLength(computed.headersFontSize);
  if (fontSize !== undefined && fontSize !== body.fontSize) {
    lost.push(`font size ${fontSize}px`);
  }
  const align = computed.headersTextAlign;
  if (
    (align === "left" || align === "center" || align === "right") &&
    align !== body.textAlign
  ) {
    lost.push(`alignment ${align}`);
  }
  return lost.length > 0
    ? `Header row ${lost.join(", ")} not kept; Templatical draws the header bold in the body's color, size and alignment.`
    : undefined;
}

function convertTable(
  descriptor: BeeFreeeModuleDescriptor,
  textColor: string,
): {
  block: Block;
  cellHtmlStripped: boolean;
  notes: string[];
} {
  const table = descriptor.table;
  const styles = makeStyles(descriptor);
  if (!table) {
    return {
      block: createTableBlock({ styles }),
      cellHtmlStripped: false,
      notes: [],
    };
  }

  const style = table.style ?? {};
  const computed = table.computedStyle ?? {};

  // Templatical table cells are a plain-text field (the editor stores the
  // cell's innerText), so strip any HTML a BeeFree cell carried the same way
  // button labels are stripped. If a strip actually removed markup, the cell
  // lost formatting or a link URL, so the conversion is an approximation.
  let cellHtmlStripped = false;
  const toRow = (row: BeeFreeeTableRow): TableRowData => ({
    id: generateId(),
    cells: (row.cells ?? []).map((cell): TableCellData => {
      const raw = cell.html ?? "";
      const content = tableCellText(raw);
      if (content !== raw) {
        cellHtmlStripped = true;
      }
      return { id: generateId(), content };
    }),
  });
  const headers = (table.content?.headers ?? []).map(toRow);
  const rows = (table.content?.rows ?? []).map(toRow);

  const color = parseColor(style.color);
  const border = tableBorder(style);
  const block = createTableBlock({
    rows: [...headers, ...rows],
    hasHeaderRow: headers.length > 0,
    headerBackgroundColor:
      parseColor(computed.headersBackgroundColor) || undefined,
    borderColor: border.borderColor,
    borderWidth: border.borderWidth,
    fontSize: readPxLength(style["font-size"]),
    fontFamily: canonicalFontStack(style["font-family"]) || undefined,
    color: color || undefined,
    textAlign: toAlign(style["text-align"]),
    styles,
  });

  const notes: string[] = [];
  if (headers.length > 0) {
    const headerNote = tableHeaderNote(computed, {
      color: color || textColor,
      fontSize: block.fontSize,
      textAlign: block.textAlign,
    });
    if (headerNote) notes.push(headerNote);
    const extra = headers.length - 1;
    if (extra > 0) {
      notes.push(
        extra === 1
          ? "1 more header row imported as a body row."
          : `${extra} more header rows imported as body rows.`,
      );
    }
  }
  notes.push(...border.notes);

  return { block, cellHtmlStripped, notes };
}

function convertHtmlFallback(module: BeeFreeeModule): Block {
  // Attempt to extract any HTML content from the descriptor
  const descriptor = module.descriptor;
  let html = "";

  // Try common content fields
  if (descriptor.text?.html) html = descriptor.text.html;
  else if (descriptor.html?.html) html = descriptor.html.html;
  else if (descriptor.heading?.text) html = descriptor.heading.text;
  else html = `<!-- Unsupported BeeFree module: ${module.type} -->`;

  return createHtmlBlock({
    content: importedHtml(html),
    styles: makeStyles(descriptor),
  });
}

/**
 * Converts a single BeeFree module to a Templatical block.
 * Returns the block and a report entry.
 */
function convertModuleBase(
  module: BeeFreeeModule,
  warnings: string[],
  context: ModuleContext = {},
): { block: Block; entry: ImportReportEntry } {
  const mappedType = moduleKind(module);
  const descriptor = module.descriptor;
  const textColor = context.textColor ?? FALLBACK_TEXT_COLOR;

  if (!mappedType) {
    return {
      block: convertHtmlFallback(module),
      entry: {
        beeFreeModuleType: module.type,
        templaticalBlockType: "html",
        status: "html-fallback",
        note:
          module.type === ADDON_MODULE
            ? "The addon carries no content Templatical reads; converted to an HTML block."
            : `Unknown module type "${module.type}" converted to HTML block.`,
      },
    };
  }

  let block: Block;
  let extras: Block[] = [];
  let isApproximation = false;
  let notes: string[] = [];

  switch (mappedType) {
    case "paragraph": {
      block = convertText(descriptor, textColor, notes);
      // Blankness is the converted content only. A missing `paragraph.html`
      // is not blank when the text arrived on another payload.
      if (
        module.type === PARAGRAPH_MODULE &&
        block.type === "paragraph" &&
        context.blankParagraphAsSpacer !== false &&
        isBlankRichText(block.content)
      ) {
        const {
          height,
          unread,
          lineBoxOverflows,
          paddingUnread,
          heightOverflows,
        } = blankParagraphHeight(descriptor);
        const boxLost = paragraphHtmlPaintsBox(block.content);
        const typographyLost = paragraphHasUnreadTypography(
          descriptor.paragraph?.html,
        );
        block = blankParagraphSpacer(descriptor, height);
        const clauses: string[] = [];
        if (boxLost) clauses.push("its box styling is not carried");
        if (typographyLost) {
          clauses.push("its paragraph typography is not read");
        }
        if (paddingUnread) clauses.push("its padding is not read");
        if (lineBoxOverflows) {
          clauses.push("its line box overflows, 1.2 × 14px is used");
        }
        if (heightOverflows) {
          clauses.push("its height overflows, 17px is used");
        }
        clauses.push(...unread);
        const suffix = clauses.length > 0 ? `; ${clauses.join("; ")}` : "";
        notes = [`Blank paragraph imported as a ${height}px spacer${suffix}.`];
        isApproximation = clauses.length > 0;
      } else {
        isApproximation = notes.length > 0;
      }
      break;
    }
    case "list":
      block = convertText(descriptor, textColor, notes);
      isApproximation = notes.length > 0;
      break;
    case "title": {
      const result = convertHeading(descriptor, textColor);
      block = result.block;
      if (result.note) {
        notes = [result.note];
        isApproximation = true;
      }
      break;
    }
    case "image": {
      const result = convertImage(descriptor, context.columnWidth);
      block = result.block;
      notes = result.notes;
      isApproximation = notes.length > 0;
      break;
    }
    case "button": {
      const result = convertButton(descriptor);
      block = result.block;
      notes = result.notes;
      isApproximation = notes.length > 0;
      break;
    }
    case "divider": {
      const height = undrawnDividerHeight(descriptor);
      if (height !== undefined) {
        block = convertUndrawnDivider(descriptor, height);
        notes = [
          `The divider draws no line; imported as a ${height}px spacer.`,
        ];
        break;
      }
      const result = convertDivider(descriptor, context.columnWidth);
      block = result.block;
      notes = result.notes;
      isApproximation = notes.length > 0;
      break;
    }
    case "spacer":
      block = convertSpacer(descriptor);
      break;
    case "icons": {
      const result = convertIcons(descriptor, context.columnWidth, warnings);
      if (result.rebuilt) {
        return {
          block: result.block,
          entry: {
            beeFreeModuleType: module.type,
            templaticalBlockType: "html",
            status: "html-fallback",
            note: "Icons module rebuilt as an HTML table.",
          },
        };
      }
      block = result.block;
      break;
    }
    case "html":
      block = convertHtml(descriptor, module.type, context.bodyFontFamily);
      break;
    case "social": {
      const result = convertSocial(descriptor, warnings);
      block = result.block;
      extras = result.extras;
      notes = result.notes;
      isApproximation = notes.length > 0;
      break;
    }
    case "video": {
      const result = convertVideo(descriptor, context.columnWidth, warnings);
      block = result.block;
      notes = result.notes;
      isApproximation = notes.length > 0;
      break;
    }
    case "menu": {
      const result = convertMenu(descriptor, textColor);
      block = result.block;
      notes = result.notes;
      // Item padding, the hamburger and link titles have no menu field.
      isApproximation = true;
      break;
    }
    case "table": {
      const result = convertTable(descriptor, textColor);
      block = result.block;
      notes = result.notes;
      isApproximation = notes.length > 0;
      if (result.cellHtmlStripped) {
        isApproximation = true;
        warnings.push(
          "HTML inside one or more table cells was reduced to plain text; any cell formatting or links were dropped.",
        );
      }
      break;
    }
    default:
      block = convertHtmlFallback(module);
      return {
        block,
        entry: {
          beeFreeModuleType: module.type,
          templaticalBlockType: "html",
          status: "html-fallback",
        },
      };
  }

  return {
    block,
    ...(extras.length > 0 ? { extras } : {}),
    entry: {
      beeFreeModuleType: module.type,
      templaticalBlockType: block.type,
      status: isApproximation ? "approximated" : "converted",
      ...(notes.length > 0 ? { note: notes.join(" ") } : {}),
    },
  };
}

/**
 * The report entry for a module that imports no block, or `undefined` when it
 * converts: an empty module, an Icons module with no icons, and a divider that
 * draws no line and takes no space.
 */
export function skippedModuleEntry(
  module: BeeFreeeModule,
): ImportReportEntry | undefined {
  const skip = (note: string): ImportReportEntry => ({
    beeFreeModuleType: module.type,
    templaticalBlockType: null,
    status: "skipped",
    note,
  });
  if (module.type === EMPTY_MODULE) return skip("The module is empty.");
  switch (moduleKind(module)) {
    case "icons":
      return iconItems(module.descriptor).length === 0
        ? skip("The Icons module has no icons.")
        : undefined;
    case "divider":
      return undrawnDividerHeight(module.descriptor) === 0
        ? skip("The divider draws no line and takes no space.")
        : undefined;
    case "spacer":
      return spacerHeight(module.descriptor) === 0
        ? skip("The spacer is 0px tall.")
        : undefined;
    default:
      return undefined;
  }
}

export function convertModule(
  module: BeeFreeeModule,
  warnings: string[],
  context: ModuleContext = {},
): { block: Block; extras?: Block[]; entry: ImportReportEntry } {
  const result = convertModuleBase(module, warnings, context);
  const { block } = result;
  const descriptor = module.descriptor;
  const payloads = [
    ["heading", descriptor.heading],
    ["text", descriptor.text],
    ["paragraph", descriptor.paragraph],
    ["list", descriptor.list],
    ["button", descriptor.button],
    ["image", descriptor.image],
    ["video", descriptor.video],
    ["menuItemsList", descriptor.menuItemsList],
  ] as const;
  const active = payloads.find(([, payload]) => payload !== undefined);
  const sources = [
    module.translations,
    ...payloads.map(([, payload]) => payload?.translations),
  ];
  const droppedSpacerLocales: string[] = [];
  for (const translations of sources) {
    for (const [code, values] of Object.entries(translations ?? {})) {
      const locale = localeTag(code, warnings);
      if (!locale) continue;
      if (result.entry.status === "html-fallback" || block.type === "html") {
        warn(
          warnings,
          `Dropped language "${locale}" on module "${module.type}": target converted to HTML fallback.`,
        );
        continue;
      }
      if (module.type === PARAGRAPH_MODULE && block.type === "spacer") {
        warn(
          warnings,
          `Dropped language "${locale}" on module "${module.type}": the default paragraph is blank and imported as a spacer.`,
        );
        if (!droppedSpacerLocales.includes(locale)) {
          droppedSpacerLocales.push(locale);
        }
        continue;
      }
      const key = active?.[0];
      const field =
        block.type === "title"
          ? "text"
          : block.type === "paragraph"
            ? "html"
            : block.type === "button"
              ? "label"
              : block.type === "image"
                ? "alt"
                : block.type === "video"
                  ? "thumbAlt"
                  : block.type === "menu"
                    ? "items"
                    : undefined;
      for (const unknown of Object.keys(values).filter(
        (name) => name !== field,
      )) {
        warn(
          warnings,
          `Dropped language "${locale}" key "${unknown}": no language mapping for this format.`,
        );
      }
      if (!field || values[field] === undefined) continue;
      if (block.type === "menu" && Array.isArray(values.items)) {
        if (values.items.length !== block.items.length) {
          warn(
            warnings,
            `Dropped language "${locale}" menu translation: item count differs from the source.`,
          );
          continue;
        }
        values.items.forEach((item: { text?: unknown }, index: number) => {
          for (const key of Object.keys(item ?? {}).filter(
            (key) => key !== "text",
          )) {
            warn(
              warnings,
              `Dropped language "${locale}" key "${key}": no language mapping for this format.`,
            );
          }
          if (typeof item?.text === "string")
            text(
              block,
              locale,
              `items.${block.items[index].id}.text`,
              block.items[index].text,
              decodeEntitiesInTokens(item.text),
            );
        });
      } else if (key && typeof values[field] === "string") {
        const translated = convertModuleBase(
          {
            ...module,
            descriptor: {
              ...descriptor,
              [key]: { ...descriptor[key], [field]: values[field] },
            },
          },
          [],
          { ...context, blankParagraphAsSpacer: false },
        ).block;
        if (
          (block.type === "title" || block.type === "paragraph") &&
          (translated.type === "title" || translated.type === "paragraph")
        )
          text(block, locale, "content", block.content, translated.content);
        if (block.type === "button" && translated.type === "button")
          text(block, locale, "text", block.text, translated.text);
        if (
          (block.type === "image" || block.type === "video") &&
          (translated.type === "image" || translated.type === "video")
        )
          text(block, locale, "alt", block.alt, translated.alt ?? "");
      }
    }
  }
  if (droppedSpacerLocales.length > 0) {
    const dropped = `Translations ${droppedSpacerLocales.join(", ")} dropped: the default paragraph is blank and imported as a spacer.`;
    result.entry.status = "approximated";
    // A blank paragraph always records a note before translations are read.
    result.entry.note = `${result.entry.note} ${dropped}`;
  }
  return result;
}
