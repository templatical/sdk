import { createSectionBlock } from "@templatical/types";
import type { Block, BlockVisibility, SpacingValue } from "@templatical/types";
import { parseColor, parsePadding, parsePx } from "./attribute-parser";
import { convertLeaf, type MapContext } from "./block-mapper";
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
  const style = readStyle(node, ctx.variables);
  const attrs = readAttrs(node, ctx.variables);
  const contentFill = parseColor(styleValue(style, "contentBackgroundColor"));
  const outerFill = parseColor(styleValue(style, "backgroundColor"));

  const original = node.children ?? [];
  const sole = original.length === 1 ? original[0] : undefined;
  const copySoleFill =
    sole?.type === "box" &&
    isPaintedBox(sole, ctx) &&
    contentFill === undefined;

  const flattened = flattenBoxes(
    original,
    ctx,
    entries,
    copySoleFill ? sole : undefined,
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
      parsePx(styleValue(readStyle(column, ctx.variables), "width")),
    );
    const { layout, exact } = matchColumnLayout(
      widthsToPercents(widthsPx, ctx.bodyWidth),
    );
    if (!exact) {
      reasons.push(
        `Column widths ${formatWidths(widthsPx)} have no exact Templatical layout; resolved to "${layout}".`,
      );
    }

    const stacking = asString(readAttrs(driving, ctx.variables).stacking);
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
    ? parseColor(styleValue(readStyle(sole, ctx.variables), "backgroundColor"))
    : undefined;
  const fill = contentFill ?? soleFill;

  section.styles.padding = contentPadding(style);
  if (fill) section.styles.backgroundColor = fill;
  if (outerFill) section.wrapper = { backgroundColor: outerFill };

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

function flattenBoxes(
  nodes: ChamaileonNode[],
  ctx: MapContext,
  entries: ImportReportEntry[],
  silent: ChamaileonNode | undefined,
): ChamaileonNode[] {
  const out: ChamaileonNode[] = [];
  for (const child of nodes) {
    if (child.type === "placeholder") continue;
    if (child.type !== "box") {
      out.push(child);
      continue;
    }
    if (child !== silent && isPaintedBox(child, ctx)) {
      reportPaintedBox(child, ctx, entries);
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
    const converted = convertLeaf(child, ctx);
    entries.push(converted.entry);
    if (converted.block) blocks.push(converted.block);
  }
  return blocks;
}

function isPaintedBox(node: ChamaileonNode, ctx: MapContext): boolean {
  const style = readStyle(node, ctx.variables);
  if (parseColor(styleValue(style, "backgroundColor"))) return true;
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
): void {
  const fill = parseColor(
    styleValue(readStyle(node, ctx.variables), "backgroundColor"),
  );
  entries.push({
    sourceTag: "box",
    templaticalBlockType: null,
    status: "approximated",
    note: fill ? `box fill ${fill} dropped` : "box padding/radius dropped",
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
