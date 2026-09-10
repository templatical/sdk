import type { Cheerio, CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import {
  createButtonBlock,
  createMenuBlock,
  createSocialIconsBlock,
  createSpacerBlock,
  generateId,
} from "@templatical/types";
import type { Block, MenuItemData, SocialIcon } from "@templatical/types";
import { isHidden } from "./classes";
import { blocksFromHtml, pushEntry, type ConvertCtx } from "./fragment";
import { normalizePlatform } from "./platform";

function firstAnchor($el: Cheerio<Element>): Cheerio<Element> {
  const $self = $el.is("a") ? $el : $el.find("a").first();
  return $self as Cheerio<Element>;
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
  pushEntry(ctx, sourceTag, "button", "converted");
  return createButtonBlock({
    text,
    url,
    ...(target === "_blank" ? { openInNewTab: true } : {}),
  });
}

export function spacerFrom(
  $el: Cheerio<Element>,
  sourceTag: string,
  ctx: ConvertCtx,
): Block {
  const style = $el.attr("style") ?? "";
  const h = /(?:^|;)\s*height\s*:\s*(\d+)px/i.exec(style);
  const attrH = $el.attr("height");
  const height = h ? Number(h[1]) : attrH ? Number(attrH) : 24;
  pushEntry(ctx, sourceTag, "spacer", "converted");
  return createSpacerBlock({
    height: Number.isFinite(height) && height > 0 ? height : 24,
  });
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

export function socialFrom(
  $el: Cheerio<Element>,
  $: CheerioAPI,
  sourceTag: string,
  ctx: ConvertCtx,
): Block {
  const icons: SocialIcon[] = [];
  $el.find("a").each((_, a) => {
    const $a = $(a) as Cheerio<Element>;
    const $img = $a.find("img").first();
    const url = $a.attr("href") ?? "#";
    const platform = normalizePlatform(
      $img.attr("title"),
      $img.attr("src"),
      $img.attr("alt"),
    );
    icons.push({ id: generateId(), platform, url });
  });
  pushEntry(ctx, sourceTag, "social", "converted");
  return createSocialIconsBlock({ icons });
}

export function labelledInnerBlocks(
  $el: Cheerio<Element>,
  $: CheerioAPI,
  ctx: ConvertCtx,
): Block[] {
  return blocksFromHtml($.html($el) ?? "", ctx);
}
