import type { Rule, RuleMeta } from "../../types";

export const meta: RuleMeta = {
  id: "a11y.missing-preheader",
  reference:
    "https://docs.templatical.com/quality/accessibility/rule-catalog#template-level",
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
