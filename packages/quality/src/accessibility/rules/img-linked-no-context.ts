import { isImage } from "@templatical/types";
import type { Rule, RuleMeta } from "../../types";

export const meta: RuleMeta = {
  id: "img-linked-no-context",
  severity: "warning",
};

const ACTION_HINTS = [
  "buy",
  "shop",
  "view",
  "read",
  "learn",
  "open",
  "go",
  "see",
  "explore",
  "discover",
  "browse",
  "download",
  "get",
  "claim",
  "redeem",
  "watch",
];

export const imgLinkedNoContext: Rule = {
  meta,
  block(block) {
    if (!isImage(block) || block.decorative === true) return null;
    if (!block.linkUrl || block.linkUrl.trim() === "") return null;
    const alt = (block.alt ?? "").trim();
    if (alt === "") return null;
    const tokens = alt
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean);
    if (tokens.some((token) => ACTION_HINTS.includes(token))) return null;
    return { blockId: block.id };
  },
};
