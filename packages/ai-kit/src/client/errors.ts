import type { CollaborationConflictCode } from "@templatical/types";
import {
  CollaborationConflict,
  SdkError,
  ThrottledError,
} from "@templatical/types";
import { AI_ERROR_MESSAGES, AI_ERROR_STATUS, type AiErrorEvent } from "../wire";

/** Shown when the editor refused an `operations` event (§4). */
export const AI_TEMPLATE_CHANGED_MESSAGE =
  "The template changed while the AI was working.";

const CONFLICT_CODES: ReadonlySet<string> = new Set([
  "block_exists",
  "block_missing",
  "anchor_missing",
  "precondition_failed",
  "lock_held",
  "locked_by_others",
  "invalid_operation",
]);

const DEFAULT_RETRY_AFTER_MS = 1000;

/** `Retry-After` (seconds or an HTTP date) in milliseconds; a second when unreadable. */
export function parseRetryAfter(
  header: string | null,
  now = Date.now(),
): number {
  if (header === null || header.trim() === "") return DEFAULT_RETRY_AFTER_MS;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  return Number.isNaN(date) ? DEFAULT_RETRY_AFTER_MS : Math.max(0, date - now);
}

function build(
  status: number | undefined,
  body: Record<string, unknown>,
  retryAfterMs: number,
): SdkError {
  const {
    message: rawMessage,
    errors,
    code: rawCode,
    opIndex,
    holder,
    holders,
    type: _type,
    ...details
  } = body;
  const firstValidation =
    typeof errors === "object" && errors !== null
      ? (
          Object.values(errors as Record<string, unknown>)[0] as
            unknown[] | undefined
        )?.[0]
      : undefined;
  const message =
    typeof firstValidation === "string"
      ? firstValidation
      : typeof rawMessage === "string" && rawMessage !== ""
        ? rawMessage
        : AI_ERROR_MESSAGES.ai_provider_error;
  const code = typeof rawCode === "string" ? rawCode : undefined;
  if (status === 429 || code === "rate_limited") {
    return new ThrottledError(
      message,
      retryAfterMs,
      code ?? "rate_limited",
      details,
    );
  }
  if (code !== undefined && CONFLICT_CODES.has(code)) {
    return new CollaborationConflict(message, {
      code: code as CollaborationConflictCode,
      ...(status !== undefined ? { status } : {}),
      ...(typeof opIndex === "number" ? { opIndex } : {}),
      ...(holder ? { holder: holder as never } : {}),
      ...(Array.isArray(holders) ? { holders: holders as never } : {}),
    });
  }
  return new SdkError(message, status, code, details);
}

/** A refusal before the stream: `{ message, code, …details }` with its status. */
export async function errorFromResponse(response: Response): Promise<SdkError> {
  const body = (await response.json().catch(() => ({}))) as unknown;
  return build(
    response.status,
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {},
    parseRetryAfter(response.headers.get("Retry-After")),
  );
}

/** A stream's `error` event, with the status its code has before a stream (S7 D2). */
export function errorFromEvent(event: AiErrorEvent): SdkError {
  return build(AI_ERROR_STATUS[event.code], event, DEFAULT_RETRY_AFTER_MS);
}

/** The provider's failure: a cut stream, a network error, a malformed answer. */
export function providerFailure(): SdkError {
  return new SdkError(
    AI_ERROR_MESSAGES.ai_provider_error,
    502,
    "ai_provider_error",
  );
}
