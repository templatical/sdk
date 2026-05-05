import type { Rule, RuleMeta } from "../../types";

export const meta: RuleMeta = {
  id: "missing-preheader",
  severity: "info",
};

export const missingPreheader: Rule = {
  meta,
  template(content) {
    const text = content.settings.preheaderText?.trim() ?? "";
    if (text !== "") return [];
    return [{ blockId: null }];
  },
};
