import { noteValue } from "./note-value";
import {
  BUTTON_BLOCK_DEFAULTS,
  BUTTON_LINE_HEIGHT,
  createButtonBlock,
  createDividerBlock,
  createHtmlBlock,
  createImageBlock,
  createParagraphBlock,
  createTitleBlock,
  createVideoBlock,
  roundHundredths,
} from "@templatical/types";
import type {
  Block,
  BlockStyles,
  BlockVisibility,
  ButtonBlock,
  HeadingLevel,
} from "@templatical/types";
import {
  fontStack,
  parseAlignment,
  parseColor,
  parseLineStyle,
  parsePadding,
  parsePx,
} from "./attribute-parser";
import { inferTextBlock, stripTags } from "./content-inference";
import {
  camelKey,
  isUnset,
  readAttrs,
  readStyle,
  styleValue,
  unwrapValue,
} from "./normalize";
import { convertSocial } from "./social-mapper";
import type {
  ChamaileonNode,
  ChamaileonVariable,
  ConversionStatus,
  ImportReportEntry,
} from "./types";

export interface MapContext {
  bodyWidth: number;
  columnWidth: number;
  variables: ChamaileonVariable[];
  warnings: string[];
  stats?: { resolvedVariables: number };
}

export interface Converted {
  block: Block | null;
  entry: ImportReportEntry;
}

const LOOP_TYPES = new Set([
  "block-level-loop",
  "block-level-conditional",
  "loop",
  "conditional",
  "branch",
]);

export function isLoopType(type: string | undefined): boolean {
  return typeof type === "string" && LOOP_TYPES.has(type);
}

export function readLoopExpression(
  node: ChamaileonNode,
  ctx: MapContext,
): string | undefined {
  const value = readAttrs(node, ctx.variables, ctx.stats).expression;
  return typeof value === "string" ? value : undefined;
}

export function skippedLoopEntry(
  type: string,
  expression: string | undefined,
): ImportReportEntry {
  return {
    sourceTag: type,
    templaticalBlockType: null,
    status: "skipped",
    note: expression ? `${type} ${noteValue(expression)}` : type,
  };
}

export function markLoopApproximated(
  entries: ImportReportEntry[],
  from: number,
  type: string,
  expression: string | undefined,
): void {
  const extra = expression ? `${type} ${noteValue(expression)}` : type;
  for (let i = from; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.status === "converted") {
      entry.status = "approximated";
    }
    entry.note = entry.note ? `${entry.note} ${extra}` : extra;
  }
}

/**
 * Convert one Chamaileon leaf into a Templatical block.
 *
 * Structure nodes (`fullwidth` / `box` / `multicolumn` / `column`)
 * html-fallback if they reach this function.
 */
export function convertLeaf(node: ChamaileonNode, ctx: MapContext): Converted {
  switch (node.type) {
    case "text":
      return convertText(node, ctx);
    case "typed-text":
      return convertTypedText(node, ctx);
    case "button":
      return convertButton(node, ctx);
    case "image":
      return convertImage(node, ctx, "converted");
    case "dynamic-image":
      return convertImage(
        node,
        ctx,
        "approximated",
        "dynamic-image imported as an image block",
      );
    case "divider":
      return convertDivider(node, ctx);
    case "video":
      return convertVideo(node, ctx);
    case "code":
      return convertCode(node, ctx);
    case "social":
      return convertSocial(node, ctx);
    default:
      return convertUnknown(node, ctx);
  }
}

function convertText(node: ChamaileonNode, ctx: MapContext): Converted {
  const { style, attrs } = readNode(node, ctx);
  const raw = asString(attrs.text);
  const inferred = inferTextBlock(raw);

  if (inferred.kind === "paragraph") {
    return finish(
      createParagraphBlock({
        content: inferred.html,
        ...paddingStyles(style),
      }),
      attrs,
      report("text", "paragraph", "converted"),
    );
  }

  const heading = headingLooks(style, inferred.level, ctx);
  return finish(
    createTitleBlock({
      content: inferred.inner,
      level: inferred.level,
      textAlign: parseAlignment(
        alignFromMarkup(raw) ?? attrs.align ?? style.align,
        "left",
      ),
      ...heading,
      ...paddingStyles(style),
    }),
    attrs,
    inferred.clampedFrom
      ? report(
          "text",
          "title",
          "approximated",
          `Heading level h${inferred.clampedFrom} clamped to 4 — Templatical titles support h1-h4.`,
        )
      : report("text", "title", "converted"),
  );
}

