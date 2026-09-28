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
} from "@templatical/types";
import type {
  UnlayerContent,
  UnlayerContentValues,
  ImportReportEntry,
} from "./types";
import {
  parseImageBorderRadius,
  parsePxValue,
  parseColor,
  parseFontFamily,
  parsePaddingShorthand,
  parseBorderObject,
  parseDividerWidth,
} from "./style-parser";

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
  mail: "email",
  whatsapp: "whatsapp",
  telegram: "telegram",
  discord: "discord",
  snapchat: "snapchat",
  reddit: "reddit",
  github: "github",
  dribbble: "dribbble",
  behance: "behance",
};

/** The body width when a template's `contentWidth` states no px value. */
export const DEFAULT_BODY_WIDTH = 600;

/** The template text colour when the body sets none. */
export const FALLBACK_TEXT_COLOR = "#1a1a1a";

/**
 * What the caller knows about where a content node lands.
 */
export interface ContentContext {
  /**
   * Width in px of the Templatical column the block renders in. Defaults to
   * `DEFAULT_BODY_WIDTH`.
   */
  columnWidth?: number;
  /**
   * The template's `textColor`, which every text block without a colour of
   * its own inherits. Defaults to `FALLBACK_TEXT_COLOR`.
   */
  textColor?: string;
}

type Align = "left" | "center" | "right";
type LineStyle = "solid" | "dashed" | "dotted";

