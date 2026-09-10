import { describe, expect, it } from "vitest";
import {
  RTL_LANGUAGE_PRIMARY_SUBTAGS,
  isRtlLanguageTag,
  resolveContentDirection,
} from "../src";

describe("RTL_LANGUAGE_PRIMARY_SUBTAGS", () => {
  it("is a non-empty list of lowercase primary subtags", () => {
    expect(RTL_LANGUAGE_PRIMARY_SUBTAGS.length).toBeGreaterThan(0);
    for (const tag of RTL_LANGUAGE_PRIMARY_SUBTAGS) {
      expect(tag).toBe(tag.toLowerCase());
      expect(tag).not.toContain("-");
    }
  });
});

describe("isRtlLanguageTag", () => {
  it.each([
    "ar",
    "ar-SA",
    "he",
    "fa",
    "ur",
    "yi",
    "dv",
    "ps",
    "sd",
    "ug",
    "ckb",
    "ks",
  ])("treats %s as RTL", (tag) => {
    expect(isRtlLanguageTag(tag)).toBe(true);
  });

  it("treats the legacy Hebrew subtag iw as RTL", () => {
    expect(isRtlLanguageTag("iw")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isRtlLanguageTag("AR")).toBe(true);
    expect(isRtlLanguageTag("He-IL")).toBe(true);
  });

  it("accepts underscore as a BCP-47 separator", () => {
    expect(isRtlLanguageTag("ar_SA")).toBe(true);
  });

  it.each(["en", "de", "pt-BR", "fr", "zh-Hant-TW"])(
    "treats %s as LTR",
    (tag) => {
      expect(isRtlLanguageTag(tag)).toBe(false);
    },
  );

  it("treats empty, whitespace, and missing tags as not RTL", () => {
    expect(isRtlLanguageTag(undefined)).toBe(false);
    expect(isRtlLanguageTag("")).toBe(false);
    expect(isRtlLanguageTag("   ")).toBe(false);
  });
});

describe("resolveContentDirection", () => {
  it("lets an explicit rtl win over an LTR locale", () => {
    expect(resolveContentDirection({ locale: "en", direction: "rtl" })).toBe(
      "rtl",
    );
  });

  it("lets an explicit ltr win over an RTL locale", () => {
    expect(resolveContentDirection({ locale: "ar", direction: "ltr" })).toBe(
      "ltr",
    );
  });

  it("resolves an unset direction from an RTL locale", () => {
    expect(resolveContentDirection({ locale: "ar" })).toBe("rtl");
    expect(resolveContentDirection({ locale: "ar-SA" })).toBe("rtl");
    expect(resolveContentDirection({ locale: "he" })).toBe("rtl");
    expect(resolveContentDirection({ locale: "fa" })).toBe("rtl");
    expect(resolveContentDirection({ locale: "ur" })).toBe("rtl");
  });

  it("resolves an unset direction from an LTR locale as ltr", () => {
    expect(resolveContentDirection({ locale: "en" })).toBe("ltr");
    expect(resolveContentDirection({ locale: "de" })).toBe("ltr");
    expect(resolveContentDirection({ locale: "pt-BR" })).toBe("ltr");
  });

  it("resolves empty or malformed locale as ltr when direction is unset", () => {
    expect(resolveContentDirection({ locale: "" })).toBe("ltr");
    expect(resolveContentDirection({ locale: "not a tag" })).toBe("ltr");
  });

  it("ignores a garbage direction value and falls through to locale", () => {
    expect(
      resolveContentDirection({
        locale: "ar",
        direction: "sideways" as "ltr",
      }),
    ).toBe("rtl");
    expect(
      resolveContentDirection({
        locale: "en",
        direction: "sideways" as "rtl",
      }),
    ).toBe("ltr");
  });
});
