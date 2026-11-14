import type { SocialIcon, TemplateContent } from "@templatical/types";
import { isSocialIcons } from "@templatical/types";
import type { Rule, RuleHit, RuleMeta } from "../../types";
import { walkBlocks } from "../../walk";

export const meta: RuleMeta = {
  id: "a11y.social-icon-missing-alt",
  reference: "https://www.w3.org/WAI/tutorials/images/",
  severity: "warning",
};

/**
 * The custom image is the link's only content. The renderer omits an icon
 * whose image URL is missing or not a non-blank string, so there is no link
 * left that needs a text alternative. A non-string alt is missing.
 */
function missingAlt(icon: SocialIcon): boolean {
  if (icon.platform !== "custom") return false;
  const imageUrl = icon.imageUrl as unknown;
  if (typeof imageUrl !== "string" || imageUrl.trim() === "") return false;
  const alt = icon.alt as unknown;
  return typeof alt !== "string" || alt.trim() === "";
}

export const socialIconMissingAlt: Rule = {
  meta,
  template(content: TemplateContent): RuleHit[] {
    const hits: RuleHit[] = [];
    walkBlocks(content, (block) => {
      if (!isSocialIcons(block)) return;
      block.icons.forEach((icon, index) => {
        if (!missingAlt(icon)) return;
        hits.push({
          blockId: block.id,
          params: { iconIndex: index + 1 },
        });
      });
    });
    return hits;
  },
};
