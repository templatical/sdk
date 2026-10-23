import { describe, expect, it } from "vitest";
import { buildRewriteRepairPrompt, checkRewrite } from "../src/server";

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
