import type { SocialIcon, TemplateContent } from "@templatical/types";
import { isSocialIcons } from "@templatical/types";
import type { Rule, RuleHit, RuleMeta } from "../../types";
import { walkBlocks } from "../../walk";

export const meta: RuleMeta = {
  id: "structure.social-icon-missing-image",
  reference:
    "https://docs.templatical.com/quality/structure/rule-catalog#social-icons",
  severity: "error",
};

/** A custom icon the renderer will drop because it has nothing to draw. */
function missingImage(icon: SocialIcon): boolean {
  if (icon.platform !== "custom") return false;
  const imageUrl = icon.imageUrl as unknown;
  return typeof imageUrl !== "string" || imageUrl.trim() === "";
}

export const socialIconMissingImage: Rule = {
  meta,
  template(content: TemplateContent): RuleHit[] {
    const hits: RuleHit[] = [];
    walkBlocks(content, (block) => {
      if (!isSocialIcons(block)) return;
      block.icons.forEach((icon, index) => {
        if (!missingImage(icon)) return;
        hits.push({
          blockId: block.id,
          params: { iconIndex: index + 1 },
        });
      });
    });
    return hits;
  },
};
