import type {
  AiMergeTags,
  CategoryScore,
  FindingSeverity,
  ScoringCategory,
  ScoringFinding,
  ScoringResult,
} from "@templatical/types";
import { SCORING_RESULT_SCHEMA, SUGGESTIONS_SCHEMA } from "../generated/assets";
import { AI_LIMITS } from "../wire";
import {
  flattenMergeTags,
  mergeTagTokens,
  unknownMergeTags,
} from "./merge-tags";

/** For structured scoring output (`schema/scoring-result.schema.json`). */
export const scoringResultSchema = SCORING_RESULT_SCHEMA;
/** For structured suggestions output (`schema/suggestions.schema.json`). */
export const suggestionsSchema = SUGGESTIONS_SCHEMA;

function stripFences(text: string): string {
  return text.replace(/^\s*```[a-z]*\s*|\s*```\s*$/gi, "");
}

/**
 * A rewrite's output, checked: code fences dropped, not empty, no merge tag
 * that is neither declared nor in the input. On `ok: false`, ask once more
 * with `buildRewriteRepairPrompt`; if that fails too, reject with
 * `ai_output_invalid`. No sanitizer: the editor sanitizes what it shows.
 */
export function checkRewrite(
  html: string,
  inputHtml: string,
  mergeTags: AiMergeTags | null,
): { ok: true; html: string } | { ok: false; reason: string } {
  const clean = stripFences(html).trim();
  if (clean === "") return { ok: false, reason: "Your rewrite was empty." };
  if (mergeTags !== null && mergeTags.syntax !== "custom") {
    const allowed = [
      ...mergeTags.tags.map((tag) => tag.value),
      ...mergeTagTokens(flattenMergeTags(inputHtml), mergeTags.syntax),
    ];
    const unknown = unknownMergeTags(
      mergeTags.syntax,
      mergeTagTokens(clean, mergeTags.syntax),
      allowed,
    );
    if (unknown.length > 0) {
      return {
        ok: false,
        reason: `Your rewrite used merge tags that don't exist: ${unknown.join(", ")}.`,
      };
    }
  }
  return { ok: true, html: clean };
}

export function buildRewriteRepairPrompt(
  prompt: string,
  reason: string,
): string {
  return `${prompt}\n\n${reason} Rewrite it again, using only the merge tags in the text.`;
}

const CATEGORIES: readonly ScoringCategory[] = [
  "spam",
  "readability",
  "bestPractices",
];
const SEVERITIES: readonly FindingSeverity[] = ["high", "medium", "low"];

function parsed(answer: unknown): unknown {
  if (typeof answer !== "string") return answer;
  try {
    return JSON.parse(stripFences(answer));
  } catch {
    return null;
  }
}

const record = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

function clamp(score: unknown): number {
  const number = typeof score === "number" ? score : Number(score);
  return Number.isFinite(number)
    ? Math.max(0, Math.min(100, Math.round(number)))
    : 0;
}

/**
 * A model's scoring answer in the contract's shape (S7 Y9): integer scores
 * 0–100, three categories, at most ten findings each, unknown severities as
 * `medium`, blocks the template doesn't have as `null`, empty ids made up.
 */
export function normalizeScoringResult(
  answer: unknown,
  blockIds: Iterable<string>,
): ScoringResult {
  const known = new Set(blockIds);
  const root = record(parsed(answer));
  const categories = record(root.categories);
  const result = {} as Record<ScoringCategory, CategoryScore>;
  const ids = new Set<string>();
  const cut = (text: string, max: number) =>
    Array.from(text).slice(0, max).join("");
  for (const name of CATEGORIES) {
    const category = record(categories[name]);
    const findings = Array.isArray(category.findings) ? category.findings : [];
    result[name] = {
      score: clamp(category.score),
      findings: findings
        .slice(0, AI_LIMITS.findingsPerCategoryMax)
        .map((raw, index): ScoringFinding => {
          const finding = record(raw);
          const base = cut(
            typeof finding.id === "string" && finding.id !== ""
              ? finding.id
              : `${name}-${index}`,
            64,
          );
          let id = base;
          for (let suffix = 2; ids.has(id); suffix++) {
            const tail = `-${suffix}`;
            id = cut(base, 64 - Array.from(tail).length) + tail;
          }
          ids.add(id);
          return {
            id,
            severity: SEVERITIES.includes(finding.severity as FindingSeverity)
              ? (finding.severity as FindingSeverity)
              : "medium",
            message:
              typeof finding.message === "string"
                ? cut(finding.message, 1000)
                : "",
            blockId:
              typeof finding.blockId === "string" && known.has(finding.blockId)
                ? finding.blockId
                : null,
            suggestion:
              typeof finding.suggestion === "string"
                ? cut(finding.suggestion, 1000)
                : "",
          };
        }),
    };
  }
  return { score: clamp(root.score), categories: result };
}

/** At most four non-empty suggestions of at most 80 characters (code points). */
export function parseSuggestions(answer: unknown): string[] {
  const value = parsed(answer);
  const list = Array.isArray(value) ? value : record(value).suggestions;
  if (!Array.isArray(list)) return [];
  return list
    .filter(
      (item): item is string => typeof item === "string" && item.trim() !== "",
    )
    .map((item) =>
      Array.from(item.trim()).slice(0, AI_LIMITS.suggestionMaxChars).join(""),
    )
    .slice(0, AI_LIMITS.suggestionsMax);
}
