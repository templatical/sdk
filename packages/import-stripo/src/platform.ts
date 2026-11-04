import type { SocialPlatform } from "@templatical/types";

const NAMED: Record<string, SocialPlatform> = {
  facebook: "facebook",
  fb: "facebook",
  twitter: "twitter",
  x: "twitter",
  instagram: "instagram",
  inst: "instagram",
  linkedin: "linkedin",
  xing: "xing",
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
 * The file name of an icon src. An absolute URL contributes its last path
 * segment, so the host is not a name; an empty path has none. A relative or
 * protocol-relative src resolves against a placeholder base for the same
 * reason. The query and hash are not part of the name.
 */
function srcFileName(src: string): string {
  try {
    const url = new URL(src, "https://placeholder.invalid");
    return url.pathname.split("/").pop() || "";
  } catch {
    return "";
  }
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
  for (const candidate of [name, alt]) {
    if (!candidate) continue;
    for (const w of peel(candidate).split(/\s+/)) {
      if (NAMED[w]) return NAMED[w];
    }
  }
  // Only the file name identifies an icon; the host and folders of a URL do not.
  if (src) {
    const stem = peel(srcFileName(src));
    for (const w of stem.split(/\s+/)) {
      if (NAMED[w]) return NAMED[w];
    }
  }
  return "website";
}
