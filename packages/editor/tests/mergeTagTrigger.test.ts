import { describe, expect, it } from "vitest";
import { findOpenMergeTagTrigger } from "../src/utils/mergeTagTrigger";

describe("findOpenMergeTagTrigger", () => {
  describe("liquid ({{ / }})", () => {
    const find = (value: string, caret: number) =>
      findOpenMergeTagTrigger(value, caret, "{{", "}}");

    it("returns null when the caret is at the start", () => {
      expect(find("", 0)).toBeNull();
    });

    it("opens with an empty query right after the trigger", () => {
      expect(find("{{", 2)).toEqual({ triggerStart: 0, caret: 2, query: "" });
    });

    it("captures the query typed after the trigger", () => {
      expect(find("{{fir", 5)).toEqual({
        triggerStart: 0,
        caret: 5,
        query: "fir",
      });
    });

    it("detects a trigger mid-string", () => {
      expect(find("Hello {{na", 10)).toEqual({
        triggerStart: 6,
        caret: 10,
        query: "na",
      });
    });

    it("returns null over a completed tag", () => {
      expect(find("{{first_name}}", 14)).toBeNull();
    });

    it("targets the most recent open trigger after a completed one", () => {
      expect(find("{{first}} and {{la", 18)).toEqual({
        triggerStart: 14,
        caret: 18,
        query: "la",
      });
    });

    it("re-opens with empty query when a fresh trigger follows a completed tag", () => {
      expect(find("{{x}}{{", 7)).toEqual({
        triggerStart: 5,
        caret: 7,
        query: "",
      });
    });

    it("returns null once whitespace is typed in the query", () => {
      expect(find("{{a b", 5)).toBeNull();
    });

    it("returns null when the caret is before the trigger completes", () => {
      // caret sits inside the first "{" — no full "{{" yet before it
      expect(find("{{name", 1)).toBeNull();
    });

    it("targets the nearest trigger when triggers are adjacent", () => {
      expect(find("{{a{{b", 6)).toEqual({
        triggerStart: 3,
        caret: 6,
        query: "b",
      });
    });

    it("uses the caret, not the string end", () => {
      // caret at 4 inside "{{firXname" → query is only what's before caret
      expect(find("{{firstname", 4)).toEqual({
        triggerStart: 0,
        caret: 4,
        query: "fi",
      });
    });
  });

  describe("mailchimp (*| / |*)", () => {
    const find = (value: string, caret: number) =>
      findOpenMergeTagTrigger(value, caret, "*|", "|*");

    it("opens on the mailchimp trigger", () => {
      expect(find("*|FIR", 5)).toEqual({
        triggerStart: 0,
        caret: 5,
        query: "FIR",
      });
    });

    it("returns null over a completed mailchimp tag", () => {
      expect(find("*|FIRST|*", 9)).toBeNull();
    });
  });

  describe("ampscript (%%= / =%%)", () => {
    const find = (value: string, caret: number) =>
      findOpenMergeTagTrigger(value, caret, "%%=", "=%%");

    it("opens on the ampscript trigger", () => {
      expect(find("%%=fi", 5)).toEqual({
        triggerStart: 0,
        caret: 5,
        query: "fi",
      });
    });

    it("returns null over a completed ampscript tag", () => {
      expect(find("%%=first=%%", 11)).toBeNull();
    });
  });

  describe("guards", () => {
    it("returns null for an empty trigger char", () => {
      expect(findOpenMergeTagTrigger("{{a", 3, "", "}}")).toBeNull();
    });

    it("skips the closing check when closingChar is null", () => {
      expect(findOpenMergeTagTrigger("{{a}}", 5, "{{", null)).toEqual({
        triggerStart: 0,
        caret: 5,
        query: "a}}",
      });
    });
  });
});
