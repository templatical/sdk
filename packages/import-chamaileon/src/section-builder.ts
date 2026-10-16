import { createSectionBlock } from "@templatical/types";
import type { Block, BlockVisibility, SpacingValue } from "@templatical/types";
import {
  parseColor,
  parsePadding,
  parsePx,
  readChamaileonBackgroundImage,
} from "./attribute-parser";
import {
  convertLeaf,
  isLoopType,
  markLoopApproximated,
  readLoopExpression,
  skippedLoopEntry,
  type MapContext,
} from "./block-mapper";
import {
  COLUMN_COUNT,
  columnPixels,
  matchColumnLayout,
  widthsToPercents,
} from "./column-layout";
import { readAttrs, readStyle, styleValue } from "./normalize";
import type { ChamaileonNode, ImportReportEntry } from "./types";

/**
 * Build a `SectionBlock` from a Chamaileon `fullwidth`. Returns an array so
 * an empty fullwidth produces nothing.
 *
 * Boxes flatten into the parent. A nested `multicolumn` flattens into the
 * parent column — never a nested `type: "section"`.
 */
export function buildFullwidth(
  node: ChamaileonNode,
  ctx: MapContext,
  entries: ImportReportEntry[],
): Block[] {
  const style = readStyle(node, ctx.variables, ctx.stats);
  const attrs = readAttrs(node, ctx.variables, ctx.stats);
  const contentFill = parseColor(styleValue(style, "contentBackgroundColor"));
  const outerFill = parseColor(styleValue(style, "backgroundColor"));
  const content = readChamaileonBackgroundImage(
    style,
    "contentBackground",
    "Section",
    ctx.bodyWidth,
  );
  const band = readChamaileonBackgroundImage(
    style,
    "background",
    "fullwidth",
    ctx.bodyWidth,
  );

  const original = node.children ?? [];
  const sole =
    original.length === 1 && original[0].type === "box"
      ? original[0]
      : undefined;
  const soleStyle = sole ? readStyle(sole, ctx.variables, ctx.stats) : {};
  const copySoleFill =
    sole !== undefined && losesPaint(soleStyle) && contentFill === undefined;
  const soleImage =
    sole !== undefined && !content
      ? readChamaileonBackgroundImage(
          soleStyle,
          "background",
          "Box",
          ctx.bodyWidth,
        )
      : null;
  if (copySoleFill && !soleImage && hasBoxImage(soleStyle)) {
    // The lone box's fill goes up with the section's paint, so it stays
    // silent; an image the section doesn't keep is still lost and reported.
    entries.push({
      sourceTag: "box",
      templaticalBlockType: null,
      status: "approximated",
      note: BOX_IMAGE_DROPPED,
    });
  }

  const flattened = flattenBoxes(
    original,
    ctx,
    entries,
    copySoleFill ? sole : undefined,
    soleImage ? sole : undefined,
  );
  if (flattened.length === 0) return [];

  const mcIndex = flattened.findIndex((child) => child.type === "multicolumn");
  const reasons: string[] = [];

  const section = createSectionBlock();

  if (mcIndex === -1) {
    section.columns = "1";
    section.children = [
      convertColumnChildren(
        flattened,
        withColumnWidth(ctx, ctx.bodyWidth),
        entries,
      ),
    ];
  } else {
    const driving = flattened[mcIndex];
    const before = flattened.slice(0, mcIndex);
    const after = flattened.slice(mcIndex + 1);
    if (before.length > 0 || after.length > 0) {
      reasons.push(
        "fullwidth mixes a multicolumn with sibling leaves; siblings were placed in column 0.",
      );
    }

    const columns = (driving.children ?? []).filter(
      (child) => child.type === "column",
    );
    const widthsPx = columns.map((column) =>
      parsePx(styleValue(readStyle(column, ctx.variables, ctx.stats), "width")),
    );
    const { layout, exact } = matchColumnLayout(
      widthsToPercents(widthsPx, ctx.bodyWidth),
    );
    if (!exact) {
      reasons.push(
        `Column widths ${formatWidths(widthsPx)} have no exact Templatical layout; resolved to "${layout}".`,
      );
    }

    const stacking = asString(
      readAttrs(driving, ctx.variables, ctx.stats).stacking,
    );
    if (stacking === "none") {
      section.stackOnMobile = false;
    } else if (stacking !== undefined && stacking !== "left-on-top") {
      reasons.push(`unknown stacking "${stacking}" omitted`);
    }

    const slots = COLUMN_COUNT[layout];
    const pixels = columnPixels(layout, ctx.bodyWidth);
    const children: Block[][] = Array.from({ length: slots }, () => []);
    const slotCtx = (slot: number): MapContext =>
      withColumnWidth(ctx, Math.round(pixels[slot] ?? ctx.bodyWidth));

    children[0].push(...convertColumnChildren(before, slotCtx(0), entries));
    columns.forEach((column, index) => {
      const slot = Math.min(index, slots - 1);
      children[slot].push(
        ...convertColumnChildren(column.children ?? [], slotCtx(slot), entries),
      );
    });
    children[0].push(...convertColumnChildren(after, slotCtx(0), entries));

    section.columns = layout;
    section.children = children;
  }

  const soleFill = copySoleFill
    ? parseColor(
        styleValue(
          readStyle(sole, ctx.variables, ctx.stats),
          "backgroundColor",
        ),
      )
    : undefined;
  const fill = contentFill ?? soleFill;

  section.styles.padding = contentPadding(style);
  if (fill) section.styles.backgroundColor = fill;

  const own = content ?? soleImage;
  let backgroundImage = own?.image;
  if (own) reasons.push(...own.notes);
  if (band) {
    if (!own && fill === undefined) {
      backgroundImage = band.image;
      reasons.push(
        ...band.notes,
        "fullwidth background image spans the full width in Chamaileon; the section paints it at the content width.",
      );
    } else {
      reasons.push(
        "fullwidth background image outside the content width was dropped.",
      );
    }
  }
  if (backgroundImage) section.backgroundImage = backgroundImage;

  if (outerFill) {
    if (!backgroundImage) {
      section.wrapper = { backgroundColor: outerFill };
    } else if (backgroundImage === band?.image) {
      section.styles.backgroundColor = outerFill;
    } else {
      reasons.push(
        `fullwidth background colour ${outerFill} was dropped: Outlook desktop paints a wrapper colour over the section's background image.`,
      );
    }
  }

  const visibility = readVisibility(attrs);
  if (visibility) section.visibility = visibility;

  entries.push({
    sourceTag: "fullwidth",
    templaticalBlockType: "section",
    status: reasons.length > 0 ? "approximated" : "converted",
    ...(reasons.length > 0 ? { note: reasons.join(" ") } : {}),
  });

  return [section];
}

