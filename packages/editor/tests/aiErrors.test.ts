import { describe, expect, it } from "vitest";
import {
  CollaborationConflict,
  SdkError,
  ThrottledError,
} from "@templatical/types";
import en from "../src/i18n/locales/en";
import { AI_MISSING_PROVIDER_MESSAGE, aiErrorMessage } from "../src/utils/aiErrors";

const format = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) =>
    String(values[key] ?? `{${key}}`),
  );
const message = (error: unknown, context?: "turn" | "undo" | "redo" | "history") =>
  aiErrorMessage(error, en.ai.errors, format, "en", context);

describe("aiErrorMessage (D25)", () => {
  it.each([
    [
      new SdkError("x", 403, "feature_unavailable"),
      "This AI feature isn't available.",
    ],
    [
      new SdkError("x", 403, "limit_reached"),
      "You've used up your AI allowance for now.",
    ],
    [
      new ThrottledError("x", 1000, "rate_limited"),
      "Too many AI requests. Try again in a moment.",
    ],
    [
      new SdkError("x", 409, "ai_turn_running"),
      "An AI request is already running on this template.",
    ],
    [
      new SdkError("x", 413, "content_too_large"),
      "This template is too large for AI.",
    ],
    [
      new SdkError("x", 422, "ai_output_invalid"),
      "The AI couldn't produce a valid result. Try again.",
    ],
    [
      new SdkError("x", 502, "ai_provider_error"),
      "AI is unavailable right now. Try again later.",
    ],
    [
      new SdkError("x", 404, "not_found"),
      "This message is no longer in the conversation.",
    ],
    [
      new CollaborationConflict("x", { code: "lock_held" }),
      "Someone is editing a block the AI needed.",
    ],
    [
      new CollaborationConflict("x", { code: "precondition_failed" }),
      "The template changed while the AI was working.",
    ],
    [
      new SdkError(
        "Your workspace has no AI seats left.",
        403,
        "seats_exhausted",
      ),
      "Your workspace has no AI seats left.",
    ],
    [new TypeError("x is undefined"), "Something went wrong. Try again."],
  ])("%s", (error, expected) => {
    expect(message(error, error instanceof SdkError && error.code === "not_found" ? "undo" : "turn")).toBe(expected);
  });

  it("names the reset date when the backend sends one", () => {
    const error = new SdkError("x", 403, "limit_reached", {
      limit: "aiMonthly",
      resetsAt: "2026-11-01T00:00:00Z",
    });
    expect(message(error)).toMatch(
      /^You've used up your AI allowance until .*2026/,
    );
  });

  it("says an overtaken Undo or Redo can't be done", () => {
    const changed = new CollaborationConflict("x", {
      code: "precondition_failed",
    });
    expect(message(changed, "undo")).toBe(
      "Someone changed these blocks since, so this can't be undone.",
    );
    expect(message(changed, "redo")).toBe(
      "Someone changed these blocks since, so this can't be redone.",
    );
  });
});


it("names missing messages only on replay and gives history its own error", () => {
  const missing = new SdkError("Missing template", 404, "not_found");
  expect(message(missing, "undo")).toBe("This message is no longer in the conversation.");
  expect(message(missing, "redo")).toBe("This message is no longer in the conversation.");
  expect(message(missing, "turn")).toBe("Missing template");
  expect(message(missing, "history")).toBe("Couldn't load the conversation. Try again.");
  expect(message(new Error("Network failed"), "history")).toBe("Couldn't load the conversation. Try again.");
});


it("explains a server-applied backend's missing editor provider", () => {
  expect(message(new SdkError(AI_MISSING_PROVIDER_MESSAGE, 502, "ai_provider_error"))).toBe("This AI backend needs a templates or collaboration provider to show its changes.");
});

class OtherPackageSdkError extends Error {
  constructor(message: string, public statusCode: number, public code?: string, public details?: Record<string, unknown>) { super(message); }
}

it("recognizes SDK errors from a separate package constructor", () => {
  expect(message(new OtherPackageSdkError("quota", 403, "limit_reached"))).toBe(en.ai.errors.limitReached);
  expect(message(new OtherPackageSdkError("slow down", 429, "rate_limited"))).toBe(en.ai.errors.rateLimited);
  expect(message(new Error("plain"))).toBe(en.ai.errors.generic);
  for (const fields of [{ statusCode: "403", code: "limit_reached" }, { statusCode: 403, code: 42 }, { statusCode: 403, details: "invalid" }, { statusCode: 403, details: null }]) {
    expect(message(Object.assign(new Error("invalid shape"), fields))).toBe(en.ai.errors.generic);
  }
});
