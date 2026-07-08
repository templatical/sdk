import type { MergeTag } from "./config";

// --- Syntax Presets ---

export interface SyntaxPreset {
  value: RegExp;
  logic: RegExp;
}

export type SyntaxPresetName =
  "liquid" | "handlebars" | "mailchimp" | "ampscript";

export const SYNTAX_PRESETS: Record<SyntaxPresetName, SyntaxPreset> = {
  liquid: { value: /\{\{.+?\}\}/g, logic: /\{%-?\s*(\w+).*?-?%\}/g },
  handlebars: {
    value: /\{\{\{?.+?\}?\}\}/g,
    logic: /\{\{[#/](\w+).*?\}\}/g,
  },
  mailchimp: { value: /\*\|\w+\|\*/g, logic: /\*\|(\w+)[:|].*?\|\*/g },
  ampscript: { value: /%%=.+?=%%/g, logic: /%%\[\s*(\w+).*?\]%%/g },
};

const SYNTAX_TRIGGER_CHARS: Record<SyntaxPresetName, string> = {
  liquid: "{{",
  handlebars: "{{",
  mailchimp: "*|",
  ampscript: "%%=",
};

const SYNTAX_CLOSING_CHARS: Record<SyntaxPresetName, string> = {
  liquid: "}}",
  handlebars: "}}",
  mailchimp: "|*",
  ampscript: "=%%",
};

/**
 * Resolves the autocomplete trigger string for a syntax preset.
 * Returns null when the syntax doesn't match any built-in preset
 * (custom regex syntax — autocomplete cannot be enabled safely).
 */
export function getSyntaxTriggerChar(syntax: SyntaxPreset): string | null {
  for (const name of Object.keys(SYNTAX_PRESETS) as SyntaxPresetName[]) {
    if (SYNTAX_PRESETS[name].value.source === syntax.value.source) {
      return SYNTAX_TRIGGER_CHARS[name];
    }
  }
  return null;
}

/**
 * Resolves the closing delimiter for a syntax preset (e.g. `}}` for liquid,
 * `|*` for mailchimp). The autocomplete trigger detector uses it to tell an
 * open tag (`{{first`) from a completed one (`{{first_name}}`) so the popup
 * doesn't reappear over a finished tag. Returns null for custom syntaxes —
 * the same set for which `getSyntaxTriggerChar` returns null.
 */
export function getSyntaxClosingChar(syntax: SyntaxPreset): string | null {
  for (const name of Object.keys(SYNTAX_PRESETS) as SyntaxPresetName[]) {
    if (SYNTAX_PRESETS[name].value.source === syntax.value.source) {
      return SYNTAX_CLOSING_CHARS[name];
    }
  }
  return null;
}

export function resolveSyntax(
  syntax?: SyntaxPresetName | SyntaxPreset,
): SyntaxPreset {
  if (!syntax) {
    return SYNTAX_PRESETS.liquid;
  }

  if (typeof syntax === "string") {
    return SYNTAX_PRESETS[syntax] ?? SYNTAX_PRESETS.liquid;
  }

  return syntax;
}

// --- Merge Tag Utilities ---

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function anchoredRegex(pattern: RegExp): RegExp {
  const source = pattern.source;
  const flags = pattern.flags.replace("g", "");
  return new RegExp(`^${source}$`, flags);
}

export function isMergeTagValue(value: string, syntax: SyntaxPreset): boolean {
  const trimmed = value?.trim() || "";
  // Handlebars (and similar) value regex is liberal enough to also match
  // logic tags like `{{#each items}}`. Exclude logic-shaped tags so callers
  // that rely on this discriminator (UI segmentation, label rendering)
  // don't misclassify them.
  if (anchoredRegex(syntax.logic).test(trimmed)) {
    return false;
  }
  return anchoredRegex(syntax.value).test(trimmed);
}

export function getMergeTagLabel(value: string, mergeTags: MergeTag[]): string {
  const found = mergeTags.find((p) => p.value === value);
  if (found) {
    return found.label;
  }
  return value;
}

export function resolveHtmlMergeTagLabels(
  html: string,
  mergeTags: MergeTag[],
): string {
  return rewriteSpanByAttr(html, "data-merge-tag", (value) =>
    getMergeTagLabel(value, mergeTags),
  );
}

export function containsMergeTag(value: string, syntax: SyntaxPreset): boolean {
  if (!value) return false;

  const valueRegex = new RegExp(syntax.value.source, syntax.value.flags);
  const logicRegex = new RegExp(syntax.logic.source, syntax.logic.flags);

  return valueRegex.test(value) || logicRegex.test(value);
}

export function restoreMergeTagMarkup(
  html: string,
  mergeTags: MergeTag[],
  syntax: SyntaxPreset,
): string {
  let result = html;

  for (const tag of mergeTags) {
    const escaped = escapeRegExp(tag.value);
    const pattern = new RegExp(`(?<!data-merge-tag=")${escaped}`, "g");
    result = result.replace(pattern, (match) => {
      const label = getMergeTagLabel(match, mergeTags);
      return `<span data-merge-tag="${match}">${label}</span>`;
    });
  }

  const logicRegex = new RegExp(
    `(?<!data-logic-merge-tag=")${syntax.logic.source}`,
    syntax.logic.flags,
  );
  result = result.replace(logicRegex, (match) => {
    const keyword = getLogicMergeTagKeyword(match, syntax);
    return `<span data-logic-merge-tag="${match}">${keyword}</span>`;
  });

  return result;
}

export function isLogicMergeTagValue(
  value: string,
  syntax: SyntaxPreset,
): boolean {
  return anchoredRegex(syntax.logic).test(value?.trim() || "");
}

export function getLogicMergeTagKeyword(
  value: string,
  syntax: SyntaxPreset,
): string {
  const regex = new RegExp(
    syntax.logic.source,
    syntax.logic.flags.replace("g", ""),
  );
  const match = value.match(regex);
  return match && match[1] ? match[1].toUpperCase() : value;
}

export function resolveHtmlLogicMergeTagLabels(
  html: string,
  syntax: SyntaxPreset,
): string {
  return rewriteSpanByAttr(html, "data-logic-merge-tag", (value) =>
    getLogicMergeTagKeyword(value, syntax),
  );
}

/**
 * Walk `html` and rewrite the inner text of every `<span … {attrName}="…">…</span>`
 * by passing the attribute value through `relabel`. Linear in `html.length`:
 * each `indexOf` advances the cursor monotonically, and no regex backtracking
 * can run over the whole string.
 *
 * Replaces the original `/<span[^>]*…[^>]*>(.*?)<\/span>/g` pattern, which
 * was polynomial-ReDoS over inputs that contained many `<span` starts with
 * no closing `>`.
 */
function rewriteSpanByAttr(
  html: string,
  attrName: string,
  relabel: (value: string) => string,
): string {
  // Anchored on `>` per match. `[^<>"]*` for the attribute value fails fast
  // on a missing closing quote instead of backtracking across the input.
  const attrPattern = new RegExp(`(?:^|\\s)${attrName}="([^"<>]*)"`);
  let out = "";
  let i = 0;
  while (i < html.length) {
    const open = html.indexOf("<span", i);
    if (open === -1) {
      out += html.substring(i);
      break;
    }
    const afterTagName = html[open + 5];
    if (
      afterTagName !== ">" &&
      afterTagName !== " " &&
      afterTagName !== "\t" &&
      afterTagName !== "\n" &&
      afterTagName !== "\r" &&
      afterTagName !== "/"
    ) {
      out += html.substring(i, open + 5);
      i = open + 5;
      continue;
    }
    const openEnd = html.indexOf(">", open + 5);
    if (openEnd === -1) {
      out += html.substring(i);
      break;
    }
    const closeStart = html.indexOf("</span>", openEnd + 1);
    if (closeStart === -1) {
      out += html.substring(i);
      break;
    }
    const attrs = html.substring(open + 5, openEnd);
    const attrMatch = attrPattern.exec(attrs);
    if (!attrMatch) {
      // This `<span>` isn't the one we're looking for — emit up to and
      // including the `<span` literal and let the next iteration scan
      // inward. Skipping straight to the matching `</span>` would swallow
      // any nested merge-tag span in the same loop iteration.
      out += html.substring(i, open + 5);
      i = open + 5;
      continue;
    }
    const value = attrMatch[1];
    const newLabel = relabel(value);
    out += html.substring(i, openEnd + 1);
    out += newLabel;
    out += "</span>";
    i = closeStart + 7;
  }
  return out;
}
