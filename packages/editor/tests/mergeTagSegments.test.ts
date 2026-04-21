import { describe, expect, it } from "vitest";
import type { MergeTag } from "@templatical/types";
import {
  SYNTAX_PRESETS,
  isMergeTagValue,
  getMergeTagLabel,
  isLogicMergeTagValue,
  getLogicMergeTagKeyword,
} from "@templatical/types";
import type { SyntaxPreset } from "@templatical/types";

// Replicate the segment parsing algorithm from MergeTagInput.vue (lines 50-93)
type Segment =
  | { type: "text"; value: string }
  | { type: "mergeTag"; value: string; label: string }
  | { type: "logicMergeTag"; value: string; keyword: string };

function parseSegments(
  val: string,
  syntax: SyntaxPreset,
  mergeTags: MergeTag[],
): Segment[] {
  if (!val) return [];

  const result: Segment[] = [];
  const combinedSource = `(${syntax.value.source}|${syntax.logic.source})`;
  const regex = new RegExp(combinedSource, "g");
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(val)) !== null) {
    if (match.index > lastIndex) {
      result.push({
        type: "text",
        value: val.slice(lastIndex, match.index),
      });
    }

    const matched = match[0];
    if (isMergeTagValue(matched, syntax)) {
      result.push({
        type: "mergeTag",
        value: matched,
        label: getMergeTagLabel(matched, mergeTags),
      });
    } else if (isLogicMergeTagValue(matched, syntax)) {
      result.push({
        type: "logicMergeTag",
        value: matched,
        keyword: getLogicMergeTagKeyword(matched, syntax),
      });
    } else {
      result.push({ type: "text", value: matched });
    }

    lastIndex = match.index + matched.length;
  }

  if (lastIndex < val.length) {
    result.push({ type: "text", value: val.slice(lastIndex) });
  }

  return result;
}

function hasMergeTags(segments: Segment[]): boolean {
  return segments.some(
    (s) => s.type === "mergeTag" || s.type === "logicMergeTag",
  );
}

const sampleTags: MergeTag[] = [
  { label: "First Name", value: "{{first_name}}" },
  { label: "Last Name", value: "{{last_name}}" },
  { label: "Email", value: "{{email}}" },
];

const liquid = SYNTAX_PRESETS.liquid;

