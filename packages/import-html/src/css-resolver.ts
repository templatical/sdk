import type { CheerioAPI } from "cheerio";
import { parseStyleAttribute, serializeStyleAttribute } from "./style-parser";

interface CssRule {
  selectors: string[];
  declarations: Record<string, string>;
}

/**
 * Strips all CSS comments. Handles nested-looking content safely.
 */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Strips at-rule blocks (@media, @font-face, @keyframes, @supports, etc.)
 * and their nested content. Leaves top-level rules in place.
 *
 * Email HTML rarely benefits from @media (we render at one viewport),
 * and resolving it onto elements would not be visually faithful anyway.
 */
function stripAtRules(css: string): string {
  let result = "";
  let i = 0;
  while (i < css.length) {
    if (css[i] === "@") {
      // skip until matching `{...}` block or terminating `;`
      const semiIdx = css.indexOf(";", i);
      const braceIdx = css.indexOf("{", i);

      if (braceIdx === -1 || (semiIdx !== -1 && semiIdx < braceIdx)) {
        i = semiIdx === -1 ? css.length : semiIdx + 1;
        continue;
      }

      // skip the entire `{...}` block, accounting for nesting
      let depth = 0;
      let j = braceIdx;
      for (; j < css.length; j++) {
        if (css[j] === "{") depth++;
        else if (css[j] === "}") {
          depth--;
          if (depth === 0) {
            j++;
            break;
          }
        }
      }
      i = j;
    } else {
      result += css[i];
      i++;
    }
  }
  return result;
}

/**
 * Parses a CSS declarations block (`color: red; font-size: 14px`) into
 * a flat record. `!important` markers are dropped.
 */
function parseDeclarations(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const decl of text.split(";")) {
    const idx = decl.indexOf(":");
    if (idx === -1) continue;
    const key = decl.slice(0, idx).trim().toLowerCase();
    let value = decl.slice(idx + 1).trim();
    value = value.replace(/!important\s*$/i, "").trim();
    if (key && value) result[key] = value;
  }
  return result;
}

/**
 * A selector is "supported" by cheerio's matcher if it has no pseudo-classes
 * or pseudo-elements. Resolving e.g. `a:hover` onto an inline style would be
 * wrong (it would always apply), so we skip such rules entirely.
 */
function isSupportedSelector(selector: string): boolean {
  if (!selector) return false;
  if (selector.includes(":")) return false;
  if (selector.includes("@")) return false;
  return true;
}

/**
 * Parses the full content of one or more `<style>` tags into a list of rules.
 * Skips at-rules and selectors with pseudo-classes.
 */
export function parseStyleSheet(css: string): CssRule[] {
  const rules: CssRule[] = [];
  const cleaned = stripAtRules(stripComments(css));

  // Greedily walk top-level `selectors { decls }` blocks.
  const blockRe = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(cleaned)) !== null) {
    const selectorPart = match[1].trim();
    const declarationPart = match[2];
    if (!selectorPart) continue;

    const selectors = selectorPart
      .split(",")
      .map((s) => s.trim())
      .filter(isSupportedSelector);
    if (selectors.length === 0) continue;

    const declarations = parseDeclarations(declarationPart);
    if (Object.keys(declarations).length === 0) continue;

    rules.push({ selectors, declarations });
  }

  return rules;
}

/**
 * Reads all `<style>` tags from the document, parses them into rules,
 * applies each rule's declarations to matching elements (merging with
 * existing inline `style=""` attributes — inline always wins), and removes
 * the `<style>` tags from the document.
 *
 * No specificity is computed; rules are applied in source order, with later
 * rules overriding earlier ones. Inline styles always override resolved
 * rules. This is sufficient for typical email HTML, where authors already
 * inline most styles.
 */
export function resolveCssStyles($: CheerioAPI): void {
  const styleTags = $("style");
  if (styleTags.length === 0) return;

  const allRules: CssRule[] = [];
  styleTags.each((_, el) => {
    const css = $(el).text();
    if (css) allRules.push(...parseStyleSheet(css));
  });

  // First pass: capture each element's original inline styles, so we can
  // distinguish "author wrote this inline" from "we just resolved a rule into it".
  const inlineByEl = new WeakMap<object, Record<string, string>>();
  $("[style]").each((_, el) => {
    inlineByEl.set(el as object, parseStyleAttribute($(el).attr("style")));
  });

  // Second pass: apply rules in source order. Later rules override earlier
  // resolved ones; original inline always wins at the end.
  const resolvedByEl = new WeakMap<object, Record<string, string>>();

  for (const rule of allRules) {
    for (const selector of rule.selectors) {
      let matched: ReturnType<CheerioAPI>;
      try {
        matched = $(selector);
      } catch {
        // cheerio threw on an exotic selector — skip the rule.
        continue;
      }
      matched.each((_, el) => {
        const key = el as object;
        const current = resolvedByEl.get(key) ?? {};
        for (const [k, v] of Object.entries(rule.declarations)) {
          current[k] = v;
        }
        resolvedByEl.set(key, current);
      });
    }
  }

  // Third pass: merge resolved + original inline (inline wins) and write back.
  $("*").each((_, el) => {
    const key = el as object;
    const resolved = resolvedByEl.get(key);
    if (!resolved) return;
    const inline = inlineByEl.get(key) ?? {};
    const merged: Record<string, string> = { ...resolved };
    for (const [k, v] of Object.entries(inline)) merged[k] = v;
    $(el).attr("style", serializeStyleAttribute(merged));
  });

  styleTags.remove();
}
