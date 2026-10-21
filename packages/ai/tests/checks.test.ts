import { describe, expect, it } from "vitest";
import {
  buildRewriteRepairPrompt,
  checkRewrite,
  normalizeScoringResult,
  parseSuggestions,
  scoringResultSchema,
  suggestionsSchema,
} from "../src/server";

const tags = { syntax: "liquid" as const, tags: [{ value: "{{first_name}}", label: "First" }] };

describe("checkRewrite", () => {
  it("drops code fences and accepts the input's and declared tags", () => {
    expect(
      checkRewrite(
        "```html\n<p>Hey {{first_name}}, {{order_id}}</p>\n```",
        '<p>Hi <span data-merge-tag="{{order_id}}" data-label="Order">Order</span></p>',
        tags,
      ),
    ).toEqual({ ok: true, html: "<p>Hey {{first_name}}, {{order_id}}</p>" });
  });

  it("refuses an empty rewrite and an invented tag, with the reason the repair sends", () => {
    expect(checkRewrite("  ", "<p>x</p>", tags)).toEqual({ ok: false, reason: "Your rewrite was empty." });
    expect(checkRewrite("<p>{{coupon}}</p>", "<p>x</p>", tags)).toEqual({
      ok: false,
      reason: "Your rewrite used merge tags that don't exist: {{coupon}}.",
    });
    expect(buildRewriteRepairPrompt("PROMPT", "Your rewrite was empty.")).toBe(
      "PROMPT\n\nYour rewrite was empty. Rewrite it again, using only the merge tags in the text.",
    );
  });
});

describe("normalizeScoringResult", () => {
  it("clamps scores, defaults severities and ids, and forgets unknown blocks", () => {
    expect(
      normalizeScoringResult(
        {
          score: 140,
          categories: {
            spam: { score: -3, findings: [] },
            readability: {
              score: 71.6,
              findings: [
                { id: "", severity: "urgent", message: "Long.", blockId: "gone", suggestion: "Cut." },
              ],
            },
          },
        },
        ["p1"],
      ),
    ).toEqual({
      score: 100,
      categories: {
        spam: { score: 0, findings: [] },
        readability: {
          score: 72,
          findings: [
            { id: "readability-0", severity: "medium", message: "Long.", blockId: null, suggestion: "Cut." },
          ],
        },
        bestPractices: { score: 0, findings: [] },
      },
    });
  });

  it("keeps at most ten findings a category, and reads a JSON answer", () => {
    const findings = Array.from({ length: 12 }, (_, i) => ({
      id: `f${i}`, severity: "low", message: "m", blockId: null, suggestion: "s",
    }));
    const result = normalizeScoringResult(
      JSON.stringify({ score: 50, categories: { spam: { score: 50, findings } } }),
      [],
    );
    expect(result.categories.spam.findings).toHaveLength(10);
  });
});

describe("parseSuggestions", () => {
  it("keeps four non-empty suggestions of at most 80 characters", () => {
    expect(
      parseSuggestions({
        suggestions: ["Add a footer", " ", 7, "x".repeat(90), "Bolder button", "Shorter intro", "Fifth"],
      }),
    ).toEqual(["Add a footer", "x".repeat(80), "Bolder button", "Shorter intro"]);
    expect(parseSuggestions('["One"]')).toEqual(["One"]);
    expect(parseSuggestions("not json")).toEqual([]);
  });

  it("exports the structured-output schemas", () => {
    expect(scoringResultSchema).toMatchObject({ title: "ScoringResult" });
    expect(suggestionsSchema).toMatchObject({ title: "Suggestions" });
  });
});


it("normalizes long and colliding scoring findings for the Fix reader", () => {
  const finding = { id: "😀".repeat(65), message: "😀".repeat(1001), suggestion: "😀".repeat(1001), blockId: null };
  const result = normalizeScoringResult({ categories: {
    spam: { findings: [finding, { ...finding, id: "1" }, { ...finding, id: "1-2" }] },
    readability: { findings: [finding, { ...finding, id: "1" }, { ...finding, id: "1" }] },
  } }, []);
  const findings = [...result.categories.spam.findings, ...result.categories.readability.findings];
  expect(findings[0]).toMatchObject({ id: "😀".repeat(64), message: "😀".repeat(1000), suggestion: "😀".repeat(1000) });
  expect(new Set(findings.map((finding) => finding.id)).size).toBe(6);
  expect(findings.every((finding) => Array.from(finding.id).length <= 64)).toBe(true);
});
