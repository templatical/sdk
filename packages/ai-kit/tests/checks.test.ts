import { describe, expect, it } from "vitest";
import {
  buildAltTextRepairRequest,
  buildRewriteRepairPrompt,
  checkRewrite,
  checkAltText,
  checkAltTextAnswer,
  type AiModelMessage,
} from "../src/server";

const tags = {
  syntax: "liquid" as const,
  tags: [{ value: "{{first_name}}", label: "First" }],
};

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
    expect(checkRewrite("  ", "<p>x</p>", tags)).toEqual({
      ok: false,
      reason: "Your rewrite was empty.",
    });
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
  it.each([
    "",
    "  ",
    '""',
    "Image of ",
    "<b>Sale</b>",
    "Sale <IMG src=x>",
    "x".repeat(61),
  ])("refuses invalid plain text %j", (answer) => {
    expect(() => checkAltText(answer, { maxLength: 60 })).toThrowError(
      expect.objectContaining({
        name: "SdkError",
        statusCode: 502,
        code: "ai_output_invalid",
        message: "The AI couldn't produce a valid result. Try again.",
      }),
    );
  });
  it("counts the exact custom boundary in UTF-16 units", () => {
    expect(checkAltText("x".repeat(60), { maxLength: 60 })).toHaveLength(60);
    expect(checkAltText("x".repeat(58) + "😀", { maxLength: 60 })).toHaveLength(
      60,
    );
    expect(() =>
      checkAltText("x".repeat(59) + "😀", { maxLength: 60 }),
    ).toThrowError(expect.objectContaining({ code: "ai_output_invalid" }));
    expect(
      checkAltText("x".repeat(123) + "😀", { maxLength: 125 }),
    ).toHaveLength(125);
    expect(() =>
      checkAltText("x".repeat(124) + "😀", { maxLength: 125 }),
    ).toThrowError(expect.objectContaining({ code: "ai_output_invalid" }));
  });
  it.each([
    "Shop\nnow",
    "Shop\rnow",
    "Shop\r\nnow",
    "Shop\u2028now",
    "Shop\u2029now",
    "Image of\nShop now",
  ])("refuses line breaks in %j with the final output error", (answer) => {
    expect(() => checkAltText(answer, { maxLength: 60 })).toThrowError(
      expect.objectContaining({
        name: "SdkError",
        statusCode: 502,
        code: "ai_output_invalid",
        message: "The AI couldn't produce a valid result. Try again.",
      }),
    );
  });
});

describe("checkAltTextAnswer", () => {
  it.each([
    ["", "Your answer was empty."],
    ["  ", "Your answer was empty."],
    ['""', "Your answer was empty."],
    ["Image of ", "Your answer was empty."],
    ["Shop\nnow", "Your answer had several lines."],
    ["Shop\rnow", "Your answer had several lines."],
    ["Shop\r\nnow", "Your answer had several lines."],
    ["Shop\u2028now", "Your answer had several lines."],
    ["Shop\u2029now", "Your answer had several lines."],
    ["Image of\nShop now", "Your answer had several lines."],
    ["<b>Sale</b>", "Your answer contained HTML."],
    ["Sale <IMG src=x>", "Your answer contained HTML."],
    ["x".repeat(61), "Your answer was 61 characters; the limit is 60."],
    ["x".repeat(59) + "😀", "Your answer was 61 characters; the limit is 60."],
  ])("returns the repair reason for %j", (answer, reason) => {
    expect(checkAltTextAnswer(answer, { maxLength: 60 })).toEqual({
      ok: false,
      reason,
    });
  });

  it.each([
    ['  "Image of Shop our autumn collection"  ', "Shop our autumn collection"],
    ["'pIcTuRe Of New arrivals'", "New arrivals"],
    ["A useful purpose", "A useful purpose"],
    ['"One" "Two"', 'One" "Two'],
    ["\"'Shop now'\"", "'Shop now'"],
    ["x".repeat(58) + "😀", "x".repeat(58) + "😀"],
    ['  "Image of ' + "x".repeat(60) + '"  ', "x".repeat(60)],
  ])("normalizes %j before checking its length", (answer, alt) => {
    expect(checkAltTextAnswer(answer, { maxLength: 60 })).toEqual({
      ok: true,
      alt,
    });
  });
});

describe("buildAltTextRepairRequest", () => {
  it("preserves the system and original image messages and appends the refused answer and exact repair instruction", () => {
    const messages: AiModelMessage[] = [
      {
        role: "user",
        content: '{"nearbyText":"Shop now"}',
        attachments: [
          { kind: "image-url", url: "https://example.com/hero.png" },
        ],
      },
    ];
    const built = { system: "Use the image and data.", messages };
    const original = structuredClone(built);
    const answer =
      "First draft\nWait, I need to output only the final alt text…\nShop now";
    expect(
      buildAltTextRepairRequest(
        built,
        answer,
        "Your answer had several lines.",
        60,
      ),
    ).toEqual({
      system: "Use the image and data.",
      messages: [
        {
          role: "user",
          content: '{"nearbyText":"Shop now"}',
          attachments: [
            { kind: "image-url", url: "https://example.com/hero.png" },
          ],
        },
        { role: "assistant", content: answer },
        {
          role: "user",
          content:
            "Your answer had several lines. Reply again with only the alt text: one line of plain text, at most 60 characters.",
        },
      ],
    });
    expect(built).toEqual(original);
  });
});


it("refuses an invented rewrite tag when no merge tags are declared", () => {
  expect(checkRewrite("<p>{{x}}</p>", "<p>Hi</p>", { syntax: "liquid", tags: [] })).toEqual({
    ok: false,
    reason: "Your rewrite used merge tags that don't exist: {{x}}.",
  });
});
