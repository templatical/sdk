import { localeTag, text, warn } from "./localization";
import {
  canonicalFontStack,
  isSafeHtmlUrl,
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
  DividerBlock,
  HeadingLevel,
  ImageBlock,
  SocialPlatform,
  SocialIcon,
  MenuItemData,
  SpacingValue,
  TableRowData,
  TableCellData,
} from "@templatical/types";
import type {
  BeeFreeeIconItem,
  BeeFreeeModule,
  BeeFreeeModuleDescriptor,
  BeeFreeeSocialIcon,
  ImportReportEntry,
} from "./types";
import {
  parseImageBorderRadius,
  parsePxValue,
  parseColor,
  parseBorderTop,
  extractPadding,
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
  ["menu", "menu"],
  ["iconsList", "icons"],
] as const;

/** The converter a module goes to, or `undefined` when there is none. */
function moduleKind(module: BeeFreeeModule): string | undefined {
  if (module.type !== ADDON_MODULE) return MODULE_TYPE_MAP[module.type];
  return ADDON_PAYLOADS.find(
    ([key]) => module.descriptor[key] !== undefined,
  )?.[1];
}

const SOCIAL_PLATFORM_MAP: Record<string, SocialPlatform> = {
  facebook: "facebook",
  twitter: "twitter",
  x: "twitter",
  instagram: "instagram",
  linkedin: "linkedin",
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

function makeStyles(descriptor: BeeFreeeModuleDescriptor): Block["styles"] {
  const padding = extractPadding(descriptor.style);
  const bg = parseColor(descriptor.style?.["background-color"]);
  return {
    padding,
    ...(bg ? { backgroundColor: bg } : {}),
  };
}

/**
 * Apply BeeFree text styles as TipTap-compatible inline markup.
 * - text-align → added to each <p> tag's style attribute
 * - color, font-size, font-weight, font-family → wrapped in <span style="..."> inside each <p>
 */
function inlineStylesToHtml(
  html: string,
  style: Record<string, string | undefined>,
  textColor: string,
): string {
  const spanParts: string[] = [];
  const fontSize = parsePxValue(style["font-size"]);
  if (fontSize && fontSize !== 16) spanParts.push(`font-size: ${fontSize}px`);
  const color = parseColor(style.color);
  // A paragraph inherits the template's text color, so only a different
  // color needs a span to survive.
  if (color && color !== textColor) spanParts.push(`color: ${color}`);
  const fontWeight = style["font-weight"];
  // "400" is the numeric synonym for "normal" — neither needs an explicit
  // span (matches the import-unlayer importer).
  if (fontWeight && fontWeight !== "normal" && fontWeight !== "400")
    spanParts.push(`font-weight: ${fontWeight}`);
  const fontFamily = canonicalFontStack(style["font-family"]);
  if (fontFamily) spanParts.push(`font-family: ${fontFamily}`);

  const textAlign = style["text-align"];
  const pStyle =
    textAlign && textAlign !== "left" ? `text-align: ${textAlign}` : "";

  if (!pStyle && spanParts.length === 0) return html;

  const spanStyle = spanParts.join("; ");

  // Apply styles to each <p> tag in the HTML
  let result = html;

  if (pStyle) {
    // Add text-align to existing <p style="..."> or add style to plain <p>
    result = result
      .replace(/<p style="([^"]*)">/g, `<p style="$1; ${pStyle}">`)
      .replaceAll("<p>", `<p style="${pStyle}">`);
  }

  if (spanStyle) {
    // Wrap inner content of each <p> in a styled span.
    result = wrapParagraphInner(result, spanStyle);
  }

  return result;
}

/**
 * Wrap the inner content of every `<p …>…</p>` with `<span style="…">…</span>`.
 *
 * Hand-rolled linear scanner instead of `/<p([^>]*)>([\s\S]*?)<\/p>/g` because
 * the regex is polynomial-ReDoS: the engine retries `[\s\S]*?<\/p>` at every
 * `<p` start, so inputs like `<p>a<p>a<p>a…` (no `</p>` ever) cost O(n²).
 * The scanner advances `i` monotonically via `indexOf`, keeping the work
 * strictly O(n).
 */
