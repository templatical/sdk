const EDITOR_TOKENS = new Set([
  "esd-stripe",
  "esd-structure",
  "esd-container-frame",
]);

const COMPILED_TOKENS = new Set([
  "es-wrapper",
  "es-content-body",
  "es-header-body",
]);

export type StripoKind = "editor" | "compiled";

/**
 * Class tokens from attributes only. Stylesheets are stripped first so a
 * compiled leftover `.esd-block-html table` rule cannot trip editor detection.
 * Cheerio is not used here: it rewrites a bare `<td>` fragment and would drop
 * the very attributes we need to see.
 */
function markupClassTokens(html: string): string[] {
  const stripped = html
    .replace(/<style\b[\s\S]*?<\/style[^>]*>/gi, " ")
    .replace(/<script\b[\s\S]*?<\/script[^>]*>/gi, " ");
  const tokens: string[] = [];
  const re = /\bclass\s*=\s*(["'])([^"']*)\1/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped))) {
    tokens.push(...m[2].trim().split(/\s+/).filter(Boolean));
  }
  return tokens;
}

function isEditorToken(token: string): boolean {
  return EDITOR_TOKENS.has(token) || token.startsWith("esd-block-");
}

/**
 * Which Stripo HTML surface this is, or null if it is not Stripo markup.
 *
 * Editor-source (`getTemplateData`) carries `esd-*` on elements. Compiled
 * export carries `es-wrapper` / `es-*-body` and never `esd-*` on a class
 * attribute. A CSS-only leftover (`.esd-block-html` in a stylesheet) is not
 * a discriminator — stylesheets are stripped before the check.
 */
export function detectStripoKind(html: string): StripoKind | null {
  if (typeof html !== "string" || html.trim().length === 0) return null;
  const tokens = markupClassTokens(html);
  if (tokens.some(isEditorToken)) return "editor";
  if (tokens.some((t) => COMPILED_TOKENS.has(t))) return "compiled";
  return null;
}

export function isStripoHtml(html: string): boolean {
  return detectStripoKind(html) !== null;
}
