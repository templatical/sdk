import { load, type Cheerio, type CheerioAPI } from "cheerio";
import type { AnyNode, Element } from "domhandler";
import { createSectionBlock } from "@templatical/types";
import type { Block, ColumnLayout, SpacingValue } from "@templatical/types";
import { hasAnyToken, hasToken, isHidden } from "./classes";
import {
  colorFromPaint,
  columnRooms,
  emailBodyWidth,
  hasBackgroundImage,
  readBoxPadding,
  resolveSectionPaint,
  type SectionPaint,
} from "./css";
import {
  blocksFromHtml,
  pushEntry,
  withBackground,
  type ConvertCtx,
} from "./fragment";
import { buttonFrom, menuFrom, socialFrom, spacerFrom } from "./labelled";

const ZERO: SpacingValue = { top: 0, right: 0, bottom: 0, left: 0 };
const COLUMN_TOKENS = ["es-left", "es-right"] as const;
const STRIPE_TOKENS = ["es-header", "es-content", "es-footer"] as const;
const BODY_SELECTOR =
  "[class~='es-header-body'], [class~='es-content-body'], [class~='es-footer-body']";

const BETWEEN_NOTE = "Content between columns was placed after them.";
const SEAM_NOTE = "This row's padding was split across more than one section.";
const IMAGE_NOTE = "A background image was not imported.";

type WidgetKind = "menu" | "social" | "button" | "spacer";

type Piece =
  { kind: "flow"; nodes: AnyNode[] } | { kind: "column"; el: Element };

function paintOf($el: Cheerio<Element>): string {
  return colorFromPaint($el.attr("style"), $el.attr("bgcolor"));
}

function stripeToken($el: Cheerio<Element>): string | undefined {
  return STRIPE_TOKENS.find((token) => hasToken($el, token));
}

function topStripes($: CheerioAPI): Cheerio<Element>[] {
  const out: Cheerio<Element>[] = [];
  $("[class]").each((_, node) => {
    const $el = $(node) as Cheerio<Element>;
    if (!stripeToken($el)) return;
    const nested = $el
      .parents()
      .toArray()
      .some((parent) =>
        hasAnyToken($(parent) as Cheerio<Element>, STRIPE_TOKENS),
      );
    if (nested) return;
    out.push($el);
  });
  return out;
}

function directRows(
  $table: Cheerio<Element>,
  $: CheerioAPI,
): Cheerio<Element>[] {
  const $direct = $table.children("tr");
  const $nested = $table.children("tbody, thead, tfoot").children("tr");
  const $rows = $direct.length > 0 ? $direct : $nested;
  return $rows.toArray().map((node) => $(node) as Cheerio<Element>);
}

function directCell($table: Cheerio<Element>): Cheerio<Element> {
  const $direct = $table.children("tr").children("td, th");
  const $nested = $table
    .children("tbody, thead, tfoot")
    .children("tr")
    .children("td, th");
  return ($direct.length > 0 ? $direct : $nested).first() as Cheerio<Element>;
}

/** Paint on the stripe table, else on its cell. A `td` stripe is its own paint. */
function bandColor($stripe: Cheerio<Element>): string {
  const own = paintOf($stripe);
  if (own) return own;
  if ($stripe.is("td") || $stripe.is("th")) return "";
  const $cell = directCell($stripe);
  return $cell.length > 0 ? paintOf($cell) : "";
}

function imageNote(...styles: Array<string | undefined>): string | undefined {
  return styles.some((style) => hasBackgroundImage(style))
    ? IMAGE_NOTE
    : undefined;
}

function hasPadding(padding: SpacingValue): boolean {
  return (
    padding.top !== 0 ||
    padding.right !== 0 ||
    padding.bottom !== 0 ||
    padding.left !== 0
  );
}

