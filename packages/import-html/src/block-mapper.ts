import type { CheerioAPI, Cheerio } from "cheerio";
import { isTag, isText } from "domhandler";
import type { Element, AnyNode } from "domhandler";
import {
  createTitleBlock,
  createParagraphBlock,
  createImageBlock,
  createButtonBlock,
  createDividerBlock,
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
  parseImageBorderRadius,
  parsePxValue,
  parseStyleAttribute,
  readPaddingFromStyles,
} from "./style-parser";

const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
const TEXT_TAGS = new Set(["p", "span", "div"]);

/**
 * Wrapper tags that carry layout rather than content. One of these is worth
 * descending into when it holds a table somewhere below it.
 */
const CONTAINER_TAGS = new Set(["div", "center", "main"]);

/**
 * Decides whether an element is a layout container worth descending into: a
 * wrapper tag that holds a table somewhere below it.
 *
 * The table test is what keeps the descent from widening into "descend every
 * div". `div` is in `TEXT_TAGS` above, so a container holding only copy must
 * keep that mapping and become one paragraph rather than being split into a
 * block per child.
 *
 * Lives here, with the other predicates both traversal modules consult,
 * because the body walk and the cell walk have to agree on what a container
 * is. A second copy answers the question differently the moment either is
 * edited, and the divergence shows up as a table swallowed into a paragraph
 * on whichever surface was missed.
 */
export function isTableContainer($el: Cheerio<Element>, tag: string): boolean {
  return CONTAINER_TAGS.has(tag) && $el.find("table").length > 0;
}

/**
 * Block-level elements a container may be unwrapped down to. Only a heading:
 * a container wrapping one is the single case where mapping the container
 * gets the block's *type* wrong.
 *
 * A tag qualifies only if unwrapping it loses nothing, and `p` is the one that
 * looks like it belongs and does not. `convertParagraph` reads an element's
 * inner HTML, so unwrapping `<div><p class="lead">…</p></div>` drops the `<p>`
 * and every attribute on it, where mapping the container keeps that markup
 * inside the paragraph's content. Nothing is bought in exchange: a wrapped
 * `<p>` already maps to a paragraph, which is the right type. A heading has no
 * such cost, because `convertHeading` stores the level and the inner HTML —
 * so unwrapping routes it to the same converter a bare `<h3>` already reaches.
 *
 * `img`, `hr` and `table` stay out for the same "nothing to fix" reason: a
 * table belongs to the container descent the two traversals run, and the other
 * two would widen a heading-typing rule into image and divider mapping.
 *
 * The set is also what keeps the styling below correct — `convertHeading` is
 * the only converter reached with a container's styles, so admitting a tag it
 * does not handle would silently drop them.
 */
const UNWRAPPABLE_BLOCK_TAGS: ReadonlySet<string> = HEADING_TAGS;

/**
 * Inline formatting tags, which carry no block of their own. One of these
 * reaching a block position means the parent's text extraction stopped short —
 * it does not mean the element has no mapping, so it must never fall through
 * to the html-fallback arm.
 *
 * The hazard that keeps them listed here: a cell's inline markup and the bare
 * text nodes around it are one run of rich text. Dispatching an inline element
 * on its own emits a block whose entire content is `<br>` AND deletes every
 * text node beside it, because a walk over element children never visits
 * those. That is silent content loss — text visible in the source email never
 * reaches the template.
 *
 * `a` is excluded on purpose: whether an anchor belongs to a run depends on
 * how the source styled it, so the cell walk asks `isProseAnchor` per anchor
 * instead. Reading every `<a>` as inline here would fold a styled call to
 * action into the sentence beside it and lose the button.
 */
const INLINE_FORMATTING_TAGS = new Set([
  "br",
  "em",
  "strong",
  "i",
  "b",
  "u",
  "small",
  "sub",
  "sup",
]);

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
 * Whether an element carries anything a reader would see: text, or an element
 * that renders without text of its own.
 *
 * One rule with two readers, which is the point: it decides both whether a
 * text container is worth a block at all and whether a wrapper is worth
 * unwrapping. Two copies would let `<div><h3></h3></div>` be skipped by one
 * and turned into an empty title by the other.
 */
