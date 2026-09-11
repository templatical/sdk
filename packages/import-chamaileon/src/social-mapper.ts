import { createSocialIconsBlock, generateId } from "@templatical/types";
import type {
  BlockStyles,
  BlockVisibility,
  SocialIcon,
  SocialIconSize,
  SocialIconStyle,
  SocialPlatform,
} from "@templatical/types";
import { parseAlignment, parsePadding, parsePx } from "./attribute-parser";
import type { Converted, MapContext } from "./block-mapper";
import { readAttrs, readStyle } from "./normalize";
import type {
  ChamaileonNode,
  ConversionStatus,
  ImportReportEntry,
} from "./types";

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

function normalizePlatform(raw: string): SocialPlatform | null {
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned) return null;
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

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asIconStyle(value: unknown): SocialIconStyle | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim().toLowerCase();
  return KNOWN_STYLES.has(v) ? (v as SocialIconStyle) : undefined;
}

/**
 * Convert a Chamaileon `social` leaf into a `SocialIconsBlock`.
 *
 * `attrs.elements` is the source of truth for which icons render and in what
 * order. A row of images is not sniffed as social — only `type === "social"`.
 */
export function convertSocial(
  node: ChamaileonNode,
  ctx: MapContext,
): Converted {
  const style = readStyle(node, ctx.variables, ctx.stats);
  const attrs = readAttrs(node, ctx.variables, ctx.stats);
  const rawElements = attrs.elements;
  const elements = Array.isArray(rawElements) ? rawElements : [];

  if (elements.length === 0) {
    return {
      block: null,
      entry: report("social", null, "skipped", "social has no elements"),
    };
  }

  const notes: string[] = [];
  const icons: SocialIcon[] = [];

  for (const item of elements) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      continue;
    }
    const el = item as Record<string, unknown>;
    const rawType = asString(el.type) ?? "";
    const platform = normalizePlatform(rawType);
    if (!platform) {
      notes.push(
        `Unrecognised social platform "${rawType}" mapped to "website".`,
      );
    }
    icons.push({
      id: generateId(),
      platform: platform ?? "website",
      url: asString(el.link) ?? "",
    });
  }

  if (icons.length === 0) {
    return {
      block: null,
      entry: report("social", null, "skipped", "social has no elements"),
    };
  }

  let iconSize: SocialIconSize | undefined;
  const sizePx = parsePx(attrs.size);
  if (sizePx !== undefined) {
    const resolved = nearestSize(sizePx);
    iconSize = resolved.size;
    if (!resolved.exact) {
      notes.push(
        `Icon size ${attrs.size} is not one of 24/32/48px; resolved to "${resolved.size}".`,
      );
    }
  }

  const iconStyle = asIconStyle(attrs.color) ?? asIconStyle(attrs.iconSet);
  const spacing = parsePx(attrs.spacing);

  const block = createSocialIconsBlock({
    icons,
    align: parseAlignment(attrs.align ?? style.align, "center"),
    ...(iconSize ? { iconSize } : {}),
    ...(iconStyle ? { iconStyle } : {}),
    ...(spacing !== undefined ? { spacing } : {}),
    styles: { padding: parsePadding(style) } satisfies BlockStyles,
  });

  const visibility = readVisibility(attrs);
  if (visibility) block.visibility = visibility;

  return {
    block,
    entry: report(
      "social",
      "social",
      notes.length > 0 ? "approximated" : "converted",
      notes.length > 0 ? notes.join(" ") : undefined,
    ),
  };
}

function readVisibility(
  attrs: Record<string, unknown>,
): BlockVisibility | undefined {
  const hideOnMobile = attrs.hideOnMobile === true;
  const hideOnDesktop = attrs.hideOnDesktop === true;
  if (!hideOnMobile && !hideOnDesktop) return undefined;
  return { desktop: !hideOnDesktop, mobile: !hideOnMobile };
}

function report(
  sourceTag: string,
  templaticalBlockType: string | null,
  status: ConversionStatus,
  note?: string,
): ImportReportEntry {
  return {
    sourceTag,
    templaticalBlockType,
    status,
    ...(note ? { note } : {}),
  };
}
