import { describe, expect, it } from "vitest";
import { CollaborationConflict, SdkError, ThrottledError } from "../src";
import {
  errorFromEvent,
  errorFromResponse,
  parseRetryAfter,
} from "../src/client";
import { jsonResponse } from "./helpers/fake-fetch";

describe("parseRetryAfter", () => {
  const now = Date.parse("2026-10-21T12:00:00Z");

  it.each([
    [null, 1000],
    ["", 1000],
    ["   ", 1000],
    ["unreadable", 1000],
    ["1.5", 1500],
    ["-2", 0],
    ["Wed, 21 Oct 2026 12:00:03 GMT", 3000],
    ["Wed, 21 Oct 2026 11:59:59 GMT", 0],
  ])("reads %j as %i milliseconds", (header, expected) => {
    expect(parseRetryAfter(header, now)).toBe(expected);
  });
});

describe("client error responses", () => {
  it("prefers the first validation message and keeps the remaining details", async () => {
    const error = await errorFromResponse(
      jsonResponse(
        {
          message: "Validation failed.",
          errors: {
            message: ["Write a message.", "Use fewer characters."],
            content: ["Missing content."],
          },
          requestId: "request-1",
        },
        422,
      ),
    );

    expect(error).toBeInstanceOf(SdkError);
    expect(error).toMatchObject({
      name: "SdkError",
      message: "Write a message.",
      statusCode: 422,
      code: undefined,
      details: { requestId: "request-1" },
    });
  });

  it.each([
    ["absent errors", { message: "Try a shorter message." }],
    ["null errors", { message: "Try a shorter message.", errors: null }],
    ["empty errors", { message: "Try a shorter message.", errors: {} }],
    [
      "non-string validation",
      { message: "Try a shorter message.", errors: { message: [7] } },
    ],
  ])("uses the response message with %s", async (_name, body) => {
    const error = await errorFromResponse(jsonResponse(body, 422));
    expect({
      name: error.name,
      message: error.message,
      statusCode: error.statusCode,
      code: error.code,
      details: error.details,
    }).toEqual({
      name: "SdkError",
      message: "Try a shorter message.",
      statusCode: 422,
      code: undefined,
      details: undefined,
    });
  });

  it.each([null, "upstream failed", 7, { message: "", code: 7 }, {}])(
    "uses a safe default for malformed body %j",
    async (body) => {
      const error = await errorFromResponse(jsonResponse(body, 503));
      expect({
        name: error.name,
        message: error.message,
        statusCode: error.statusCode,
        code: error.code,
        details: error.details,
      }).toEqual({
        name: "SdkError",
        message: "AI is unavailable right now. Try again later.",
        statusCode: 503,
        code: undefined,
        details: undefined,
      });
    },
  );

  it("uses the safe default when the response is not JSON", async () => {
    const error = await errorFromResponse(
      new Response("unavailable", { status: 502 }),
    );
    expect({
      message: error.message,
      statusCode: error.statusCode,
      code: error.code,
    }).toEqual({
      message: "AI is unavailable right now. Try again later.",
      statusCode: 502,
      code: undefined,
    });
  });

  it("defaults a 429 without a code to rate_limited", async () => {
    const error = await errorFromResponse(
      jsonResponse({ message: "Slow down.", limit: "requests" }, 429),
    );
    expect(error).toBeInstanceOf(ThrottledError);
    expect(error).toMatchObject({
      name: "ThrottledError",
      message: "Slow down.",
      statusCode: 429,
      code: "rate_limited",
      retryAfterMs: 1000,
      details: { limit: "requests" },
    });
  });

  it("preserves the conflict's operation and lock holders", async () => {
    const holder = {
      sessionId: "s-2",
      actor: { id: "alice", name: "Alice", type: "human" },
    };
    const error = await errorFromResponse(
      jsonResponse(
        {
          message: "Alice is editing this block.",
          code: "lock_held",
          opIndex: 2,
          holder,
          holders: [holder],
        },
        423,
      ),
    );
    expect(error).toBeInstanceOf(CollaborationConflict);
    expect(error).toMatchObject({
      name: "CollaborationConflict",
      message: "Alice is editing this block.",
      statusCode: 423,
      code: "lock_held",
      opIndex: 2,
      holder,
      holders: [holder],
    });
    expect(error.details).toBe(undefined);
  });

  it("omits malformed optional conflict fields", async () => {
    const error = await errorFromResponse(
      jsonResponse(
        {
          message: "Changed.",
          code: "precondition_failed",
          opIndex: "2",
          holder: null,
          holders: {},
        },
        409,
      ),
    );
    expect(error).toMatchObject({
      name: "CollaborationConflict",
      message: "Changed.",
      statusCode: 409,
      code: "precondition_failed",
    });
    expect({
      opIndex: (error as CollaborationConflict).opIndex,
      holder: (error as CollaborationConflict).holder,
      holders: (error as CollaborationConflict).holders,
    }).toEqual({ opIndex: undefined, holder: undefined, holders: undefined });
  });

  it("maps a stream rate limit without an HTTP response", () => {
    const error = errorFromEvent({
      type: "error",
      code: "rate_limited",
      message: "Wait a moment.",
      resetsAt: "2026-10-21T12:01:00Z",
    });
    expect(error).toBeInstanceOf(ThrottledError);
    expect(error).toMatchObject({
      name: "ThrottledError",
      message: "Wait a moment.",
      statusCode: 429,
      code: "rate_limited",
      retryAfterMs: 1000,
      details: { resetsAt: "2026-10-21T12:01:00Z" },
    });
  });

  it("keeps an unknown stream error's code without inventing a status", () => {
    const error = errorFromEvent({
      type: "error",
      code: "backend_busy",
      message: "Try later.",
      requestId: "r-1",
    });
    expect({
      name: error.name,
      message: error.message,
      statusCode: error.statusCode,
      code: error.code,
      details: error.details,
    }).toEqual({
      name: "SdkError",
      message: "Try later.",
      statusCode: undefined,
      code: "backend_busy",
      details: { requestId: "r-1" },
    });
  });
});