function hasRenderedContent($el: Cheerio<Element>): boolean {
  if (($el.text() ?? "").trim() !== "") return true;
  return $el.find("img, a").length > 0;
}

/**
 * The single element a container's whole content consists of, or `null` when
 * the container holds anything else.
 *
 * Whitespace and comments are incidental — the same reading `extractContentBlocks`
 * gives them — and `trim` counts `&nbsp;` among them, which is how the rest of
 * this module reads it (`normalizeCellText`, and through it `isBlankCell`).
 * Everything else is content: a second element, a bare word, or a rendering
 * `<br>` all mean the container holds more than one thing, and unwrapping it
 * would drop whatever was not unwrapped.
 */
function soleElementChild($el: Cheerio<Element>): Element | null {
  let found: Element | null = null;

  for (const node of $el.contents().toArray()) {
    if (isText(node)) {
      if (node.data.trim() !== "") return null;
      continue;
    }
    if (!isTag(node)) continue;
    if (found) return null;
    found = node;
  }

  return found;
}

/**
 * The styles the innermost element of a wrapper chain renders with: each
 * container's own declarations, overridden by those of the element inside it.
 *
 * The container's styles have to travel, because the wrapper is where
 * table-based email puts the colour, size, font and alignment — a plain
 * `getStyles` on the unwrapped element trades a typing defect for a styling
 * loss.
 *
 * A declaration of `inherit` states nothing of its own, so it must not shadow
 * the container's value. That is load-bearing rather than pedantic: mjml@5
 * puts every visual property on the wrapper div and writes `color: inherit` on
 * the heading inside it, so honouring the keyword literally drops the colour
 * the email actually renders with.
 */
function inheritedStyles(chain: Cheerio<Element>[]): Record<string, string> {
  const merged: Record<string, string> = { ...getStyles(chain[0]) };

  for (const $node of chain.slice(1)) {
    for (const [property, value] of Object.entries(getStyles($node))) {
      if (value.trim().toLowerCase() === "inherit") continue;
      merged[property] = value;
    }
  }

  return merged;
}

/**
 * The element that takes a container's place when the container's entire
 * meaningful content is one block-level element, together with the styles that
 * element renders with. Returns the element handed in when there is nothing to
 * unwrap.
 *
 * Generator-produced email wraps each text block in a plain `<div>` holding a
 * single block-level element — compiled MJML puts one `<h3>` inside an
 * `mj-text` body that rendered a heading. That `<div>` holds no table, so it
 * is correctly not a container to descend, and `div` is a text tag here:
 * mapping it emits a paragraph with the heading buried in its content, which
 * loses the heading's semantics, its own styling and any downstream treatment
 * of titles.
 *
 * Three constraints, each a hazard a relaxed version would reintroduce:
 *
 * - The chain must *end* on an `UNWRAPPABLE_BLOCK_TAGS` element. That is what
 *   keeps a `div.mj-column-per-*` out: its sole child is a `<table>`, and
 *   handing that to the dispatch below would html-fallback the whole column.
 *   It also leaves a chain of containers bottoming out in bare text alone, so
 *   `<div><div>copy</div></div>` keeps mapping as it did.
 * - A container holding a table is refused outright, through the same
 *   `isTableContainer` predicate the two traversals use. This decides the one
 *   case the tag test cannot — a sole child that *is* a heading, with the
 *   table below it — and both traversals descend such a container, so the
 *   subtree is theirs rather than this dispatch's.
 * - An empty wrapper is refused, so a container whose sole child renders
 *   nothing stays skipped rather than becoming an empty title.
 *
 * Bounded by DOM depth: each step moves to a child.
 */
