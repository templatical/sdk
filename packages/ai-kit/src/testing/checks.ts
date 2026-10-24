import type { AiChatMessage } from "@templatical/types";
import { SdkError } from "@templatical/types";

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

export function messageProblem(message: unknown): string | null {
  const m = message as AiChatMessage;
  if (
    !m ||
    typeof m.id !== "string" ||
    !["user", "assistant"].includes(m.role) ||
    !["chat", "fix"].includes(m.kind) ||
    typeof m.text !== "string" ||
    (m.attachments !== undefined &&
      (!Array.isArray(m.attachments) ||
        !m.attachments.every(
          (a) =>
            a &&
            typeof a.name === "string" &&
            ["image", "pdf"].includes(a.kind),
        ))) ||
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
