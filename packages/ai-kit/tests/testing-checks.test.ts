import { describe, expect, it } from "vitest";
import { SdkError } from "@templatical/types";
import {
  describeError,
  errorProblem,
  messageProblem,
} from "../src/testing/checks";

describe("testing contract checks", () => {
  it("describes SDK, standard and non-Error rejections exactly", () => {
    expect(describeError(new SdkError("Try later.", 429, "rate_limited"))).toBe(
      "SdkError rate_limited 429: Try later.",
    );
    expect(describeError(new SdkError("Missing metadata."))).toBe(
      "SdkError (no code) : Missing metadata.",
    );
    expect(describeError(new TypeError("Invalid."))).toBe(
      "TypeError: Invalid.",
    );
    expect(describeError("offline")).toBe("offline");
    expect(describeError(null)).toBe("null");
  });

  it("accepts AbortErrors and known SDK codes and explains other rejections", () => {
    expect(errorProblem(new DOMException("Stopped.", "AbortError"))).toBe(null);
    expect(errorProblem(new SdkError("Try later.", 429, "rate_limited"))).toBe(
      null,
    );
    expect(errorProblem(new Error("offline"))).toBe(
      "not an SdkError: Error: offline",
    );
    expect(errorProblem("offline")).toBe("not an SdkError: offline");
    expect(errorProblem(new SdkError("Missing metadata."))).toBe(
      "unknown code: SdkError (no code) : Missing metadata.",
    );
    expect(errorProblem(new SdkError("Unknown.", 502, "made_up"))).toBe(
      "unknown code: SdkError made_up 502: Unknown.",
    );
  });

  it("accepts valid messages and reports malformed message and batch fields", () => {
    const message = {
      id: "a-1",
      role: "assistant",
      kind: "chat",
      text: "Done.",
      batches: [{ batchId: "b-1", revision: null, operationCount: 1 }],
      undone: false,
      createdAt: "2026-10-21T00:00:00Z",
    };
    expect(messageProblem(message)).toBe(null);
    expect(
      messageProblem({
        ...message,
        role: "user",
        kind: "fix",
        batches: [{ batchId: "b-2", revision: 1, operationCount: 0 }],
      }),
    ).toBe(null);
    expect(
      messageProblem({
        ...message,
        role: "user",
        attachments: [
          { name: "shot.png", kind: "image" },
          { name: "ref.pdf", kind: "pdf" },
        ],
      }),
    ).toBe(null);
    for (const change of [
      { id: 1 },
      { kind: "design" },
      ...[
        null,
        {},
        [null],
        [{ name: 1, kind: "image" }],
        [{ name: "x", kind: "video" }],
      ].map((attachments) => ({ attachments })),
      { role: "system" },
      { kind: "rewrite" },
      { text: 1 },
      { batches: null },
      { undone: "false" },
      { createdAt: 1 },
      { batches: [{ batchId: 1, revision: null, operationCount: 1 }] },
      { batches: [{ batchId: "b-1", revision: 0.5, operationCount: 1 }] },
      { batches: [{ batchId: "b-1", revision: null, operationCount: 0.5 }] },
    ]) {
      const malformed = { ...message, ...change };
      expect(messageProblem(malformed)).toBe(
        `malformed message: ${JSON.stringify(malformed)}`,
      );
    }
    expect(messageProblem(null)).toBe("malformed message: null");
  });
});
