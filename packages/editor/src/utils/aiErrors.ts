import { isSdkError } from "./isSdkError";
import type { Translations } from "../i18n";
import { formatAbsoluteDateTime } from "./formatAbsoluteDateTime";

/** D9's provider refusal; localized separately from provider outages. */
export const AI_MISSING_PROVIDER_MESSAGE =
  "This AI backend changes the template on its server, and the editor can only show those changes with a templates or collaboration provider.";

export type AiErrorContext = "turn" | "undo" | "redo" | "history";

/** S6's codes that mean the template moved on under the AI. */
const CHANGED = new Set([
  "precondition_failed",
  "block_missing",
  "anchor_missing",
  "block_exists",
  "invalid_operation",
]);

/**
 * What to tell the user about an AI failure (D25). The parameter is named
 * `strings`, never `t`: the i18n key guard reads every `t.` chain as a root key.
 */
export function aiErrorMessage(
  error: unknown,
  strings: Translations["ai"]["errors"],
  format: (template: string, values: Record<string, string | number>) => string,
  locale: string | undefined,
  context: AiErrorContext = "turn",
): string {
  if (context === "history") return strings.historyError;
  if (!isSdkError(error)) return strings.generic;
  switch (error.code) {
    case "feature_unavailable":
      return strings.featureUnavailable;
    case "limit_reached": {
      const resetsAt = error.details?.resetsAt;
      const date =
        typeof resetsAt === "string"
          ? formatAbsoluteDateTime(resetsAt, locale, {
              dateStyle: "medium",
              timeStyle: "short",
            })
          : "";
      return date !== ""
        ? format(strings.limitReachedUntil, { date })
        : strings.limitReached;
    }
    case "rate_limited":
      return strings.rateLimited;
    case "ai_turn_running":
      return strings.turnRunning;
    case "content_too_large":
      return strings.contentTooLarge;
    case "ai_output_invalid":
      return strings.outputInvalid;
    case "ai_provider_error":
      return error.message === AI_MISSING_PROVIDER_MESSAGE
        ? strings.missingProvider
        : strings.providerError;
    case "not_found":
      return context === "undo" || context === "redo"
        ? strings.messageGone
        : error.message || strings.generic;
    case "lock_held":
    case "locked_by_others":
      return strings.blockLocked;
  }
  if (typeof error.code === "string" && CHANGED.has(error.code)) {
    if (context === "undo") return strings.undoRefused;
    if (context === "redo") return strings.redoRefused;
    return strings.templateChanged;
  }
  // A BYO backend's own codes come with user-presentable messages (§2).
  return error.message !== "" ? error.message : strings.generic;
}
