import { describe, expect, it } from "vitest";
import {
  SdkError,
  type AiScoreRequest,
  type ScoringResult,
} from "@templatical/types";
import { AI_EVAL_TEMPLATES, AI_RECORDINGS } from "../src/testing";
import {
  describeError,
  errorProblem,
  messageProblem,
  scoringProblem,
  suggestionsProblem,
} from "../src/testing/checks";

const score = () =>
  (AI_RECORDINGS.score as (request: AiScoreRequest) => ScoringResult)({
    templateId: "t-1",
    content: AI_EVAL_TEMPLATES.welcome,
    revision: null,
    sessionId: "s-1",
    mergeTags: null,
    lintFindings: [],
  });

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

  it("accepts a recording's score and requires the exact category names", () => {
    expect(scoringProblem(score())).toBe(null);
    expect(scoringProblem(null)).toBe("score must be an integer 0–100");
    expect(scoringProblem({ score: 50 })).toBe(
      "categories must be spam, readability, bestPractices (got )",
    );
    expect(scoringProblem({ score: 50, categories: { spam: {} } })).toBe(
      "categories must be spam, readability, bestPractices (got spam)",
    );
  });

  it.each([-1, 101, 2.5, "50", Number.NaN])(
    "rejects invalid overall and category scores: %s",
    (invalid) => {
      expect(scoringProblem({ ...score(), score: invalid })).toBe(
        "score must be an integer 0–100",
      );
      const result = score();
      expect(
        scoringProblem({
          ...result,
          categories: {
            ...result.categories,
            readability: { score: invalid, findings: [] },
          },
        }),
      ).toBe("readability.score must be an integer 0–100");
    },
  );

  it("requires a findings list for each category", () => {
    const result = score();
    expect(
      scoringProblem({
        ...result,
        categories: {
          ...result.categories,
          spam: { score: 50, findings: "none" },
        },
      }),
    ).toBe("spam.findings must be a list");
  });

  it.each([
    { id: 7 },
    { severity: "urgent" },
    { message: null },
    { suggestion: 7 },
    { blockId: false },
  ])("identifies malformed finding fields: %j", (change) => {
    const result = score();
    const finding = { ...result.categories.readability.findings[0], ...change };
    expect(
      scoringProblem({
        ...result,
        categories: {
          ...result.categories,
          readability: { score: 50, findings: [finding] },
        },
      }),
    ).toBe(`readability has a malformed finding: ${JSON.stringify(finding)}`);
  });

  it("checks suggestion counts and Unicode character limits", () => {
    expect(suggestionsProblem("One")).toBe("must be a list");
    expect(suggestionsProblem(["One", "Two", "Three", "Four", "Five"])).toBe(
      "5 suggestions (at most 4)",
    );
    expect(suggestionsProblem(["One", 7])).toBe(
      "not a string of at most 80 characters: 7",
    );
    expect(suggestionsProblem(["😀".repeat(81)])).toBe(
      `not a string of at most 80 characters: "${"😀".repeat(81)}"`,
    );
    expect(suggestionsProblem(["😀".repeat(80)])).toBe(null);
    expect(suggestionsProblem([])).toBe(null);
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
    expect(messageProblem({ ...message, kind: "design" })).toBe(null);
    for (const change of [
      { id: 1 },
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
