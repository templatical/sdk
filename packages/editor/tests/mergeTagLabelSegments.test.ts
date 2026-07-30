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

/**
 * Sample mode. The segment *type* is the load-bearing part: a resolved sample is
 * emitted as `text`, not `tag`, and that is what stops `MergeTagPreviewText`
 * wrapping it in `.tpl-merge-tag-label` — so a sample renders with no dotted
 * underline and reads as ordinary content.
 */
const SAMPLE_TAGS: MergeTag[] = [
  { label: "First Name", value: "{{first_name}}", sample: "Ada" },
  { label: "Plan Name", value: "{{plan}}" }, // no sample on purpose
];

describe("splitMergeTagLabelSegments in sample mode", () => {
  it("defaults to labels when the flag is omitted", () => {
    // The default matters: the editing canvas passes nothing.
    expect(
      splitMergeTagLabelSegments("{{first_name}}", SAMPLE_TAGS, liquid),
    ).toEqual([{ type: "tag", value: "First Name" }]);
  });

  it("emits a resolved sample as a text segment, not a tag segment", () => {
    expect(
      splitMergeTagLabelSegments("{{first_name}}", SAMPLE_TAGS, liquid, true),
    ).toEqual([{ type: "text", value: "Ada" }]);
  });

  it("keeps a tag segment for a tag with no sample, so its cue survives", () => {
    expect(
      splitMergeTagLabelSegments("{{plan}}", SAMPLE_TAGS, liquid, true),
    ).toEqual([{ type: "tag", value: "Plan Name" }]);
  });

  it("mixes substituted and unsubstituted tags in one value", () => {
    expect(
      splitMergeTagLabelSegments(
        "Hi {{first_name}} on {{plan}}",
        SAMPLE_TAGS,
        liquid,
        true,
      ),
    ).toEqual([
      { type: "text", value: "Hi " },
      { type: "text", value: "Ada" },
      { type: "text", value: " on " },
      { type: "tag", value: "Plan Name" },
    ]);
  });

  it("leaves logic tags as tag segments in sample mode", () => {
    const result = splitMergeTagLabelSegments(
      "{% if vip %}",
      SAMPLE_TAGS,
      liquid,
      true,
    );

    expect(result).toEqual([{ type: "tag", value: "IF" }]);
  });

  it("substitutes inside a URL value", () => {
    expect(
      splitMergeTagLabelSegments(
        "https://x.test/{{first_name}}",
        SAMPLE_TAGS,
        liquid,
        true,
      ),
    ).toEqual([
      { type: "text", value: "https://x.test/" },
      { type: "text", value: "Ada" },
    ]);
  });
});
