/**
 * Strip XSS vectors from a rich-text HTML fragment before `v-html`-ing
 * it into the canvas. TipTap-authored content is already safe; the
 * attack surface is template JSON loaded by the consumer, where a
 * malicious or compromised source can inject `<script>`, `<img
 * onerror>`, or `javascript:` anchors.
 *
 * Strips:
 *   - dangerous elements (script, style, iframe, object, embed, link, meta, base)
 *   - every event handler attribute (`on*`)
 *   - `href` / `xlink:href` / `formaction` / `action` values with disallowed schemes
 *   - `src` values with disallowed schemes (except `data:image/...`)
 *   - non-image `data:` URLs and any `javascript:` / `vbscript:` / `file:` URL
 *
 * Allowed URL schemes mirror the link-dialog allowlist. Uses the platform
 * `DOMParser`; falls back to returning the input unchanged in environments
 * without one (server-side renderers should never reach this code path,
 * but we don't want to crash if they do).
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

const FORBIDDEN_ELEMENTS = new Set([
  "SCRIPT",
  "STYLE",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "LINK",
  "META",
  "BASE",
  "FORM",
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
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("#")) return true;
  const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed);
  if (!schemeMatch) return true;
  const scheme = schemeMatch[1].toLowerCase();
  if (SAFE_URL_SCHEMES.has(scheme)) return true;
  if (allowDataImage && scheme === "data") {
    return /^data:image\/(png|jpe?g|gif|webp|svg\+xml);/i.test(trimmed);
  }
  return false;
}

function scrubElement(el: Element): void {
  if (FORBIDDEN_ELEMENTS.has(el.tagName)) {
    el.remove();
    return;
  }
  // Snapshot attribute names — removing during iteration breaks the live list.
  const attrNames: string[] = [];
  for (let i = 0; i < el.attributes.length; i++) {
    attrNames.push(el.attributes[i].name);
  }
  for (const name of attrNames) {
    const lower = name.toLowerCase();
    if (lower.startsWith("on")) {
      el.removeAttribute(name);
      continue;
    }
    if (URL_ATTRIBUTES.has(lower)) {
      const value = el.getAttribute(name) ?? "";
      if (!isSafeUrl(value, false)) el.removeAttribute(name);
      continue;
    }
    if (lower === "src") {
      const value = el.getAttribute(name) ?? "";
      if (!isSafeUrl(value, true)) el.removeAttribute(name);
      continue;
    }
    if (lower === "srcdoc") {
      el.removeAttribute(name);
    }
  }
  const children = Array.from(el.children);
  for (const child of children) scrubElement(child);
}

export function sanitizeRichTextHtml(html: string): string {
  if (typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(
    `<!doctype html><body>${html}</body>`,
    "text/html",
  );
  const body = doc.body;
  const children = Array.from(body.children);
  for (const child of children) scrubElement(child);
  return body.innerHTML;
}
