/**
 * Generate apps/docs/quality/rule-catalog.md from `@templatical/quality`'s
 * exported `RULES` array. Run as a build step (or pre-commit) so the
 * catalog never drifts from the rule definitions.
 *
 *   tsx apps/docs/.vitepress/scripts/generate-rule-catalog.ts
 *
 * The script writes only when content changes, so it's idempotent and
 * safe to run repeatedly.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { RULES } from "@templatical/quality";

const OUT_PATH = resolve(import.meta.dirname, "../../quality/rule-catalog.md");

const CATEGORY_ORDER = [
  "image",
  "heading",
  "link",
  "text",
  "button",
  "structure",
] as const;

const CATEGORY_LABEL: Record<string, string> = {
  image: "Images",
  heading: "Headings",
  link: "Links",
  text: "Text",
  button: "Buttons",
  structure: "Structure",
};

function escape(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function code(value: string): string {
  return "`" + value.replace(/`/g, "\\`") + "`";
}

function section(category: (typeof CATEGORY_ORDER)[number]): string {
  const rules = RULES.filter((r) => r.meta.category === category);
  if (rules.length === 0) return "";

  const rows = rules
    .map((r) => {
      const refs = (r.meta.references ?? [])
        .map((u, i) => `[${i + 1}](${u})`)
        .join(" ");
      return `| ${code(r.meta.id)} | ${r.meta.severity} | ${r.meta.autoFix ? "yes" : "—"} | ${escape(r.meta.title)} — ${escape(r.meta.rationale)}${refs ? ` ${refs}` : ""} |`;
    })
    .join("\n");

  return `## ${CATEGORY_LABEL[category]}

| Rule | Default severity | Auto-fix | What it checks |
|---|---|---|---|
${rows}
`;
}

const body = `# Rule catalog

> This page is generated from \`@templatical/quality\`'s rule definitions. Edit the rule files in \`packages/quality/src/accessibility/rules/\` and re-run \`tsx apps/docs/.vitepress/scripts/generate-rule-catalog.ts\` — never edit this file by hand.

${RULES.length} rules ship in v1.

${CATEGORY_ORDER.map(section).filter(Boolean).join("\n")}
`;

let existing = "";
try {
  existing = readFileSync(OUT_PATH, "utf8");
} catch {
  /* first run */
}

if (existing === body) {
  console.log("rule-catalog.md is up to date.");
} else {
  writeFileSync(OUT_PATH, body);
  console.log(`Wrote ${OUT_PATH} (${RULES.length} rules).`);
}
