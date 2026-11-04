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
  const tokens = rel.toLowerCase().split(/[ \t\n\f\r]+/);
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
 * lowercase `<a`. Its boundary and decoded attribute values come from the
 * parser in `rewriteOpenTags`, as they do during detection.
 */
function addNoopenerToTargetBlank(html: string): string {
  return rewriteOpenTags(html, ({ name, attrs, decodedAttrs }) => {
    if (name !== "a") return null;
    if (decodedAttrs.target !== "_blank") return null;

    const relSpans = findAttrSpans(attrs, "rel");
    if (relSpans === null) return null;
    const relSpan = relSpans[0];
    if (relSpan === undefined) {
      return `<a${attrs} ${doubleQuotedAttr("rel", "noopener")}>`;
    }

    const relValue = attrRawValue(attrs.slice(relSpan.start, relSpan.end));
    if (hasSafeRel(decodedAttrs.rel ?? null)) return null;
    const newRel = `${relValue ?? ""} noopener`.replace(/^[ \t\n\f\r]+/, "");
    const next =
      attrs.slice(0, relSpan.start) +
      doubleQuotedAttr("rel", newRel) +
      attrs.slice(relSpan.end);
    return `<a${next}>`;
  });
}
