import type { SocialPlatform } from "@templatical/types";

const NAMED: Record<string, SocialPlatform> = {
  facebook: "facebook",
  fb: "facebook",
  twitter: "twitter",
  x: "twitter",
  instagram: "instagram",
  inst: "instagram",
  linkedin: "linkedin",
  youtube: "youtube",
  yt: "youtube",
  tiktok: "tiktok",
  pinterest: "pinterest",
  email: "email",
  mail: "email",
  whatsapp: "whatsapp",
  telegram: "telegram",
  discord: "discord",
  snapchat: "snapchat",
  reddit: "reddit",
  github: "github",
  dribbble: "dribbble",
  behance: "behance",
};

function peel(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\.(png|jpe?g|gif|svg|webp)$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Map a Stripo icon's title, alt, or src stem onto a SocialPlatform.
 * Unknown names become `website` — same floor as the MJML importer.
 */
export function normalizePlatform(
  name?: string,
  src?: string,
  alt?: string,
): SocialPlatform {
  for (const candidate of [name, alt, src]) {
    if (!candidate) continue;
    const words = peel(candidate).split(/\s+/);
    for (const w of words) {
      if (NAMED[w]) return NAMED[w];
    }
    const stem = peel(candidate.split("/").pop() ?? "");
    for (const w of stem.split(/\s+/)) {
      if (NAMED[w]) return NAMED[w];
    }
  }
  return "website";
}
