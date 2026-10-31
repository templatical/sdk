import DOMPurify from "dompurify";
import {
  SAFE_LINK_SCHEMES,
  HTML_URL_ATTRIBUTES,
  HTML_FORBIDDEN_ATTRIBUTES,
  isSafeHtmlUrl,
} from "@templatical/types";

const URL_ATTRIBUTES = new Set<string>(HTML_URL_ATTRIBUTES);
const FORBID_ATTRIBUTES = [...HTML_FORBIDDEN_ATTRIBUTES];

// DOMPurify applies this to URL-bearing attributes beyond our explicit hook.
// Build the scheme portion from the shared policy. The suffix accepts relative
// URLs and fragments, as DOMPurify's default URI expression does.
const ALLOWED_URI_REGEXP = new RegExp(
  `^(?:(?:${SAFE_LINK_SCHEMES.join("|")}):|[^a-z]|[a-z+.\\-]+(?:[^a-z+.\\-:]|$))`,
  "i",
);

const FORBID_TAGS = [
  "style",
  "form",
  "iframe",
  "object",
  "embed",
  "link",
  "meta",
  "base",
  "noscript",
  "template",
  "script",
];

const HTML_CONFIG = {
  FORBID_TAGS,
  ADD_FORBID_CONTENTS: FORBID_TAGS,
  FORBID_ATTR: FORBID_ATTRIBUTES,
  ALLOWED_URI_REGEXP,
  ADD_ATTR: ["target"],
};

const SVG_CONFIG = {
  USE_PROFILES: { svg: true, svgFilters: true },
  FORBID_TAGS: [
    "script",
    "foreignObject",
    "animate",
    "set",
    "animateMotion",
    "animateTransform",
  ],
  ADD_FORBID_CONTENTS: [
    "script",
    "foreignObject",
    "animate",
    "set",
    "animateMotion",
    "animateTransform",
  ],
  FORBID_ATTR: FORBID_ATTRIBUTES,
  ALLOWED_URI_REGEXP,
};

if (DOMPurify.isSupported) {
  DOMPurify.addHook("uponSanitizeAttribute", (node, data) => {
    const name = data.attrName.toLowerCase();
    if (name === "contenteditable") {
      if (node.getAttribute(data.attrName) === "false") {
        data.forceKeepAttr = true;
      } else {
        data.keepAttr = false;
      }
    } else if (name.startsWith("on") || name === "srcdoc") {
      data.keepAttr = false;
    } else if (
      URL_ATTRIBUTES.has(name) &&
      !isSafeHtmlUrl(data.attrValue, name)
    ) {
      data.keepAttr = false;
    }
  });
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Sanitize a rich-text fragment before inserting it into a live canvas. */
export function sanitizeHtml(html: string): string {
  if (!DOMPurify.isSupported) return escapeHtmlText(html);
  return DOMPurify.sanitize(html, HTML_CONFIG);
}

/** Sanitize an integrator-supplied inline SVG icon. */
export function sanitizeSvg(svg: string): string {
  if (!DOMPurify.isSupported) return escapeHtmlText(svg);
  return DOMPurify.sanitize(svg, SVG_CONFIG);
}
