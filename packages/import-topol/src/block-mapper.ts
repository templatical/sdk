import {
  createButtonBlock,
  createDividerBlock,
  createHtmlBlock,
  createImageBlock,
  createParagraphBlock,
  createSpacerBlock,
  createTitleBlock,
} from "@templatical/types";
import type { Block, BlockStyles } from "@templatical/types";
import {
  attr,
  numAttr,
  parseAlignment,
  parseBorderStyle,
  parseColor,
  parseFontFamily,
  parsePadding,
  parsePxValue,
} from "./attribute-parser";
import { inferTextBlock, stripTags } from "./content-inference";
import { selectorDefault, tagDefault, type GlobalStyle } from "./global-style";
import type { ImportReportEntry, TopolNode } from "./types";

export interface MapContext {
  style: GlobalStyle;
  /** The rendered width of the column holding this node, for `width: "full"`. */
  columnWidth: number;
  warnings: string[];
}

export interface Converted {
  block: Block | null;
  entry: ImportReportEntry;
}

/**
 * Read a node's own attribute, falling back to the design's per-tag then
 * per-selector default. Returns undefined when nothing sets it, so the caller
 * can omit the field and let the block factory's default stand.
 */
function resolved(
  node: TopolNode,
  key: string,
  ctx: MapContext,
  selector?: string,
): string | undefined {
  return (
    attr(node, key) ??
    tagDefault(ctx.style, node.tagName, key) ??
    (selector === undefined
      ? undefined
      : selectorDefault(ctx.style, selector, key))
  );
}

function baseStyles(node: TopolNode): { styles: BlockStyles } {
  const backgroundColor = parseColor(attr(node, "background-color"));
  return {
    styles: {
      padding: parsePadding(node),
      ...(backgroundColor ? { backgroundColor } : {}),
    },
  };
}

function convertText(node: TopolNode, ctx: MapContext): Converted {
  const inferred = inferTextBlock(node.content);

  if (inferred.kind === "paragraph") {
    return {
      block: createParagraphBlock({
        content: inferred.html,
        ...baseStyles(node),
      }),
      entry: {
        sourceTag: "mj-text",
        templaticalBlockType: "paragraph",
        status: "converted",
      },
    };
  }

  const selector = `h${inferred.level}`;
  const color = parseColor(resolved(node, "color", ctx, selector));
  const fontFamily = parseFontFamily(
    resolved(node, "font-family", ctx, selector),
  );

  const block = createTitleBlock({
    content: inferred.inner,
    level: inferred.level,
    textAlign: parseAlignment(attr(node, "align"), "left"),
    ...(color ? { color } : {}),
    ...(fontFamily ? { fontFamily } : {}),
    ...baseStyles(node),
  });

  return {
    block,
    entry: {
      sourceTag: "mj-text",
      templaticalBlockType: "title",
      status: inferred.clampedFrom ? "approximated" : "converted",
      ...(inferred.clampedFrom
        ? {
            note: `Heading level h${inferred.clampedFrom} clamped to 4 — Templatical titles support h1-h4.`,
          }
        : {}),
    },
  };
}

function convertButton(node: TopolNode, ctx: MapContext): Converted | null {
  const text = stripTags(node.content);
  if (!text) return null;

  const backgroundColor = parseColor(
    resolved(node, "background-color", ctx, "button"),
  );
  const textColor = parseColor(resolved(node, "color", ctx, "button"));
  const fontFamily = parseFontFamily(
    resolved(node, "font-family", ctx, "button"),
  );
  const fontSizeRaw = resolved(node, "font-size", ctx);
  const radiusRaw = resolved(node, "border-radius", ctx);

  return {
    block: createButtonBlock({
      text,
      url: attr(node, "href") ?? "",
      ...(backgroundColor ? { backgroundColor } : {}),
      ...(textColor ? { textColor } : {}),
      ...(fontFamily ? { fontFamily } : {}),
      ...(fontSizeRaw === undefined
        ? {}
        : { fontSize: parsePxValue(fontSizeRaw) }),
      ...(radiusRaw === undefined
        ? {}
        : { borderRadius: parsePxValue(radiusRaw) }),
      align: parseAlignment(attr(node, "align"), "center"),
      ...baseStyles(node),
    }),
    entry: {
      sourceTag: node.tagName,
      templaticalBlockType: "button",
      status: "converted",
    },
  };
}

function convertImage(
  node: TopolNode,
  ctx: MapContext,
  sourceTag: string,
): Converted | null {
  const src = attr(node, "src");
  if (!src) return null;

  const widthPercent = numAttr(node, "widthPercent");
  const pxWidth = numAttr(node, "width");
  const href = attr(node, "href");

  const width =
    widthPercent === 100 || pxWidth === undefined || pxWidth >= ctx.columnWidth
      ? ("full" as const)
      : Math.round(pxWidth);

  const isGif = sourceTag === "mj-gif";

  return {
    block: createImageBlock({
      src,
      alt: attr(node, "alt") ?? "",
      width,
      align: parseAlignment(attr(node, "align"), "center"),
      ...(href ? { linkUrl: href } : {}),
      ...baseStyles(node),
    }),
    entry: {
      sourceTag,
      templaticalBlockType: "image",
      status: isGif ? "approximated" : "converted",
      ...(isGif
        ? {
            note: "<mj-gif> imported as an image block; Templatical has no dedicated GIF block.",
          }
        : {}),
    },
  };
}

function convertSpacer(node: TopolNode): Converted {
  const height = attr(node, "height");
  return {
    block: createSpacerBlock({
      ...(height === undefined ? {} : { height: parsePxValue(height) }),
      ...baseStyles(node),
    }),
    entry: {
      sourceTag: "mj-spacer",
      templaticalBlockType: "spacer",
      status: "converted",
    },
  };
}

function convertDivider(node: TopolNode): Converted {
  const color = parseColor(attr(node, "border-color"));
  const thickness = attr(node, "border-width");
  return {
    block: createDividerBlock({
      lineStyle: parseBorderStyle(attr(node, "border-style")),
      ...(color ? { color } : {}),
      ...(thickness === undefined
        ? {}
        : { thickness: parsePxValue(thickness) }),
      ...baseStyles(node),
    }),
    entry: {
      sourceTag: "mj-divider",
      templaticalBlockType: "divider",
      status: "converted",
    },
  };
}

/**
 * Convert one leaf node to a block.
 *
 * Returns `null` for a node that produces nothing *and* warrants no report
 * entry — an image with no `src`, a button with no label. `mj-social` is not
 * handled here; the converter routes it to `convertSocial`.
 */
export function convertLeaf(
  node: TopolNode,
  ctx: MapContext,
): Converted | null {
  switch (node.tagName) {
    case "mj-text":
      return convertText(node, ctx);
    case "mj-button":
      return convertButton(node, ctx);
    case "mj-image":
      return convertImage(node, ctx, "mj-image");
    case "mj-gif":
      return convertImage(node, ctx, "mj-gif");
    case "mj-spacer":
      return convertSpacer(node);
    case "mj-divider":
      return convertDivider(node);
    default:
      return {
        block: createHtmlBlock({
          content: JSON.stringify(node, null, 2),
          ...baseStyles(node),
        }),
        entry: {
          sourceTag: node.tagName,
          templaticalBlockType: "html",
          status: "html-fallback",
          note: `<${node.tagName}> has no Templatical block equivalent; the original node is preserved as JSON.`,
        },
      };
  }
}
