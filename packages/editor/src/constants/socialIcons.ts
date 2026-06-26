import { SOCIAL_ICON_GLYPHS, type SocialPlatform } from "@templatical/types";

/**
 * Icon glyph (SVG path + brand color) per platform. Re-exported from the
 * shared kernel in `@templatical/types` so the editor's inline SVG and the
 * renderer's PNG rasterizer never drift. Platform display labels are NOT here
 * — they come from i18n (`t.social.platforms[platform]`).
 */
export const socialIcons = SOCIAL_ICON_GLYPHS;

export const socialIconSizeMap: Record<"small" | "medium" | "large", number> = {
  small: 24,
  medium: 32,
  large: 48,
};

export const socialPlatformOptions: SocialPlatform[] = [
  "facebook",
  "twitter",
  "instagram",
  "linkedin",
  "youtube",
  "tiktok",
  "pinterest",
  "email",
  "website",
  "whatsapp",
  "telegram",
  "discord",
  "snapchat",
  "reddit",
  "github",
  "dribbble",
  "behance",
];
