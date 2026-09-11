import type { Cheerio, CheerioAPI } from "cheerio";
import type { Element } from "domhandler";

export function classTokens($el: Cheerio<Element>): string[] {
  return ($el.attr("class") ?? "").trim().split(/\s+/).filter(Boolean);
}

export function hasToken($el: Cheerio<Element>, token: string): boolean {
  return classTokens($el).includes(token);
}

export function hasAnyToken(
  $el: Cheerio<Element>,
  tokens: readonly string[],
): boolean {
  const set = new Set(classTokens($el));
  return tokens.some((t) => set.has(t));
}

export function tokenStartingWith(
  $el: Cheerio<Element>,
  prefix: string,
): string | undefined {
  return classTokens($el).find((t) => t.startsWith(prefix));
}

/** Elements carrying `token` that are not nested in another such element. */
export function topLevelWithToken(
  $: CheerioAPI,
  token: string,
  $root?: Cheerio<Element>,
): Cheerio<Element>[] {
  const selector = `[class~="${token}"]`;
  const $found = $root ? $root.find(selector) : $(selector);
  const out: Cheerio<Element>[] = [];
  $found.each((_, node) => {
    const $el = $(node) as Cheerio<Element>;
    const nested = $el.parents(selector);
    if ($root && $root.length) {
      const outside = nested.filter((_, p) => {
        const $p = $(p) as Cheerio<Element>;
        return $p.closest($root).length === 0 && !$p.is($root);
      });
      if (nested.length - outside.length > 0) return;
    } else if (nested.length > 0) {
      return;
    }
    out.push($el);
  });
  return out;
}

export function isHidden($el: Cheerio<Element>): boolean {
  return hasToken($el, "es-hidden") || hasToken($el, "esd-hidden");
}
