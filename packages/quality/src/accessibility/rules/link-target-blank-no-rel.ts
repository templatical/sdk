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

interface ParsedAttr {
  raw: string;
  name: string;
  value: string | null;
}

const ATTR_RE =
  /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function parseAttrs(attrs: string): ParsedAttr[] {
  const parsed: ParsedAttr[] = [];
  ATTR_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ATTR_RE.exec(attrs)) !== null) {
    const value = match[2] ?? match[3] ?? match[4] ?? null;
    parsed.push({ raw: match[0], name: match[1], value });
  }
  return parsed;
}

function hasUnsafeTargetBlank(parsed: ParsedAttr[]): boolean {
  return parsed.some(
    (a) =>
      a.name.toLowerCase() === "target" &&
      a.value !== null &&
      a.value.toLowerCase() === "_blank",
  );
}

function addNoopenerToTargetBlank(html: string): string {
  return html.replace(/<a\b([^>]*)>/gi, (match, attrs: string) => {
    const parsed = parseAttrs(attrs);
    if (!hasUnsafeTargetBlank(parsed)) return match;

    const relAttr = parsed.find((a) => a.name.toLowerCase() === "rel");
    if (relAttr) {
      const tokens = (relAttr.value ?? "").toLowerCase().split(/\s+/);
      if (tokens.includes("noopener") || tokens.includes("noreferrer")) {
        return match;
      }
      const newRel = `${relAttr.value ?? ""} noopener`.trim();
      const newAttrs = attrs.replace(relAttr.raw, `rel="${newRel}"`);
      return `<a${newAttrs}>`;
    }
    return `<a${attrs} rel="noopener">`;
  });
}
