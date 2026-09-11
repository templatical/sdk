import type { Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode, Element } from "domhandler";
import type { BlockVisibility } from "@templatical/types";

export type Attrs = Record<string, string>;

/**
 * The flattened contents of `mj-head > mj-attributes`, built once per document.
 */
export interface AttributeCascade {
  /** From `<mj-all …>` — applies to every element. */
  all: Attrs;
  /** From `<mj-text …>` etc. — keyed by lowercased tag name. */
  byTag: Record<string, Attrs>;
  /** From `<mj-class name="x" …>` — keyed by class name. */
  byClass: Record<string, Attrs>;
}

/**
 * A node's tag name, lowercased.
 *
 * The parser configuration this package uses (`xmlMode: false`, set in
 * `converter.ts`) already lowercases every tag at parse time, so this call is
 * a no-op on that parser's output. It remains the one place every tag
 * comparison in this package goes through, so a comparison stays correct
 * regardless of the active parser configuration — a bare `$("mj-body")` would
 * otherwise miss a document that shouts its tags.
 */
export function tagOf(node: AnyNode | undefined): string {
  if (!node) return "";
  return (node as Element).tagName?.toLowerCase() ?? "";
}

/**
 * Every element with the given tag name, matched case-insensitively.
 */
export function findByTag($: CheerioAPI, tag: string): Cheerio<Element> {
  const wanted = tag.toLowerCase();
  return $("*").filter(
    (_, el) => tagOf(el) === wanted,
  ) as unknown as Cheerio<Element>;
}

/**
 * An element's element children.
 *
 * `.children()` already excludes text and comment nodes; the tag filter here
 * guards against a node whose `tagName` is undefined, not against either of
 * those.
 */
export function childElements(
  $el: Cheerio<Element>,
  $: CheerioAPI,
): Cheerio<Element>[] {
  return $el
    .children()
    .toArray()
    .filter((node) => tagOf(node) !== "")
    .map((node) => $(node) as unknown as Cheerio<Element>);
}

function attrsOf($el: Cheerio<Element>): Attrs {
  const raw = $el.attr();
  if (!raw) return {};
  const out: Attrs = {};
  for (const [key, value] of Object.entries(raw)) {
    out[key.toLowerCase()] = value;
  }
  return out;
}

/**
 * Read `mj-head > mj-attributes` into the three buckets the cascade resolves
 * against. Called once per document; `resolveAttributes` is then pure lookup.
 */
export function buildAttributeCascade($: CheerioAPI): AttributeCascade {
  // Every bucket is a lookup table keyed by names taken from the imported
  // document, so a class or tag literally named `__proto__` must not be able
  // to reach the bucket's own prototype — `Object.create(null)` means a
  // computed-key write like `cascade.byClass[name] = …` can only ever create
  // an own property, never reassign what the bucket inherits from.
  const cascade: AttributeCascade = {
    all: Object.create(null),
    byTag: Object.create(null),
    byClass: Object.create(null),
  };

  const containers = findByTag($, "mj-attributes").toArray();
  for (const container of containers) {
    const $container = $(container) as unknown as Cheerio<Element>;
    for (const $child of childElements($container, $)) {
      const tag = tagOf($child[0]);
      const attrs = attrsOf($child);

      if (tag === "mj-all") {
        Object.assign(cascade.all, attrs);
        continue;
      }

      if (tag === "mj-class") {
        const { name, ...rest } = attrs;
        if (!name) continue;
        cascade.byClass[name] = { ...(cascade.byClass[name] ?? {}), ...rest };
        continue;
      }

      cascade.byTag[tag] = { ...(cascade.byTag[tag] ?? {}), ...attrs };
    }
  }

  return cascade;
}

/**
 * The first two cascade layers alone — `mj-all` then the per-tag default —
 * with neither a named `mj-class` nor the element's own inline attributes on
 * top. This is the ambient value a tag inherits before the element sets
 * anything of its own, which is what {@link ownAttr} compares against.
 */
function resolveTagDefaults(tag: string, cascade: AttributeCascade): Attrs {
  return {
    ...cascade.all,
    ...(cascade.byTag[tag] ?? {}),
  };
}

/**
 * An element's effective attributes, highest precedence last:
 * `mj-all` → per-tag default → each named `mj-class` → the element's own
 * inline attributes.
 *
 * MJML's built-in component defaults are deliberately not modelled — the block
 * factories in `@templatical/types` supply that floor instead, which keeps this
 * module from becoming a copy of MJML's component table.
 */
