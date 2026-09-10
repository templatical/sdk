import { load, type Cheerio, type CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import { createHtmlBlock, createSectionBlock } from "@templatical/types";
import type { Block, ColumnLayout } from "@templatical/types";
import { isHidden, tokenStartingWith, topLevelWithToken } from "./classes";
import { colorFromPaint } from "./css";
import { pushEntry, type ConvertCtx } from "./fragment";
import {
  buttonFrom,
  labelledInnerBlocks,
  menuFrom,
  socialFrom,
  spacerFrom,
} from "./labelled";

function columnLayout(count: number, ctx: ConvertCtx): ColumnLayout {
  if (count <= 1) return "1";
  if (count === 2) return "2";
  if (count === 3) return "3";
  pushEntry(
    ctx,
    "esd-structure",
    "section",
    "approximated",
    `Row with ${count} columns was flattened to a single column. Templatical supports up to 3 columns per section.`,
  );
  ctx.warnings.push(
    `Row with ${count} columns was flattened to a single column. Templatical supports up to 3 columns per section.`,
  );
  return "1";
}

function esdBlockKind($el: Cheerio<Element>): string | undefined {
  const token = tokenStartingWith($el, "esd-block-");
  return token ? token.slice("esd-block-".length) : undefined;
}

function convertEsdBlock(
  $el: Cheerio<Element>,
  $: CheerioAPI,
  ctx: ConvertCtx,
): Block[] {
  const kind = esdBlockKind($el);
  if (!kind) return labelledInnerBlocks($el, $, ctx);
  if (kind === "button") return [buttonFrom($el, "esd-block-button", ctx)];
  if (kind === "spacer") return [spacerFrom($el, "esd-block-spacer", ctx)];
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
    out.push(...convertEsdBlock($el, $, ctx));
  });
  if (out.length === 0) return labelledInnerBlocks($frame, $, ctx);
  return out;
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

  const count = frames.length || 1;
  const layout = columnLayout(count, ctx);
  let children: Block[][];
  if (layout === "1") {
    const merged: Block[] = [];
    if (frames.length === 0)
      merged.push(...blocksInContainer($structure, $, ctx));
    else for (const $f of frames) merged.push(...blocksInContainer($f, $, ctx));
    children = [merged];
  } else {
    children = frames.map(($f) => blocksInContainer($f, $, ctx));
  }
  if (layout !== "1" || frames.length <= 3) {
    pushEntry(ctx, "esd-structure", "section", "converted");
  }
  const backgroundColor = colorFromPaint(
    $structure.attr("style"),
    $structure.attr("bgcolor"),
  );
  return createSectionBlock({
    columns: layout,
    children,
    ...(backgroundColor ? { styles: { backgroundColor } } : {}),
  });
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
    pushEntry(ctx, "esd-stripe", "section", "converted");
    const backgroundColor = colorFromPaint(
      $stripe.attr("style"),
      $stripe.attr("bgcolor"),
    );
    return createSectionBlock({
      columns: "1",
      children: [blocksInContainer($stripe, $, ctx)],
      ...(backgroundColor ? { styles: { backgroundColor } } : {}),
    });
  });
}
