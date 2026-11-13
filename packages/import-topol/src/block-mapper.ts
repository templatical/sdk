import {
  BUTTON_BLOCK_DEFAULTS,
  BUTTON_LINE_HEIGHT,
  canonicalFontStack,
  createButtonBlock,
  createDividerBlock,
  createHtmlBlock,
  createImageBlock,
  createParagraphBlock,
  createSpacerBlock,
  createTitleBlock,
  roundHundredths,
} from "@templatical/types";
import type { Block, BlockStyles } from "@templatical/types";
import {
  attr,
  numAttr,
  parseAlignment,
  parseBorderStyle,
  parseColor,
  parsePadding,
  parsePxValue,
} from "./attribute-parser";
import { inferTextBlock, stripTags } from "./content-inference";
import { selectorDefault, tagDefault, type GlobalStyle } from "./global-style";
import type { ImportReportEntry, TopolNode } from "./types";

export interface MapContext {
  uidMap?: Map<string, { node: TopolNode; block: Block | null }>;
  style: GlobalStyle;
  /** The rendered width of the column holding this node, for `width: "full"`. */
  columnWidth: number;
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

/**
 * The `styles` every leaf block shares.
 *
 * The block background is the row behind the element, which MJML reads from
 * `container-background-color` on every leaf and which the renderer writes
 * `styles.backgroundColor` back out as. A leaf's `background-color` must not
 * feed it: on `mj-button` it is the button face (`backgroundColor`, read in
 * `convertButton`), on `mj-text` MJML never paints it, and on image, spacer,
 * divider and social it is invalid and dropped. Reading it here paints a
 * button's whole row in its fill colour. `buildSection` reads
 * `background-color` itself, since on `mj-section` it is the section's fill.
 */
export function baseStyles(node: TopolNode): { styles: BlockStyles } {
  const backgroundColor = parseColor(attr(node, "container-background-color"));
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
  const fontFamily = canonicalFontStack(
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

function convertButton(node: TopolNode, ctx: MapContext): Converted | null {
  const text = stripTags(node.content);
  if (!text) return null;

  const backgroundColor = parseColor(
    resolved(node, "background-color", ctx, "button"),
  );
  const textColor = parseColor(resolved(node, "color", ctx, "button"));
  const fontFamily = canonicalFontStack(
    resolved(node, "font-family", ctx, "button"),
  );
  // A stated font size that is not px, not finite, or not above 0, leaves the
  // factory size with a note, and a px line height is measured against the
  // size the label renders at.
  const factorySize = Number(BUTTON_BLOCK_DEFAULTS.fontSize);
  const statedFontSize = String(resolved(node, "font-size", ctx) ?? "").trim();
  const parsedFontSize = parsePxValue(statedFontSize);
  const fontSize =
    Number.isFinite(parsedFontSize) && parsedFontSize > 0
      ? parsedFontSize
      : undefined;
  const radiusRaw = resolved(node, "border-radius", ctx);
  const notes: string[] = [];
  if (statedFontSize !== "" && fontSize === undefined) {
    notes.push(
      `Button font-size "${statedFontSize}" could not be read; imported at ${factorySize}px.`,
    );
  }
  const lineHeight = readButtonLineHeight(
    resolved(node, "line-height", ctx, "button"),
    fontSize ?? factorySize,
    notes,
  );

  return {
    block: createButtonBlock({
      text,
      url: attr(node, "href") ?? "",
      ...(backgroundColor ? { backgroundColor } : {}),
      ...(textColor ? { textColor } : {}),
      ...(fontFamily ? { fontFamily } : {}),
      ...(fontSize !== undefined ? { fontSize } : {}),
      ...(lineHeight !== undefined ? { lineHeight } : {}),
      ...(radiusRaw === undefined
        ? {}
        : { borderRadius: parsePxValue(radiusRaw) }),
      align: parseAlignment(attr(node, "align"), "center"),
      ...baseStyles(node),
    }),
    entry: {
      sourceTag: node.tagName,
      templaticalBlockType: "button",
      status: notes.length > 0 ? "approximated" : "converted",
      ...(notes.length > 0 ? { note: notes.join(" ") } : {}),
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
  const base = baseStyles(node);
  // MJML caps an image at its column less its own side padding, so a px width
  // that reaches that renders as "full" does.
  const room =
    ctx.columnWidth - base.styles.padding.left - base.styles.padding.right;

  const width =
    widthPercent === 100 || pxWidth === undefined || pxWidth >= room
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
      ...base,
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
          content: JSON.stringify(node),
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
