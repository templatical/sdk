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

function isTagNameEnd(ch: string | undefined): boolean {
  return ch === undefined || !/[A-Za-z0-9_]/.test(ch);
}

/**
 * Drop every `tag` element, including a closer with extra attributes or
 * whitespace (`</style >`, `</script foo>`). Linear `indexOf` — a regex
 * here fails `js/bad-tag-filter` or `js/polynomial-redos`, and Cheerio
 * rewrites a bare `<td>` fragment and would drop the attributes we need.
 */
function withoutElements(html: string, tag: string): string {
  const open = `<${tag}`;
  const close = `</${tag}`;
  const lower = html.toLowerCase();
  let out = "";
  let pos = 0;
  while (pos < html.length) {
    const start = lower.indexOf(open, pos);
    if (start === -1) {
      out += html.slice(pos);
      break;
    }
    if (!isTagNameEnd(lower[start + open.length])) {
      out += html.slice(pos, start + open.length);
      pos = start + open.length;
      continue;
    }
    out += html.slice(pos, start);
    const gt = html.indexOf(">", start);
    if (gt === -1) break;
    const closeAt = lower.indexOf(close, gt + 1);
    if (closeAt === -1) break;
    const closeGt = html.indexOf(">", closeAt);
    if (closeGt === -1) break;
    out += " ";
    pos = closeGt + 1;
  }
  return out;
}

/**
 * Class tokens from attributes only. Stylesheets and scripts are dropped
 * first so a compiled leftover `.esd-block-html table` rule cannot trip
 * editor detection.
 */
function markupClassTokens(html: string): string[] {
  const stripped = withoutElements(withoutElements(html, "style"), "script");
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
