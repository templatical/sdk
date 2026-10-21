import { vi } from "vitest";
import type { AiWireEvent } from "../../src";

export interface SeenRequest {
  url: string;
  method: string;
  headers: Headers;
  body: unknown;
  signal: AbortSignal | null;
}

/** An SSE body from events, plus raw lines (pings, junk) where a test wants them. */
export function sse(...items: (AiWireEvent | string)[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const chunks = items.map((item) =>
    typeof item === "string" ? item : `data: ${JSON.stringify(item)}\n\n`,
  );
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

/** A stream that delivers its events, then waits until the request is aborted. */
export function sseThenHang(
  signal: () => AbortSignal | null,
  ...events: AiWireEvent[]
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      signal()?.addEventListener("abort", () =>
        controller.error(new DOMException("aborted", "AbortError")),
      );
    },
  });
}

/** Stub the global `fetch` with a responder; returns what it saw. */
export function fakeFetch(
  respond: (request: SeenRequest) => Response | Promise<Response>,
): SeenRequest[] {
  const seen: SeenRequest[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      init.signal?.throwIfAborted();
      const headers = new Headers(init.headers);
      const body =
        init.body instanceof FormData
          ? init.body
          : typeof init.body === "string"
            ? JSON.parse(init.body)
            : init.body ?? null;
      const request = {
        url,
        method: init.method ?? "GET",
        headers,
        body,
        signal: init.signal ?? null,
      };
      seen.push(request);
      return respond(request);
    }),
  );
  return seen;
}

export const streamResponse = (body: ReadableStream<Uint8Array>): Response =>
  new Response(body, {
    headers: { "Content-Type": "text/event-stream", "Templatical-AI-Wire": "1" },
  });

export const jsonResponse = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Templatical-AI-Wire": "1", ...headers },
  });
