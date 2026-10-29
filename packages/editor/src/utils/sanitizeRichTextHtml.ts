import { isSafeUrlAttribute } from "@templatical/types";

/**
 * Strip XSS vectors from a rich-text HTML fragment before `v-html`-ing
 * it into the canvas. TipTap-authored content is already safe; the
 * attack surface is template JSON loaded by the consumer, where a
 * malicious or compromised source can inject `<script>`, `<img
 * onerror>`, or `javascript:` anchors.
 *
 * Strips:
 *   - dangerous elements (script, style, iframe, object, embed, link, meta, base)
 *   - every event handler attribute (`on*`) and `srcdoc`
 *   - URL attributes that `isSafeUrlAttribute` refuses: `href`, `xlink:href`,
 *     `formaction`, `action`, `ping`, `background` and `poster` with a
 *     disallowed scheme, and `src` with one other than a `data:image/...` URL
 *
 * The URL policy lives in `@templatical/types`, so `template-tools strings
 * import` refuses exactly what this removes. Uses the platform
 * `DOMParser`; falls back to returning the input unchanged in environments
 * without one (server-side renderers should never reach this code path,
 * but we don't want to crash if they do).
 */

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
    if (
      lower.startsWith("on") ||
      lower === "srcdoc" ||
      !isSafeUrlAttribute(lower, el.getAttribute(name) ?? "")
    )
      el.removeAttribute(name);
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
