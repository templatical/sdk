import { describe, expect, it } from "vitest";
import type { MergeTag } from "@templatical/types";
import { SYNTAX_PRESETS } from "@templatical/types";
import { resolveMergeTagLabelsText } from "../src/utils/resolveMergeTagLabelsText";

const TAGS: MergeTag[] = [
  { label: "First Name", value: "{{first_name}}" },
  { label: "Shipping Method", value: "{{shipping_method}}" },
];

const liquid = SYNTAX_PRESETS.liquid;

describe("resolveMergeTagLabelsText", () => {
  it("replaces a known data tag with its label", () => {
    expect(resolveMergeTagLabelsText("{{shipping_method}}", TAGS, liquid)).toBe(
      "Shipping Method",
    );
  });

  it("preserves surrounding text", () => {
    expect(
      resolveMergeTagLabelsText("Go to Your Dashboard {{shipping_method}}", TAGS, liquid),
    ).toBe("Go to Your Dashboard Shipping Method");
  });

  it("resolves multiple tags in one string", () => {
    expect(
      resolveMergeTagLabelsText("Hi {{first_name}} — {{shipping_method}}", TAGS, liquid),
    ).toBe("Hi First Name — Shipping Method");
  });

  it("falls back to the raw value for an unknown tag", () => {
    expect(resolveMergeTagLabelsText("{{unknown}}", TAGS, liquid)).toBe(
      "{{unknown}}",
    );
  });

  it("resolves a logic tag to its keyword", () => {
    expect(
      resolveMergeTagLabelsText("{% if vip %}VIP{% endif %}", TAGS, liquid),
    ).toBe("IFVIPENDIF");
  });

  it("leaves plain text untouched", () => {
    expect(resolveMergeTagLabelsText("Go to Your Dashboard", TAGS, liquid)).toBe(
      "Go to Your Dashboard",
    );
  });

  it("returns empty string unchanged", () => {
    expect(resolveMergeTagLabelsText("", TAGS, liquid)).toBe("");
  });

  it("works with a non-liquid syntax (mailchimp)", () => {
    const tags: MergeTag[] = [{ label: "First Name", value: "*|FNAME|*" }];
    expect(
      resolveMergeTagLabelsText("Hi *|FNAME|*", tags, SYNTAX_PRESETS.mailchimp),
    ).toBe("Hi First Name");
  });
});
