import { createSocialIconsBlock, generateId } from "@templatical/types";
import type {
  BlockStyles,
  SocialIcon,
  SocialIconSize,
  SocialIconStyle,
  SocialPlatform,
} from "@templatical/types";
import {
  attr,
  parseAlignment,
  parseColor,
  parsePadding,
  parsePxValue,
} from "./attribute-parser";
import type { Converted, MapContext } from "./block-mapper";
import type { TopolNode } from "./types";

/**
 * Exhaustive over `SocialPlatform` on purpose: adding a member to that union
 * without adding it here is a compile error, so this cannot silently fall back
 * to "website" for a platform the block model gained.
 */
const KNOWN_PLATFORMS: Record<SocialPlatform, true> = {
  facebook: true,
  twitter: true,
  instagram: true,
  linkedin: true,
  youtube: true,
  tiktok: true,
  pinterest: true,
  email: true,
  whatsapp: true,
  telegram: true,
  discord: true,
  snapchat: true,
  reddit: true,
  github: true,
  dribbble: true,
  behance: true,
  website: true,
};

const ALIASES: Record<string, SocialPlatform> = {
  x: "twitter",
  "x-twitter": "twitter",
};

const ICON_SIZES: Array<[number, SocialIconSize]> = [
  [24, "small"],
  [32, "medium"],
  [48, "large"],
];

const KNOWN_STYLES = new Set<string>([
  "solid",
  "outlined",
  "rounded",
  "square",
  "circle",
]);

// Topol ships icon sets whose folder name is not a Templatical style name.
// `outlinedbw` is the outlined set in black and white; Templatical has no
// monochrome variant, so `outlined` is the closest true answer — mapping it to
// the `solid` fallback instead would import an outlined icon set as filled.
// Measured: both `/social-icos/outlined/` and `/social-icos/outlinedbw/` appear
// across the reference exports.
const STYLE_ALIASES: Record<string, SocialIconStyle> = {
  outlinedbw: "outlined",
};

function normalizePlatform(raw: string): SocialPlatform | null {
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned) return null;
  if (ALIASES[cleaned]) return ALIASES[cleaned];
  return cleaned in KNOWN_PLATFORMS ? (cleaned as SocialPlatform) : null;
}

function nearestSize(px: number): { size: SocialIconSize; exact: boolean } {
  let best = ICON_SIZES[1];
  let gap = Infinity;
  for (const candidate of ICON_SIZES) {
    const d = Math.abs(candidate[0] - px);
    if (d < gap) {
      gap = d;
      best = candidate;
    }
  }
  return { size: best[1], exact: gap === 0 };
}

/** The style segment of `https://…/social-icos/<style>/`, when it names one. */
function styleFromBaseUrl(
  baseUrl: string | undefined,
): SocialIconStyle | undefined {
  if (!baseUrl) return undefined;
  const segment = baseUrl.split("?")[0].split("/").filter(Boolean).at(-1) ?? "";
  if (KNOWN_STYLES.has(segment)) return segment as SocialIconStyle;
  return STYLE_ALIASES[segment];
}

/**
 * The padding/background-color chrome every leaf block carries, read the same
 * way `block-mapper.ts`'s leaf converters read it: a social block can set its
 * own `padding` and `background-color` on the node like any other leaf, and
 * either one is omitted from `styles` only when the node doesn't set it.
 */
function socialStyles(node: TopolNode): { styles: BlockStyles } {
  const backgroundColor = parseColor(attr(node, "background-color"));
  return {
    styles: {
      padding: parsePadding(node),
      ...(backgroundColor ? { backgroundColor } : {}),
    },
  };
}

/**
 * Convert Topol's MJML v3 social block.
 *
 * `display` decides which icons render and in what order; a platform with
 * `*-href` set but absent from `display` was not shown in the email and is
 * not imported.
 */
export function convertSocial(
  node: TopolNode,
  _ctx: MapContext,
): Converted | null {
  const display = attr(node, "display");
  if (!display) return null;

  const notes: string[] = [];
  const icons: SocialIcon[] = [];

  for (const token of display.trim().split(/\s+/)) {
    const rawName = token.split(":")[0];
    if (!rawName) continue;

    const url = attr(node, `${rawName}-href`);
    if (!url) continue;

    const platform = normalizePlatform(rawName);
    if (!platform) {
      notes.push(
        `Unrecognised social platform "${rawName}" mapped to "website".`,
      );
    }

    icons.push({ id: generateId(), platform: platform ?? "website", url });
  }

  if (icons.length === 0) return null;

  const iconStyle = styleFromBaseUrl(attr(node, "base-url"));

  const declaredSize = attr(node, "icon-size");
  let iconSize: SocialIconSize | undefined;
  if (declaredSize !== undefined) {
    const px = parsePxValue(declaredSize);
    const resolved = nearestSize(px);
    iconSize = resolved.size;
    if (!resolved.exact) {
      notes.push(
        `Icon size ${declaredSize} is not one of 24/32/48px; resolved to "${resolved.size}".`,
      );
    }
  }

  return {
    block: createSocialIconsBlock({
      icons,
      align: parseAlignment(attr(node, "align"), "center"),
      ...(iconSize ? { iconSize } : {}),
      ...(iconStyle ? { iconStyle } : {}),
      ...socialStyles(node),
    }),
    entry: {
      sourceTag: "mj-social",
      templaticalBlockType: "social",
      status: notes.length > 0 ? "approximated" : "converted",
      ...(notes.length > 0 ? { note: notes.join(" ") } : {}),
    },
  };
}
