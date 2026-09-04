import type { CheerioAPI } from "cheerio";
import { DEFAULT_TEMPLATE_DEFAULTS } from "@templatical/types";
import type { TemplateContent, TemplateSettings } from "@templatical/types";
import { parseColor, parseFontFamily, parsePxValue } from "./attribute-parser";
import {
  childElements,
  findByTag,
  tagOf,
  type AttributeCascade,
} from "./attribute-resolver";

/** `mj-head` children this module reads; anything else is warned about. */
const CONSUMED_HEAD_TAGS = new Set([
  "mj-attributes",
  "mj-preview",
  "mj-font",
  "mj-style",
  "mj-title",
]);

/**
 * `DEFAULT_TEMPLATE_DEFAULTS` is typed `Partial<TemplateSettings>` so a
 * consumer can override any subset of it, but its own literal (see
 * `packages/types/src/defaults.ts`) always sets exactly the six required
 * `TemplateSettings` fields — `linkColor` and `preheaderText` are the two
 * optional ones and are correctly absent from it. Narrowing the type once
 * here, rather than at every read below, is what lets `width`, `fontFamily`
 * and the rest come out as `number`/`string`/`boolean` instead of `| undefined`.
 */
const REQUIRED_TEMPLATE_DEFAULTS = DEFAULT_TEMPLATE_DEFAULTS as Required<
  Pick<
    TemplateSettings,
    | "width"
    | "backgroundColor"
    | "textColor"
    | "linkUnderline"
    | "fontFamily"
    | "locale"
  >
>;

interface AnchorRule {
  color?: string;
  underline?: boolean;
}

/**
 * Read the `a { … }` declarations out of the concatenated `mj-style` blocks.
 *
 * This is the reverse of how the renderer emits `settings.linkColor` and
 * `settings.linkUnderline` — as a global anchor rule — so a template that
 * round-trips keeps both. A stylesheet with no anchor rule leaves both unset.
 */
function readAnchorRule(css: string): AnchorRule {
  const rule: AnchorRule = {};

  for (const match of css.matchAll(/(^|[},])\s*a\s*\{([^}]*)\}/g)) {
    const body = match[2];

    const color = body.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
    if (color) {
      const parsed = parseColor(color[1]);
      if (parsed) rule.color = parsed;
    }

    const decoration = body.match(/(?:^|;)\s*text-decoration\s*:\s*([^;]+)/i);
    if (decoration) {
      rule.underline = decoration[1].trim().toLowerCase().includes("underline");
    }
  }

  return rule;
}

/**
 * Build `TemplateSettings` from `mj-body`'s attributes, the attribute cascade
 * and the remaining `mj-head` children.
 *
 * Optional keys (`preheaderText`, `linkColor`) are **omitted** rather than set
 * to `undefined`: an absent key is what the block model means by unset, and a
 * present-but-undefined key serialises into exported JSON.
 */
export function extractSettings(
  $: CheerioAPI,
  cascade: AttributeCascade,
  warnings: string[],
): TemplateContent["settings"] {
  const $body = findByTag($, "mj-body").first();
  const $root = findByTag($, "mjml").first();

  const width =
    parsePxValue($body.attr("width")) || REQUIRED_TEMPLATE_DEFAULTS.width;
  const backgroundColor =
    parseColor($body.attr("background-color")) ||
    REQUIRED_TEMPLATE_DEFAULTS.backgroundColor;

  const fontFromCascade =
    parseFontFamily(cascade.all["font-family"]) ||
    parseFontFamily(cascade.byTag["mj-text"]?.["font-family"]);
  const fontFromDeclaration =
    findByTag($, "mj-font").first().attr("name") ?? "";
  const fontFamily =
    fontFromCascade ||
    fontFromDeclaration ||
    REQUIRED_TEMPLATE_DEFAULTS.fontFamily;

  const textColor =
    parseColor(cascade.byTag["mj-text"]?.color) ||
    REQUIRED_TEMPLATE_DEFAULTS.textColor;

  const previewText = findByTag($, "mj-preview").first().text().trim();

  const styleCss = findByTag($, "mj-style")
    .toArray()
    .map((el) => $(el).text())
    .join("\n");
  const anchor = readAnchorRule(styleCss);

  const locale =
    ($root.attr("lang") ?? "").trim() || REQUIRED_TEMPLATE_DEFAULTS.locale;

  const title = findByTag($, "mj-title").first().text().trim();
  if (title) {
    warnings.push(
      `Dropped <mj-title> ("${title}") — Templatical templates have no document-title field.`,
    );
  }

  const $head = findByTag($, "mj-head").first();
  if ($head.length > 0) {
    for (const $child of childElements($head, $)) {
      const tag = tagOf($child[0]);
      if (!CONSUMED_HEAD_TAGS.has(tag)) {
        warnings.push(`Dropped <${tag}> — it has no Templatical equivalent.`);
      }
    }
  }

  return {
    width,
    backgroundColor,
    textColor,
    linkUnderline: anchor.underline ?? REQUIRED_TEMPLATE_DEFAULTS.linkUnderline,
    fontFamily,
    locale,
    ...(anchor.color ? { linkColor: anchor.color } : {}),
    ...(previewText ? { preheaderText: previewText } : {}),
  };
}
