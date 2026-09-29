import { load, type Cheerio, type CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import { createHtmlBlock, createSectionBlock } from "@templatical/types";
import type { Block, SpacingValue } from "@templatical/types";
import { isHidden, tokenStartingWith, topLevelWithToken } from "./classes";
import {
  colorFromPaint,
  columnRooms,
  emailBodyWidth,
  hasBackgroundImage,
  readBoxPadding,
  resolveSectionPaint,
  type SectionPaint,
} from "./css";
import { pushEntry, withBackground, type ConvertCtx } from "./fragment";
import {
  buttonFrom,
  labelledInnerBlocks,
  menuFrom,
  socialFrom,
  spacerFrom,
} from "./labelled";

const ZERO: SpacingValue = { top: 0, right: 0, bottom: 0, left: 0 };
const BODY_SELECTOR =
  "[class~='es-header-body'], [class~='es-content-body'], [class~='es-footer-body']";
const IMAGE_NOTE = "A background image was not imported.";

function columnLayout(
  count: number,
  ctx: ConvertCtx,
): { layout: "1" | "2" | "3"; flattenNote?: string } {
  if (count <= 1) return { layout: "1" };
  if (count === 2) return { layout: "2" };
  if (count === 3) return { layout: "3" };
  const flattenNote = `Row with ${count} columns was flattened to a single column. Templatical supports up to 3 columns per section.`;
  ctx.warnings.push(flattenNote);
  return { layout: "1", flattenNote };
}

function esdBlockKind($el: Cheerio<Element>): string | undefined {
  const token = tokenStartingWith($el, "esd-block-");
  return token ? token.slice("esd-block-".length) : undefined;
}

function convertEsdBlock(
  $el: Cheerio<Element>,
  $: CheerioAPI,
  ctx: ConvertCtx,
  room?: number,
): Block[] {
  const kind = esdBlockKind($el);
  if (!kind) return labelledInnerBlocks($el, $, ctx);
  if (kind === "button") return [buttonFrom($el, "esd-block-button", ctx)];
  if (kind === "spacer")
    return [spacerFrom($el, "esd-block-spacer", ctx, $, room)];
  if (kind === "social") return [socialFrom($el, $, "esd-block-social", ctx)];
  if (kind === "menu") {
    const menu = menuFrom($el, $, "esd-block-menu", ctx);
    if (menu) return [menu];
    return labelledInnerBlocks($el, $, ctx);
  }
  if (kind === "html") {
    pushEntry(
      ctx,
      "esd-block-html",
      "html",
      "html-fallback",
      "HTML block preserved as HTML.",
    );
    return [createHtmlBlock({ content: ($el.html() ?? "").trim() })];
  }
  // image / text / anything else: generic HTML mapping of the inner markup
  pushEntry(
    ctx,
    `esd-block-${kind}`,
    kind === "image" ? "image" : "paragraph",
    "converted",
  );
  return labelledInnerBlocks($el, $, ctx);
}

function blocksInContainer(
  $frame: Cheerio<Element>,
  $: CheerioAPI,
  ctx: ConvertCtx,
  room?: number,
): Block[] {
  const out: Block[] = [];
  const seen = new Set<Element>();
  $frame.find("[class]").each((_, node) => {
    const $el = $(node) as Cheerio<Element>;
    if (!tokenStartingWith($el, "esd-block-")) return;
    const nested = $el
      .parents()
      .toArray()
      .some((p) => tokenStartingWith($(p) as Cheerio<Element>, "esd-block-"));
    if (nested) return;
    if (seen.has(node)) return;
    seen.add(node);
    out.push(...convertEsdBlock($el, $, ctx, room));
  });
  if (out.length === 0) return labelledInnerBlocks($frame, $, ctx);
  return out;
}

function enclosing(
  $el: Cheerio<Element>,
  selector: string,
): Cheerio<Element> | null {
  if ($el.is(selector)) return $el;
  const $parent = $el.parents(selector).first();
  return $parent.length > 0 ? ($parent as Cheerio<Element>) : null;
}

function bandColor($stripe: Cheerio<Element>): string {
  const own = colorFromPaint($stripe.attr("style"), $stripe.attr("bgcolor"));
  if (own) return own;
  if ($stripe.is("td") || $stripe.is("th")) return "";
  const $direct = $stripe.children("tr").children("td, th");
  const $nested = $stripe
    .children("tbody, thead")
    .children("tr")
    .children("td, th");
  const $cell = (
    $direct.length > 0 ? $direct : $nested
  ).first() as Cheerio<Element>;
  return $cell.length > 0
    ? colorFromPaint($cell.attr("style"), $cell.attr("bgcolor"))
    : "";
}

function paintFor($el: Cheerio<Element>, ctx: ConvertCtx): SectionPaint {
  const $stripe = enclosing($el, "[class~='esd-stripe']");
  const $body = enclosing($el, BODY_SELECTOR);
  return resolveSectionPaint(
    ctx.pageBackground ?? "#ffffff",
    $stripe ? bandColor($stripe) : "",
    $body ? colorFromPaint($body.attr("style"), $body.attr("bgcolor")) : "",
  );
}

function imageNote(...styles: Array<string | undefined>): string | undefined {
  return styles.some((style) => hasBackgroundImage(style))
    ? IMAGE_NOTE
    : undefined;
}

function sectionFromStructure(
  $structure: Cheerio<Element>,
  $: CheerioAPI,
  ctx: ConvertCtx,
): Block {
  const frames = $structure
    .find("[class~='esd-container-frame']")
    .toArray()
    .map((n) => $(n) as Cheerio<Element>)
    .filter(($el) => {
      if (isHidden($el)) return false;
      return (
        $el.parents("[class~='esd-container-frame']").filter((_, p) => {
          return $(p).closest($structure).length > 0;
        }).length === 0
      );
    });

  const frameCount = frames.length;
  const { layout, flattenNote } = columnLayout(
    frameCount === 0 ? 1 : frameCount,
    ctx,
  );
  const padding = readBoxPadding(
    $structure.attr("class"),
    $structure.attr("style"),
  );
  const $body = enclosing($structure, BODY_SELECTOR);
  const bodyWidth = emailBodyWidth($body?.attr("width"), $body?.attr("style"));
  const rooms = columnRooms(
    bodyWidth,
    layout,
    padding,
    layout === "1" ? 1 : Math.min(frameCount, 3),
  );
  let children: Block[][];
  if (layout === "1") {
    const merged: Block[] = [];
    const room = rooms[0];
    if (frames.length === 0) {
      merged.push(...blocksInContainer($structure, $, ctx, room));
    } else {
      for (const $f of frames)
        merged.push(...blocksInContainer($f, $, ctx, room));
    }
    children = [merged];
  } else {
    children = frames.map(($f, index) =>
      blocksInContainer($f, $, ctx, rooms[index]),
    );
  }
  const paint = paintFor($structure, ctx);
  const $stripe = enclosing($structure, "[class~='esd-stripe']");
  const notes = [
    ...paint.notes,
    flattenNote,
    imageNote($stripe?.attr("style"), $body?.attr("style")),
  ].filter((note): note is string => Boolean(note));
  if (notes.length > 0) {
    pushEntry(ctx, "esd-structure", "section", "approximated", notes.join(" "));
  } else if (frameCount <= 3) {
    pushEntry(ctx, "esd-structure", "section", "converted");
  }
  const section = createSectionBlock({
    columns: layout,
    children,
    styles: { padding },
    ...(paint.wrapperColor
      ? { wrapper: { backgroundColor: paint.wrapperColor } }
      : {}),
  });
  return withBackground(section, paint.backgroundColor);
}

export function convertEditor(html: string, ctx: ConvertCtx): Block[] {
  const $ = load(html);
  const structures = topLevelWithToken($, "esd-structure");
  if (structures.length > 0) {
    return structures.map(($s) => sectionFromStructure($s, $, ctx));
  }
  const stripes = topLevelWithToken($, "esd-stripe");
  if (stripes.length === 0) {
    return labelledInnerBlocks($.root() as unknown as Cheerio<Element>, $, ctx);
  }
  return stripes.map(($stripe) => {
    const inner = $stripe.find("[class~='esd-structure']");
    if (inner.length > 0) {
      return sectionFromStructure(inner.first() as Cheerio<Element>, $, ctx);
    }
    const paint = paintFor($stripe, ctx);
    const notes = [...paint.notes, imageNote($stripe.attr("style"))].filter(
      (note): note is string => Boolean(note),
    );
    pushEntry(
      ctx,
      "esd-stripe",
      "section",
      notes.length > 0 ? "approximated" : "converted",
      notes.length > 0 ? notes.join(" ") : undefined,
    );
    const section = createSectionBlock({
      columns: "1",
      children: [
        blocksInContainer($stripe, $, ctx, columnRooms(600, "1", ZERO, 1)[0]),
      ],
      styles: { padding: { ...ZERO } },
      ...(paint.wrapperColor
        ? { wrapper: { backgroundColor: paint.wrapperColor } }
        : {}),
    });
    return withBackground(section, paint.backgroundColor);
  });
}