function splitPadding(
  padding: SpacingValue,
  count: number,
  index: number,
): SpacingValue {
  if (count <= 1) return { ...padding };
  return {
    top: index === 0 ? padding.top : 0,
    right: padding.right,
    bottom: index === count - 1 ? padding.bottom : 0,
    left: padding.left,
  };
}

function isColumn($el: Cheerio<Element>): boolean {
  return $el.is("table") && hasAnyToken($el, COLUMN_TOKENS);
}

function containsColumn($el: Cheerio<Element>, $: CheerioAPI): boolean {
  const stop = $el[0];
  let found = false;
  $el.find("table").each((_, node) => {
    if (found) return;
    const $n = $(node) as Cheerio<Element>;
    if (!hasAnyToken($n, COLUMN_TOKENS)) return;
    let $parent = $n.parent();
    while ($parent.length > 0 && $parent[0] !== stop) {
      if (hasAnyToken($parent as Cheerio<Element>, COLUMN_TOKENS)) return;
      $parent = $parent.parent();
    }
    found = true;
  });
  return found;
}

/**
 * Columns in one cell are one section. Flow before them, between them and
 * after them becomes its own one-column section, in that order.
 */
function collectPieces($root: Cheerio<Element>, $: CheerioAPI): Piece[] {
  const pieces: Piece[] = [];
  const walk = ($parent: Cheerio<Element>) => {
    const flow: AnyNode[] = [];
    const flush = () => {
      if (flow.length === 0) return;
      pieces.push({ kind: "flow", nodes: flow.splice(0, flow.length) });
    };
    for (const node of $parent.contents().toArray()) {
      if (node.type === "text") {
        if (node.data.trim()) flow.push(node);
        continue;
      }
      if (node.type !== "tag") continue;
      const $el = $(node) as Cheerio<Element>;
      if (isHidden($el)) continue;
      if (isColumn($el)) {
        flush();
        pieces.push({ kind: "column", el: node });
        continue;
      }
      if (containsColumn($el, $)) {
        flush();
        walk($el);
        continue;
      }
      flow.push(node);
    }
    flush();
  };
  walk($root);
  return pieces;
}

function widgetKind($el: Cheerio<Element>): WidgetKind | null {
  if (hasToken($el, "es-menu")) {
    if (!$el.is("table") && $el.find("table").length > 0) return null;
    return "menu";
  }
  if (hasToken($el, "es-social")) return "social";
  if (hasToken($el, "es-button")) {
    if ($el.is("a") || $el.find("a").length > 0) return "button";
    return null;
  }
  if (hasToken($el, "es-spacer")) return "spacer";
  return null;
}

function containsWidget($el: Cheerio<Element>, $: CheerioAPI): boolean {
  let found = false;
  $el.find("[class]").each((_, node) => {
    if (found) return;
    if (widgetKind($(node) as Cheerio<Element>)) found = true;
  });
  return found;
}

function widgetBlocks(
  $el: Cheerio<Element>,
  kind: WidgetKind,
  $: CheerioAPI,
  ctx: ConvertCtx,
  room: number | undefined,
): Block[] {
  if (kind === "button") return [buttonFrom($el, "es-button", ctx)];
  if (kind === "spacer") return [spacerFrom($el, "es-spacer", ctx, $, room)];
  if (kind === "social") return [socialFrom($el, $, "es-social", ctx)];
  const menu = menuFrom($el, $, "es-menu", ctx);
  if (menu) return [menu];
  return blocksFromHtml($.html($el) ?? "", ctx);
}