function wrapParagraphInner(html: string, spanStyle: string): string {
  let out = "";
  let i = 0;
  while (i < html.length) {
    const open = html.indexOf("<p", i);
    if (open === -1) {
      out += html.substring(i);
      break;
    }
    const afterTagName = html[open + 2];
    if (
      afterTagName !== ">" &&
      afterTagName !== " " &&
      afterTagName !== "\t" &&
      afterTagName !== "\n" &&
      afterTagName !== "\r" &&
      afterTagName !== "/"
    ) {
      out += html.substring(i, open + 2);
      i = open + 2;
      continue;
    }
    const openEnd = html.indexOf(">", open + 2);
    if (openEnd === -1) {
      out += html.substring(i);
      break;
    }
    const closeStart = html.indexOf("</p>", openEnd + 1);
    if (closeStart === -1) {
      out += html.substring(i);
      break;
    }
    const inner = html.substring(openEnd + 1, closeStart);
    out += html.substring(i, openEnd + 1);
    out += `<span style="${spanStyle}">${inner}</span></p>`;
    i = closeStart + 4;
  }
  return out;
}

function convertText(
  descriptor: BeeFreeeModuleDescriptor,
  textColor: string,
): Block {
  const textContent =
    descriptor.text ?? descriptor.paragraph ?? descriptor.list;
  const html = textContent?.html ?? "";
  const style = textContent?.style ?? {};

  return createParagraphBlock({
    content: inlineStylesToHtml(html, style, textColor),
    styles: makeStyles(descriptor),
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

function convertHeading(
  descriptor: BeeFreeeModuleDescriptor,
  textColor: string,
): Block {
  const heading = descriptor.heading;
  if (!heading) return convertText(descriptor, textColor);

  const style = heading.style ?? {};
  const tag = heading.title ?? "h2";
  const text = heading.text ?? "";
  // Strip heading tags — content goes inside TipTap, heading tag is rendered by the block
  const content = text.startsWith("<")
    ? text.replace(/^<h\d[^>]*>|<\/h\d>$/gi, "")
    : text;

  return createTitleBlock({
    content: content ? `<p>${content}</p>` : "<p></p>",
    level: parseHeadingLevel(tag),
    color: parseColor(style.color) || undefined,
    textAlign: toAlign(style["text-align"]),
    fontFamily: canonicalFontStack(style["font-family"]) || undefined,
    styles: makeStyles(descriptor),
  });
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
 * Older exports class an image that fills its column `fullwidth`, and its
 * computed width leaves out the column padding the import drops, so the class
 * decides.
 */
function resolveImageWidth(
  descriptor: BeeFreeeModuleDescriptor,
  room: number | undefined,
): ImageBlock["width"] {
  if (computedClasses(descriptor).includes("fullwidth")) return "full";
  const shown =
    computedPx(descriptor.computedStyle?.width) ||
    parsePxValue(descriptor.image?.width);
  return shownWidth(shown, room);
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
): Block {
  const image = descriptor.image;
  const styles = makeStyles(descriptor);
  if (!image) {
    return createImageBlock({ styles });
  }

  const room =
    columnWidth === undefined
      ? undefined
      : columnWidth - styles.padding.left - styles.padding.right;
  const width = resolveImageWidth(descriptor, room);

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

  return createImageBlock({
    src: image.src || "",
    alt: image.alt || "",
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
    linkUrl: image.href || undefined,
    styles,
  });
}

function convertButton(descriptor: BeeFreeeModuleDescriptor): Block {
  const button = descriptor.button;
  if (!button) {
    return createButtonBlock({ styles: makeStyles(descriptor) });
  }

  const style = button.style ?? {};
  const label = button.label ? stripTagsPlain(button.label) : "Button";

  return createButtonBlock({
    text: label,
    url: button.href || "#",
    backgroundColor: parseColor(style["background-color"]) || "#4f46e5",
    textColor: parseColor(style.color) || "#ffffff",
    borderRadius: parsePxValue(style["border-radius"]),
    fontSize: parsePxValue(style["font-size"]) || 16,
    fontFamily: canonicalFontStack(style["font-family"]) || undefined,
    align: toAlign(style["text-align"], "center"),
    buttonPadding: {
      top: parsePxValue(style["padding-top"]) || 12,
      right: parsePxValue(style["padding-right"]) || 24,
      bottom: parsePxValue(style["padding-bottom"]) || 12,
      left: parsePxValue(style["padding-left"]) || 24,
    },
    styles: makeStyles(descriptor),
  });
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
  const contentWidth =
    columnWidth === undefined
      ? undefined
      : columnWidth - styles.padding.left - styles.padding.right;
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

function convertSpacer(descriptor: BeeFreeeModuleDescriptor): Block {
  const spacer = descriptor.spacer;
  const height = parsePxValue(spacer?.style?.height) || 24;

  return createSpacerBlock({
    height,
    styles: makeStyles(descriptor),
  });
}

function convertHtml(descriptor: BeeFreeeModuleDescriptor): Block {
  const html = descriptor.html?.html ?? "";

  return createHtmlBlock({
    content: html,
    styles: makeStyles(descriptor),
  });
}

function convertSocial(
  descriptor: BeeFreeeModuleDescriptor,
  warnings: string[],
): Block {
  const iconsList = descriptor.iconsList;
  if (!iconsList?.icons) {
    return createSocialIconsBlock({ styles: makeStyles(descriptor) });
  }

  const icons: SocialIcon[] = [];

  // The Icons module keeps items of another shape under the same key.
  for (const beeIcon of iconsList.icons as BeeFreeeSocialIcon[]) {
    const id = (beeIcon.id ?? beeIcon.name ?? "").toLowerCase();
    const platform = SOCIAL_PLATFORM_MAP[id];

    if (!platform) {
      warnings.push(
        `Unrecognized social icon "${beeIcon.name || id}" was skipped.`,
      );
      continue;
    }

    icons.push({
      id: generateId(),
      platform,
      url: beeIcon.image?.href || "#",
    });
  }

  return createSocialIconsBlock({
    icons,
    styles: makeStyles(descriptor),
  });
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
  const room =
    columnWidth === undefined
      ? undefined
      : columnWidth - padding.left - padding.right;

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
  const fontWeight = style["font-weight"];
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
  const gap =
    computedPx(computed.itemsSpacing) || computedPx(computed.itemSpacing);
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
        ? `<a href="${escapeHtml(href)}"${target ? ` target="${escapeHtml(target)}"` : ""} style="${escapeHtml(linkStyle)}">${inner}</a>`
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
    const img = `<img src="${escapeHtml(src)}" alt="${escapeHtml(stringField(item.alt))}"${title ? ` title="${escapeHtml(title)}"` : ""}${width === undefined ? "" : ` width="${width}"`} height="${height}" style="${imgStyle}">`;
    const iconCell = src
      ? `<td${cellAlign} style="${iconPadding}vertical-align: middle;">${link(img, "text-decoration: none;")}</td>`
      : "";

    const text = stringField(item.text);
    const textCell = text
      ? `<td${cellAlign} style="vertical-align: middle;${textStyle ? ` ${escapeHtml(textStyle)}` : ""}">${link(
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
    return `<td style="${itemGap}vertical-align: middle;"><table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">${body}</table></td>`;
  });

  const tableAlign = align === "left" ? "" : ` align="${align}"`;
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0"${tableAlign} style="border-collapse: collapse;"><tr>${items.join("")}</tr></table>`;
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
    const safe = { ...item };
    const image = stringField(item.image);
    if (image && !isSafeHtmlUrl(image, "src")) {
      warnings.push(`Dropped the unsafe image "${image}" on an Icons item.`);
      safe.image = "";
    }
    const href = stringField(item.href);
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

function convertVideo(descriptor: BeeFreeeModuleDescriptor): Block {
  const video = descriptor.video;
  if (!video) {
    return createVideoBlock({ styles: makeStyles(descriptor) });
  }

  return createVideoBlock({
    url: video.src || "",
    thumbnailUrl: video.thumbnail || "",
    alt: video.thumbAlt ?? video.alt ?? "",
    width: parsePxValue(video.style?.width) || 600,
    height: parsePxValue(video.style?.height) || undefined,
    align: toAlign(video.style?.["text-align"], "center"),
    styles: makeStyles(descriptor),
  });
}

function convertMenu(descriptor: BeeFreeeModuleDescriptor): Block {
  const menu = descriptor.menu;
  if (!menu) {
    return createMenuBlock({ styles: makeStyles(descriptor) });
  }

  const style = menu.style ?? {};

  const items: MenuItemData[] = (menu.items ?? []).map((item) => ({
    id: generateId(),
    text: item.text || "",
    url: item.link || item.href || "#",
    openInNewTab: item.target === "_blank",
    bold: false,
    underline: false,
  }));

  return createMenuBlock({
    items,
    separator: menu.separator || "|",
    separatorColor: parseColor(menu.separatorColor) || "#999999",
    fontSize: parsePxValue(style["font-size"]) || 14,
    color: parseColor(style.color) || undefined,
    fontFamily: canonicalFontStack(style["font-family"]) || undefined,
    textAlign: toAlign(style["text-align"], "center"),
    styles: makeStyles(descriptor),
  });
}

function convertTable(descriptor: BeeFreeeModuleDescriptor): {
  block: Block;
  approximated: boolean;
} {
  const table = descriptor.table;
  if (!table) {
    return {
      block: createTableBlock({ styles: makeStyles(descriptor) }),
      approximated: false,
    };
  }

  const style = table.style ?? {};

  // Templatical table cells are a plain-text field (the editor stores the
  // cell's innerText), so strip any HTML a BeeFree cell carried the same way
  // button labels are stripped. If a strip actually removed markup, the cell
  // lost formatting or a link URL, so the conversion is an approximation.
  let approximated = false;
  const rows: TableRowData[] = (table.rows ?? []).map((row) => ({
    id: generateId(),
    cells: (row.cells ?? []).map((cell): TableCellData => {
      const raw = cell.content ?? cell.html ?? "";
      const content = stripTagsPlain(raw);
      if (content !== raw) {
        approximated = true;
      }
      return { id: generateId(), content };
    }),
  }));

  return {
    block: createTableBlock({
      rows,
      hasHeaderRow: table.hasHeaderRow ?? false,
      headerBackgroundColor:
        parseColor(table.headerBackgroundColor) || undefined,
      borderColor: parseColor(style["border-color"]) || "#dddddd",
      borderWidth: parsePxValue(style["border-width"]) || 1,
      cellPadding:
        typeof table.cellPadding === "number"
          ? table.cellPadding
          : parsePxValue(table.cellPadding as string) || 8,
      fontSize: parsePxValue(style["font-size"]) || 14,
      color: parseColor(style.color) || undefined,
      textAlign: toAlign(style["text-align"]),
      styles: makeStyles(descriptor),
    }),
    approximated,
  };
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
    content: html,
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
  let isApproximation = false;
  let notes: string[] = [];

  switch (mappedType) {
    case "paragraph":
    case "list":
      block = convertText(descriptor, textColor);
      break;
    case "title":
      block = convertHeading(descriptor, textColor);
      break;
    case "image":
      block = convertImage(descriptor, context.columnWidth);
      break;
    case "button":
      block = convertButton(descriptor);
      break;
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
      block = convertHtml(descriptor);
      break;
    case "social":
      block = convertSocial(descriptor, warnings);
      break;
    case "video":
      block = convertVideo(descriptor);
      break;
    case "menu":
      block = convertMenu(descriptor);
      isApproximation = true; // menu styles are approximate
      break;
    case "table": {
      const result = convertTable(descriptor);
      block = result.block;
      if (result.approximated) {
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
    default:
      return undefined;
  }
}

export function convertModule(
  module: BeeFreeeModule,
  warnings: string[],
  context: ModuleContext = {},
): { block: Block; entry: ImportReportEntry } {
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
    ["menu", descriptor.menu],
  ] as const;
  const active = payloads.find(([, payload]) => payload !== undefined);
  const sources = [
    module.translations,
    ...payloads.map(([, payload]) => payload?.translations),
  ];
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
              item.text,
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
          context,
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
  return result;
}