function convertTypedText(node: ChamaileonNode, ctx: MapContext): Converted {
  const { style, attrs } = readNode(node, ctx);
  const raw = asString(attrs.text);
  const inferred = inferTextBlock(raw);
  const subType = asString(style.subType)?.trim().toLowerCase() ?? "paragraph";
  const titleLevel = typedTitleLevel(subType);

  if (titleLevel !== undefined) {
    const level = inferred.kind === "title" ? inferred.level : titleLevel;
    const color = parseColor(styleValue(style, "color"));
    const fontFamily = fontStack(styleValue(style, "fontFamily"));
    return finish(
      createTitleBlock({
        content: inferred.kind === "title" ? inferred.inner : stripTags(raw),
        level,
        textAlign: parseAlignment(
          style.align ?? attrs.align ?? alignFromMarkup(raw),
          "left",
        ),
        ...(color ? { color } : {}),
        ...(fontFamily ? { fontFamily } : {}),
        ...paddingStyles(style),
      }),
      attrs,
      report("typed-text", "title", "converted"),
    );
  }

  const list = subType === "list";
  return finish(
    createParagraphBlock({
      content:
        inferred.kind === "paragraph"
          ? inferred.html
          : raw?.trim() || "<p></p>",
      ...paddingStyles(style),
    }),
    attrs,
    list
      ? report(
          "typed-text",
          "paragraph",
          "approximated",
          "typed-text list imported as a paragraph",
        )
      : report("typed-text", "paragraph", "converted"),
  );
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

function convertButton(node: ChamaileonNode, ctx: MapContext): Converted {
  const { style, attrs } = readNode(node, ctx);
  const fill = parseColor(styleValue(style, "backgroundColor"));
  const textColor = parseColor(styleValue(style, "color"));
  const borderRadius = parsePx(styleValue(style, "borderRadius"));
  const fontSize = parsePx(styleValue(style, "fontSize"));
  const fontFamily = fontStack(styleValue(style, "fontFamily"));
  // Chamaileon states the line height in px; it is a multiple of the size
  // the label renders at.
  const notes: string[] = [];
  const lineHeight = readButtonLineHeight(
    styleValue(style, "lineHeight"),
    fontSize ?? Number(BUTTON_BLOCK_DEFAULTS.fontSize),
    notes,
  );

  const block: ButtonBlock = createButtonBlock({
    text: stripTags(asString(attrs.text)),
    url: asString(attrs.href) ?? "",
    ...(fill ? { backgroundColor: fill } : {}),
    ...(textColor ? { textColor } : {}),
    ...(borderRadius !== undefined ? { borderRadius } : {}),
    ...(fontSize !== undefined ? { fontSize } : {}),
    ...(lineHeight !== undefined ? { lineHeight } : {}),
    ...(fontFamily ? { fontFamily } : {}),
    align: parseAlignment(attrs.align ?? style.align, "center"),
    ...paddingStyles(style),
  });

  // createButtonBlock defaults fill to #333333; an unset Chamaileon
  // background is an outlined button, which has no Templatical equivalent.
  if (!fill) {
    block.backgroundColor = "#ffffff";
    notes.unshift("outlined button has no Templatical equivalent");
  }

  // The outline note has no full stop of its own; a line-height note does.
  return finish(
    block,
    attrs,
    notes.length > 0
      ? report("button", "button", "approximated", notes.join(". "))
      : report("button", "button", "converted"),
  );
}

function convertImage(
  node: ChamaileonNode,
  ctx: MapContext,
  status: "converted" | "approximated",
  note?: string,
): Converted {
  const { style, attrs } = readNode(node, ctx);
  const sourceTag = node.type ?? "image";
  const src = asString(attrs.src) ?? asString(styleValue(style, "src")) ?? "";
  const padding = paddingStyles(style);
  // MJML caps an image at its column less its own side padding, so a px width
  // that reaches that renders as "full" does.
  const width = resolvedWidth(
    style,
    ctx.columnWidth -
      padding.styles.padding.left -
      padding.styles.padding.right,
  );
  const linkUrl = asString(attrs.link);
  const borderRadius = parsePx(styleValue(style, "borderRadius"));

  return finish(
    createImageBlock({
      src,
      alt: asString(attrs.altText) ?? "",
      ...(width !== undefined ? { width } : {}),
      align: parseAlignment(attrs.align ?? style.align, "center"),
      ...(linkUrl ? { linkUrl } : {}),
      ...(borderRadius && borderRadius > 0 ? { borderRadius } : {}),
      ...paddingStyles(style),
    }),
    attrs,
    report(sourceTag, "image", status, note),
  );
}

function convertDivider(node: ChamaileonNode, ctx: MapContext): Converted {
  const { style, attrs } = readNode(node, ctx);
  const fromLine = parseLineStyle(attrs.lineStyle);
  // 4.x `style.width` is line thickness, not DividerBlock.width.
  const thickness = fromLine?.thickness ?? parsePx(styleValue(style, "width"));
  const lineStyle = fromLine?.lineStyle ?? asLineStyle(style.type);
  const color = fromLine?.color ?? parseColor(styleValue(style, "color"));

  return finish(
    createDividerBlock({
      ...(thickness !== undefined ? { thickness } : {}),
      ...(lineStyle ? { lineStyle } : {}),
      ...(color ? { color } : {}),
      width: "full",
      ...paddingStyles(style),
    }),
    attrs,
    report("divider", "divider", "converted"),
  );
}

function convertVideo(node: ChamaileonNode, ctx: MapContext): Converted {
  const { style, attrs } = readNode(node, ctx);
  const padding = paddingStyles(style);
  const width = resolvedWidth(
    style,
    ctx.columnWidth -
      padding.styles.padding.left -
      padding.styles.padding.right,
  );
  const alt = asString(attrs.altText);

  return finish(
    createVideoBlock({
      url: videoUrl(attrs),
      thumbnailUrl: asString(attrs.src) ?? "",
      ...(alt !== undefined ? { alt } : {}),
      ...(width !== undefined ? { width } : {}),
      align: parseAlignment(attrs.align ?? style.align, "center"),
      ...paddingStyles(style),
    }),
    attrs,
    report("video", "video", "converted"),
  );
}

function videoUrl(attrs: Record<string, unknown>): string {
  const link = asString(attrs.link);
  if (link) return link;
  const videoId = asString(attrs.videoId);
  if (!videoId) return "";
  const provider = asString(attrs.videoProvider)?.trim().toLowerCase();
  if (provider === "youtube") {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }
  if (provider === "vimeo") {
    return `https://vimeo.com/${videoId}`;
  }
  return "";
}

function convertCode(node: ChamaileonNode, ctx: MapContext): Converted {
  const { style, attrs } = readNode(node, ctx);
  return finish(
    createHtmlBlock({
      content: firstSetContent(attrs.html, attrs.code, attrs.content),
      ...paddingStyles(style),
    }),
    attrs,
    report("code", "html", "converted"),
  );
}

function convertUnknown(node: ChamaileonNode, ctx: MapContext): Converted {
  const { style, attrs } = readNode(node, ctx);
  const sourceTag = node.type ?? "unknown";
  return finish(
    createHtmlBlock({
      content: JSON.stringify(node),
      ...paddingStyles(style),
    }),
    attrs,
    report(
      sourceTag,
      "html",
      "html-fallback",
      `${noteValue(sourceTag)} has no Templatical block equivalent; the original node is preserved as JSON.`,
    ),
  );
}

function readNode(
  node: ChamaileonNode,
  ctx: MapContext,
): { style: Record<string, unknown>; attrs: Record<string, unknown> } {
  return {
    style: readStyle(node, ctx.variables, ctx.stats),
    attrs: readAttrs(node, ctx.variables, ctx.stats),
  };
}

function paddingStyles(style: Record<string, unknown>): {
  styles: BlockStyles;
} {
  return { styles: { padding: parsePadding(style) } };
}

function finish(
  block: Block,
  attrs: Record<string, unknown>,
  entry: ImportReportEntry,
): Converted {
  const visibility = readVisibility(attrs);
  if (visibility) block.visibility = visibility;
  return { block, entry };
}

function readVisibility(
  attrs: Record<string, unknown>,
): BlockVisibility | undefined {
  const hideOnMobile = attrs.hideOnMobile === true;
  const hideOnDesktop = attrs.hideOnDesktop === true;
  if (!hideOnMobile && !hideOnDesktop) return undefined;
  return { desktop: !hideOnDesktop, mobile: !hideOnMobile };
}

function report(
  sourceTag: string,
  templaticalBlockType: string,
  status: ConversionStatus,
  note?: string,
): ImportReportEntry {
  return {
    sourceTag,
    templaticalBlockType,
    status,
    ...(note ? { note } : {}),
  };
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function firstSetContent(...values: unknown[]): string {
  for (const value of values) {
    if (isUnset(value)) continue;
    if (typeof value === "string") return value;
    return JSON.stringify(value);
  }
  return "";
}

function resolvedWidth(
  style: Record<string, unknown>,
  room: number,
): number | "full" | undefined {
  const px = parsePx(styleValue(style, "width"));
  if (px === undefined) return undefined;
  return px >= room ? "full" : px;
}

function asLineStyle(
  value: unknown,
): "solid" | "dashed" | "dotted" | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim().toLowerCase();
  return v === "solid" || v === "dashed" || v === "dotted" ? v : undefined;
}

function typedTitleLevel(subType: string): HeadingLevel | undefined {
  if (subType === "title" || subType === "heading1") return 1;
  if (subType === "heading2") return 2;
  if (subType === "heading3") return 3;
  return undefined;
}

function headingLooks(
  style: Record<string, unknown>,
  level: HeadingLevel,
  ctx: MapContext,
): { color?: string; fontFamily?: string } {
  const nested = readNested(style[`h${level}`], ctx);
  const color = parseColor(style[`h${level}Color`] ?? nested.color);
  const fontFamily = fontStack(
    style[`h${level}FontFamily`] ?? nested.fontFamily,
  );
  return {
    ...(color ? { color } : {}),
    ...(fontFamily ? { fontFamily } : {}),
  };
}

function readNested(value: unknown, ctx: MapContext): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const unwrapped = unwrapValue(raw, ctx.variables, ctx.stats);
    if (isUnset(unwrapped)) continue;
    out[camelKey(key)] = unwrapped;
  }
  return out;
}

function alignFromMarkup(html: string | undefined): string | undefined {
  if (!html) return undefined;
  const match = /text-align\s*:\s*(left|center|right)/i.exec(html);
  return match?.[1]?.toLowerCase();
}
