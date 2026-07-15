import { describe, expect, it } from "vitest";
import type { MergeTag } from "@templatical/types";
import { SYNTAX_PRESETS } from "@templatical/types";
import { splitMergeTagLabelSegments } from "../src/utils/mergeTagLabelSegments";

const TAGS: MergeTag[] = [
  { label: "First Name", value: "{{first_name}}" },
  { label: "Shipping Method", value: "{{shipping_method}}" },
];

const liquid = SYNTAX_PRESETS.liquid;

describe("splitMergeTagLabelSegments", () => {
  it("returns a single text segment for plain text", () => {
    expect(splitMergeTagLabelSegments("Go to Your Dashboard", TAGS, liquid)).toEqual(
      [{ type: "text", value: "Go to Your Dashboard" }],
    );
  });

  it("resolves a known data tag to its label", () => {
    expect(splitMergeTagLabelSegments("{{shipping_method}}", TAGS, liquid)).toEqual(
      [{ type: "tag", value: "Shipping Method" }],
    );
  });

  it("splits mixed text and tags, preserving surrounding text", () => {
    expect(
      splitMergeTagLabelSegments("Go to Your Dashboard {{shipping_method}}", TAGS, liquid),
    ).toEqual([
      { type: "text", value: "Go to Your Dashboard " },
      { type: "tag", value: "Shipping Method" },
    ]);
  });

  it("handles a tag between text on both sides", () => {
    expect(
      splitMergeTagLabelSegments("Hi {{first_name}}!", TAGS, liquid),
    ).toEqual([
      { type: "text", value: "Hi " },
      { type: "tag", value: "First Name" },
      { type: "text", value: "!" },
    ]);
  });

  it("keeps an unknown tag as a tag segment with its raw value", () => {
    expect(splitMergeTagLabelSegments("{{unknown}}", TAGS, liquid)).toEqual([
      { type: "tag", value: "{{unknown}}" },
    ]);
  });

  it("resolves a logic tag to its keyword", () => {
    expect(
      splitMergeTagLabelSegments("{% if vip %}VIP{% endif %}", TAGS, liquid),
    ).toEqual([
      { type: "tag", value: "IF" },
      { type: "text", value: "VIP" },
      { type: "tag", value: "ENDIF" },
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(splitMergeTagLabelSegments("", TAGS, liquid)).toEqual([]);
  });

  it("works with a non-liquid syntax (mailchimp)", () => {
    const tags: MergeTag[] = [{ label: "First Name", value: "*|FNAME|*" }];
    expect(
      splitMergeTagLabelSegments("Hi *|FNAME|*", tags, SYNTAX_PRESETS.mailchimp),
    ).toEqual([
      { type: "text", value: "Hi " },
      { type: "tag", value: "First Name" },
    ]);
  });
});
