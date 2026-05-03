import type { CheerioAPI, Cheerio } from "cheerio";
import type { Element, AnyNode } from "domhandler";
import {
  createTitleBlock,
  createParagraphBlock,
  createImageBlock,
  createButtonBlock,
  createDividerBlock,
  createSpacerBlock,
  createHtmlBlock,
} from "@templatical/types";
import type { Block, HeadingLevel, SpacingValue } from "@templatical/types";
import type { ImportReportEntry } from "./types";
import {
  parseAlignment,
  parseBorderShorthand,
  parseColor,
  parseFontFamily,
  parseFontWeight,
  parsePxValue,
  parseStyleAttribute,
  readPaddingFromStyles,
} from "./style-parser";

const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
const TEXT_TAGS = new Set(["p", "span", "div"]);

function emptyMargin(): SpacingValue {
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

function emptyPadding(): SpacingValue {
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

function tagOf(el: Element | AnyNode): string {
  if ("tagName" in el && typeof el.tagName === "string")
    return el.tagName.toLowerCase();
  return "";
}

function getStyles($el: Cheerio<Element>): Record<string, string> {
  return parseStyleAttribute($el.attr("style"));
}

/**
 * Returns the inner HTML of `$el`.
 */
export function getInnerHtml($el: Cheerio<Element>): string {
  return $el.html() ?? "";
}

function ensureParagraphWrapped(html: string): string {
  if (!html.trim()) return "<p></p>";
  if (/<(p|h[1-6]|ul|ol|blockquote)[\s>]/i.test(html)) return html;
  return `<p>${html}</p>`;
}

function safeHtmlComment(message: string, raw: string): string {
  const escapedMessage = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<!-- ${escapedMessage} -->\n${raw}`;
}

/**
 * Heading element (h1-h6) → Title block.
 */
function convertHeading($el: Cheerio<Element>): Block {
  const tag = tagOf($el[0]);
  const styles = getStyles($el);
  const levelMatch = tag.match(/^h(\d)$/);
  const rawLevel = levelMatch ? Number(levelMatch[1]) : 2;
  const level: HeadingLevel = (
    rawLevel >= 1 && rawLevel <= 4 ? rawLevel : Math.min(rawLevel, 4)
  ) as HeadingLevel;

  const innerHtml = getInnerHtml($el);
  const content = innerHtml.trim() ? `<p>${innerHtml}</p>` : "<p></p>";

  return createTitleBlock({
    content,
    level,
    color: parseColor(styles.color) || "#1a1a1a",
    textAlign: parseAlignment(styles["text-align"]),
    fontFamily: parseFontFamily(styles["font-family"]) || undefined,
    styles: {
      padding: readPaddingFromStyles(styles),
      margin: emptyMargin(),
    },
  });
}

/**
 * Paragraph or block-level text container → Paragraph block.
 */
function convertParagraph($el: Cheerio<Element>): Block {
  const styles = getStyles($el);
  const innerHtml = getInnerHtml($el);
  const wrapped = ensureParagraphWrapped(innerHtml);

  // Apply container-level styles to the wrapping <p>.
  const fontParts: string[] = [];
  const fontSize = parsePxValue(styles["font-size"]);
  if (fontSize && fontSize !== 16) fontParts.push(`font-size: ${fontSize}px`);
  const color = parseColor(styles.color);
  if (color && color !== "#1a1a1a") fontParts.push(`color: ${color}`);
  const fontWeight = parseFontWeight(styles["font-weight"]);
  if (fontWeight) fontParts.push(`font-weight: ${fontWeight}`);
  const fontFamily = parseFontFamily(styles["font-family"]);
  if (fontFamily) fontParts.push(`font-family: ${fontFamily}`);
  const textAlign = styles["text-align"];

  let result = wrapped;
  if (textAlign && textAlign !== "left") {
    result = result
      .replace(
        /<p style="([^"]*)">/g,
        `<p style="$1; text-align: ${textAlign}">`,
      )
      .replaceAll("<p>", `<p style="text-align: ${textAlign}">`);
  }
  if (fontParts.length > 0) {
    const span = fontParts.join("; ");
    result = result.replace(
      /<p([^>]*)>([\s\S]*?)<\/p>/g,
      `<p$1><span style="${span}">$2</span></p>`,
    );
  }

  return createParagraphBlock({
    content: result,
    styles: {
      padding: readPaddingFromStyles(styles),
      margin: emptyMargin(),
    },
  });
}

/**
 * <img> → Image block.
 */
function convertImage($el: Cheerio<Element>): Block {
  const styles = getStyles($el);
  const src = $el.attr("src") ?? "";
  const alt = $el.attr("alt") ?? "";
  const widthAttr = $el.attr("width");
  const widthStyle = styles.width;
  const width = parsePxValue(widthAttr) || parsePxValue(widthStyle) || 600;

  return createImageBlock({
    src,
    alt,
    width,
    align: parseAlignment(styles["text-align"], "center"),
    styles: {
      padding: readPaddingFromStyles(styles),
      margin: emptyMargin(),
    },
  });
}

/**
 * <a> styled as a button → Button block.
 *
 * Heuristic: a single `<a>` with a non-transparent background-color OR padding
 * OR border-radius OR display: inline-block / block is treated as a button.
 */
export function looksLikeButton(styles: Record<string, string>): boolean {
  if (parseColor(styles["background-color"]) || parseColor(styles.background))
    return true;
  if (
    styles.padding ||
    styles["padding-top"] ||
    styles["padding-bottom"] ||
    styles["padding-left"] ||
    styles["padding-right"]
  )
    return true;
  if (parsePxValue(styles["border-radius"])) return true;
  const display = (styles.display ?? "").toLowerCase();
  if (display === "inline-block" || display === "block") return true;
  return false;
}

function convertButton($el: Cheerio<Element>): Block {
  const styles = getStyles($el);
  const text = ($el.text() ?? "Button").trim() || "Button";
  const url = $el.attr("href") ?? "#";
  const target = $el.attr("target");

  return createButtonBlock({
    text,
    url,
    openInNewTab: target === "_blank" || undefined,
    backgroundColor:
      parseColor(styles["background-color"]) ||
      parseColor(styles.background) ||
      "#4f46e5",
    textColor: parseColor(styles.color) || "#ffffff",
    borderRadius: parsePxValue(styles["border-radius"]),
    fontSize: parsePxValue(styles["font-size"]) || 16,
    fontFamily: parseFontFamily(styles["font-family"]) || undefined,
    buttonPadding: readPaddingFromStyles(styles),
    styles: {
      padding: emptyPadding(),
      margin: emptyMargin(),
    },
  });
}

/**
 * <hr> → Divider block.
 */
function convertDivider($el: Cheerio<Element>): Block {
  const styles = getStyles($el);
  const border = parseBorderShorthand(styles["border-top"] ?? styles.border);
  const lineStyle =
    border.style === "dashed" || border.style === "dotted"
      ? border.style
      : "solid";

  return createDividerBlock({
    lineStyle: lineStyle as "solid" | "dashed" | "dotted",
    color: border.color || "#e5e7eb",
    thickness: border.width || 1,
    width: 100,
    styles: {
      padding: readPaddingFromStyles(styles),
      margin: emptyMargin(),
    },
  });
}

/**
 * Empty `<td>` with explicit height → Spacer block.
 */
function convertSpacer($el: Cheerio<Element>): Block {
  const styles = getStyles($el);
  const heightAttr = $el.attr("height");
  const height =
    parsePxValue(heightAttr) ||
    parsePxValue(styles.height) ||
    parsePxValue(styles["line-height"]) ||
    24;

  return createSpacerBlock({
    height,
    styles: {
      padding: emptyPadding(),
      margin: emptyMargin(),
    },
  });
}

/**
 * Wraps the element's outerHTML in an HTML block (the lossless fallback).
 */
export function convertHtmlFallback(
  $el: Cheerio<Element>,
  $: CheerioAPI,
  note?: string,
): Block {
  const outer = $.html($el) ?? "";
  const content = note ? safeHtmlComment(note, outer) : outer;
  const styles = getStyles($el);

  return createHtmlBlock({
    content,
    styles: {
      padding: readPaddingFromStyles(styles),
      margin: emptyMargin(),
    },
  });
}

/**
 * Decides whether a `<td>` looks like a vertical spacer:
 * empty (or only `&nbsp;`) AND has an explicit height.
 */
export function isSpacerCell($el: Cheerio<Element>): boolean {
  const text = ($el.text() ?? "").replace(/\s| /g, "");
  if (text !== "") return false;
  if ($el.find("img, a, hr").length > 0) return false;

  const styles = getStyles($el);
  const hasHeight =
    parsePxValue($el.attr("height")) > 0 ||
    parsePxValue(styles.height) > 0 ||
    parsePxValue(styles["line-height"]) > 0;
  return hasHeight;
}

/**
 * Decides whether a `<td>` is a button container — i.e. has exactly one
 * `<a>` inside that itself looks like a button.
 */
export function isButtonCell(
  $el: Cheerio<Element>,
  $: CheerioAPI,
): { match: boolean; anchor?: Cheerio<Element> } {
  const anchors = $el.find("a");
  if (anchors.length !== 1) return { match: false };
  const anchor = $(anchors[0]);
  if (looksLikeButton(getStyles(anchor))) return { match: true, anchor };
  // Cell-level styling (bg, padding) wrapping a plain anchor also reads as button.
  if (looksLikeButton(getStyles($el))) return { match: true, anchor };
  return { match: false };
}

/**
 * Converts a single content-bearing element (heading / paragraph / image /
 * anchor-as-button / divider) to a Templatical block.
 *
 * Returns `null` for elements that do not contain any meaningful content
 * (the caller should skip them).
 */
export function convertElement(
  $el: Cheerio<Element>,
  $: CheerioAPI,
): { block: Block; entry: ImportReportEntry } | null {
  const tag = tagOf($el[0]);
  if (!tag) return null;

  if (HEADING_TAGS.has(tag)) {
    return {
      block: convertHeading($el),
      entry: {
        sourceTag: tag,
        templaticalBlockType: "title",
        status: "converted",
      },
    };
  }

  if (tag === "img") {
    return {
      block: convertImage($el),
      entry: {
        sourceTag: tag,
        templaticalBlockType: "image",
        status: "converted",
      },
    };
  }

  if (tag === "a") {
    if (looksLikeButton(getStyles($el))) {
      return {
        block: convertButton($el),
        entry: {
          sourceTag: tag,
          templaticalBlockType: "button",
          status: "converted",
        },
      };
    }
    // Plain anchor — wrap as paragraph.
    return {
      block: convertParagraph($el),
      entry: {
        sourceTag: tag,
        templaticalBlockType: "paragraph",
        status: "approximated",
        note: "Inline anchor wrapped in a paragraph block.",
      },
    };
  }

  if (tag === "hr") {
    return {
      block: convertDivider($el),
      entry: {
        sourceTag: tag,
        templaticalBlockType: "divider",
        status: "converted",
      },
    };
  }

  if (TEXT_TAGS.has(tag)) {
    const text = ($el.text() ?? "").trim();
    if (!text && $el.find("img, a").length === 0) return null;
    return {
      block: convertParagraph($el),
      entry: {
        sourceTag: tag,
        templaticalBlockType: "paragraph",
        status: "converted",
      },
    };
  }

  // Unknown element — preserve as HTML.
  return {
    block: convertHtmlFallback(
      $el,
      $,
      `Unsupported element <${tag}>: preserved as raw HTML`,
    ),
    entry: {
      sourceTag: tag,
      templaticalBlockType: "html",
      status: "html-fallback",
      note: `Unknown element "${tag}" preserved as HTML block.`,
    },
  };
}

/**
 * Helpers exported for tests.
 */
export const _internal = {
  convertButton,
  convertDivider,
  convertHeading,
  convertImage,
  convertParagraph,
  convertSpacer,
  ensureParagraphWrapped,
};
