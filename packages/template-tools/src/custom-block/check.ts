// The full `custom-block validate` pipeline, as a library function. Stages
// short-circuit where a later stage would only report noise: no Liquid or
// render checks on a structurally broken definition, no render on a template
// that doesn't parse or loads another file, and no lint on one that fails to
// render.

import { checkAccessibility } from "./a11y";
import { validateCustomBlockDefinition } from "./definition";
import { checkLiquid } from "./liquid";
import { checkRecipe } from "./recipe";
import { renderSpecimenMjml, renderStates, type RenderedState } from "./render";
import { checkEmailSafety } from "./safety";
import type {
  CustomBlockCheckResult,
  CustomBlockIssue,
  CustomBlockWorkingFile,
} from "./types";

export interface CheckCustomBlockOptions {
  compileMjml?: (mjml: string) => Promise<{ errors: unknown[] }>;
}

const finish = (issues: CustomBlockIssue[]): CustomBlockCheckResult => ({
  valid: !issues.some((i) => i.severity === "error"),
  issues,
});

export async function checkCustomBlock(
  data: unknown,
  { compileMjml }: CheckCustomBlockOptions = {},
): Promise<CustomBlockCheckResult> {
  const structural = validateCustomBlockDefinition(data);
  if (!structural.valid) return structural;
  const def = data as CustomBlockWorkingFile;

  const issues = [...structural.issues, ...checkRecipe(def)];
  const liquid = checkLiquid(def);
  issues.push(...liquid);
  if (
    liquid.some(
      (i) => i.ruleId === "liquid.parse" || i.ruleId === "liquid.file-tag",
    )
  )
    return finish(issues);

  // A template can parse and still throw while rendering; that is a finding
  // about the definition, not a crash of the check.
  let rendered: RenderedState[];
  try {
    rendered = await renderStates(def);
  } catch (err) {
    issues.push({
      ruleId: "liquid.render",
      severity: "error",
      path: "/template",
      message: `The template does not render: ${(err as Error).message}`,
    });
    return finish(issues);
  }
  issues.push(...checkEmailSafety(def, rendered));
  issues.push(...checkAccessibility(rendered));
  const mjml = await renderSpecimenMjml(def);
  // The renderer trims the stylesheet before emitting it.
  const stylesheet = def.stylesheet?.trim();
  if (stylesheet && !mjml.includes(stylesheet)) {
    issues.push({
      ruleId: "render.stylesheet-missing",
      severity: "error",
      message: "The stylesheet did not reach <mj-head> in the rendered MJML.",
    });
  }
  if (compileMjml) {
    for (const e of (await compileMjml(mjml)).errors) {
      const o = e as { formattedMessage?: string; message?: string };
      issues.push({
        ruleId: "render.mjml",
        severity: "warning",
        message: o.formattedMessage ?? o.message ?? String(e),
      });
    }
  }
  return finish(issues);
}
