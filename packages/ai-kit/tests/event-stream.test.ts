import { afterEach, describe, expect, it, vi } from "vitest";
import { CollaborationConflict, SdkError, ThrottledError } from "../src";
import { aiErrorResponse, aiEventStream, aiJsonResponse } from "../src/server";

afterEach(() => vi.useRealTimers());

describe("aiEventStream (D32)", () => {
  it("passes an already-aborted signal and its reason to the producer immediately", async () => {
    const external = new AbortController();
    external.abort("Request already cancelled");
    let observed: { aborted: boolean; reason: unknown } | null = null;
    const response = aiEventStream(
      async (stream) => {
        observed = {
          aborted: stream.signal.aborted,
          reason: stream.signal.reason,
        };
      },
      { signal: external.signal },
    );
    expect(observed).toEqual({
      aborted: true,
      reason: "Request already cancelled",
    });
    expect(await response.text()).toBe("");
  });

  it("ignores a producer write after the reader closes the body", async () => {
    let stream!: Parameters<Parameters<typeof aiEventStream>[0]>[0];
    let finish!: () => void;
    const response = aiEventStream((controller) => {
      stream = controller;
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    });
    const reader = response.body!.getReader();
    await reader.cancel("Client left");
    stream.send({ type: "text", text: "Late text" });
    expect(await reader.read()).toEqual({ done: true, value: undefined });
    expect(stream.signal.aborted).toBe(true);
    expect(stream.signal.reason).toBe("Client left");
    finish();
  });

  it("writes each event as a data line, with the wire's headers", async () => {
    const response = aiEventStream(async (stream) => {
      stream.send({ type: "text", text: "Hi" });
      stream.send({ type: "done", messageId: "m-1" });
      stream.send({ type: "text", text: "ignored after done" });
    });

    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
    expect(response.headers.get("X-Accel-Buffering")).toBe("no");
    expect(response.headers.get("Templatical-AI-Wire")).toBe("1");
    expect(await response.text()).toBe(
      'data: {"type":"text","text":"Hi"}\n\ndata: {"type":"done","messageId":"m-1"}\n\n',
    );
  });

  it("ends a producer that throws an SdkError with its code, message and details", async () => {
    const response = aiEventStream(async () => {
      throw new SdkError("You've used this month's AI.", 403, "limit_reached", {
        limit: "aiMonthly",
        resetsAt: "2026-11-01T00:00:00Z",
      });
    });
    expect(await response.text()).toBe(
      'data: {"limit":"aiMonthly","resetsAt":"2026-11-01T00:00:00Z","type":"error","code":"limit_reached","message":"You\'ve used this month\'s AI."}\n\n',
    );
  });

  it("hides anything else behind the provider error, and ends a stream left open the same way", async () => {
    const thrown = aiEventStream(async () => {
      throw new Error("ECONNRESET at 10.0.0.3");
    });
    const silent = aiEventStream(async () => {});
    const expected =
      'data: {"type":"error","code":"ai_provider_error","message":"AI is unavailable right now. Try again later."}\n\n';
    expect(await thrown.text()).toBe(expected);
    expect(await silent.text()).toBe(expected);
  });

  it("pings while nothing else is written", async () => {
    vi.useFakeTimers();
    let finish!: () => void;
    const response = aiEventStream(
      (stream) =>
        new Promise<void>((resolve) => {
          finish = () => {
            stream.send({ type: "done", html: "<p>Done</p>" });
            resolve();
          };
        }),
      { pingMs: 15_000 },
    );

    await vi.advanceTimersByTimeAsync(15_000);
    finish();
    await vi.advanceTimersByTimeAsync(0);

    expect(await response.text()).toBe(
      ': ping\n\ndata: {"type":"done","html":"<p>Done</p>"}\n\n',
    );
  });

  it("tells the producer when the client goes away", async () => {
    let seen: AbortSignal | null = null;
    const response = aiEventStream(
      (stream) =>
        new Promise<void>((resolve) => {
          seen = stream.signal;
          stream.signal.addEventListener("abort", () => resolve());
        }),
    );
    await response.body!.cancel();
    expect(seen!.aborted).toBe(true);
  });

  it("forwards an external abort and its reason to an active producer", async () => {
    const external = new AbortController();
    let seen!: AbortSignal;
    const response = aiEventStream(
      (stream) => {
        seen = stream.signal;
        return new Promise<void>((resolve) => {
          stream.signal.addEventListener("abort", () => resolve(), {
            once: true,
          });
        });
      },
      { signal: external.signal },
    );

    external.abort("Server shutdown");

    expect(await response.text()).toBe("");
    expect(seen.aborted).toBe(true);
    expect(seen.reason).toBe("Server shutdown");
  });

  it("stops forwarding external aborts after normal completion", async () => {
    const external = new AbortController();
    let seen!: AbortSignal;
    const response = aiEventStream(async (stream) => {
      seen = stream.signal;
      stream.send({ type: "done", messageId: "m-1" });
    }, { signal: external.signal });
    await response.text();
    const aborted = vi.fn();
    seen.addEventListener("abort", aborted);

    external.abort("Server shutdown");

    expect(seen.aborted).toBe(false);
    expect(aborted).not.toHaveBeenCalled();
  });

  it("stops forwarding external aborts after body cancellation even if the producer stays pending", async () => {
    const external = new AbortController();
    let seen!: AbortSignal;
    const response = aiEventStream((stream) => {
      seen = stream.signal;
      return new Promise<void>(() => {});
    }, { signal: external.signal });
    await response.body!.cancel("Client left");
    expect(seen.aborted).toBe(true);
    expect(seen.reason).toBe("Client left");
    // Abort is idempotent, so observe public abort calls to catch redundant
    // forwarding to the already-cancelled producer. The spy calls through.
    const abort = vi.spyOn(AbortController.prototype, "abort");
    try {
      external.abort("Server shutdown");
      expect(abort).toHaveBeenCalledTimes(1);
      expect(seen.reason).toBe("Client left");
    } finally {
      abort.mockRestore();
    }
  });
});

