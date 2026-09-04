import type { Cheerio } from "cheerio";
import {
  createMenuBlock,
  createSocialIconsBlock,
  createTableBlock,
  generateId,
} from "@templatical/types";
import type {
  MenuItemData,
  SocialIcon,
  SocialIconSize,
  SocialIconStyle,
  SocialPlatform,
  TableRowData,
} from "@templatical/types";
import type { Element } from "domhandler";
import {
  parseAlignment,
  parseColor,
  parseFontFamily,
  parsePxValue,
} from "./attribute-parser";
import {
  childElements,
  resolveAttributes,
  tagOf,
  type Attrs,
} from "./attribute-resolver";
import { baseFields, type ConvertContext, type Converted } from "./block-base";

/**
 * Exhaustive over `SocialPlatform` on purpose: adding a member to that union
 * without adding it here is a compile error, so the importer cannot silently
 * fall back to "website" for a platform the block model gained.
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

const PLATFORM_ALIASES: Record<string, SocialPlatform> = {
  x: "twitter",
  "x-twitter": "twitter",
};

function normalizePlatform(raw: string): SocialPlatform | null {
  // MJML ships `<platform>-noshare` variants that render the same icon.
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/-noshare$/, "");
  if (!cleaned) return null;
  if (PLATFORM_ALIASES[cleaned]) return PLATFORM_ALIASES[cleaned];
  return cleaned in KNOWN_PLATFORMS ? (cleaned as SocialPlatform) : null;
}

/** The `<style>/<platform>.png` tail of the URL `renderers/social.ts:76` builds. */
function platformFromSrc(src: string): { platform: string; style: string } {
  const parts = src.split("?")[0].split("/").filter(Boolean);
  const file = parts.at(-1) ?? "";
  return {
    platform: file.replace(/\.[a-z0-9]+$/i, ""),
    style: parts.at(-2) ?? "",
  };
}

const ICON_SIZES: Array<[number, SocialIconSize]> = [
  [24, "small"],
  [32, "medium"],
  [48, "large"],
];

function nearestIconSize(px: number): { size: SocialIconSize; exact: boolean } {
  let best = ICON_SIZES[1];
  let bestGap = Infinity;
  for (const candidate of ICON_SIZES) {
    const gap = Math.abs(candidate[0] - px);
    if (gap < bestGap) {
      bestGap = gap;
      best = candidate;
    }
  }
  return { size: best[1], exact: bestGap === 0 };
}

const RADIUS_STYLES: Record<string, SocialIconStyle> = {
  "50%": "circle",
  "8px": "rounded",
  "0": "square",
  "4px": "solid",
};

const KNOWN_ICON_STYLES = new Set<string>([
  "solid",
  "outlined",
  "rounded",
  "square",
  "circle",
]);

export function convertSocial(
  $el: Cheerio<Element>,
  attrs: Attrs,
  ctx: ConvertContext,
): Converted | null {
  const elements = childElements($el, ctx.$).filter(
    ($child) => tagOf($child[0]) === "mj-social-element",
  );
  if (elements.length === 0) return null;

  const notes: string[] = [];
  const icons: SocialIcon[] = [];

  let iconStyle: SocialIconStyle | null = null;
  let iconSizePx = 0;
  let spacing = 0;

  elements.forEach(($child, index) => {
    const childAttrs = resolveAttributes($child, ctx.cascade);
    const src = (childAttrs.src ?? "").trim();
    const fromSrc = src ? platformFromSrc(src) : { platform: "", style: "" };

    const rawName = (childAttrs.name ?? "").trim() || fromSrc.platform;
    const platform = normalizePlatform(rawName);
    if (!platform && rawName) {
      notes.push(
        `Unrecognised social platform "${rawName}" mapped to "website".`,
      );
    }

    icons.push({
      id: generateId(),
      platform: platform ?? "website",
      url: (childAttrs.href ?? "").trim(),
    });

    if (!iconStyle && KNOWN_ICON_STYLES.has(fromSrc.style)) {
      iconStyle = fromSrc.style as SocialIconStyle;
    }

    if (iconSizePx === 0) {
      iconSizePx = parsePxValue(childAttrs["icon-size"]);
    }

    // The final element emits `0` right-padding, so spacing is only readable
    // from a non-final one (renderers/social.ts:79).
    if (spacing === 0 && index < elements.length - 1) {
      spacing = parsePxValue((childAttrs.padding ?? "").trim().split(/\s+/)[1]);
    }

    if (!iconStyle) {
      const radius = (childAttrs["border-radius"] ?? "").trim().toLowerCase();
      const mapped = RADIUS_STYLES[radius];
      if (mapped) {
        iconStyle = mapped;
        if (radius === "4px") {
          notes.push(
            'Icon border-radius 4px maps to both "solid" and "outlined"; resolved to "solid".',
          );
        }
      }
    }
  });

  const declaredSize = parsePxValue(attrs["icon-size"]) || iconSizePx;
  let iconSize: SocialIconSize | undefined;
  if (declaredSize > 0) {
    const resolved = nearestIconSize(declaredSize);
    iconSize = resolved.size;
    if (!resolved.exact) {
      notes.push(
        `Icon size ${declaredSize}px is not one of 24/32/48; resolved to "${resolved.size}".`,
      );
    }
  }

  const block = createSocialIconsBlock({
    icons,
    align: parseAlignment(attrs.align, "center"),
    ...(iconSize ? { iconSize } : {}),
    ...(iconStyle ? { iconStyle } : {}),
    ...(spacing > 0 ? { spacing } : {}),
    ...baseFields(attrs),
  });

  return {
    block,
    entry: {
      sourceTag: "mj-social",
      templaticalBlockType: "social",
      status: notes.length > 0 ? "approximated" : "converted",
      ...(notes.length > 0 ? { note: notes.join(" ") } : {}),
    },
  };
}

