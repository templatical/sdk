import { isImage } from "@templatical/types";
import type { Rule, RuleMeta } from "../../types";

export const meta: RuleMeta = {
  id: "img-alt-is-filename",
  severity: "warning",
};

const FILENAME_PATTERNS: RegExp[] = [
  /\.(jpe?g|png|gif|webp|svg)$/i,
  /^IMG[_-]?\d+/i,
  /^Untitled/i,
  /^Screen[\s_-]?Shot/i,
  /^DSC\d+/i,
];

export const imgAltIsFilename: Rule = {
  meta,
  block(block) {
    if (!isImage(block) || block.decorative === true) return null;
    const alt = block.alt?.trim() ?? "";
    if (alt === "") return null;
    if (!FILENAME_PATTERNS.some((re) => re.test(alt))) return null;

    return {
      blockId: block.id,
      params: { alt },
      fix: {
        description: "Clear alt text",
        apply: (ctx) => ctx.updateBlock(block.id, { alt: "" }),
      },
    };
  },
};
