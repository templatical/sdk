/**
 * CI guard: run @templatical/quality against every showcase template.
 *
 * Exits non-zero if any rule above `info` severity fires. Wired into
 * `pnpm --filter @templatical/playground run lint:templates`.
 *
 * Run locally with: `pnpm --filter @templatical/playground run lint:templates`
 */
import { lintAccessibility } from "@templatical/quality";
import {
  createBlackFridayTemplate,
  createEventInvitationTemplate,
  createNewsletterTemplate,
  createOrderConfirmationTemplate,
  createPasswordResetTemplate,
  createProductLaunchTemplate,
  createWelcomeTemplate,
} from "../src/templates";

const TEMPLATES = [
  ["product-launch", createProductLaunchTemplate],
  ["newsletter", createNewsletterTemplate],
  ["welcome", createWelcomeTemplate],
  ["order-confirmation", createOrderConfirmationTemplate],
  ["event-invitation", createEventInvitationTemplate],
  ["password-reset", createPasswordResetTemplate],
  ["black-friday", createBlackFridayTemplate],
] as const;

const SEVERITY_RANK: Record<string, number> = { error: 3, warning: 2, info: 1 };

let failed = 0;

for (const [name, build] of TEMPLATES) {
  const issues = lintAccessibility(build()).filter(
    (i) => SEVERITY_RANK[i.severity] >= SEVERITY_RANK.warning,
  );
  if (issues.length === 0) {
    console.log(`✔ ${name}: clean`);
    continue;
  }
  failed++;
  console.error(`✖ ${name}: ${issues.length} issue(s)`);
  for (const issue of issues) {
    const where = issue.blockId ? `block ${issue.blockId}` : "template";
    console.error(
      `  [${issue.severity}] ${issue.ruleId} (${where}): ${issue.message}`,
    );
  }
}

if (failed > 0) {
  console.error(
    `\n${failed} template(s) failed accessibility lint. Fix the issues above or adjust the severity in templates.ts.`,
  );
  process.exit(1);
}

console.log("\nAll templates passed accessibility lint.");
