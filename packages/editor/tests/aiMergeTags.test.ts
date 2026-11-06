import { describe, expect, it } from "vitest";
import { SYNTAX_PRESETS } from "@templatical/types";
import { toAiMergeTags } from "../src/utils/aiMergeTags";

describe("toAiMergeTags", () => {
  it("names the syntax and keeps value, label, group and description", () => {
    expect(
      toAiMergeTags(
        [
          {
            value: "{{first_name}}",
            label: "First name",
            group: "Contact",
            sample: "Ada",
          },
        ],
        SYNTAX_PRESETS.liquid,
      ),
    ).toEqual({
      syntax: "liquid",
      tags: [
        { value: "{{first_name}}", label: "First name", group: "Contact" },
      ],
    });
  });

  it("keeps syntax with no tags, and custom for the consumer's own patterns", () => {
    expect(toAiMergeTags([], SYNTAX_PRESETS.liquid)).toEqual({
      syntax: "liquid",
      tags: [],
    });
    expect(
      toAiMergeTags([{ value: "[[x]]", label: "" }], {
        value: /\[\[.+?\]\]/g,
        logic: /\[%.+?%\]/g,
      }),
    ).toEqual({ syntax: "custom", tags: [{ value: "[[x]]", label: "[[x]]" }] });
  });

  it("names equivalent patterns but keeps changed flags custom", () => {
    const spread = {
      ...SYNTAX_PRESETS.liquid,
      value: new RegExp(SYNTAX_PRESETS.liquid.value.source, "y"),
      logic: new RegExp(SYNTAX_PRESETS.liquid.logic.source, "y"),
    };
    expect(toAiMergeTags([], spread)).toEqual({ syntax: "liquid", tags: [] });
    expect(
      toAiMergeTags([], {
        ...spread,
        value: new RegExp(spread.value.source, "is"),
      }),
    ).toEqual({ syntax: "custom", tags: [] });
    expect(
      toAiMergeTags([], {
        ...spread,
        logic: new RegExp(spread.logic.source, "i"),
      }),
    ).toEqual({ syntax: "custom", tags: [] });
  });

  it("caps the list at 500 and skips values over 200 code points", () => {
    const tags = Array.from({ length: 502 }, (_, i) => ({
      value: `{{t${i}}}`,
      label: `T${i}`,
    }));
    tags[0] = { value: `{{${"x".repeat(250)}}}`, label: "Long" };
    const result = toAiMergeTags(tags, SYNTAX_PRESETS.liquid)!;
    expect(result.tags).toHaveLength(500);
    expect(result.tags[0].value).toBe("{{t1}}");
  });
});