export function convertNavbar(
  $el: Cheerio<Element>,
  attrs: Attrs,
  ctx: ConvertContext,
): Converted | null {
  const links = childElements($el, ctx.$).filter(
    ($child) => tagOf($child[0]) === "mj-navbar-link",
  );
  if (links.length === 0) return null;

  const items: MenuItemData[] = links.map(($link) => {
    const linkAttrs = resolveAttributes($link, ctx.cascade);
    const color = parseColor(linkAttrs.color);
    return {
      id: generateId(),
      text: ($link.text() ?? "").trim(),
      url: (linkAttrs.href ?? "").trim(),
      openInNewTab: (linkAttrs.target ?? "").toLowerCase() === "_blank",
      bold: (linkAttrs["font-weight"] ?? "").toLowerCase() === "bold",
      underline: (linkAttrs["text-decoration"] ?? "").includes("underline"),
      ...(color ? { color } : {}),
    };
  });

  const fontSize = parsePxValue(attrs["font-size"]);
  const fontFamily = parseFontFamily(attrs["font-family"]);

  const block = createMenuBlock({
    items,
    textAlign: parseAlignment(attrs.align, "center"),
    ...(fontSize > 0 ? { fontSize } : {}),
    ...(fontFamily ? { fontFamily } : {}),
    ...baseFields(attrs),
  });

  return {
    block,
    entry: {
      sourceTag: "mj-navbar",
      templaticalBlockType: "menu",
      status: "converted",
    },
  };
}

export function convertNativeTable(
  $el: Cheerio<Element>,
  attrs: Attrs,
  ctx: ConvertContext,
): Converted | null {
  const $ = ctx.$;
  const rowEls = $el.find("tr").toArray();
  if (rowEls.length === 0) return null;

  const rows: TableRowData[] = rowEls.map((rowEl) => ({
    id: generateId(),
    cells: $(rowEl)
      .children()
      .toArray()
      .map((cellEl) => ({ id: generateId(), content: $(cellEl).html() ?? "" })),
  }));

  const hasHeaderRow = $(rowEls[0])
    .children()
    .toArray()
    .some((cell) => tagOf(cell) === "th");

  const color = parseColor(attrs.color);
  const fontSize = parsePxValue(attrs["font-size"]);
  const fontFamily = parseFontFamily(attrs["font-family"]);

  const block = createTableBlock({
    rows,
    hasHeaderRow,
    textAlign: parseAlignment(attrs.align, "left"),
    ...(color ? { color } : {}),
    ...(fontSize > 0 ? { fontSize } : {}),
    ...(fontFamily ? { fontFamily } : {}),
    ...baseFields(attrs),
  });

  return {
    block,
    entry: {
      sourceTag: "mj-table",
      templaticalBlockType: "table",
      status: "converted",
    },
  };
}