function toAlign(value: string | undefined, fallback: Align = "left"): Align {
  if (value === "left" || value === "center" || value === "right") return value;
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

function toLineStyle(
  value: string | undefined,
  fallback: LineStyle = "solid",
): LineStyle {
  if (value === "solid" || value === "dashed" || value === "dotted")
    return value;
  return fallback;
}

function makeStyles(values: UnlayerContentValues): Block["styles"] {
  const padding = parsePaddingShorthand(values.containerPadding);
  return {
    padding,
  };
}

/**
 * Apply Unlayer text-level styles as TipTap-compatible inline markup.
 * Mirrors the BeeFree importer's helper but reads from Unlayer's flat
 * values shape rather than a CSS style record.
 */
function inlineStylesToHtml(
  html: string,
  values: UnlayerContentValues,
  textColor: string,
): string {
  const spanParts: string[] = [];
  const fontSize = parsePxValue(values.fontSize);
  if (fontSize && fontSize !== 16) spanParts.push(`font-size: ${fontSize}px`);
  const color = parseColor(values.color);
  if (color && color !== textColor) spanParts.push(`color: ${color}`);
  const fontWeight = values.fontWeight;
  if (
    fontWeight !== undefined &&
    fontWeight !== null &&
    String(fontWeight) !== "normal" &&
    String(fontWeight) !== "400"
  ) {
    spanParts.push(`font-weight: ${fontWeight}`);
  }
  const fontFamily = parseFontFamily(values.fontFamily);
  if (fontFamily) spanParts.push(`font-family: ${fontFamily}`);

  const textAlign = values.textAlign;
  const pStyle =
    textAlign && textAlign !== "left" ? `text-align: ${textAlign}` : "";

  if (!pStyle && spanParts.length === 0) return html;

  const spanStyle = spanParts.join("; ");
  let result = html;

  if (pStyle) {
    result = result
      .replace(/<p style="([^"]*)">/g, `<p style="$1; ${pStyle}">`)
      .replaceAll("<p>", `<p style="${pStyle}">`);
  }

  if (spanStyle) {
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

function ensureParagraphWrapped(html: string): string {
  if (!html) return "<p></p>";
  if (/<p[\s>]/i.test(html)) return html;
  return `<p>${html}</p>`;
}

function convertText(values: UnlayerContentValues, textColor: string): Block {
  const html = ensureParagraphWrapped(values.text ?? "");

  return createParagraphBlock({
    content: inlineStylesToHtml(html, values, textColor),
    styles: makeStyles(values),
  });
}

function parseHeadingLevel(tag: string | undefined): HeadingLevel {
  if (!tag) return 2;
  const match = tag.match(/^h(\d)$/i);
  if (match) {
    const num = Number(match[1]);
    if (num >= 1 && num <= 4) return num as HeadingLevel;
  }
  return 2;
}

function convertHeading(values: UnlayerContentValues): Block {
  const text = values.text ?? "";
  const stripped = text.replace(/^<h\d[^>]*>|<\/h\d>$/gi, "");
  const content = stripped ? `<p>${stripped}</p>` : "<p></p>";

  return createTitleBlock({
    content,
    level: parseHeadingLevel(values.headingType),
    color: parseColor(values.color) || undefined,
    textAlign: toAlign(values.textAlign),
    fontFamily: parseFontFamily(values.fontFamily) || undefined,
    styles: makeStyles(values),
  });
}

function convertImage(values: UnlayerContentValues): Block {
  const src = values.src;
  const action = values.action?.values;

  // Kept separate from the `?? 600` fallback below: a percentage radius has to
  // resolve against a width the template actually stated.
  const readWidth = src?.width ? Math.round(src.width) : undefined;
  const readHeight = src?.height ? Math.round(src.height) : undefined;

  return createImageBlock({
    src: src?.url || "",
    alt: values.altText || "",
    width: readWidth ?? 600,
    // No default, unlike width: an absent height keeps the aspect ratio.
    height: readHeight,
    borderRadius: parseImageBorderRadius(
      values.borderRadius,
      readWidth,
      readHeight,
    ),
    align: toAlign(values.textAlign, "center"),
    linkUrl: action?.href || undefined,
    linkOpenInNewTab: action?.target === "_blank" || undefined,
    styles: makeStyles(values),
  });
}

function convertButton(values: UnlayerContentValues): Block {
  const colors = values.buttonColors ?? {};
  const padding = values.padding
    ? parsePaddingShorthand(values.padding)
    : { top: 12, right: 24, bottom: 12, left: 24 };
  const label = stripTagsPlain(values.text ?? "Button");
  const linkValues = values.href?.values;

  return createButtonBlock({
    text: label,
    url: linkValues?.href || "#",
    openInNewTab: linkValues?.target === "_blank" || undefined,
    backgroundColor: parseColor(colors.backgroundColor) || "#4f46e5",
    textColor: parseColor(colors.color) || "#ffffff",
    borderRadius: parsePxValue(values.borderRadius),
    fontSize: parsePxValue(values.fontSize) || 16,
    fontFamily: parseFontFamily(values.fontFamily) || undefined,
    align: toAlign(values.textAlign, "center"),
    buttonPadding: padding,
    styles: makeStyles(values),
  });
}

/**
 * `"full"` when the divider spans its column: no width, `100%`, or a px width
 * that reaches `room`, the span the column leaves the line. Any other
 * percentage stays a percentage, clamped to 0–100%.
 */
function resolveDividerWidth(
  value: string | number | undefined,
  room: number,
  notes: string[],
): DividerBlock["width"] {
  const raw = String(value ?? "").trim();
  if (!raw) return "full";

  const parsed = parseDividerWidth(typeof value === "number" ? value : raw);
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
  return px >= room ? "full" : px;
}

/**
 * Unlayer places a partial divider by `textAlign`, centred by default.
 * Templatical centres every divider, so a left- or right-aligned partial one
 * comes back with a note.
 */
function convertDivider(
  values: UnlayerContentValues,
  columnWidth: number,
): { block: Block; notes: string[] } {
  const border = parseBorderObject(values.border);
  const styles = makeStyles(values);
  const notes: string[] = [];
  // `mj-divider` draws 100% across the column less the divider's own side
  // padding, so a px width that reaches that span renders as "full" does.
  const room = columnWidth - styles.padding.left - styles.padding.right;
  const width = resolveDividerWidth(values.width, room, notes);

  const align = values.textAlign;
  if (width !== "full" && (align === "left" || align === "right")) {
    notes.push(
      `Unlayer aligns this divider ${align}; Templatical centres every divider.`,
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

function convertSpacer(values: UnlayerContentValues): Block {
  const padding = parsePaddingShorthand(values.containerPadding);
  const height =
    parsePxValue((values as { height?: string | number }).height) ||
    padding.top + padding.bottom ||
    24;

  return createSpacerBlock({
    height,
    styles: makeStyles(values),
  });
}

function convertHtml(values: UnlayerContentValues): Block {
  return createHtmlBlock({
    content: values.html ?? "",
    styles: makeStyles(values),
  });
}

function convertSocial(
  values: UnlayerContentValues,
  warnings: string[],
): Block {
  const iconList = values.icons?.icons ?? [];
  const icons: SocialIcon[] = [];

  for (const unlayerIcon of iconList) {
    const id = (unlayerIcon.name ?? "").toLowerCase();
    const platform = SOCIAL_PLATFORM_MAP[id];

    if (!platform) {
      warnings.push(
        `Unrecognized social icon "${unlayerIcon.name || id}" was skipped.`,
      );
      continue;
    }

    icons.push({
      id: generateId(),
      platform,
      url: unlayerIcon.url || "#",
    });
  }

  return createSocialIconsBlock({
    icons,
    align: toAlign(values.textAlign, "center"),
    styles: makeStyles(values),
  });
}

function convertVideo(values: UnlayerContentValues): Block {
  return createVideoBlock({
    url: values.videoUrl || "",
    thumbnailUrl: values.thumbnailUrl || "",
    alt: values.altText || "",
    width: 600,
    align: toAlign(values.textAlign, "center"),
    styles: makeStyles(values),
  });
}

function convertMenu(values: UnlayerContentValues): Block {
  const menu = values.menu;
  const items: MenuItemData[] = (menu?.items ?? []).map((item) => ({
    id: generateId(),
    text: item.text || "",
    url: item.link?.values?.href || "#",
    openInNewTab: item.link?.values?.target === "_blank",
    bold: false,
    underline: false,
  }));

  return createMenuBlock({
    items,
    separator: values.separator || "|",
    separatorColor: "#999999",
    fontSize: parsePxValue(values.fontSize) || 14,
    color: parseColor(values.color) || undefined,
    fontFamily: parseFontFamily(values.fontFamily) || undefined,
    textAlign: toAlign(values.textAlign, "center"),
    styles: makeStyles(values),
  });
}

function convertHtmlFallback(content: UnlayerContent, comment: string): Block {
  const safe = comment.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return createHtmlBlock({
    content: `<div style="padding:12px;border:1px dashed #d1d5db;border-radius:6px;background:#fafafa;color:#6b7280;font-family:sans-serif;font-size:13px;">${safe}</div>`,
    styles: makeStyles(content.values),
  });
}

/**
 * Converts a single Unlayer content node to a Templatical block.
 * Returns the block and a report entry.
 */
export function convertContent(
  content: UnlayerContent,
  warnings: string[],
  context: ContentContext = {},
): { block: Block; entry: ImportReportEntry } {
  const type = content.type;
  const values = content.values ?? ({} as UnlayerContentValues);
  const columnWidth = context.columnWidth ?? DEFAULT_BODY_WIDTH;
  const textColor = context.textColor ?? FALLBACK_TEXT_COLOR;

  switch (type) {
    case "text":
      return {
        block: convertText(values, textColor),
        entry: {
          unlayerContentType: type,
          templaticalBlockType: "paragraph",
          status: "converted",
        },
      };
    case "heading":
      return {
        block: convertHeading(values),
        entry: {
          unlayerContentType: type,
          templaticalBlockType: "title",
          status: "converted",
        },
      };
    case "image":
      return {
        block: convertImage(values),
        entry: {
          unlayerContentType: type,
          templaticalBlockType: "image",
          status: "converted",
        },
      };
    case "button":
      return {
        block: convertButton(values),
        entry: {
          unlayerContentType: type,
          templaticalBlockType: "button",
          status: "converted",
        },
      };
    case "divider": {
      const { block, notes } = convertDivider(values, columnWidth);
      return {
        block,
        entry: {
          unlayerContentType: type,
          templaticalBlockType: "divider",
          status: notes.length > 0 ? "approximated" : "converted",
          ...(notes.length > 0 ? { note: notes.join(" ") } : {}),
        },
      };
    }
    case "spacer":
      return {
        block: convertSpacer(values),
        entry: {
          unlayerContentType: type,
          templaticalBlockType: "spacer",
          status: "converted",
        },
      };
    case "html":
      return {
        block: convertHtml(values),
        entry: {
          unlayerContentType: type,
          templaticalBlockType: "html",
          status: "converted",
        },
      };
    case "menu":
      return {
        block: convertMenu(values),
        entry: {
          unlayerContentType: type,
          templaticalBlockType: "menu",
          status: "approximated",
          note: "Menu styles map approximately; review spacing and separator color.",
        },
      };
    case "social":
      return {
        block: convertSocial(values, warnings),
        entry: {
          unlayerContentType: type,
          templaticalBlockType: "social",
          status: "converted",
        },
      };
    case "video":
      return {
        block: convertVideo(values),
        entry: {
          unlayerContentType: type,
          templaticalBlockType: "video",
          status: "converted",
        },
      };
    case "timer":
      return {
        block: convertHtmlFallback(
          content,
          "Unlayer timer block: rebuild manually in Templatical",
        ),
        entry: {
          unlayerContentType: type,
          templaticalBlockType: "html",
          status: "html-fallback",
          note: "Timer modules have no direct Templatical equivalent; placeholder HTML inserted.",
        },
      };
    case "form":
      return {
        block: convertHtmlFallback(
          content,
          "Unlayer form block: not supported in Templatical (most email clients block form submission)",
        ),
        entry: {
          unlayerContentType: type,
          templaticalBlockType: null,
          status: "skipped",
          note: "Unlayer forms have no Templatical equivalent and are skipped. Most email clients block form submission anyway.",
        },
      };
    default:
      return {
        block: convertHtmlFallback(
          content,
          `Unsupported Unlayer content type: ${type}`,
        ),
        entry: {
          unlayerContentType: type,
          templaticalBlockType: "html",
          status: "html-fallback",
          note: `Unknown content type "${type}" converted to HTML block.`,
        },
      };
  }
}