const BOX_IMAGE_DROPPED = "box background image dropped";

function hasBoxImage(style: Record<string, unknown>): boolean {
  return (
    readChamaileonBackgroundImage(style, "background", "Box", undefined) !==
    null
  );
}

function flattenBoxes(
  nodes: ChamaileonNode[],
  ctx: MapContext,
  entries: ImportReportEntry[],
  silent: ChamaileonNode | undefined,
  imageKept?: ChamaileonNode,
): ChamaileonNode[] {
  const out: ChamaileonNode[] = [];
  for (const child of nodes) {
    if (child.type === "placeholder") continue;
    if (child.type !== "box") {
      out.push(child);
      continue;
    }
    const keepsImage = child === imageKept;
    if (child !== silent && isPaintedBox(child, ctx, keepsImage)) {
      reportPaintedBox(child, ctx, entries, keepsImage);
    }
    out.push(...flattenBoxes(child.children ?? [], ctx, entries, undefined));
  }
  return out;
}

function convertColumnChildren(
  nodes: ChamaileonNode[],
  ctx: MapContext,
  entries: ImportReportEntry[],
): Block[] {
  const blocks: Block[] = [];
  for (const child of nodes) {
    if (child.type === "placeholder") continue;
    if (child.type === "box") {
      if (isPaintedBox(child, ctx)) reportPaintedBox(child, ctx, entries);
      blocks.push(...convertColumnChildren(child.children ?? [], ctx, entries));
      continue;
    }
    if (child.type === "multicolumn") {
      const innerColumns = (child.children ?? []).filter(
        (column) => column.type === "column",
      );
      entries.push({
        sourceTag: "multicolumn",
        templaticalBlockType: null,
        status: "approximated",
        note: `nested multicolumn flattened (${innerColumns.length} columns)`,
      });
      for (const column of innerColumns) {
        blocks.push(
          ...convertColumnChildren(column.children ?? [], ctx, entries),
        );
      }
      continue;
    }
    if (child.type === "column") {
      blocks.push(...convertColumnChildren(child.children ?? [], ctx, entries));
      continue;
    }
    if (isLoopType(child.type)) {
      const type = child.type ?? "loop";
      const expression = readLoopExpression(child, ctx);
      const kids = child.children ?? [];
      if (kids.length === 0) {
        entries.push(skippedLoopEntry(type, expression));
        continue;
      }
      const from = entries.length;
      blocks.push(...convertColumnChildren(kids, ctx, entries));
      markLoopApproximated(entries, from, type, expression);
      continue;
    }
    const converted = convertLeaf(child, ctx);
    entries.push(converted.entry);
    if (converted.block) blocks.push(converted.block);
  }
  return blocks;
}