function resolveWrappedBlock(
  $el: Cheerio<Element>,
  $: CheerioAPI,
): { $el: Cheerio<Element>; styles: Record<string, string> } {
  const unwrapped = { $el, styles: getStyles($el) };

  const chain: Cheerio<Element>[] = [$el];
  let $current = $el;

  for (;;) {
    const tag = tagOf($current[0]);
    if (!CONTAINER_TAGS.has(tag)) break;
    if (isTableContainer($current, tag)) break;

    const child = soleElementChild($current);
    if (!child) break;

    const childTag = tagOf(child);
    if (!CONTAINER_TAGS.has(childTag) && !UNWRAPPABLE_BLOCK_TAGS.has(childTag))
      break;

    $current = $(child) as unknown as Cheerio<Element>;
    chain.push($current);
  }

  if (chain.length === 1) return unwrapped;

  const $target = chain[chain.length - 1];
  if (!UNWRAPPABLE_BLOCK_TAGS.has(tagOf($target[0]))) return unwrapped;
  if (!hasRenderedContent($target)) return unwrapped;

  return { $el: $target, styles: inheritedStyles(chain) };
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
 *
 * `styles` is the element's own by default and the wrapper chain's when the
 * heading was unwrapped out of a container — see `resolveWrappedBlock`.
 */
function convertHeading(
  $el: Cheerio<Element>,
  styles: Record<string, string> = getStyles($el),
): Block {
  const tag = tagOf($el[0]);
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
    },
  });
}

/**
 * Apply a container-level `text-align` to every `<p>` opening tag in `html`,
 * merging into an existing `style="…"` attribute when present. Tolerant of
 * any other attributes on the `<p>` (class/id/dir/…) — the previous narrow
 * `<p style="…">` + bare-`<p>` matchers silently dropped the alignment when
 * the inner `<p>` carried a non-style attribute.
 */
function applyTextAlignToParagraphs(html: string, textAlign: string): string {
  return html.replace(/<p\b([^>]*)>/gi, (_match, attrs: string) => {
    const styleMatch = /\sstyle\s*=\s*"([^"]*)"/i.exec(attrs);
    if (styleMatch) {
      const existing = styleMatch[1].trim().replace(/;\s*$/, "");
      const merged = existing
        ? `${existing}; text-align: ${textAlign}`
        : `text-align: ${textAlign}`;
      const newAttrs =
        attrs.slice(0, styleMatch.index) +
        ` style="${merged}"` +
        attrs.slice(styleMatch.index + styleMatch[0].length);
      return `<p${newAttrs}>`;
    }
    return `<p${attrs} style="text-align: ${textAlign}">`;
  });
}

/**
 * Builds a Paragraph block from a fragment of inline markup, styled by the
 * element that supplied `styles`.
 */
function buildParagraph(
  innerHtml: string,
  styles: Record<string, string>,
): Block {
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
    result = applyTextAlignToParagraphs(result, textAlign);
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
    },
  });
}

/**
 * Paragraph or block-level text container → Paragraph block.
 */
function convertParagraph($el: Cheerio<Element>): Block {
  return buildParagraph(getInnerHtml($el), getStyles($el));
}

/**
 * Decides whether a child node of a table cell belongs to a run of inline
 * text rather than to a block of its own: a bare text node, or one of the
 * inline formatting tags.
 */
export function isInlineContent(node: AnyNode): boolean {
  if (isText(node)) return true;
  return isTag(node) && INLINE_FORMATTING_TAGS.has(node.tagName.toLowerCase());
}

/**
 * Converts a run of consecutive inline nodes lifted out of a table cell into
 * one Paragraph block, keeping their markup inside the paragraph's content.
 *
 * `$cell` supplies the styling: a bare run has no element of its own to read
 * a colour, size or alignment from, and table-based email puts all three on
 * the cell.
 *
 * Returns `null` for a run carrying no text — a cell holding nothing but
 * `&nbsp;` and `<br>` has no content, the same reading `convertElement`
 * gives an empty `<p>`.
 */
