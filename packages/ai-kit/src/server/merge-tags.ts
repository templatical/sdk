import type { AiMergeTagSyntax } from "@templatical/types";
import {
  findOpenTagEnd,
  getTagAttrValue,
  SYNTAX_PRESETS,
} from "@templatical/types";

/** The value pattern of a built-in syntax, as the editor matches it; none for `custom`. */
function patternOf(syntax: AiMergeTagSyntax): RegExp | null {
  if (syntax === "custom") return null;
  const preset = SYNTAX_PRESETS[syntax];
  return preset ? new RegExp(preset.value.source, "g") : null;
}

/** The tag-shaped tokens in a text, in order. Nothing for `custom`. */
export function mergeTagTokens(
  text: string,
  syntax: AiMergeTagSyntax,
): string[] {
  const pattern = patternOf(syntax);
  return pattern ? [...text.matchAll(pattern)].map((match) => match[0]) : [];
}

/** The tag-shaped tokens in every string inside a JSON value. */
export function mergeTagTokensIn(
  value: unknown,
  syntax: AiMergeTagSyntax,
): string[] {
  if (typeof value === "string") return mergeTagTokens(value, syntax);
  if (Array.isArray(value)) {
    return value.flatMap((item) => mergeTagTokensIn(item, syntax));
  }
  if (typeof value === "object" && value !== null) {
    return Object.values(value).flatMap((item) =>
      mergeTagTokensIn(item, syntax),
    );
  }
  return [];
}

/**
 * The editor's merge-tag tags (`<span data-merge-tag="{{x}}" …>…</span>`) as
 * their bare value, the way a model reads and writes them.
 */
export function flattenMergeTags(html: string): string {
  let out = "";
  let cursor = 0;
  while (cursor < html.length) {
    const open = html.indexOf("<span", cursor);
    if (open === -1) {
      out += html.substring(cursor);
      break;
    }
    const afterTagName = html[open + 5];
    if (
      afterTagName !== ">" &&
      afterTagName !== " " &&
      afterTagName !== "\t" &&
      afterTagName !== "\n" &&
      afterTagName !== "\r" &&
      afterTagName !== "\f" &&
      afterTagName !== "/"
    ) {
      out += html.substring(cursor, open + 5);
      cursor = open + 5;
      continue;
    }
    const openEnd = findOpenTagEnd(html, open + 5);
    if (openEnd === -1) {
      out += html.substring(cursor);
      break;
    }
    const value = getTagAttrValue(
      html.substring(open + 5, openEnd),
      "data-merge-tag",
    );
    if (value === null) {
      out += html.substring(cursor, openEnd + 1);
      cursor = openEnd + 1;
      continue;
    }
    const closeStart = html.indexOf("</span>", openEnd + 1);
    if (closeStart === -1) {
      out += html.substring(cursor);
      break;
    }
    out += html.substring(cursor, open) + value;
    cursor = closeStart + 7;
  }
  return out;
}

/** The distinct tokens of `found` that `allowed` lacks, in order. Nothing for `custom`. */
export function unknownMergeTags(
  syntax: AiMergeTagSyntax,
  found: readonly string[],
  allowed: readonly string[],
): string[] {
  if (syntax === "custom") return [];
  const known = new Set(allowed);
  return [...new Set(found.filter((token) => !known.has(token)))];
}
