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
 * XML mode preserves source case (htmlparser2 only lowercases when xmlMode is
 * off), so every tag comparison in this package must go through here — a bare
 * `$("mj-body")` misses a document that shouts its tags.
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
 * An element's element children, with text and comment nodes dropped.
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
  const cascade: AttributeCascade = { all: {}, byTag: {}, byClass: {} };

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

  const resolved: Attrs = {
    ...cascade.all,
    ...(cascade.byTag[tag] ?? {}),
  };

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

const HIDE_DESKTOP = "tpl-hide-desktop";
const HIDE_MOBILE = "tpl-hide-mobile";

function cssClasses(attrs: Attrs): string[] {
  return (attrs["css-class"] ?? "").trim().split(/\s+/).filter(Boolean);
}

/**
 * Reverse of the renderer's `getCssClassAttr`
 * (`packages/renderer/src/visibility.ts`), which is the only block-level marker
 * the renderer emits.
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
 * Classes on `css-class` that carry no Templatical meaning. The caller warns
 * about these rather than dropping them silently: they are consumer CSS with no
 * home in the block model, and a template that relies on them will render
 * differently after import.
 */
export function readForeignCssClasses(attrs: Attrs): string[] {
  return cssClasses(attrs).filter(
    (name) => name !== HIDE_DESKTOP && name !== HIDE_MOBILE,
  );
}
