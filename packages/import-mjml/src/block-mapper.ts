import type { Cheerio } from "cheerio";
import type { Element } from "domhandler";
import {
  createButtonBlock,
  createDividerBlock,
  createHtmlBlock,
  createImageBlock,
  createSpacerBlock,
} from "@templatical/types";
import type { Block } from "@templatical/types";
import {
  parseAlignment,
  parseBorderStyle,
  parseColor,
  parsePaddingShorthand,
  parsePxValue,
} from "./attribute-parser";
import { resolveAttributes, tagOf, type Attrs } from "./attribute-resolver";
import {
  baseFields,
  convertHtmlFallback,
  isNewTab,
  warnForeignClasses,
  type ConvertContext,
  type Converted,
} from "./block-base";
import { convertTextElement } from "./text-inference";

/** Tags handled elsewhere but recognised, so they never hit the unknown-tag arm. */
const STRUCTURAL_TAGS = new Set([
  "mjml",
  "mj-head",
  "mj-body",
  "mj-wrapper",
  "mj-section",
  "mj-column",
  "mj-group",
  "mj-attributes",
  "mj-all",
  "mj-class",
  "mj-font",
  "mj-style",
  "mj-title",
  "mj-preview",
  "mj-breakpoint",
  "mj-html-attributes",
  "mj-social-element",
  "mj-navbar-link",
]);

/** Tags with no Templatical equivalent that keep their markup verbatim. */
const NO_EQUIVALENT_TAGS = new Set(["mj-hero", "mj-carousel", "mj-accordion"]);

function convertImage(
  $el: Cheerio<Element>,
  attrs: Attrs,
  ctx: ConvertContext,
): Block | null {
  const src = (attrs.src ?? "").trim();
  if (!src) return null;

  const decorative = (attrs.role ?? "").trim().toLowerCase() === "presentation";
  const pxWidth = parsePxValue(attrs.width);
  const height = parsePxValue(attrs.height);
  const borderRadius = parsePxValue(attrs["border-radius"]);
  const href = (attrs.href ?? "").trim();

  return createImageBlock({
    src,
    alt: decorative ? "" : (attrs.alt ?? ""),
    // A px width equal to the container is how `width: "full"` renders
    // (renderer/src/renderers/image.ts), so restore the flag rather than
    // freezing the number — otherwise a full-width image stops resizing with
    // the template.
    width: pxWidth === ctx.containerWidth ? "full" : pxWidth || "full",
    align: parseAlignment(attrs.align, "center"),
    ...(height > 0 ? { height } : {}),
    ...(borderRadius > 0 ? { borderRadius } : {}),
    ...(href ? { linkUrl: href } : {}),
    ...(href && isNewTab(attrs) ? { linkOpenInNewTab: true } : {}),
    ...(decorative ? { decorative: true } : {}),
    ...baseFields(attrs),
  });
}

function convertButton($el: Cheerio<Element>, attrs: Attrs): Block | null {
  const text = ($el.text() ?? "").trim();
  if (!text) return null;

  const backgroundColor = parseColor(attrs["background-color"]);
  const textColor = parseColor(attrs.color);
  const fontSize = parsePxValue(attrs["font-size"]);

  return createButtonBlock({
    text,
    url: (attrs.href ?? "").trim(),
    ...(backgroundColor ? { backgroundColor } : {}),
    ...(textColor ? { textColor } : {}),
    ...(fontSize > 0 ? { fontSize } : {}),
    ...(attrs["border-radius"] !== undefined
      ? { borderRadius: parsePxValue(attrs["border-radius"]) }
      : {}),
    ...(attrs["inner-padding"] !== undefined
      ? { buttonPadding: parsePaddingShorthand(attrs["inner-padding"]) }
      : {}),
    align: parseAlignment(attrs.align, "center"),
    ...(isNewTab(attrs) ? { openInNewTab: true } : {}),
    ...baseFields(attrs),
  });
}

function convertDivider(attrs: Attrs): Block {
  const color = parseColor(attrs["border-color"]);
  const thickness = parsePxValue(attrs["border-width"]);

  return createDividerBlock({
    lineStyle: parseBorderStyle(attrs["border-style"]),
    ...(color ? { color } : {}),
    ...(attrs["border-width"] !== undefined ? { thickness } : {}),
    ...baseFields(attrs),
  });
}

function convertSpacer(attrs: Attrs): Block {
  const height = parsePxValue(attrs.height);

  return createSpacerBlock({
    ...(attrs.height !== undefined ? { height } : {}),
    ...baseFields(attrs),
  });
}

/**
 * Convert one MJML element to a Templatical block.
 *
 * Returns `null` for an element that produces nothing *and* warrants no report
 * entry — an image with no `src`, a button with no label. A `Converted` whose
 * `block` is null is a *skip*, which does get an entry.
 */
export function convertElement(
  $el: Cheerio<Element>,
  ctx: ConvertContext,
): Converted | null {
  const tag = tagOf($el[0]);
  if (!tag) return null;

  const attrs = resolveAttributes($el, ctx.cascade);
  warnForeignClasses(attrs, tag, ctx);

  if (tag === "mj-include") {
    const path = (attrs.path ?? "").trim();
    return {
      block: null,
      entry: {
        sourceTag: tag,
        templaticalBlockType: null,
        status: "skipped",
        note: `Cannot resolve <mj-include path="${path}"> — the importer reads a single string and has no filesystem access. Inline the include before importing.`,
      },
    };
  }

  if (tag === "mj-text") {
    return convertTextElement($el, attrs, ctx);
  }

  if (tag === "mj-image") {
    const block = convertImage($el, attrs, ctx);
    if (!block) return null;
    return {
      block,
      entry: {
        sourceTag: tag,
        templaticalBlockType: "image",
        status: "converted",
      },
    };
  }

  if (tag === "mj-button") {
    const block = convertButton($el, attrs);
    if (!block) return null;
    return {
      block,
      entry: {
        sourceTag: tag,
        templaticalBlockType: "button",
        status: "converted",
      },
    };
  }

  if (tag === "mj-divider") {
    return {
      block: convertDivider(attrs),
      entry: {
        sourceTag: tag,
        templaticalBlockType: "divider",
        status: "converted",
      },
    };
  }

  if (tag === "mj-spacer") {
    return {
      block: convertSpacer(attrs),
      entry: {
        sourceTag: tag,
        templaticalBlockType: "spacer",
        status: "converted",
      },
    };
  }

  if (tag === "mj-raw") {
    return {
      block: createHtmlBlock({
        content: $el.html() ?? "",
        ...baseFields(attrs),
      }),
      entry: {
        sourceTag: tag,
        templaticalBlockType: "html",
        status: "converted",
      },
    };
  }

  if (NO_EQUIVALENT_TAGS.has(tag)) {
    return {
      block: convertHtmlFallback($el, ctx, attrs),
      entry: {
        sourceTag: tag,
        templaticalBlockType: "html",
        status: "html-fallback",
        note: `<${tag}> has no Templatical block equivalent; the original markup is preserved.`,
      },
    };
  }

  if (STRUCTURAL_TAGS.has(tag)) return null;

  return {
    block: convertHtmlFallback($el, ctx, attrs),
    entry: {
      sourceTag: tag,
      templaticalBlockType: "html",
      status: "html-fallback",
      note: `<${tag}> is not a known MJML element (a custom component?); the original markup is preserved.`,
    },
  };
}