export function resolveAttributes(
  $el: Cheerio<Element>,
  cascade: AttributeCascade,
): Attrs {
  const own = attrsOf($el);
  const tag = tagOf($el[0]);

  const resolved: Attrs = resolveTagDefaults(tag, cascade);

  const classNames = (own["mj-class"] ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  for (const name of classNames) {
    Object.assign(resolved, cascade.byClass[name] ?? {});
  }

  Object.assign(resolved, own);
  delete resolved["mj-class"];

  return resolved;
}

/**
 * A resolved attribute value, but only when the element is the reason it has
 * that value — a named `mj-class` counts as the element opting in, but a bare
 * `mj-all`/per-tag cascade default does not.
 *
 * This reverses the renderer's inherit-by-omission convention for `mj-text`'s
 * `color` and `font-family`: `renderers/title.ts`, `table.ts` and `menu.ts`
 * all emit that attribute only when the block sets its own value, otherwise
 * leaving the element to inherit the document default from
 * `<mj-attributes>` (`renderers/title.ts:31`). `resolveAttributes` flattens
 * that default onto every element of the tag regardless, so reading `attrs`
 * directly cannot tell "the block set this" from "the document default
 * reached this element too" — and treating the latter as the former invents
 * a per-block override the source never made.
 *
 * `resolved === ambient` also covers an element that repeats the ambient
 * value on purpose: the two cases render identically, so which one happened
 * is not observable in the output and dropping it costs nothing (the same
 * reasoning as §8.3b's image-width and §8.4b's paragraph-gap defaults).
 */
export function ownAttr(
  attrs: Attrs,
  key: string,
  tag: string,
  cascade: AttributeCascade,
): string | undefined {
  const resolved = attrs[key];
  if (resolved === undefined) return undefined;
  return resolved === resolveTagDefaults(tag, cascade)[key]
    ? undefined
    : resolved;
}

const HIDE_DESKTOP = "tpl-hide-desktop";
const HIDE_MOBILE = "tpl-hide-mobile";

/**
 * Marks a rendered title or paragraph's rich-text spacing — mirrors
 * `RICH_TEXT_CSS_CLASS` in `packages/renderer/src/rich-text.ts`. `title.ts`
 * and `paragraph.ts` are the only two renderers that pass a second argument
 * to `getCssClassAttr`, so every rendered title and paragraph carries this
 * class on `css-class` alongside any visibility markers.
 */
const RICH_TEXT_CSS_CLASS = "tpl-rich-text";

/**
 * Matches the per-block paragraph-gap class the same two renderers append,
 * e.g. `tpl-rich-text-8` (`richTextGapClass` in `rich-text.ts`). The gap
 * accepts a decimal (`tpl-rich-text-8.5`) because `ParagraphBlock.paragraphSpacing`
 * is a plain `number` that a headless caller can set to a fractional value,
 * even though the editor UI clamps it to an integer. Negative gaps are out of
 * scope — the renderer never emits one, so there is nothing here that needs to
 * recognise it.
 *
 * Shared by `readForeignCssClasses` (which classes to exclude) and
 * `readParagraphGap` (which class to decode), so the two can never disagree
 * about what a gap class looks like.
 */
const RICH_TEXT_GAP_CLASS = /^tpl-rich-text-(\d+(?:\.\d+)?)$/;

function cssClasses(attrs: Attrs): string[] {
  return (attrs["css-class"] ?? "").trim().split(/\s+/).filter(Boolean);
}

/**
 * Reverse of the renderer's `getCssClassAttr` (`packages/renderer/src/visibility.ts`).
 * `css-class` also carries the rich-text markers below (`RICH_TEXT_CSS_CLASS`,
 * `RICH_TEXT_GAP_CLASS`) — this function reads only the two visibility
 * classes off it and leaves those alone.
 *
 * Returns `undefined` when neither class is present — absence means visible
 * everywhere, and writing `{ desktop: true, mobile: true }` instead would put a
 * redundant key in every imported block.
 */
export function readVisibility(attrs: Attrs): BlockVisibility | undefined {
  const classes = cssClasses(attrs);
  const hideDesktop = classes.includes(HIDE_DESKTOP);
  const hideMobile = classes.includes(HIDE_MOBILE);

  if (!hideDesktop && !hideMobile) return undefined;

  return { desktop: !hideDesktop, mobile: !hideMobile };
}

/**
 * The paragraph gap encoded on a rendered title or paragraph's `css-class` —
 * reverse of `richTextGapClass` (`packages/renderer/src/rich-text.ts`), e.g.
 * `8` from `tpl-rich-text-8`.
 *
 * Returns `null` when no gap class is present. Callers must not confuse that
 * with a gap of `0`, which is a legitimate value in its own right.
 */
export function readParagraphGap(attrs: Attrs): number | null {
  for (const name of cssClasses(attrs)) {
    const match = RICH_TEXT_GAP_CLASS.exec(name);
    if (match) return parseFloat(match[1]);
  }
  return null;
}

/**
 * Classes on `css-class` that carry no Templatical meaning. The caller warns
 * about these rather than dropping them silently: they are consumer CSS with no
 * home in the block model, and a template that relies on them will render
 * differently after import.
 *
 * Excludes the renderer's own rich-text markers alongside the two visibility
 * classes, so importing a template the renderer itself produced does not
 * report a title or paragraph's own spacing class as foreign. A consumer's
 * own `tpl-`-prefixed class is not one of these markers and is still reported.
 */
export function readForeignCssClasses(attrs: Attrs): string[] {
  return cssClasses(attrs).filter(
    (name) =>
      name !== HIDE_DESKTOP &&
      name !== HIDE_MOBILE &&
      name !== RICH_TEXT_CSS_CLASS &&
      !RICH_TEXT_GAP_CLASS.test(name),
  );
}
