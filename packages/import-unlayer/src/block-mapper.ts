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
  HeadingLevel,
  SocialPlatform,
  SocialIcon,
  MenuItemData,
  SpacingValue,
} from "@templatical/types";
import type {
  UnlayerContent,
  UnlayerContentValues,
  ImportReportEntry,
} from "./types";
import {
  parsePxValue,
  parseColor,
  parseFontFamily,
  parsePaddingShorthand,
  parseBorderObject,
  parseWidthPercent,
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

function defaultMargin(): SpacingValue {
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

function makeStyles(values: UnlayerContentValues): Block["styles"] {
  const padding = parsePaddingShorthand(values.containerPadding);
  return {
    padding,
    margin: defaultMargin(),
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
): string {
  const spanParts: string[] = [];
  const fontSize = parsePxValue(values.fontSize);
  if (fontSize && fontSize !== 16) spanParts.push(`font-size: ${fontSize}px`);
  const color = parseColor(values.color);
  if (color && color !== "#1a1a1a") spanParts.push(`color: ${color}`);
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
    result = result.replace(
      /<p([^>]*)>([\s\S]*?)<\/p>/g,
      `<p$1><span style="${spanStyle}">$2</span></p>`,
    );
  }

  return result;
}

function ensureParagraphWrapped(html: string): string {
  if (!html) return "<p></p>";
  if (/<p[\s>]/i.test(html)) return html;
  return `<p>${html}</p>`;
}

function convertText(values: UnlayerContentValues): Block {
  const html = ensureParagraphWrapped(values.text ?? "");

  return createParagraphBlock({
    content: inlineStylesToHtml(html, values),
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
    color: parseColor(values.color) || "#1a1a1a",
    textAlign: toAlign(values.textAlign),
    fontFamily: parseFontFamily(values.fontFamily) || undefined,
    styles: makeStyles(values),
  });
}

function convertImage(values: UnlayerContentValues): Block {
  const src = values.src;
  const action = values.action?.values;

  return createImageBlock({
    src: src?.url || "",
    alt: values.altText || "",
    width: src?.width ? Math.round(src.width) : 600,
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
  const label = (values.text ?? "Button").replace(/<[^>]*>/g, "");
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
    buttonPadding: padding,
    styles: makeStyles(values),
  });
}

function convertDivider(values: UnlayerContentValues): Block {
  const border = parseBorderObject(values.border);

  return createDividerBlock({
    lineStyle: toLineStyle(border.style),
    color: border.color,
    thickness: border.width || 1,
    width: parseWidthPercent(values.width),
    styles: makeStyles(values),
  });
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
    color: parseColor(values.color) || "#1a1a1a",
    fontFamily: parseFontFamily(values.fontFamily) || undefined,
    textAlign: toAlign(values.textAlign, "center"),
    styles: makeStyles(values),
  });
}

function convertHtmlFallback(content: UnlayerContent, comment: string): Block {
  return createHtmlBlock({
    content: `<!-- ${comment} -->`,
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
): { block: Block; entry: ImportReportEntry } {
  const type = content.type;
  const values = content.values ?? ({} as UnlayerContentValues);

  switch (type) {
    case "text":
      return {
        block: convertText(values),
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
    case "divider":
      return {
        block: convertDivider(values),
        entry: {
          unlayerContentType: type,
          templaticalBlockType: "divider",
          status: "converted",
        },
      };
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
