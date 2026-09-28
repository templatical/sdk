import {
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
  SocialPlatform,
  SocialIcon,
  MenuItemData,
  TableRowData,
  TableCellData,
} from "@templatical/types";
import type {
  BeeFreeeModule,
  BeeFreeeModuleDescriptor,
  ImportReportEntry,
} from "./types";
import {
  parseImageBorderRadius,
  parsePxValue,
  parseColor,
  parseBorderTop,
  extractPadding,
  parseDividerWidth,
  parseFontFamily,
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
};

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
  const fontFamily = parseFontFamily(style["font-family"]);
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
    fontFamily: parseFontFamily(style["font-family"]) || undefined,
    styles: makeStyles(descriptor),
  });
}

function convertImage(descriptor: BeeFreeeModuleDescriptor): Block {
  const image = descriptor.image;
  if (!image) {
    return createImageBlock({ styles: makeStyles(descriptor) });
  }

  // Kept separate from the `?? 600` fallback below: a percentage radius has to
  // resolve against a width the template actually stated.
  const readWidth = parsePxValue(image.width) || undefined;
  const readHeight = parsePxValue(image.height) || undefined;

  return createImageBlock({
    src: image.src || "",
    alt: image.alt || "",
    width: readWidth ?? 600,
    // No default, unlike width: an absent height is what keeps the aspect
    // ratio, and BeeFree's "auto" parses to 0, which reads the same way.
    height: readHeight,
    borderRadius: parseImageBorderRadius(
      image.style?.["border-radius"],
      readWidth,
      readHeight,
    ),
    align: toAlign(image.style?.["text-align"], "center"),
    linkUrl: image.href || undefined,
    styles: makeStyles(descriptor),
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
    fontFamily: parseFontFamily(style["font-family"]) || undefined,
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

  for (const beeIcon of iconsList.icons) {
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

function convertVideo(descriptor: BeeFreeeModuleDescriptor): Block {
  const video = descriptor.video;
  if (!video) {
    return createVideoBlock({ styles: makeStyles(descriptor) });
  }

  return createVideoBlock({
    url: video.src || "",
    thumbnailUrl: video.thumbnail || "",
    alt: video.alt || "",
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
    fontFamily: parseFontFamily(style["font-family"]) || undefined,
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
export function convertModule(
  module: BeeFreeeModule,
  warnings: string[],
  context: ModuleContext = {},
): { block: Block; entry: ImportReportEntry } {
  const mappedType = MODULE_TYPE_MAP[module.type];
  const descriptor = module.descriptor;
  const textColor = context.textColor ?? FALLBACK_TEXT_COLOR;

  if (!mappedType) {
    return {
      block: convertHtmlFallback(module),
      entry: {
        beeFreeModuleType: module.type,
        templaticalBlockType: "html",
        status: "html-fallback",
        note: `Unknown module type "${module.type}" converted to HTML block.`,
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
      block = convertImage(descriptor);
      break;
    case "button":
      block = convertButton(descriptor);
      break;
    case "divider": {
      const result = convertDivider(descriptor, context.columnWidth);
      block = result.block;
      notes = result.notes;
      isApproximation = notes.length > 0;
      break;
    }
    case "spacer":
      block = convertSpacer(descriptor);
      break;
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
