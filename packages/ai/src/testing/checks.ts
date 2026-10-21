import type { AiChatMessage, ScoringResult } from "@templatical/types";
import { SdkError } from "@templatical/types";
import { AI_LIMITS } from "../wire";

const KNOWN_CODES = new Set([
  "feature_unavailable",
  "limit_reached",
  "rate_limited",
  "ai_turn_running",
  "content_too_large",
  "ai_output_invalid",
  "ai_provider_error",
  "not_found",
  "block_exists",
  "block_missing",
  "anchor_missing",
  "precondition_failed",
  "lock_held",
  "locked_by_others",
  "invalid_operation",
]);

export function describeError(error: unknown): string {
  if (error instanceof SdkError) {
    return `${error.name} ${error.code ?? "(no code)"} ${error.statusCode ?? ""}: ${error.message}`.trim();
  }
  return error instanceof Error
    ? `${error.name}: ${error.message}`
    : String(error);
}

/** Why a rejection breaks the contract, or `null`: SdkErrors with known codes and AbortErrors are fine. */
export function errorProblem(error: unknown): string | null {
  if (error instanceof Error && error.name === "AbortError") return null;
  if (!(error instanceof SdkError))
    return `not an SdkError: ${describeError(error)}`;
  if (typeof error.code !== "string" || !KNOWN_CODES.has(error.code)) {
    return `unknown code: ${describeError(error)}`;
  }
  return null;
}

const isScore = (value: unknown) =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= 100;

export function scoringProblem(result: unknown): string | null {
  const root = result as ScoringResult | null;
  if (!root || !isScore(root.score)) return "score must be an integer 0–100";
  const names = Object.keys(root.categories ?? {}).sort();
  if (names.join() !== "bestPractices,readability,spam") {
    return `categories must be spam, readability, bestPractices (got ${names.join(", ")})`;
  }
  for (const [name, category] of Object.entries(root.categories)) {
    if (!isScore(category.score))
      return `${name}.score must be an integer 0–100`;
    if (!Array.isArray(category.findings))
      return `${name}.findings must be a list`;
    for (const finding of category.findings) {
      if (
        typeof finding.id !== "string" ||
        !["high", "medium", "low"].includes(finding.severity) ||
        typeof finding.message !== "string" ||
        typeof finding.suggestion !== "string" ||
        !(finding.blockId === null || typeof finding.blockId === "string")
      ) {
        return `${name} has a malformed finding: ${JSON.stringify(finding)}`;
      }
    }
  }
  return null;
}

export function suggestionsProblem(list: unknown): string | null {
  if (!Array.isArray(list)) return "must be a list";
  if (list.length > AI_LIMITS.suggestionsMax)
    return `${list.length} suggestions (at most 4)`;
  const bad = list.findIndex(
    (item) =>
      typeof item !== "string" ||
      Array.from(item).length > AI_LIMITS.suggestionMaxChars,
  );
  return bad === -1
    ? null
    : `not a string of at most 80 characters: ${JSON.stringify(list[bad])}`;
}

export function messageProblem(message: unknown): string | null {
  const m = message as AiChatMessage;
  if (
    !m ||
    typeof m.id !== "string" ||
    !["user", "assistant"].includes(m.role) ||
    !["chat", "fix", "design"].includes(m.kind) ||
    typeof m.text !== "string" ||
    !Array.isArray(m.batches) ||
    typeof m.undone !== "boolean" ||
    typeof m.createdAt !== "string" ||
    !m.batches.every(
      (batch) =>
        typeof batch.batchId === "string" &&
        (batch.revision === null || Number.isInteger(batch.revision)) &&
        Number.isInteger(batch.operationCount),
    )
  ) {
    return `malformed message: ${JSON.stringify(message)}`;
  }
  return null;
}
