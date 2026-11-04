import { isParagraph, isTitle } from "@templatical/types";
import type { Block } from "@templatical/types";
import type { LintPatchContext, Rule, RuleMeta } from "../../types";
import {
  attrRawValue,
  doubleQuotedAttr,
  extractAnchors,
  findAttrSpans,
  rewriteOpenTags,
} from "../../html-utils";

export const meta: RuleMeta = {
  id: "a11y.link-target-blank-no-rel",
  reference:
    "https://docs.templatical.com/quality/accessibility/rule-catalog#links",
  severity: "warning",
};

function getHtml(block: Block): string | null {
  if (isParagraph(block) || isTitle(block)) return block.content;
  return null;
}

function hasSafeRel(rel: string | null): boolean {
  if (rel === null) return false;
  const tokens = rel.toLowerCase().split(/\s+/);
  return tokens.includes("noopener") || tokens.includes("noreferrer");
}

export const linkTargetBlankNoRel: Rule = {
  meta,
  block(block) {
    const html = getHtml(block);
    if (html === null) return null;
    const anchors = extractAnchors(html);
    const offender = anchors.find(
      (a) => a.target === "_blank" && !hasSafeRel(a.rel),
    );
    if (!offender) return null;

    return {
      blockId: block.id,
      fix: {
        description: 'Add rel="noopener"',
        apply: (ctx: Omit<LintPatchContext, "removeBlock">) => {
          if (!isParagraph(block) && !isTitle(block)) return;
          const updated = addNoopenerToTargetBlank(block.content ?? "");
          ctx.updateBlock(block.id, { content: updated } as Partial<Block>);
        },
      },
    };
  },
};

/**
 * Add `noopener` on every `<a target="_blank">` that lacks it.
 *
 * The attribute value is the raw text inside its quotes (double-quoted,
 * single-quoted, or unquoted), so an entity such as `&copy;` is kept as
 * written. The value is written back double-quoted, and a `"` in it is
 * escaped so it cannot close the attribute. The rewritten open tag is a
 * lowercase `<a`. Its boundary comes from `findOpenTagEnd` via
 * `rewriteOpenTags`, so a `>` inside a quoted value stays inside that value.
 */
function addNoopenerToTargetBlank(html: string): string {
  return rewriteOpenTags(html, ({ name, attrs }) => {
    if (name !== "a") return null;
    const targetSpans = findAttrSpans(attrs, "target");
    if (targetSpans === null) return null;
    const opensNewTab = targetSpans.some((span) => {
      const target = attrRawValue(attrs.slice(span.start, span.end));
      return target !== null && target.toLowerCase() === "_blank";
    });
    if (!opensNewTab) return null;

    const relSpans = findAttrSpans(attrs, "rel");
    if (relSpans === null) return null;
    const relSpan = relSpans[0];
    if (relSpan === undefined) {
      return `<a${attrs} ${doubleQuotedAttr("rel", "noopener")}>`;
    }

    const relValue = attrRawValue(attrs.slice(relSpan.start, relSpan.end));
    if (hasSafeRel(relValue)) return null;
    const newRel = `${relValue ?? ""} noopener`.trim();
    const next =
      attrs.slice(0, relSpan.start) +
      doubleQuotedAttr("rel", newRel) +
      attrs.slice(relSpan.end);
    return `<a${next}>`;
  });
}
