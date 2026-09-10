import { load, type Cheerio, type CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import { createSectionBlock } from "@templatical/types";
import type { Block, ColumnLayout } from "@templatical/types";
import { hasAnyToken, hasToken, isHidden } from "./classes";
import { blocksFromHtml, pushEntry, type ConvertCtx } from "./fragment";
import { buttonFrom, menuFrom, socialFrom, spacerFrom } from "./labelled";

const STRIPE_TOKENS = ["es-header", "es-content", "es-footer"] as const;

function stripeToken($el: Cheerio<Element>): string | undefined {
  return STRIPE_TOKENS.find((t) => hasToken($el, t));
}

function topStripes($: CheerioAPI): Cheerio<Element>[] {
  const out: Cheerio<Element>[] = [];
  $("[class]").each((_, node) => {
    const $el = $(node) as Cheerio<Element>;
    const token = stripeToken($el);
    if (!token) return;
    const nested = $el
      .parents()
      .toArray()
      .some((p) => hasAnyToken($(p) as Cheerio<Element>, STRIPE_TOKENS));
    if (nested) return;
    out.push($el);
  });
  return out;
}

function floatedColumns(
  $stripe: Cheerio<Element>,
  $: CheerioAPI,
): Cheerio<Element>[] {
  const out: Cheerio<Element>[] = [];
  $stripe.find("[class~='es-left'], [class~='es-right']").each((_, node) => {
    const $el = $(node) as Cheerio<Element>;
    if (isHidden($el)) return;
    const nested = $el
      .parents("[class~='es-left'], [class~='es-right']")
      .filter((_, p) => {
        return $stripe.find(p).length > 0 || $(p).closest($stripe).length > 0;
      });
    if (nested.length > 0) return;
    const inOtherStripe = $el
      .parents()
      .toArray()
      .some((p) => {
        if (p === $stripe[0]) return false;
        return hasAnyToken($(p) as Cheerio<Element>, STRIPE_TOKENS);
      });
    if (inOtherStripe) return;
    out.push($el);
  });
  return out;
}

function columnLayout(
  count: number,
  ctx: ConvertCtx,
  sourceTag: string,
): {
  layout: ColumnLayout;
  flattenExtra: boolean;
} {
  if (count <= 1) return { layout: "1", flattenExtra: false };
  if (count === 2) return { layout: "2", flattenExtra: false };
  if (count === 3) return { layout: "3", flattenExtra: false };
  pushEntry(
    ctx,
    sourceTag,
    "section",
    "approximated",
    `Row with ${count} columns was flattened; extra columns merged into the third slot. Templatical supports up to 3 columns per section.`,
  );
  ctx.warnings.push(
    `Row with ${count} columns was flattened; extra columns merged into the third slot. Templatical supports up to 3 columns per section.`,
  );
  return { layout: "3", flattenExtra: true };
}

function convertSubtree(
  $el: Cheerio<Element>,
  $: CheerioAPI,
  ctx: ConvertCtx,
): Block[] {
  const $clone = $el.clone();
  const replacements: Block[][] = [];

  const take = ($node: Cheerio<Element>, block: Block | null) => {
    if (!block) return;
    const marker = `stripo-keep-${replacements.length}`;
    replacements.push([block]);
    $node.replaceWith(`<div data-stripo-keep="${marker}"></div>`);
  };

  $clone.find("table.es-menu, [class~='es-menu']").each((_, node) => {
    const $n = $(node) as Cheerio<Element>;
    if (!$n.is("table") && $n.find("table").length) return;
    const menu = menuFrom($n, $, "es-menu", ctx);
    take($n, menu);
  });
  $clone.find("[class~='es-social']").each((_, node) => {
    const $n = $(node) as Cheerio<Element>;
    take($n, socialFrom($n, $, "es-social", ctx));
  });
  $clone.find("a.es-button, [class~='es-button']").each((_, node) => {
    const $n = $(node) as Cheerio<Element>;
    if (!$n.is("a") && $n.find("a").length === 0) return;
    take($n, buttonFrom($n, "es-button", ctx));
  });
  $clone.find("[class~='es-spacer']").each((_, node) => {
    const $n = $(node) as Cheerio<Element>;
    take($n, spacerFrom($n, "es-spacer", ctx));
  });

  const html = $.html($clone) ?? "";
  const generic = blocksFromHtml(html, ctx);
  const out: Block[] = [];
  const used = new Set<number>();
  const walk = (blocks: Block[]) => {
    for (const b of blocks) {
      if (
        b.type === "html" &&
        /data-stripo-keep="stripo-keep-(\d+)"/.test(b.content)
      ) {
        const m = /data-stripo-keep="stripo-keep-(\d+)"/.exec(b.content);
        const i = m ? Number(m[1]) : -1;
        if (i >= 0 && replacements[i] && !used.has(i)) {
          used.add(i);
          out.push(...replacements[i]);
          continue;
        }
      }
      if (b.type === "paragraph" && /stripo-keep-/.test(b.content ?? "")) {
        const m = /stripo-keep-(\d+)/.exec(b.content);
        const i = m ? Number(m[1]) : -1;
        if (i >= 0 && replacements[i] && !used.has(i)) {
          used.add(i);
          out.push(...replacements[i]);
          continue;
        }
      }
      out.push(b);
    }
  };
  walk(generic);
  for (let i = 0; i < replacements.length; i++) {
    if (!used.has(i)) out.push(...replacements[i]);
  }
  return out;
}

export function convertCompiled(html: string, ctx: ConvertCtx): Block[] {
  const $ = load(html);
  const stripes = topStripes($);
  if (stripes.length === 0) {
    return convertSubtree($.root() as unknown as Cheerio<Element>, $, ctx);
  }
  return stripes.map(($stripe) => {
    const token = stripeToken($stripe) ?? "es-content";
    const cols = floatedColumns($stripe, $);
    const { layout, flattenExtra } = columnLayout(cols.length || 1, ctx, token);
    let children: Block[][];
    if (cols.length <= 1) {
      children = [convertSubtree($stripe, $, ctx)];
    } else if (flattenExtra) {
      const slots = cols.slice(0, 2).map(($c) => convertSubtree($c, $, ctx));
      const rest: Block[] = [];
      for (const $c of cols.slice(2)) rest.push(...convertSubtree($c, $, ctx));
      slots.push(rest);
      children = slots;
    } else {
      children = cols.map(($c) => convertSubtree($c, $, ctx));
    }
    if (!flattenExtra) pushEntry(ctx, token, "section", "converted");
    return createSectionBlock({ columns: layout, children });
  });
}
