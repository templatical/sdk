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

/** URL-bearing attributes checked by the editor's HTML and SVG sanitizer hook. */
export const HTML_URL_ATTRIBUTES = Object.freeze([
  "href",
  "xlink:href",
  "background",
  "poster",
  "src",
] as const);

/** Attributes removed regardless of value by the HTML and SVG sanitizer config. */
export const HTML_FORBIDDEN_ATTRIBUTES = Object.freeze([
  "srcdoc",
  "ping",
  "formaction",
  "action",
] as const);

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

/**
 * Apply the editor's URL hook and forbidden-attribute policy. Pass character
 * references decoded, as a browser reads them. Other attributes return true;
 * callers must check tags and on* handlers separately.
 */
export function isSafeUrlAttribute(name: string, value: string): boolean {
  const attribute = name.toLowerCase();
  if (HTML_FORBIDDEN_ATTRIBUTES.some((forbidden) => forbidden === attribute))
    return false;
  return (
    !HTML_URL_ATTRIBUTES.some((urlAttribute) => urlAttribute === attribute) ||
    isSafeHtmlUrl(value, attribute)
  );
}
