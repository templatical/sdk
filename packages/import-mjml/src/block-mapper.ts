import type { Cheerio } from "cheerio";
import type { Element } from "domhandler";
import {
  BUTTON_BLOCK_DEFAULTS,
  BUTTON_LINE_HEIGHT,
  canonicalFontStack,
  roundHundredths,
  createButtonBlock,
  createDividerBlock,
  createHtmlBlock,
  createImageBlock,
  createSpacerBlock,
} from "@templatical/types";
import type { Block, ButtonBlock, DividerBlock } from "@templatical/types";
import {
  parseAlignment,
  parseBorderStyle,
  parseColor,
  parsePaddingShorthand,
  parsePxValue,
} from "./attribute-parser";
import {
  ownAttr,
  resolveAttributes,
  tagOf,
  type Attrs,
} from "./attribute-resolver";
import {
  baseFields,
  convertHtmlFallback,
  mjmlHorizontalInset,
  isNewTab,
  readBorder,
  readBorderRadius,
  warnForeignClasses,
  type ConvertContext,
  type Converted,
} from "./block-base";
import {
  convertNativeTable,
  convertNavbar,
  convertSocial,
} from "./composite-mapper";
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
const NO_EQUIVALENT_TAGS = new Set(["mj-carousel", "mj-accordion"]);

function convertImage(
  $el: Cheerio<Element>,
  attrs: Attrs,
  ctx: ConvertContext,
): Converted | null {
  const src = (attrs.src ?? "").trim();
  if (!src) return null;

  const decorative = (attrs.role ?? "").trim().toLowerCase() === "presentation";
  const pxWidth = parsePxValue(attrs.width);
  const height = parsePxValue(attrs.height);
  const href = (attrs.href ?? "").trim();

  const notes: string[] = [];
  const borderRadius = readBorderRadius(attrs, "Image", notes);
  const border = readBorder(attrs, "Image", notes);
  const base = baseFields(attrs);
  // MJML caps an image at `room`, its column less its own side padding and
  // border, so a px width that reaches it renders as `width: "full"` does
  // (the renderer writes "full" as the column's px width). Restore the flag
  // rather than freezing the number, or the image stops resizing with the
  // template.
  const room = Math.floor(ctx.contentWidth) - mjmlHorizontalInset(attrs);
  const width = !pxWidth || pxWidth >= room ? "full" : pxWidth;
  // The renderer makes an image fill its column on phones only when it fills
  // the column on desktop (`fluidOnMobileAttr`); an image set narrower has no
  // field to ask for it.
  if (
    (attrs["fluid-on-mobile"] ?? "").trim().toLowerCase() === "true" &&
    width !== "full"
  ) {
    notes.push(
      `fluid-on-mobile on a ${width}px image narrower than its column has no Templatical equivalent: the image keeps its width on phones instead of filling the column.`,
    );
  }

  return {
    block: createImageBlock({
      src,
      alt: decorative ? "" : (attrs.alt ?? ""),
      width,
      align: parseAlignment(attrs.align, "center"),
      ...(height > 0 ? { height } : {}),
      ...(borderRadius ? { borderRadius } : {}),
      ...(border ? { border } : {}),
      ...(href ? { linkUrl: href } : {}),
      ...(href && isNewTab(attrs) ? { linkOpenInNewTab: true } : {}),
      ...(decorative ? { decorative: true } : {}),
      ...base,
    }),
    entry: {
      sourceTag: "mj-image",
      templaticalBlockType: "image",
      status: notes.length > 0 ? "approximated" : "converted",
      ...(notes.length > 0 ? { note: notes.join(" ") } : {}),
    },
  };
}

/**
 * Two decimals, trailing zeros dropped: `40` is `"40%"`, `33.333` is `"33.33%"`.
 */
function formatButtonPercent(value: number): `${number}%` {
  const share = roundHundredths(value);
  const text = share.toFixed(2).replace(/\.?0+$/, "");
  return `${Number(text)}%`;
}

/**
 * `mj-button`'s `width` as `ButtonBlock.width`, where no width is a button
 * that fits its label. `100%` is `"full"` and a px width stays px, as the
 * renderer writes them. A percentage above 0 and below 100 is that share of
 * the column, which MJML renders natively. The 0 and 100 boundaries are
 * that share rounded to two decimals: above 100 is `"full"` with a clamp
 * note, and 100 is `"full"` with no note. A rounded share of 0 or below
 * fits the label, which is what MJML draws for it. Anything but `100%`, a
 * smaller percentage, or a positive px width pushes a note.
 */
