/**
 * The URL policy for rich-text HTML: the editor's sanitizer removes the
 * attributes it refuses, and `template-tools strings import` rejects a
 * translation that carries one.
 *
 * - `on*` handlers are not covered here; callers refuse them separately.
 * - `href`, `xlink:href`, `formaction`, `action`, `ping`, `background` and
 *   `poster` may hold a relative URL, a `#` fragment, or one of the
 *   link-dialog schemes.
 * - `src` may also hold a `data:image/…;` URL for PNG, JPEG, GIF, WebP or SVG.
 * - Every other scheme is refused, `javascript:`, `vbscript:`, `data:` and
 *   `file:` included.
 */

const SAFE_URL_SCHEMES = new Set([
  "http",
  "https",
  "mailto",
  "tel",
  "ftp",
  "ftps",
  "sms",
  "xmpp",
  "cid",
]);

const URL_ATTRIBUTES = new Set([
  "href",
  "xlink:href",
  "formaction",
  "action",
  "ping",
  "background",
  "poster",
]);

function isSafeUrl(value: string, allowDataImage: boolean): boolean {
  // Normalize the value the same way the WHATWG URL parser does before
  // testing the scheme, so we inspect the string the browser will actually
  // resolve. The parser removes ASCII tab/LF/CR from *anywhere* in a URL and
  // strips leading C0-control + space characters. Without this, payloads like
  // "java\tscript:alert(1)" or "\x01javascript:alert(1)" match no scheme here
  // (and fall through to the safe branch) yet re-form a live `javascript:`
  // URL once rendered into the anchor.
  const normalized = value
    .replace(/[\t\n\r]/g, "")
    .replace(/^[\u0000- ]+/, "")
    .trimEnd();
  if (!normalized) return true;
  if (normalized.startsWith("#")) return true;
  const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(normalized);
  if (!schemeMatch) return true;
  const scheme = schemeMatch[1].toLowerCase();
  if (SAFE_URL_SCHEMES.has(scheme)) return true;
  if (allowDataImage && scheme === "data") {
    return /^data:image\/(png|jpe?g|gif|webp|svg\+xml);/i.test(normalized);
  }
  return false;
}

/**
 * Whether an attribute's value is allowed by the URL policy. Pass the
 * attribute value as a browser reads it, with character references decoded.
 * Attributes that hold no URL are always allowed.
 */
export function isSafeUrlAttribute(name: string, value: string): boolean {
  const attribute = name.toLowerCase();
  if (attribute === "src") return isSafeUrl(value, true);
  return !URL_ATTRIBUTES.has(attribute) || isSafeUrl(value, false);
}
