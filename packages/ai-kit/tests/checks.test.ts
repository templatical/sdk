import { describe, expect, it } from "vitest";
import { buildRewriteRepairPrompt, checkRewrite, checkAltText } from "../src/server";

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


describe("checkAltText", () => {
  it.each([
    ['  "Image of Shop our autumn collection"  ', "Shop our autumn collection"],
    ["'pIcTuRe Of New arrivals'", "New arrivals"],
    ["A useful purpose", "A useful purpose"],
    ['"One" "Two"', 'One" "Two'],
  ])("normalizes %s", (answer, expected) => {
    expect(checkAltText(answer, { maxLength: 60 })).toBe(expected);
  });
  it.each(["", "  ", '""', "Image of ", "<b>Sale</b>", "Sale <IMG src=x>", "x".repeat(61)])("refuses invalid plain text %j", (answer) => {
    expect(() => checkAltText(answer, { maxLength: 60 })).toThrowError(expect.objectContaining({
      name: "SdkError", statusCode: 502, code: "ai_output_invalid",
      message: "The AI couldn't produce a valid result. Try again.",
    }));
  });
  it("counts the exact custom boundary in UTF-16 units", () => {
    expect(checkAltText("x".repeat(60), { maxLength: 60 })).toHaveLength(60);
    expect(checkAltText("x".repeat(58) + "😀", { maxLength: 60 })).toHaveLength(60);
    expect(() => checkAltText("x".repeat(59) + "😀", { maxLength: 60 })).toThrowError(expect.objectContaining({ code: "ai_output_invalid" }));
    expect(checkAltText("x".repeat(123) + "😀", { maxLength: 125 })).toHaveLength(125);
    expect(() => checkAltText("x".repeat(124) + "😀", { maxLength: 125 })).toThrowError(expect.objectContaining({ code: "ai_output_invalid" }));
  });
});