describe("merge tag segment parsing", () => {
  describe("empty inputs", () => {
    it("returns empty array for empty string", () => {
      expect(parseSegments("", liquid, sampleTags)).toEqual([]);
    });

    it("returns empty array for undefined-like falsy value", () => {
      expect(parseSegments("", liquid, [])).toEqual([]);
    });
  });

  describe("plain text", () => {
    it("returns single text segment", () => {
      const result = parseSegments("Hello world", liquid, sampleTags);
      expect(result).toEqual([{ type: "text", value: "Hello world" }]);
      expect(hasMergeTags(result)).toBe(false);
    });
  });

  describe("single merge tag (liquid)", () => {
    it("resolves label from merge tag list", () => {
      const result = parseSegments("{{first_name}}", liquid, sampleTags);
      expect(result).toEqual([
        { type: "mergeTag", value: "{{first_name}}", label: "First Name" },
      ]);
      expect(hasMergeTags(result)).toBe(true);
    });
  });

  describe("unknown merge tag", () => {
    it("uses raw value as label when not in merge tag list", () => {
      const result = parseSegments("{{unknown}}", liquid, sampleTags);
      expect(result).toEqual([
        { type: "mergeTag", value: "{{unknown}}", label: "{{unknown}}" },
      ]);
    });
  });

  describe("mixed content", () => {
    it("parses text + merge tag + text", () => {
      const result = parseSegments(
        "Hello {{first_name}}, welcome",
        liquid,
        sampleTags,
      );
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ type: "text", value: "Hello " });
      expect(result[1]).toEqual({
        type: "mergeTag",
        value: "{{first_name}}",
        label: "First Name",
      });
      expect(result[2]).toEqual({ type: "text", value: ", welcome" });
    });
  });

  describe("adjacent merge tags", () => {
    it("parses mergeTag + text + mergeTag", () => {
      const result = parseSegments(
        "{{first_name}} {{last_name}}",
        liquid,
        sampleTags,
      );
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        type: "mergeTag",
        value: "{{first_name}}",
        label: "First Name",
      });
      expect(result[1]).toEqual({ type: "text", value: " " });
      expect(result[2]).toEqual({
        type: "mergeTag",
        value: "{{last_name}}",
        label: "Last Name",
      });
    });
  });

  describe("logic merge tags", () => {
    it("parses liquid logic tag with keyword", () => {
      const result = parseSegments("{% if active %}", liquid, []);
      expect(result).toEqual([
        { type: "logicMergeTag", value: "{% if active %}", keyword: "IF" },
      ]);
      expect(hasMergeTags(result)).toBe(true);
    });

    it("parses endif logic tag", () => {
      const result = parseSegments("{% endif %}", liquid, []);
      expect(result).toEqual([
        { type: "logicMergeTag", value: "{% endif %}", keyword: "ENDIF" },
      ]);
    });
  });

  describe("mixed value and logic tags", () => {
    it("parses logic + value + logic", () => {
      const result = parseSegments(
        "{% if x %}{{first_name}}{% endif %}",
        liquid,
        sampleTags,
      );
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        type: "logicMergeTag",
        value: "{% if x %}",
        keyword: "IF",
      });
      expect(result[1]).toEqual({
        type: "mergeTag",
        value: "{{first_name}}",
        label: "First Name",
      });
      expect(result[2]).toEqual({
        type: "logicMergeTag",
        value: "{% endif %}",
        keyword: "ENDIF",
      });
    });
  });

  describe("handlebars syntax", () => {
    const handlebars = SYNTAX_PRESETS.handlebars;
    const hbTags: MergeTag[] = [
      { label: "Name", value: "{{name}}" },
    ];

    it("parses handlebars value tag", () => {
      const result = parseSegments("{{name}}", handlebars, hbTags);
      expect(result).toEqual([
        { type: "mergeTag", value: "{{name}}", label: "Name" },
      ]);
    });

    it("parses handlebars logic tag #if as mergeTag (value regex matches first)", () => {
      // In handlebars, {{#if show}} matches the value regex too, so the
      // combined regex picks it up as a value merge tag (isMergeTagValue wins)
      const result = parseSegments("{{#if show}}", handlebars, []);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("mergeTag");
      expect(result[0].value).toBe("{{#if show}}");
    });

    it("parses handlebars logic tag /if as mergeTag (value regex matches first)", () => {
      const result = parseSegments("{{/if}}", handlebars, []);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("mergeTag");
      expect(result[0].value).toBe("{{/if}}");
    });
  });

  describe("mailchimp syntax", () => {
    const mailchimp = SYNTAX_PRESETS.mailchimp;
    const mcTags: MergeTag[] = [
      { label: "First Name", value: "*|FNAME|*" },
    ];

    it("parses mailchimp merge tag", () => {
      const result = parseSegments("*|FNAME|*", mailchimp, mcTags);
      expect(result).toEqual([
        { type: "mergeTag", value: "*|FNAME|*", label: "First Name" },
      ]);
    });

    it("does not match liquid syntax under mailchimp", () => {
      const result = parseSegments("{{name}}", mailchimp, []);
      expect(result).toEqual([{ type: "text", value: "{{name}}" }]);
      expect(hasMergeTags(result)).toBe(false);
    });
  });

  describe("ampscript syntax", () => {
    const ampscript = SYNTAX_PRESETS.ampscript;
    const ampTags: MergeTag[] = [
      { label: "First Name", value: "%%=v(@first_name)=%%" },
    ];

    it("parses ampscript merge tag", () => {
      const result = parseSegments("%%=v(@first_name)=%%", ampscript, ampTags);
      expect(result).toEqual([
        {
          type: "mergeTag",
          value: "%%=v(@first_name)=%%",
          label: "First Name",
        },
      ]);
    });
  });

  describe("hasMergeTags derivation", () => {
    it("is false for plain text", () => {
      const result = parseSegments("plain text", liquid, []);
      expect(hasMergeTags(result)).toBe(false);
    });

    it("is true when merge tags present", () => {
      const result = parseSegments("{{first_name}}", liquid, sampleTags);
      expect(hasMergeTags(result)).toBe(true);
    });

    it("is true when logic tags present", () => {
      const result = parseSegments("{% if active %}", liquid, []);
      expect(hasMergeTags(result)).toBe(true);
    });
  });
});