function readButtonWidth(
  value: string | undefined,
  notes: string[],
): ButtonBlock["width"] {
  const raw = (value ?? "").trim();
  if (!raw) return undefined;

  const match = /^(-?\d+(?:\.\d+)?)\s*(px|%)?$/i.exec(raw);
  if (!match) {
    notes.push(
      `Button width "${raw}" could not be read; imported as fit to content.`,
    );
    return undefined;
  }
  const parsed = parseFloat(match[1]);
  const isPercent = match[2]?.toLowerCase() === "%";

  if (isPercent) {
    const share = roundHundredths(parsed);
    if (share > 100) {
      notes.push(`Button width ${raw} was clamped to 100%.`);
      return "full";
    }
    if (share >= 100) return "full";
    if (share <= 0) {
      notes.push(
        `Button width ${raw} has no usable size; imported as fit to content.`,
      );
      return undefined;
    }
    return formatButtonPercent(parsed);
  }

  const px = Math.round(parsed);
  if (px <= 0) {
    notes.push(
      `Button width ${raw} has no usable size; imported as fit to content.`,
    );
    return undefined;
  }
  return px;
}

/**
 * `line-height` as `ButtonBlock.lineHeight`. A percentage is that number over
 * 100, a unitless number is itself, a px length is that many pixels over
 * `fontSize`, and an `em` length is the number itself (`2em` is `2`). A
 * leading dot (`.5`, `.5%`, `.5px`, `.5em`) is read. Rounded to two decimals.
 * `1.2` and a missing value stay unset, so the label keeps
 * `BUTTON_LINE_HEIGHT` and the button stays converted. Any other explicit
 * value that cannot be kept stays unset and pushes a note.
 */
function readButtonLineHeight(
  value: string | undefined,
  fontSize: number,
  notes: string[],
): number | undefined {
  const trimmed = value?.trim() ?? "";
  if (trimmed === "") return undefined;

  const reject = (): undefined => {
    notes.push(
      `Button line-height "${trimmed}" could not be read; imported at 1.2.`,
    );
    return undefined;
  };

  const percent = /^((?:\d+(?:\.\d+)?|\.\d+))\s*%$/.exec(trimmed);
  const unitless = /^((?:\d+(?:\.\d+)?|\.\d+))$/.exec(trimmed);
  const px = /^((?:\d+(?:\.\d+)?|\.\d+))\s*px$/i.exec(trimmed);
  const em = /^((?:\d+(?:\.\d+)?|\.\d+))\s*em$/i.exec(trimmed);
  let ratio: number;
  if (percent) ratio = Number(percent[1]) / 100;
  else if (unitless) ratio = Number(unitless[1]);
  else if (px) ratio = Number(px[1]) / fontSize;
  else if (em) ratio = Number(em[1]);
  else return reject();

  if (!Number.isFinite(ratio) || !(ratio > 0)) return reject();
  const rounded = roundHundredths(ratio);
  if (!(rounded > 0)) return reject();
  if (rounded === BUTTON_LINE_HEIGHT) return undefined;
  return rounded;
}

/**
 * `font-family` is read only when the button sets its own: the renderer
 * writes the document font onto `mj-all`, which reaches every button.
 */
function convertButton(
  $el: Cheerio<Element>,
  attrs: Attrs,
  ctx: ConvertContext,
): Converted | null {
  const text = ($el.text() ?? "").trim();
  if (!text) return null;

  const backgroundColor = parseColor(attrs["background-color"]);
  const textColor = parseColor(attrs.color);
  const parsedFontSize = parsePxValue(attrs["font-size"]);
  // The defaults type marks every field optional. `fontSize` is 15, and
  // `Number` keeps that value a number for the px line-height ratio.
  const fontSize =
    parsedFontSize > 0
      ? parsedFontSize
      : Number(BUTTON_BLOCK_DEFAULTS.fontSize);
  const notes: string[] = [];
  const lineHeight = readButtonLineHeight(
    attrs["line-height"],
    fontSize,
    notes,
  );
  const fontFamily = canonicalFontStack(
    ownAttr(attrs, "font-family", "mj-button", ctx.cascade),
  );
  const base = baseFields(attrs);
  const width = readButtonWidth(attrs.width, notes);
  const borderRadius = readBorderRadius(attrs, "Button", notes);
  const border = readBorder(attrs, "Button", notes);

  return {
    block: createButtonBlock({
      text,
      url: (attrs.href ?? "").trim(),
      ...(backgroundColor ? { backgroundColor } : {}),
      ...(textColor ? { textColor } : {}),
      ...(parsedFontSize > 0 ? { fontSize: parsedFontSize } : {}),
      ...(lineHeight !== undefined ? { lineHeight } : {}),
      ...(fontFamily ? { fontFamily } : {}),
      ...(borderRadius !== undefined ? { borderRadius } : {}),
      ...(border ? { border } : {}),
      ...(attrs["inner-padding"] !== undefined
        ? { buttonPadding: parsePaddingShorthand(attrs["inner-padding"]) }
        : {}),
      ...(width !== undefined ? { width } : {}),
      align: parseAlignment(attrs.align, "center"),
      ...(isNewTab(attrs) ? { openInNewTab: true } : {}),
      ...base,
    }),
    entry: {
      sourceTag: "mj-button",
      templaticalBlockType: "button",
      status: notes.length > 0 ? "approximated" : "converted",
      ...(notes.length > 0 ? { note: notes.join(" ") } : {}),
    },
  };
}

