import { isParagraph, isTitle } from "@templatical/types";
import type { Block } from "@templatical/types";
import type { Rule, RuleMeta } from "../../types";
import { extractAnchors } from "../../html-utils";

export const meta: RuleMeta = {
  id: "link-target-blank-no-rel",
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
        apply: (ctx) => {
          if (!isParagraph(block) && !isTitle(block)) return;
          const updated = addNoopenerToTargetBlank(block.content ?? "");
          ctx.updateBlock(block.id, { content: updated } as Partial<Block>);
        },
      },
    };
  },
};

function addNoopenerToTargetBlank(html: string): string {
  return html.replace(/<a\b([^>]*)>/gi, (match, attrs: string) => {
    const hasTargetBlank = /\btarget\s*=\s*["']_blank["']/i.test(attrs);
    if (!hasTargetBlank) return match;
    const relMatch = /\brel\s*=\s*["']([^"']*)["']/i.exec(attrs);
    if (relMatch) {
      const tokens = relMatch[1].toLowerCase().split(/\s+/);
      if (tokens.includes("noopener") || tokens.includes("noreferrer")) {
        return match;
      }
      const newRel = `${relMatch[1]} noopener`.trim();
      const newAttrs = attrs.replace(relMatch[0], `rel="${newRel}"`);
      return `<a${newAttrs}>`;
    }
    return `<a${attrs} rel="noopener">`;
  });
}