describe("errors before the stream", () => {
  it.each([
    ["rate_limited", 429],
    ["custom_failure", 400],
    [undefined, 400],
  ] as const)(
    "uses the status fallback for code %s when no status was supplied",
    async (code, status) => {
      const response = aiErrorResponse(
        new SdkError("Please retry.", undefined, code),
      );
      expect(response.status).toBe(status);
      expect(response.headers.get("Templatical-AI-Wire")).toBe("1");
      expect(await response.json()).toEqual({
        message: "Please retry.",
        ...(code === undefined ? {} : { code }),
      });
    },
  );

  it("answers an AI code with its status, body and headers", async () => {
    const response = aiErrorResponse(
      new ThrottledError("Too many AI requests. Try again in a moment.", 2500, "rate_limited"),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("3");
    expect(response.headers.get("Templatical-AI-Wire")).toBe("1");
    expect(await response.json()).toEqual({
      message: "Too many AI requests. Try again in a moment.",
      code: "rate_limited",
    });
  });

  it("keeps an operation refusal's index for Undo and Redo", async () => {
    const response = aiErrorResponse(
      new CollaborationConflict("Changed since.", { code: "precondition_failed", opIndex: 2 }),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      message: "Changed since.",
      code: "precondition_failed",
      opIndex: 2,
    });
  });

  it("answers a validation failure with its 422 and message, and no code", async () => {
    const response = aiErrorResponse(new SdkError("The message must be 1 to 4,000 characters.", 422));
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      message: "The message must be 1 to 4,000 characters.",
    });
  });

  it("never shows an unexpected error's text", async () => {
    const response = aiErrorResponse(new TypeError("x is undefined"));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      message: "AI is unavailable right now. Try again later.",
      code: "ai_provider_error",
    });
  });

  it("answers JSON with the wire's header", async () => {
    const response = aiJsonResponse({ data: [] });
    expect(response.status).toBe(200);
    expect(response.headers.get("Templatical-AI-Wire")).toBe("1");
    expect(await response.json()).toEqual({ data: [] });
    expect(aiJsonResponse(null, 204).status).toBe(204);
  });
});