/**
 * `mj-divider`'s `width` as `DividerBlock.width`. A percentage is a share of
 * the column and stays one, to two decimals within 0–100%. `100%`, and a px
 * width that reaches `lineWidth`, span the line's whole box, which is
 * `"full"`. A clamped or unreadable value pushes a note.
 *
 * It reads a sign, which `parsePercent` does not, so a negative value is
 * clamped to 0 and reported instead of being dropped.
 */
function readDividerWidth(
  value: string | undefined,
  lineWidth: number,
  notes: string[],
): DividerBlock["width"] {
  const raw = (value ?? "").trim();
  if (!raw) return "full";

  const match = /^(-?\d+(?:\.\d+)?)\s*(px|%)?$/i.exec(raw);
  if (!match) {
    notes.push(
      `Divider width "${raw}" could not be read; imported as full width.`,
    );
    return "full";
  }
  const parsed = parseFloat(match[1]);

  if (match[2] === "%") {
    const percent = Math.min(100, Math.max(0, parsed));
    if (percent !== parsed) {
      notes.push(`Divider width ${raw} was clamped to ${percent}%.`);
    }
    // Two decimals keep the value inside `DividerPercentWidth`'s pattern,
    // which a float printed in exponent form would leave.
    const share = Math.round(percent * 100) / 100;
    return share === 100 ? "full" : `${share}%`;
  }

  const px = Math.max(0, Math.round(parsed));
  if (px !== Math.round(parsed)) {
    notes.push(`Divider width ${raw} was clamped to 0px.`);
  }
  return px >= lineWidth ? "full" : px;
}

/**
 * `mj-divider` draws `100%` across its column less the column's side padding
 * and its own, so that is the width a px value is measured against. It places
 * a partial-width line by `align`, centred by default; Templatical centres
 * every divider, so a left- or right-aligned partial one comes back with a
 * note.
 */
function convertDivider(attrs: Attrs, ctx: ConvertContext): Converted {
  const color = parseColor(attrs["border-color"]);
  const thickness = parsePxValue(attrs["border-width"]);
  const base = baseFields(attrs);
  const { left, right } = base.styles.padding;

  const notes: string[] = [];
  const width = readDividerWidth(
    attrs.width,
    ctx.containerWidth - ctx.columnPadding - left - right,
    notes,
  );

  const align = (attrs.align ?? "").trim().toLowerCase();
  if (width !== "full" && (align === "left" || align === "right")) {
    notes.push(
      `MJML aligns this divider ${align}; Templatical centres every divider.`,
    );
  }

  return {
    block: createDividerBlock({
      lineStyle: parseBorderStyle(attrs["border-style"]),
      width,
      ...(color ? { color } : {}),
      ...(attrs["border-width"] !== undefined ? { thickness } : {}),
      ...base,
    }),
    entry: {
      sourceTag: "mj-divider",
      templaticalBlockType: "divider",
      status: notes.length > 0 ? "approximated" : "converted",
      ...(notes.length > 0 ? { note: notes.join(" ") } : {}),
    },
  };
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

  if (tag === "mj-social") {
    return convertSocial($el, attrs, ctx);
  }

  if (tag === "mj-navbar") {
    return convertNavbar($el, attrs, ctx);
  }

  if (tag === "mj-table") {
    return convertNativeTable($el, attrs, ctx);
  }

  if (tag === "mj-image") {
    return convertImage($el, attrs, ctx);
  }

  if (tag === "mj-button") {
    return convertButton($el, attrs, ctx);
  }

  if (tag === "mj-divider") {
    return convertDivider(attrs, ctx);
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
