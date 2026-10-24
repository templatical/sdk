import { AI_WIRE_HEADER, AI_WIRE_VERSION, type AiWireEvent } from "../wire";
import { aiErrorEvent, PROVIDER_ERROR } from "./errors";

export interface AiEventStreamController {
  /** Write an event. Ignored once `done` or `error` was written. */
  send(event: AiWireEvent): void;
  /** Aborted when the client goes away or `options.signal` aborts. */
  readonly signal: AbortSignal;
}

export interface AiEventStreamOptions {
  /** Write `: ping` after this long without a write (15 s). */
  pingMs?: number;
  signal?: AbortSignal;
  headers?: HeadersInit;
}

/**
 * The SSE response for any Fetch-API server (Next, Hono, Workers, Deno, Bun;
 * Express through an adapter). The producer writes events; a producer that
 * throws ends the stream with an `error` event, and one that returns without
 * `done` or `error` ends it with the provider error.
 */
export function aiEventStream(
  producer: (stream: AiEventStreamController) => Promise<void>,
  options: AiEventStreamOptions = {},
): Response {
  const pingMs = options.pingMs ?? 15_000;
  const encoder = new TextEncoder();
  const abort = new AbortController();
  function forwardAbort(): void {
    abort.abort(options.signal?.reason);
  }
  if (options.signal) {
    if (options.signal.aborted) abort.abort(options.signal.reason);
    else options.signal.addEventListener("abort", forwardAbort, { once: true });
  }
  let timer: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  function cleanup(): void {
    if (timer) clearInterval(timer);
    options.signal?.removeEventListener("abort", forwardAbort);
  }

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      let finished = false;
      let lastWrite = Date.now();
      const write = (chunk: string): void => {
        if (closed) return;
        controller.enqueue(encoder.encode(chunk));
        lastWrite = Date.now();
      };
      const send = (event: AiWireEvent): void => {
        if (finished) return;
        write(`data: ${JSON.stringify(event)}\n\n`);
        if (event.type === "done" || event.type === "error") finished = true;
      };
      timer = setInterval(
        () => {
          if (Date.now() - lastWrite >= pingMs) write(": ping\n\n");
        },
        Math.max(1, Math.floor(pingMs / 3)),
      );
      void (async () => {
        try {
          await producer({ send, signal: abort.signal });
          if (!abort.signal.aborted) send({ type: "error", ...PROVIDER_ERROR });
        } catch (error) {
          if (!abort.signal.aborted) send(aiErrorEvent(error));
        } finally {
          cleanup();
          if (!closed) {
            closed = true;
            controller.close();
          }
        }
      })();
    },
    cancel(reason) {
      closed = true;
      cleanup();
      abort.abort(reason);
    },
  });

  const headers = new Headers(options.headers);
  headers.set("Content-Type", "text/event-stream");
  headers.set("Cache-Control", "no-cache");
  headers.set("X-Accel-Buffering", "no");
  headers.set(AI_WIRE_HEADER, AI_WIRE_VERSION);
  return new Response(body, { headers });
}
