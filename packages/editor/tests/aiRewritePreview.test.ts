// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  REWRITE_LANGUAGES,
  htmlToPlainText,
  rewriteLanguageOptions,
} from "../src/utils/aiRewritePreview";

describe("htmlToPlainText", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads streamed markup as text, an unclosed element included (D22)", () => {
    expect(htmlToPlainText("<p>Hello <strong>there")).toBe("Hello there");
    expect(htmlToPlainText('<img src="x" onerror="alert(1)">Hi')).toBe("Hi");
    expect(htmlToPlainText("")).toBe("");
  });

  it("drops complete tags where no DOMParser exists", () => {
    vi.stubGlobal("DOMParser", undefined);
    expect(htmlToPlainText("<p>Hello <strong>there</strong></p>")).toBe(
      "Hello there",
    );
    expect(htmlToPlainText('<img src="x" onerror="alert(1)">Hi')).toBe("Hi");
    expect(htmlToPlainText("a <b>c")).toBe("a c");
  });
});

describe("rewriteLanguageOptions", () => {
  it("offers the 16 languages, English first, named in the editor's locale", () => {
    const options = rewriteLanguageOptions("de");
    expect(options.map((option) => option.value)).toEqual([
      ...REWRITE_LANGUAGES,
    ]);
    expect(options).toHaveLength(16);
    expect(options[0]).toEqual({ value: "en", label: "Englisch" });
    expect(options.find((option) => option.value === "de")!.label).toBe(
      "Deutsch",
    );
  });

  it("names a language by its tag when Intl can't", () => {
    expect(rewriteLanguageOptions("not a locale")[0]).toEqual({
      value: "en",
      label: "en",
    });
  });
});
