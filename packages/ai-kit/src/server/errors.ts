import {
  CollaborationConflict,
  SdkError,
  ThrottledError,
} from "@templatical/types";
import {
  AI_ERROR_MESSAGES,
  AI_ERROR_STATUS,
  AI_WIRE_HEADER,
  AI_WIRE_VERSION,
  type AiErrorEvent,
} from "../wire";

const PROVIDER_ERROR = {
  code: "ai_provider_error",
  message: AI_ERROR_MESSAGES.ai_provider_error,
} as const;

function known(error: unknown): error is SdkError & { code: string } {
  return error instanceof SdkError && typeof error.code === "string";
}

function conflictDetails(error: unknown): Record<string, unknown> {
  if (!(error instanceof CollaborationConflict)) return {};
  return {
    ...(error.opIndex !== undefined ? { opIndex: error.opIndex } : {}),
    ...(error.holder !== undefined ? { holder: error.holder } : {}),
    ...(error.holders !== undefined ? { holders: error.holders } : {}),
  };
}

/** An error as the stream's last event. Anything but a coded `SdkError` hides behind the provider error. */
export function aiErrorEvent(error: unknown): AiErrorEvent {
  if (!known(error)) return { type: "error", ...PROVIDER_ERROR };
  return {
    ...error.details,
    ...conflictDetails(error),
    type: "error",
    code: error.code,
    message: error.message,
  };
}

/** A JSON response with the wire's header; `204` has no body. */
export function aiJsonResponse(body: unknown, status = 200): Response {
  const headers = new Headers({ [AI_WIRE_HEADER]: AI_WIRE_VERSION });
  if (status === 204) return new Response(null, { status, headers });
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * An error before the stream starts: `{ message, code, …details }` with the
 * code's status, `Retry-After` (seconds) for a `ThrottledError`.
 */
export function aiErrorResponse(error: unknown): Response {
  if (!(error instanceof SdkError))
    return aiJsonResponse({ ...PROVIDER_ERROR }, 502);
  // A validation failure (`readAiRequest`'s 422) has no code, as Laravel's has none.
  const code = typeof error.code === "string" ? error.code : undefined;
  const status =
    error.statusCode ??
    (code !== undefined ? AI_ERROR_STATUS[code] : undefined) ??
    400;
  const response = aiJsonResponse(
    {
      ...error.details,
      ...conflictDetails(error),
      message: error.message,
      ...(code !== undefined ? { code } : {}),
    },
    status,
  );
  if (error instanceof ThrottledError) {
    response.headers.set(
      "Retry-After",
      String(Math.ceil(error.retryAfterMs / 1000)),
    );
  }
  return response;
}

export { PROVIDER_ERROR };
