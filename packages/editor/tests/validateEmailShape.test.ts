import { describe, expect, it } from "vitest";
import { looksLikeEmail } from "../src/utils/validateEmailShape";

/**
 * The accept list matters more than the reject list here.
 *
 * This check exists to catch typos before a network round-trip, not to validate
 * deliverability — only the receiving server can do that, and the sending backend
 * has to validate regardless. The accepted cases below are the ones a stricter,
 * "more correct" RFC-ish regex reliably breaks, so they're pinned deliberately:
 * if someone tightens this and these fail, the tightening is the bug.
 */
describe("looksLikeEmail", () => {
  describe("accepts addresses a stricter regex would wrongly reject", () => {
    it.each([
      ["plain", "user@example.com"],
      ["plus-addressing", "user+newsletter@example.com"],
      ["dots in the local part", "first.last@example.com"],
      ["subdomained host", "user@mail.corp.example.com"],
      ["long new gTLD", "user@example.technology"],
      ["hyphenated domain", "user@my-company.co.uk"],
      ["underscore in local part", "first_last@example.com"],
      ["digits everywhere", "user123@123example.com"],
      ["apostrophe in local part", "o'brien@example.com"],
      ["single-character local part", "a@example.com"],
      ["surrounding whitespace is trimmed", "  user@example.com  "],
    ])("accepts %s", (_label, value) => {
      expect(looksLikeEmail(value)).toBe(true);
    });
  });

  describe("rejects what a typo actually produces", () => {
    it.each([
      ["empty", ""],
      ["whitespace only", "   "],
      ["no @", "userexample.com"],
      ["two @", "user@@example.com"],
      ["two @ separated", "user@one@example.com"],
      ["nothing before @", "@example.com"],
      ["nothing after @", "user@"],
      ["no dot in the domain", "user@example"],
      ["trailing dot", "user@example."],
      ["leading dot in domain", "user@.com"],
      ["internal space", "user name@example.com"],
      ["trailing comma from a pasted list", "user@example.com,"],
      ["tab", "user@exa\tmple.com"],
    ])("rejects %s", (_label, value) => {
      expect(looksLikeEmail(value)).toBe(false);
    });
  });

  it("rejects a trailing comma but accepts the same address without it", () => {
    // Pasting from a list is the single most common malformed input.
    expect(looksLikeEmail("user@example.com,")).toBe(false);
    expect(looksLikeEmail("user@example.com")).toBe(true);
  });
});
