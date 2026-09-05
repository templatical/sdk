import type { Cheerio, CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import { createHtmlBlock } from "@templatical/types";
import type { Block, BlockStyles, BlockVisibility } from "@templatical/types";
import { parseColor, parsePaddingShorthand } from "./attribute-parser";
import {
  readForeignCssClasses,
  readVisibility,
  type Attrs,
  type AttributeCascade,
} from "./attribute-resolver";
import type { ImportReportEntry } from "./types";

/**
 * Everything a converter needs beyond the element itself.
 *
 * `containerWidth` is the width the element renders at — a section's column
 * width, or `settings.width` at top level. It is what lets an `mj-image` whose
 * px width equals its container restore `width: "full"` (§8.3b).
 */
export interface ConvertContext {
  $: CheerioAPI;
  cascade: AttributeCascade;
  containerWidth: number;
  warnings: string[];
}

/** A produced block plus its report entry. `block` is null only when skipped. */
export interface Converted {
  block: Block | null;
  entry: ImportReportEntry;
}

/**
 * The `styles` and `visibility` every block shares.
 *
 * `placement` mirrors the renderer's own `BgPlacement` split
 * (`packages/renderer/src/utils.ts`): `mj-section` is the one "native"
 * element, whose own `background-color` attribute *is* `styles.backgroundColor`
 * (`renderers/section.ts:32`). Every other block type emits
 * `container-background-color` for that same field, because a plain
 * `background-color` on those tags already means something else of the
 * element's own — a button's fill (`renderers/button.ts:43`), for one — and
 * reading it back as the block's container background would invent a fill
 * the source never had. Defaulting to `"container"` matches every caller but
 * `buildSection`.
 *
 * `visibility` is spread conditionally so an unset block carries no key — the
 * block model treats absence as "visible everywhere".
 */
export function baseFields(
  attrs: Attrs,
  placement: "container" | "native" = "container",
): {
  styles: BlockStyles;
  visibility?: BlockVisibility;
} {
  const bgKey =
    placement === "native" ? "background-color" : "container-background-color";
  const backgroundColor = parseColor(attrs[bgKey]);
  const visibility = readVisibility(attrs);

  return {
    styles: {
      padding: parsePaddingShorthand(attrs.padding),
      ...(backgroundColor ? { backgroundColor } : {}),
    },
    ...(visibility ? { visibility } : {}),
  };
}

export function warnForeignClasses(
  attrs: Attrs,
  tag: string,
  ctx: ConvertContext,
): void {
  for (const name of readForeignCssClasses(attrs)) {
    ctx.warnings.push(
      `Dropped CSS class "${name}" on <${tag}> — consumer CSS has no Templatical equivalent.`,
    );
  }
}

export function isNewTab(attrs: Attrs): boolean {
  return (attrs.target ?? "").trim().toLowerCase() === "_blank";
}

/**
 * Wrap the element's own markup in an HTML block — the lossless fallback.
 */
export function convertHtmlFallback(
  $el: Cheerio<Element>,
  ctx: ConvertContext,
  attrs: Attrs,
): Block {
  const outer = ctx.$.html($el) ?? "";
  return createHtmlBlock({ content: outer, ...baseFields(attrs) });
}