/** Widgets stay where they sit. A run of everything else goes through HTML import. */
function convertRegion(
  nodes: AnyNode[],
  $: CheerioAPI,
  ctx: ConvertCtx,
  room?: number,
): Block[] {
  const out: Block[] = [];
  let pending = "";
  const flush = () => {
    if (!pending.trim()) {
      pending = "";
      return;
    }
    out.push(...blocksFromHtml(pending, ctx));
    pending = "";
  };
  const visit = (node: AnyNode) => {
    if (node.type === "text") {
      if (node.data.trim()) pending += node.data;
      return;
    }
    if (node.type !== "tag") return;
    const $el = $(node) as Cheerio<Element>;
    if ($el.is("head, style, script")) return;
    if (isHidden($el)) return;
    const kind = widgetKind($el);
    if (kind) {
      flush();
      out.push(...widgetBlocks($el, kind, $, ctx, room));
      return;
    }
    if (containsWidget($el, $)) {
      for (const child of $el.contents().toArray()) visit(child);
      return;
    }
    pending += $.html(node) ?? "";
  };
  for (const node of nodes) visit(node);
  flush();
  return out;
}

function regionFromElement(
  $el: Cheerio<Element>,
  $: CheerioAPI,
  ctx: ConvertCtx,
  room?: number,
): Block[] {
  return convertRegion($el.contents().toArray(), $, ctx, room);
}

function hasBlocks(children: Block[][]): boolean {
  return children.some((column) => column.length > 0);
}

function columnChildren(
  cols: Element[],
  $: CheerioAPI,
  ctx: ConvertCtx,
  bodyWidth: number,
  padding: SpacingValue,
): { children: Block[][]; layout: ColumnLayout; flattenNote?: string } | null {
  const count = cols.length;
  const layout: ColumnLayout = count >= 3 ? "3" : count === 2 ? "2" : "1";
  const used = count >= 4 ? 3 : layout === "1" ? 1 : count;
  const rooms = columnRooms(
    bodyWidth,
    count >= 4 ? "3" : layout,
    padding,
    used,
  );
  let children: Block[][];
  if (count >= 4) {
    const rest: Block[] = [];
    for (const el of cols.slice(2)) {
      rest.push(
        ...regionFromElement($(el) as Cheerio<Element>, $, ctx, rooms[2]),
      );
    }
    children = [
      regionFromElement($(cols[0]) as Cheerio<Element>, $, ctx, rooms[0]),
      regionFromElement($(cols[1]) as Cheerio<Element>, $, ctx, rooms[1]),
      rest,
    ];
  } else {
    children = cols.map((el, index) =>
      regionFromElement($(el) as Cheerio<Element>, $, ctx, rooms[index]),
    );
  }
  if (!hasBlocks(children)) return null;
  if (count < 4) return { children, layout: count >= 3 ? "3" : layout };
  const flattenNote = `Row with ${count} columns was flattened; extra columns merged into the third slot. Templatical supports up to 3 columns per section.`;
  ctx.warnings.push(flattenNote);
  return { children, layout: "3", flattenNote };
}

function flowNodes(pieces: Piece[]): AnyNode[] {
  return pieces.flatMap((piece) => (piece.kind === "flow" ? piece.nodes : []));
}

function groupsFromPieces(
  pieces: Piece[],
): Array<{ mode: "flow" | "columns"; pieces: Piece[]; extra?: string }> {
  const columns = pieces.filter((piece) => piece.kind === "column");
  if (columns.length === 0) {
    return pieces.length > 0 ? [{ mode: "flow", pieces }] : [];
  }
  let first = -1;
  let last = -1;
  pieces.forEach((piece, index) => {
    if (piece.kind !== "column") return;
    if (first === -1) first = index;
    last = index;
  });
  const groups: Array<{
    mode: "flow" | "columns";
    pieces: Piece[];
    extra?: string;
  }> = [];
  const leading = pieces.slice(0, first);
  if (leading.length > 0) groups.push({ mode: "flow", pieces: leading });
  groups.push({ mode: "columns", pieces: columns });
  const between = pieces
    .slice(first + 1, last)
    .filter((piece) => piece.kind === "flow");
  if (between.length > 0) {
    groups.push({ mode: "flow", pieces: between, extra: BETWEEN_NOTE });
  }
  const trailing = pieces.slice(last + 1);
  if (trailing.length > 0) groups.push({ mode: "flow", pieces: trailing });
  return groups;
}

