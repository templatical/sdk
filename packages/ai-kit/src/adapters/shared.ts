import { SdkError, ThrottledError } from "@templatical/types";
import { parseRetryAfter } from "../client/errors";
import type { AiModelToolCall } from "../server/model";
import { AI_ERROR_MESSAGES } from "../wire";

/** The content an adapter stored as `{ adapter, content }` state, if it's this adapter's. */
export function ownState<T>(state: unknown, adapter: string): T[] | undefined {
  if (typeof state !== "object" || state === null) return undefined;
  const tagged = state as { adapter?: unknown; content?: unknown };
  return tagged.adapter === adapter && Array.isArray(tagged.content)
    ? (tagged.content as T[])
    : undefined;
}

/** A tool call's arguments as an object (`{}` when the string isn't a JSON object). */
export function toolInput(
  input: AiModelToolCall["input"],
): Record<string, unknown> {
  if (typeof input !== "string") return input;
  try {
    const parsed: unknown = JSON.parse(input);
    return typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** A tool call's arguments as a JSON string. */
export function toolArguments(input: AiModelToolCall["input"]): string {
  return typeof input === "string" ? input : JSON.stringify(input);
}

/** A Blob's bytes as base64, with web APIs only (the kit is isomorphic). */
export async function blobBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let start = 0; start < bytes.length; start += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  }
  return btoa(binary);
}

/** The model refused or a content filter stopped it. */
export function refused(): SdkError {
  return new SdkError(
    AI_ERROR_MESSAGES.ai_provider_error,
    502,
    "ai_provider_error",
  );
}

/** The output hit the token limit while a tool call was being written. */
export function cutOff(): SdkError {
  return new SdkError(
    AI_ERROR_MESSAGES.ai_output_invalid,
    422,
    "ai_output_invalid",
  );
}

function retryAfterHeader(headers: unknown): string | null {
  if (typeof Headers !== "undefined" && headers instanceof Headers)
    return headers.get("retry-after");
  if (typeof headers !== "object" || headers === null) return null;
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === "retry-after" && typeof value === "string")
      return value;
  }
  return null;
}

/**
 * A provider's 429 (after the client's own retries) as the kit's
 * `ThrottledError`; anything else unchanged, so it keeps its own details.
 * Reads the provider SDKs' `status`/`headers` and the AI SDK's
 * `statusCode`/`responseHeaders`, unwrapping a retry error's `lastError`.
 */
export function providerError(error: unknown): unknown {
  if (typeof error !== "object" || error === null) return error;
  const failure = ((error as { lastError?: unknown }).lastError ?? error) as {
    status?: unknown;
    statusCode?: unknown;
    headers?: unknown;
    responseHeaders?: unknown;
  };
  if ((failure.status ?? failure.statusCode) !== 429) return error;
  return new ThrottledError(
    AI_ERROR_MESSAGES.rate_limited,
    parseRetryAfter(
      retryAfterHeader(failure.headers ?? failure.responseHeaders),
    ),
  );
}