/**
 * Whether flattening the box loses paint: a fill, padding, a radius, or a
 * background image the section doesn't keep (`imageKept`).
 */
function isPaintedBox(
  node: ChamaileonNode,
  ctx: MapContext,
  imageKept = false,
): boolean {
  return losesPaint(readStyle(node, ctx.variables, ctx.stats), imageKept);
}

function losesPaint(
  style: Record<string, unknown>,
  imageKept = false,
): boolean {
  if (parseColor(styleValue(style, "backgroundColor"))) return true;
  if (!imageKept && hasBoxImage(style)) return true;
  const padding = parsePadding(style);
  if (
    padding.top !== 0 ||
    padding.right !== 0 ||
    padding.bottom !== 0 ||
    padding.left !== 0
  ) {
    return true;
  }
  const radius = parsePx(styleValue(style, "borderRadius"));
  return radius !== undefined && radius > 0;
}

function reportPaintedBox(
  node: ChamaileonNode,
  ctx: MapContext,
  entries: ImportReportEntry[],
  imageKept = false,
): void {
  const style = readStyle(node, ctx.variables, ctx.stats);
  const fill = parseColor(styleValue(style, "backgroundColor"));
  const image = !imageKept && hasBoxImage(style);
  const lost = [
    fill ? `box fill ${fill} dropped` : "",
    image ? BOX_IMAGE_DROPPED : "",
  ].filter(Boolean);
  entries.push({
    sourceTag: "box",
    templaticalBlockType: null,
    status: "approximated",
    note: lost.length > 0 ? lost.join("; ") : "box padding/radius dropped",
  });
}

function contentPadding(style: Record<string, unknown>): SpacingValue {
  return {
    top: parsePx(styleValue(style, "contentPaddingTop")) ?? 0,
    right: parsePx(styleValue(style, "contentPaddingRight")) ?? 0,
    bottom: parsePx(styleValue(style, "contentPaddingBottom")) ?? 0,
    left: parsePx(styleValue(style, "contentPaddingLeft")) ?? 0,
  };
}

function withColumnWidth(ctx: MapContext, columnWidth: number): MapContext {
  return { ...ctx, columnWidth };
}

function formatWidths(widthsPx: Array<number | undefined>): string {
  return widthsPx
    .map((width) => (width === undefined ? "auto" : `${width}px`))
    .join(", ");
}

function readVisibility(
  attrs: Record<string, unknown>,
): BlockVisibility | undefined {
  const hideOnMobile = attrs.hideOnMobile === true;
  const hideOnDesktop = attrs.hideOnDesktop === true;
  if (!hideOnMobile && !hideOnDesktop) return undefined;
  return { desktop: !hideOnDesktop, mobile: !hideOnMobile };
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
