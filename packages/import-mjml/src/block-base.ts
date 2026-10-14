import type { Cheerio, CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import { BORDER_SIDES, createHtmlBlock } from "@templatical/types";
import type {
  Block,
  BlockStyles,
  BlockVisibility,
  BorderRadiusValue,
  BorderSide,
  BorderSideValue,
  BorderValue,
  ContentDirection,
} from "@templatical/types";
import {
  parseBorderDeclaration,
  parseBorderRadius,
  parseColor,
  parsePaddingShorthand,
} from "./attribute-parser";
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
 * px width equals its container restore `width: "full"` (§8.3b), and what an
 * `mj-divider`'s px width is measured against, less `columnPadding` and the
 * divider's own side padding.
 *
 * `columnPadding` is the side padding (left plus right, px) of the
 * `mj-column` holding the element, 0 at top level. A Templatical column has no
 * padding of its own, so this is read only where it changes what a value
 * means: the width an `mj-divider` line can span.
 *
 * `direction` is the writing direction the imported template resolves to. Its
 * start edge is where a paragraph sits when its markup states no alignment,
 * so an `mj-text` aligned to that edge needs none.
 */
export interface ConvertContext {
  $: CheerioAPI;
  cascade: AttributeCascade;
  containerWidth: number;
  columnPadding: number;
  direction: ContentDirection;
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

/**
 * `border-radius` as a `BorderRadiusValue`, `undefined` when the attribute is
 * absent. A value with no px reading is square corners, `0`, and pushes a
 * note: `label` names the element in it.
 */
export function readBorderRadius(
  attrs: Attrs,
  label: string,
  notes: string[],
): BorderRadiusValue | undefined {
  const raw = attrs["border-radius"];
  if (raw === undefined) return undefined;

  const radius = parseBorderRadius(raw);
  if (radius === null) {
    notes.push(
      `${label} border-radius "${raw.trim()}" could not be read; imported as square corners.`,
    );
    return 0;
  }
  return radius;
}

/**
 * What the editor's border control holds for a side with no width
 * (`BorderControl.vue`), so a border drawn on some sides reads back the way
 * the editor would have stored it.
 */
const UNDRAWN_SIDE: BorderSideValue = {
  width: 0,
  style: "solid",
  color: "#000000",
};

/**
 * `border` and `border-<side>` as a `BorderValue`, `undefined` when no side is
 * drawn. A side takes its own `border-<side>` over `border`, since MJML writes
 * the side after the shorthand. A declaration that a side actually uses pushes
 * a note when its style narrows to solid or it cannot be read, in which case
 * that side is left undrawn.
 */
export function readBorder(
  attrs: Attrs,
  label: string,
  notes: string[],
): BorderValue | undefined {
  const read = new Map<string, BorderSideValue | null>();
  const sides = {} as Record<BorderSide, BorderSideValue | null>;

  for (const side of BORDER_SIDES) {
    const name =
      attrs[`border-${side}`] !== undefined
        ? `border-${side}`
        : attrs.border !== undefined
          ? "border"
          : null;
    if (name === null) {
      sides[side] = null;
      continue;
    }

    if (!read.has(name)) {
      const raw = attrs[name]!.trim();
      const parsed = parseBorderDeclaration(raw);
      if (parsed === null) {
        notes.push(
          `${label} ${name} "${raw}" could not be read; imported without it.`,
        );
      } else if (parsed.narrowedFrom) {
        notes.push(
          `${label} ${name} "${raw}" uses style ${parsed.narrowedFrom}; imported as solid.`,
        );
      }
      read.set(name, parsed?.side ?? null);
    }
    const parsed = read.get(name)!;
    sides[side] = parsed && { ...parsed };
  }

  if (BORDER_SIDES.every((side) => sides[side] === null)) return undefined;

  return {
    top: sides.top ?? { ...UNDRAWN_SIDE },
    right: sides.right ?? { ...UNDRAWN_SIDE },
    bottom: sides.bottom ?? { ...UNDRAWN_SIDE },
    left: sides.left ?? { ...UNDRAWN_SIDE },
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
