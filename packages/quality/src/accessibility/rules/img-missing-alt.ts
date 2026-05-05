import { isImage } from "@templatical/types";
import type { Rule, RuleMeta } from "../../types";

export const meta: RuleMeta = {
  id: "img-missing-alt",
  severity: "error",
};

export const imgMissingAlt: Rule = {
  meta,
  block(block) {
    if (!isImage(block)) return null;
    if (block.decorative === true) return null;
    const alt = block.alt?.trim() ?? "";
    if (alt !== "") return null;
    if ((block.src ?? "").trim() === "") return null;
    return { blockId: block.id };
  },
};
