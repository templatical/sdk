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

/** A Stripo website icon is named website, web, or link. */
const WEBSITE_NAMES = new Set(["website", "web", "link"]);

function namedPlatform(
  candidate: string | undefined,
): SocialPlatform | undefined {
  if (!candidate) return undefined;
  for (const w of peel(candidate).split(/\s+/)) {
    const hit = NAMED[w];
    if (hit) return hit;
  }
  return undefined;
}

function explicitWebsite(candidate: string | undefined): boolean {
  if (!candidate) return false;
  for (const w of peel(candidate).split(/\s+/)) {
    if (WEBSITE_NAMES.has(w)) return true;
  }
  return false;
}

/**
 * The platform named by a Stripo icon's title, alt, or src file name.
 * An explicit website, web, or link name is `website`. Undefined when none
 * of those names a platform.
 */
export function matchPlatform(
  name?: string,
  src?: string,
  alt?: string,
): SocialPlatform | undefined {
  for (const candidate of [name, alt]) {
    const hit = namedPlatform(candidate);
    if (hit) return hit;
    // An explicit website label outranks the platform a file name suggests.
    if (explicitWebsite(candidate)) return "website";
  }
  // Only the file name identifies an icon; the host and folders of a URL do not.
  const file = src ? srcFileName(src) : "";
  const fromFile = namedPlatform(file);
  if (fromFile) return fromFile;
  if (explicitWebsite(file)) return "website";
  return undefined;
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
  return matchPlatform(name, src, alt) ?? "website";
}
