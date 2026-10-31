/** URL schemes accepted in links displayed in the editor. */
export const SAFE_LINK_SCHEMES = Object.freeze([
  "http",
  "https",
  "mailto",
  "tel",
  "ftp",
  "ftps",
  "sms",
  "xmpp",
  "cid",
] as const);

/** Script-capable or arbitrary-payload URL schemes reported by the link linter. */
export const DANGEROUS_SCRIPT_SCHEMES = Object.freeze([
  "javascript",
  "data",
  "vbscript",
] as const);

/** Normalize a URL before checking its scheme, as the WHATWG URL parser does. */
export function normalizeUrlForSchemeCheck(value: string): string {
  return value
    .replace(/[\t\n\r]/g, "")
    .replace(/^[\u0000-\u0020]+/, "")
    .trimEnd();
}

/** Return the lower-case scheme, or null for a relative or fragment URL. */
export function extractUrlScheme(value: string): string | null {
  const match = /^([a-z][a-z0-9+.-]*):/i.exec(
    normalizeUrlForSchemeCheck(value),
  );
  return match ? match[1].toLowerCase() : null;
}

/** Only these image data MIME types are accepted, and only in src. */
export const DATA_IMAGE_SRC_PATTERN =
  /^data:image\/(png|jpe?g|gif|webp|svg\+xml);/i;

/** URL rule for HTML attributes at the editor's browser insertion boundary. */
export function isSafeHtmlUrl(value: string, attribute: string): boolean {
  const normalized = normalizeUrlForSchemeCheck(value);
  const scheme = extractUrlScheme(normalized);
  if (scheme === null) return true;
  if (SAFE_LINK_SCHEMES.some((safe) => safe === scheme)) return true;
  return (
    attribute.toLowerCase() === "src" && DATA_IMAGE_SRC_PATTERN.test(normalized)
  );
}
