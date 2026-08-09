import { isParagraph } from "@templatical/types";
import type { Block } from "@templatical/types";
import type { Rule, RuleMeta } from "../../types";

export const meta: RuleMeta = {
  id: "a11y.text-justified",
  severity: "warning",
};

/**
 * Matches a `text-align` declaration and captures its value. Anchored on
 * the property name with a `(^|;)` prefix so it can only ever match a
 * declaration boundary.
 *
 * That anchor is the whole point: `justify-content: center` is common in
 * the `html` block's flexbox markup, and a rule that searched for the
 * bare token `justify` would flag every one of them. Matching the
 * property — never the value alone — is what makes the rule specific.
 *
 * Whitespace is permitted around `:` and the value because imported
 * templates aren't normalized; content that round-trips through TipTap
 * is always `text-align: <value>`, but content loaded via `init()` or an
 * importer can carry any spacing or casing.
 */
const TEXT_ALIGN_DECL = /(^|;)\s*text-align\s*:\s*([^;]*)/i;

/** Reads the `style` attribute value out of every tag in a fragment. */
const STYLE_ATTR = /\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;

function styleValues(html: string): string[] {
  const values: string[] = [];
  const re = new RegExp(STYLE_ATTR.source, STYLE_ATTR.flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    values.push(match[1] ?? match[2] ?? "");
  }
  return values;
}

function isJustified(style: string): boolean {
  const match = TEXT_ALIGN_DECL.exec(style);
  if (match === null) return false;
  return match[2].trim().toLowerCase() === "justify";
}

/**
 * Drop the `text-align` declaration from one style attribute value,
 * leaving every sibling declaration untouched.
 *
 * TipTap merges each extension's `renderHTML` contribution into a single
 * `style` attribute, so a justified paragraph that also carries a line
 * height is `style="text-align: justify; line-height: 1.8"`. Removing the
 * attribute wholesale would silently discard the line height.
 */
function removeTextAlign(style: string): string {
  return style
    .split(";")
    .filter((decl) => !/^\s*text-align\s*:/i.test(decl))
    .map((decl) => decl.trim())
    .filter((decl) => decl !== "")
    .join("; ");
}

/**
 * Rewrite every justified tag in the fragment, dropping the `style`
 * attribute entirely when `text-align` was its only declaration.
 *
 * Unsetting rather than forcing `left` is deliberate: an absent
 * declaration is how TipTap represents "no alignment" (its `renderHTML`
 * emits nothing when the attribute is null), so the paragraph goes back
 * to inheriting the document default — which is also the correct result
 * for right-to-left content, where a hardcoded `left` would be wrong.
 */
function unjustify(html: string): string {
  return html.replace(
    /\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi,
    (match, double: string | undefined, single: string | undefined) => {
      const style = double ?? single ?? "";
      if (!isJustified(style)) return match;
      const remaining = removeTextAlign(style);
      return remaining === "" ? "" : ` style="${remaining}"`;
    },
  );
}

export const textJustified: Rule = {
  meta,
  block(block) {
    if (!isParagraph(block)) return null;
    const html = block.content ?? "";
    if (!styleValues(html).some(isJustified)) return null;

    return {
      blockId: block.id,
      fix: {
        description: "Remove justified alignment",
        apply: (ctx) => {
          if (!isParagraph(block)) return;
          ctx.updateBlock(block.id, {
            content: unjustify(block.content ?? ""),
          } as Partial<Block>);
        },
      },
    };
  },
};
