import type { Cheerio, CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import {
  BUTTON_BLOCK_DEFAULTS,
  BUTTON_LINE_HEIGHT,
  createButtonBlock,
  createDividerBlock,
  createMenuBlock,
  createSocialIconsBlock,
  createSpacerBlock,
  generateId,
  roundHundredths,
} from "@templatical/types";
import type {
  Block,
  DividerBlock,
  MenuItemData,
  SocialIcon,
  SpacingValue,
} from "@templatical/types";
import { hasAnyToken, hasToken, isHidden } from "./classes";
import {
  colorFromPaint,
  parseColor,
  parsePxValue,
  parseStyleAttribute,
  readDividerWidth,
  readPadding,
  visibleLineBorder,
  type ParsedBorder,
} from "./css";
import { blocksFromHtml, pushEntry, type ConvertCtx } from "./fragment";
import { matchPlatform } from "./platform";

const ZERO: SpacingValue = { top: 0, right: 0, bottom: 0, left: 0 };

/** Tables whose padding is the section's padding. A divider must not copy it. */
const STRUCTURE_TABLES = [
  "es-header-body",
  "es-content-body",
  "es-footer-body",
  "es-header",
  "es-content",
  "es-footer",
] as const;

const MAPPED_LINE_STYLES = new Set([
  "double",
  "groove",
  "ridge",
  "inset",
  "outset",
]);

function firstAnchor($el: Cheerio<Element>): Cheerio<Element> {
  const $self = $el.is("a") ? $el : $el.find("a").first();
  return $self as Cheerio<Element>;
}

/**
 * A button's line height as `ButtonBlock.lineHeight`, a multiple of
 * `fontSize`. A percentage is that number over 100, a unitless number is
 * itself, a px length is that many pixels over `fontSize`, and an `em`
 * length is the number itself. A leading dot (`.5`) is read. Rounded to two
 * decimals. A missing value, `normal`, and a value that rounds to 1.2 stay
 * unset, so the label keeps `BUTTON_LINE_HEIGHT`. Any other value that
 * cannot be kept stays unset and pushes a note.
 */
function readButtonLineHeight(
  value: unknown,
  fontSize: number,
  notes: string[],
): number | undefined {
  const trimmed = String(value ?? "").trim();
  if (trimmed === "" || /^normal$/i.test(trimmed)) return undefined;

  const percent = /^((?:\d+(?:\.\d+)?|\.\d+))\s*%$/.exec(trimmed);
  const unitless = /^((?:\d+(?:\.\d+)?|\.\d+))$/.exec(trimmed);
  const px = /^((?:\d+(?:\.\d+)?|\.\d+))\s*px$/i.exec(trimmed);
  const em = /^((?:\d+(?:\.\d+)?|\.\d+))\s*em$/i.exec(trimmed);
  let ratio = Number.NaN;
  if (percent) ratio = Number(percent[1]) / 100;
  else if (unitless) ratio = Number(unitless[1]);
  else if (px) ratio = Number(px[1]) / fontSize;
  else if (em) ratio = Number(em[1]);

  const rounded = roundHundredths(ratio);
  if (!Number.isFinite(rounded) || !(rounded > 0)) {
    notes.push(
      `Button line-height "${trimmed}" could not be read; imported at 1.2.`,
    );
    return undefined;
  }
  return rounded === BUTTON_LINE_HEIGHT ? undefined : rounded;
}

const RELATIVE_LINE_HEIGHT = /^((?:\d+(?:\.\d+)?|\.\d+))\s*(%|em)$/i;

/**
 * A px font size, unrounded, or 0 when it is not one. `parsePxValue` rounds
 * to whole pixels, which would skew a line height resolved against it.
 */
function fontSizePx(value: string | undefined): number {
  const match = /^((?:\d+(?:\.\d+)?|\.\d+))\s*(?:px)?$/i.exec(
    value?.trim() ?? "",
  );
  return match ? Number(match[1]) : 0;
}

/**
 * The size a button label renders at: a px or unitless font size rounded to
 * whole pixels. Undefined when the value is missing, not a px length, not
 * finite, or rounds to 0, and the block then keeps the factory size.
 */
function labelFontSize(value: string | undefined): number | undefined {
  const size = Math.round(fontSizePx(value));
  return Number.isFinite(size) && size > 0 ? size : undefined;
}

/** A `%` or `em` line height as the px it computes to at `fontSize`. */
function relativeAsPx(value: string, fontSize: number): string | undefined {
  const relative = RELATIVE_LINE_HEIGHT.exec(value);
  if (!relative) return undefined;
  const factor =
    relative[2] === "%" ? Number(relative[1]) / 100 : Number(relative[1]);
  return `${factor * fontSize}px`;
}

/**
 * The line height a button takes: its own, else the one it inherits from
 * the element around it. An own line height is kept as written: the label
 * renders at the anchor's font size, or at the factory size when that can't
 * be read, so a `%` or `em` keeps its ratio. `inherit` defers to the element
 * around it, where a `%` or `em` line height inherits as the length it
 * computes to, resolved against `outerFontSize`. With no outer font size, a
 * label that states none of its own shares the size the outer element
 * inherits, so the value keeps its ratio as written. Otherwise, when the
 * outer font size is missing or not a px length, `fallbackSize` stands in and
 * a note says so. A number, a length or a keyword is kept as written.
 */
function lineHeightSource(
  own: string | undefined,
  outer: string | undefined,
  outerFontSize: string | undefined,
  ownFontSize: string | undefined,
  fallbackSize: number,
  notes: string[],
): string | undefined {
  const ownValue = own?.trim();
  if (ownValue && !/^inherit$/i.test(ownValue)) return own;
  const outerValue = outer?.trim() ?? "";
  if (!RELATIVE_LINE_HEIGHT.test(outerValue)) return outer;
  const statedOuter = outerFontSize?.trim();
  if (!statedOuter && !ownFontSize?.trim()) return outer;
  let size = fontSizePx(statedOuter);
  if (!(size > 0)) {
    const source = statedOuter
      ? `font-size "${statedOuter}", which could not be read`
      : "a font-size that is not stated";
    notes.push(
      `Button line-height "${outerValue}" inherits from ${source}; resolved against ${fallbackSize}px.`,
    );
    size = fallbackSize;
  }
  return relativeAsPx(outerValue, size);
}

export function buttonFrom(
  $el: Cheerio<Element>,
  sourceTag: string,
  ctx: ConvertCtx,
): Block {
  const $a = firstAnchor($el);
  const text = ($a.text() ?? "").trim() || "Shop Now";
  const url = $a.attr("href") ?? "#";
  const target = $a.attr("target");
  const own = parseStyleAttribute($a.attr("style"));
  const parent = parseStyleAttribute($a.parent().attr("style"));
  const backgroundColor =
    colorFromPaint($a.attr("style")) ||
    colorFromPaint($a.parent().attr("style"));
  const textColor = parseColor(own.color) || parseColor(parent.color);
  const borderRadius =
    parsePxValue(own["border-radius"]) || parsePxValue(parent["border-radius"]);
  // The anchor's own font size applies, else the one it inherits from the
  // element around it. One that can't be read leaves the factory size with a
  // note, and a px line height is measured against the size the label
  // renders at.
  const factorySize = Number(BUTTON_BLOCK_DEFAULTS.fontSize);
  const statedFontSize = own["font-size"] ?? parent["font-size"];
  const fontSize = labelFontSize(statedFontSize);
  const notes: string[] = [];
  if (statedFontSize !== undefined && fontSize === undefined) {
    notes.push(
      `Button font-size "${statedFontSize}" could not be read; imported at ${factorySize}px.`,
    );
  }
  const lineHeight = readButtonLineHeight(
    lineHeightSource(
      own["line-height"],
      parent["line-height"],
      parent["font-size"],
      own["font-size"],
      factorySize,
      notes,
    ),
    fontSize ?? factorySize,
    notes,
  );
  pushEntry(
    ctx,
    sourceTag,
    "button",
    notes.length > 0 ? "approximated" : "converted",
    notes.length > 0 ? notes.join(" ") : undefined,
  );
  return createButtonBlock({
    text,
    url,
    ...(target === "_blank" ? { openInNewTab: true } : {}),
    ...(backgroundColor ? { backgroundColor } : {}),
    ...(textColor ? { textColor } : {}),
    ...(borderRadius > 0 ? { borderRadius } : {}),
    ...(fontSize !== undefined ? { fontSize } : {}),
    ...(lineHeight !== undefined ? { lineHeight } : {}),
  });
}

function declaresPadding($el: Cheerio<Element>): boolean {
  const styles = parseStyleAttribute($el.attr("style"));
  return (
    styles.padding !== undefined ||
    styles["padding-top"] !== undefined ||
    styles["padding-right"] !== undefined ||
    styles["padding-bottom"] !== undefined ||
    styles["padding-left"] !== undefined
  );
}

/**
 * The structure cell's padding becomes the section's padding. Reading it again
 * as the divider's own padding shortens the line twice.
 */
function isStructureCell($cell: Cheerio<Element>): boolean {
  if (!$cell.is("td") && !$cell.is("th")) return false;
  if (hasToken($cell, "esd-structure")) return true;
  let $table = $cell.parent().parent();
  if ($table.is("tbody") || $table.is("thead") || $table.is("tfoot")) {
    $table = $table.parent();
  }
  return $table.is("table") && hasAnyToken($table, STRUCTURE_TABLES);
}

function spacerElement($root: Cheerio<Element>): Cheerio<Element> {
  if (hasToken($root, "es-spacer")) return $root;
  const $inner = $root.find("[class~='es-spacer']").first();
  return ($inner.length ? $inner : $root) as Cheerio<Element>;
}

function lineBorder(
  $root: Cheerio<Element>,
  $spacer: Cheerio<Element>,
  $: CheerioAPI,
): ParsedBorder | null {
  const own = visibleLineBorder(parseStyleAttribute($root.attr("style")));
  if (own) return own;
  const onSpacer = visibleLineBorder(
    parseStyleAttribute($spacer.attr("style")),
  );
  if (onSpacer) return onSpacer;
  let found: ParsedBorder | null = null;
  $spacer.find("td, th").each((_, cell) => {
    if (found) return;
    found = visibleLineBorder(parseStyleAttribute($(cell).attr("style")));
  });
  return found;
}

function dividerPadding(
  $root: Cheerio<Element>,
  $spacer: Cheerio<Element>,
): SpacingValue {
  if (declaresPadding($root)) {
    return readPadding(parseStyleAttribute($root.attr("style")));
  }
  if ($spacer[0] !== $root[0] && declaresPadding($spacer)) {
    return readPadding(parseStyleAttribute($spacer.attr("style")));
  }
  const $parent = $spacer.parent();
  if (
    ($parent.is("td") || $parent.is("th")) &&
    !isStructureCell($parent as Cheerio<Element>)
  ) {
    return readPadding(parseStyleAttribute($parent.attr("style")));
  }
  return { ...ZERO };
}

/**
 * No align and no margin is unset. A partial Stripo line with neither sits on
 * the left; the caller supplies that default.
 */
function specifiedAlign(
  $el: Cheerio<Element>,
): "left" | "center" | "right" | undefined {
  const styles = parseStyleAttribute($el.attr("style"));
  const alignAttr = ($el.attr("align") ?? "").trim().toLowerCase();
  const alignKnown =
    alignAttr === "left" || alignAttr === "center" || alignAttr === "right";
  const hasMargin =
    styles.margin !== undefined ||
    styles["margin-left"] !== undefined ||
    styles["margin-right"] !== undefined;
  if (!alignKnown && !hasMargin) return undefined;

  let left = "auto";
  let right = "auto";
  if (alignAttr === "left") left = "0";
  if (alignAttr === "right") right = "0";

  const margin = (styles.margin ?? "").trim().split(/\s+/).filter(Boolean);
  if (margin.length > 0) {
    right = margin[1] ?? margin[0];
    left = margin.length === 4 ? margin[3] : right;
  }
  if (styles["margin-left"] !== undefined) left = styles["margin-left"];
  if (styles["margin-right"] !== undefined) right = styles["margin-right"];

  const isAuto = (value: string) => value.trim().toLowerCase() === "auto";
  if (isAuto(left) && isAuto(right)) return "center";
  return isAuto(left) ? "right" : "left";
}

function placementOf(
  $spacer: Cheerio<Element>,
  $root: Cheerio<Element>,
): "left" | "center" | "right" {
  const own = specifiedAlign($spacer);
  if (own) return own;
  for (const $candidate of [$spacer.parent(), $root.parent()]) {
    if (!$candidate.is("td") && !$candidate.is("th")) continue;
    const fromCell = specifiedAlign($candidate as Cheerio<Element>);
    if (fromCell) return fromCell;
  }
  return "left";
}

function spacerHeight($el: Cheerio<Element>): number {
  const styles = parseStyleAttribute($el.attr("style"));
  const fromStyle = parsePxValue(styles.height);
  if (fromStyle > 0) return fromStyle;
  const fromAttr = parsePxValue($el.attr("height"));
  if (fromAttr > 0) return fromAttr;
  const pad = readPadding(styles);
  const vertical = pad.top + pad.bottom;
  return vertical > 0 ? vertical : 24;
}

function dividerBlock(
  border: ParsedBorder,
  padding: SpacingValue,
  width: DividerBlock["width"],
): Block {
  const lineStyle =
    border.style === "dashed" || border.style === "dotted"
      ? border.style
      : "solid";
  return createDividerBlock({
    lineStyle,
    color: border.color || "#e5e7eb",
    thickness: border.width,
    width,
    styles: { padding },
  });
}

/**
 * A bordered spacer is a divider. `room` is the column width the line can
 * span, after the section padding that column owns.
 */
export function spacerFrom(
  $el: Cheerio<Element>,
  sourceTag: string,
  ctx: ConvertCtx,
  $: CheerioAPI,
  room?: number,
): Block {
  const $spacer = spacerElement($el);
  const border = lineBorder($el, $spacer, $);
  if (!border) {
    const height = spacerHeight($spacer);
    pushEntry(ctx, sourceTag, "spacer", "converted");
    return createSpacerBlock({ height });
  }

  const padding = dividerPadding($el, $spacer);
  const styles = parseStyleAttribute($spacer.attr("style"));
  const raw = (styles.width ?? $spacer.attr("width") ?? "").trim();
  const notes: string[] = [];
  const width = readDividerWidth(raw, room, padding.left, padding.right, notes);
  if (MAPPED_LINE_STYLES.has(border.style)) {
    notes.push(`Divider border style "${border.style}" was imported as solid.`);
  }
  if (width !== "full") {
    const align = placementOf($spacer, $el);
    if (align !== "center") {
      notes.push(
        `The source aligns this divider ${align}; Templatical centres every divider.`,
      );
    }
  }
  pushEntry(
    ctx,
    sourceTag,
    "divider",
    notes.length > 0 ? "approximated" : "converted",
    notes.length > 0 ? notes.join(" ") : undefined,
  );
  return dividerBlock(border, padding, width);
}

function menuItems($table: Cheerio<Element>, $: CheerioAPI): MenuItemData[] {
  const items: MenuItemData[] = [];
  $table.find("td").each((_, td) => {
    const $td = $(td) as Cheerio<Element>;
    if (isHidden($td)) return;
    const $a = $td.find("a").first();
    if (!$a.length) return;
    const text = ($a.text() ?? "").trim();
    if (!text) return;
    items.push({
      id: generateId(),
      text,
      url: $a.attr("href") ?? "#",
      openInNewTab: $a.attr("target") === "_blank",
      bold: false,
      underline: false,
    });
  });
  return items;
}

/**
 * A compiled/editor `table.es-menu` / `esd-block-menu` is a MenuBlock only
 * when one row holds two or more item cells. A single 100% cell is a stacked
 * step (Password reset) and must fall through.
 */
export function menuFrom(
  $el: Cheerio<Element>,
  $: CheerioAPI,
  sourceTag: string,
  ctx: ConvertCtx,
): Block | null {
  const $table = $el.is("table") ? $el : $el.find("table").first();
  const $row = $table.find("tr").first();
  const itemCells = $row
    .children("td")
    .toArray()
    .filter((td) => !isHidden($(td) as Cheerio<Element>));
  if (itemCells.length < 2) return null;
  const items = menuItems($table, $);
  if (items.length < 2) return null;
  pushEntry(ctx, sourceTag, "menu", "converted");
  return createMenuBlock({ items });
}

function genericWebsiteNote(count: number): string {
  return count === 1
    ? "1 icon became a generic website icon."
    : `${count} icons became generic website icons.`;
}

export function socialFrom(
  $el: Cheerio<Element>,
  $: CheerioAPI,
  sourceTag: string,
  ctx: ConvertCtx,
): Block {
  const icons: SocialIcon[] = [];
  let generic = 0;
  $el.find("a").each((_, a) => {
    const $a = $(a) as Cheerio<Element>;
    const $img = $a.find("img").first();
    const url = $a.attr("href") ?? "#";
    const platform = matchPlatform(
      $img.attr("title"),
      $img.attr("src"),
      $img.attr("alt"),
    );
    if (!platform) generic += 1;
    icons.push({ id: generateId(), platform: platform ?? "website", url });
  });
  const note = generic > 0 ? genericWebsiteNote(generic) : undefined;
  pushEntry(
    ctx,
    sourceTag,
    "social",
    note ? "approximated" : "converted",
    note,
  );
  return createSocialIconsBlock({ icons });
}

export function labelledInnerBlocks(
  $el: Cheerio<Element>,
  $: CheerioAPI,
  ctx: ConvertCtx,
): Block[] {
  return blocksFromHtml($.html($el) ?? "", ctx);
}