function sectionsFromRow(
  $row: Cheerio<Element>,
  $: CheerioAPI,
  ctx: ConvertCtx,
  token: string,
  paint: SectionPaint,
  image: string | undefined,
  bodyWidth: number,
): Block[] {
  if (isHidden($row)) return [];
  const pieces: Piece[] = [];
  let padding = { ...ZERO };
  let sawCell = false;
  $row.children("td, th").each((_, cell) => {
    const $cell = $(cell) as Cheerio<Element>;
    if (isHidden($cell)) return;
    if (!sawCell) {
      padding = readBoxPadding($cell.attr("class"), $cell.attr("style"));
      sawCell = true;
    }
    pieces.push(...collectPieces($cell, $));
  });
  if (!sawCell || pieces.length === 0) return [];

  const rendered: Array<{
    children: Block[][];
    layout: ColumnLayout;
    extra?: string;
  }> = [];
  for (const group of groupsFromPieces(pieces)) {
    if (group.mode === "columns") {
      const cols = group.pieces.flatMap((piece) =>
        piece.kind === "column" ? [piece.el] : [],
      );
      const built = columnChildren(cols, $, ctx, bodyWidth, padding);
      if (!built) continue;
      rendered.push({
        children: built.children,
        layout: built.layout,
        extra: built.flattenNote,
      });
      continue;
    }
    const blocks = convertRegion(
      flowNodes(group.pieces),
      $,
      ctx,
      columnRooms(bodyWidth, "1", padding, 1)[0],
    );
    if (blocks.length === 0) continue;
    rendered.push({ children: [blocks], layout: "1", extra: group.extra });
  }
  if (rendered.length === 0) return [];

  const seam =
    rendered.length > 1 && hasPadding(padding) ? SEAM_NOTE : undefined;
  return rendered.map((group, index) => {
    const notes = [...paint.notes, group.extra, image, seam].filter(
      (note): note is string => Boolean(note),
    );
    pushEntry(
      ctx,
      token,
      "section",
      notes.length > 0 ? "approximated" : "converted",
      notes.length > 0 ? notes.join(" ") : undefined,
    );
    const section = createSectionBlock({
      columns: group.layout,
      children: group.children,
      styles: { padding: splitPadding(padding, rendered.length, index) },
      ...(paint.wrapperColor
        ? { wrapper: { backgroundColor: paint.wrapperColor } }
        : {}),
    });
    return withBackground(section, paint.backgroundColor);
  });
}

function sectionsFromStripe(
  $stripe: Cheerio<Element>,
  $: CheerioAPI,
  ctx: ConvertCtx,
): Block[] {
  if (isHidden($stripe)) return [];
  const token = stripeToken($stripe) ?? "es-content";
  const $body = $stripe.find(BODY_SELECTOR).first() as Cheerio<Element>;
  const rows = $body.length > 0 ? directRows($body, $) : directRows($stripe, $);
  const paint = resolveSectionPaint(
    ctx.pageBackground ?? "#ffffff",
    bandColor($stripe),
    $body.length > 0 ? paintOf($body) : "",
  );
  const image = imageNote(
    $stripe.attr("style"),
    directCell($stripe).attr("style"),
    $body.attr("style"),
  );
  const $width = $body.length > 0 ? $body : $stripe;
  const bodyWidth = emailBodyWidth($width.attr("width"), $width.attr("style"));
  const out: Block[] = [];
  for (const $row of rows) {
    out.push(...sectionsFromRow($row, $, ctx, token, paint, image, bodyWidth));
  }
  return out;
}

export function convertCompiled(html: string, ctx: ConvertCtx): Block[] {
  const $ = load(html);
  const stripes = topStripes($);
  if (stripes.length === 0) {
    return convertRegion($.root().contents().toArray(), $, ctx);
  }
  const out: Block[] = [];
  for (const $stripe of stripes)
    out.push(...sectionsFromStripe($stripe, $, ctx));
  return out;
}