export function convertInlineRun(
  nodes: AnyNode[],
  $cell: Cheerio<Element>,
  $: CheerioAPI,
): { block: Block; entry: ImportReportEntry } | null {
  const text = nodes.map((node) => $(node).text()).join("");
  if (!text.trim()) return null;

  const html = nodes.map((node) => $.html(node)).join("");

  return {
    block: buildParagraph(html, getStyles($cell)),
    entry: {
      sourceTag: tagOf($cell[0]),
      templaticalBlockType: "paragraph",
      status: "converted",
    },
  };
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
  // Kept separate from the `?? 600` fallback: a percentage radius has to
  // resolve against a width the template actually stated.
  const readWidth =
    parsePxValue(widthAttr) || parsePxValue(widthStyle) || undefined;
  const width = readWidth ?? 600;
  // No default, unlike width: an absent height is what keeps the aspect ratio,
  // and `height="auto"` / `height: auto` parse to 0, which reads the same way.
  const height =
    parsePxValue($el.attr("height")) ||
    parsePxValue(styles.height) ||
    undefined;

  return createImageBlock({
    src,
    alt,
    width,
    height,
    borderRadius: parseImageBorderRadius(
      styles["border-radius"],
      readWidth,
      height,
    ),
    align: parseAlignment(styles["text-align"], "center"),
    styles: {
      padding: readPaddingFromStyles(styles),
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

/**
 * Decides whether an `<a>` belongs to the run of prose around it rather than
 * to a block of its own: a link the source did not style as a button, whose
 * own text is what the reader sees.
 *
 * A link inside a sentence is prose, so folding it keeps the sentence in one
 * editable block — and keeps the anchor's markup, `href` included, which the
 * per-element path drops (`convertParagraph` reads inner HTML, so the element
 * itself never reaches the block).
 *
 * Two constraints, both hazards a relaxed version would reintroduce:
 *
 * - `looksLikeButton` is the same predicate `convertElement` and
 *   `isButtonCell` use to tell a call to action from a link, so a styled
 *   anchor is never absorbed into a sentence and keeps becoming a button.
 * - The anchor must carry text. `convertInlineRun` reads a run with no text
 *   as empty and emits nothing, so an anchor whose content is an image has to
 *   keep the block it already gets; folding it would delete the image.
 */
export function isProseAnchor($el: Cheerio<Element>): boolean {
  if (looksLikeButton(getStyles($el))) return false;
  return ($el.text() ?? "").trim() !== "";
}

/**
 * Reads a button's placement from the cell that wraps it. An anchor styled as
 * a button is sized to its own content, so its `text-align` says nothing about
 * where it sits — table-based email puts that on the containing `<td>`, as
 * either a `text-align` style or the legacy `align` attribute. Only the
 * immediate parent is consulted; walking further up would start reporting the
 * alignment of the surrounding layout rather than of the button.
 */
function readButtonAlign($el: Cheerio<Element>): "left" | "center" | "right" {
  const parent = $el.parent();
  if (parent.length === 0) return "center";

  const fromStyle = parseStyleAttribute(parent.attr("style"))["text-align"];
  if (fromStyle) return parseAlignment(fromStyle, "center");

  return parseAlignment(parent.attr("align"), "center");
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
    align: readButtonAlign($el),
    buttonPadding: readPaddingFromStyles(styles),
    styles: {
      padding: emptyPadding(),
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
    },
  });
}

/**
 * Decides whether a `<td>` / `<th>` carries nothing a reader would see: no
 * text once source whitespace and `&nbsp;` are collapsed, and no element that
 * renders on its own.
 *
 * Text alone is not the test. An image or a link carries no text and is
 * content all the same, so a cell holding one is never blank — reading it as
 * blank would make a picture-only column disappear.
 *
 * Lives here, with the other predicates both traversal modules consult,
 * because a spacer cell and a row's gutter cells are one fact read for two
 * purposes: `isSpacerCell` adds a stated height to it, and the section
 * builder reads a row's blank cells as chrome rather than as columns. A
 * second copy would let one cell be a spacer in one traversal and a column
 * in the other.
 */
export function isBlankCell($el: Cheerio<Element>): boolean {
  if (normalizeCellText($el.text() ?? "") !== "") return false;
  return $el.find("img, a, hr").length === 0;
}

/**
 * Decides whether a `<td>` looks like a vertical spacer: blank, and carrying
 * an explicit height.
 */
export function isSpacerCell($el: Cheerio<Element>): boolean {
  if (!isBlankCell($el)) return false;

  const styles = getStyles($el);
  const hasHeight =
    parsePxValue($el.attr("height")) > 0 ||
    parsePxValue(styles.height) > 0 ||
    parsePxValue(styles["line-height"]) > 0;
  return hasHeight;
}

/**
 * Collapses every run of whitespace — `&nbsp;` included — to one space and
 * trims. Source indentation and nested tags introduce whitespace that never
 * renders, so a text comparison has to normalise both sides.
 */
function normalizeCellText(value: string): string {
  return value.replace(/[\s\u00a0]+/g, " ").trim();
}

/**
 * Whether the anchor *is* the cell rather than sitting inside its content.
 *
 * The hazard this guards: `buildCellButton` labels the button with the
 * anchor's text and drops every other node in the cell, so classifying a
 * sentence that merely contains a link as a button deletes the sentence. The
 * constraint is that a cell only reads as a button when the link is its
 * entire content — and `find("a")` matches at any depth, so an outer callout
 * cell wrapping a real CTA reaches the same test.
 */
function isWholeCellAnchor(
  $el: Cheerio<Element>,
  $anchor: Cheerio<Element>,
): boolean {
  return (
    normalizeCellText($el.text() ?? "") ===
    normalizeCellText($anchor.text() ?? "")
  );
}

/**
 * Decides whether a `<td>` is a button container — i.e. its entire content is
 * one `<a>`, styled as a button either on the anchor or on the cell.
 *
 * Both arms require the anchor to be the cell's whole content. The anchor's
 * own styling is the stronger signal that a link is *a button*, but it says
 * nothing about whether the link is *the cell*, and `find("a")` matches at
 * any depth — so a callout cell holding a paragraph plus a self-styled CTA
 * satisfies the anchor arm exactly as it does the cell arm.
 */
export function isButtonCell(
  $el: Cheerio<Element>,
  $: CheerioAPI,
): { match: boolean; anchor?: Cheerio<Element> } {
  const anchors = $el.find("a");
  if (anchors.length !== 1) return { match: false };
  const anchor = $(anchors[0]);
  if (!isWholeCellAnchor($el, anchor)) return { match: false };

  if (looksLikeButton(getStyles(anchor))) return { match: true, anchor };
  // Cell-level styling (bg, padding) wrapping a plain anchor reads as a
  // button only when the anchor actually has an href. Without one, the
  // anchor is a decorative styled span and should fall through to the
  // text-conversion path; otherwise convertButton defaults href to "#"
  // and the import becomes a clickable button to nowhere.
  if (looksLikeButton(getStyles($el))) {
    const href = (anchor.attr("href") ?? "").trim();
    if (href !== "") {
      return { match: true, anchor };
    }
  }
  return { match: false };
}

/**
 * Converts a single content-bearing element (heading / paragraph / image /
 * anchor-as-button / divider) to a Templatical block.
 *
 * A container whose entire meaningful content is one block-level element is
 * unwrapped first, so the element inside is what gets mapped and named in the
 * report — see `resolveWrappedBlock`. Only a heading can come back from that,
 * which is why the heading branch is the only one taking the resolved styles:
 * for every other branch the resolved element is the one handed in, so its own
 * styles are what `styles` already holds.
 *
 * Returns `null` for elements that do not contain any meaningful content
 * (the caller should skip them).
 */
export function convertElement(
  $el: Cheerio<Element>,
  $: CheerioAPI,
): { block: Block; entry: ImportReportEntry } | null {
  const { $el: $target, styles } = resolveWrappedBlock($el, $);
  const tag = tagOf($target[0]);
  if (!tag) return null;

  if (HEADING_TAGS.has(tag)) {
    return {
      block: convertHeading($target, styles),
      entry: {
        sourceTag: tag,
        templaticalBlockType: "title",
        status: "converted",
      },
    };
  }

  if (tag === "img") {
    return {
      block: convertImage($target),
      entry: {
        sourceTag: tag,
        templaticalBlockType: "image",
        status: "converted",
      },
    };
  }

  if (tag === "a") {
    if (looksLikeButton(styles)) {
      return {
        block: convertButton($target),
        entry: {
          sourceTag: tag,
          templaticalBlockType: "button",
          status: "converted",
        },
      };
    }
    // Plain anchor — wrap as paragraph.
    return {
      block: convertParagraph($target),
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
      block: convertDivider($target),
      entry: {
        sourceTag: tag,
        templaticalBlockType: "divider",
        status: "converted",
      },
    };
  }

  if (TEXT_TAGS.has(tag)) {
    if (!hasRenderedContent($target)) return null;
    return {
      block: convertParagraph($target),
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
      $target,
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
