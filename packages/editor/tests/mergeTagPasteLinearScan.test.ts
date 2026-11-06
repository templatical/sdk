import { describe, expect, it } from "vitest";
import { SYNTAX_PRESETS, type SyntaxPreset } from "@templatical/types";
import { MergeTagNode } from "../src/extensions/MergeTagNode";
import { LogicMergeTagNode } from "../src/extensions/LogicMergeTagNode";
import { expectLinear } from "./helpers/expectLinear";

function pasteFinder(kind: "value" | "logic", syntax: SyntaxPreset) {
  const extension = kind === "value" ? MergeTagNode : LogicMergeTagNode;
  const rules = (extension.config.addPasteRules as Function).call({
    options: { syntax, mergeTags: () => [] },
    type: { create: () => ({}) },
  });
  return rules[0].find as
    RegExp | ((text: string) => { index: number; text: string }[]);
}

function matches(kind: "value" | "logic", syntax: SyntaxPreset, text: string) {
  const find = pasteFinder(kind, syntax);
  return (
    typeof find === "function" ? find(text) : [...text.matchAll(find)]
  ).map((match) => ({
    index: match.index,
    text: "text" in match ? match.text : match[0],
  }));
}

describe("built-in paste rules", () => {
  it("scans unclosed value openers linearly", () => {
    expect(
      matches("value", SYNTAX_PRESETS.liquid, "{{".repeat(90_000)),
    ).toEqual([]);
    expectLinear(
      (n) => {
        const value = "{{".repeat(n);
        return () => matches("value", SYNTAX_PRESETS.liquid, value);
      },
      500,
      250,
    );
  });

  it("scans unclosed logic openers linearly", () => {
    expect(
      matches("logic", SYNTAX_PRESETS.liquid, "{% if ".repeat(50_000)),
    ).toEqual([]);
    expectLinear(
      (n) => {
        const value = "{% if ".repeat(n);
        return () => matches("logic", SYNTAX_PRESETS.liquid, value);
      },
      500,
      80,
    );
  });

  it("keeps built-in paste match offsets and text", () => {
    expect(typeof pasteFinder("value", SYNTAX_PRESETS.handlebars)).toBe(
      "function",
    );
    expect(typeof pasteFinder("logic", SYNTAX_PRESETS.liquid)).toBe("function");
    expect(
      matches("value", SYNTAX_PRESETS.handlebars, "Hi {{{name}}} {{x}}"),
    ).toEqual([
      { index: 3, text: "{{{name}}}" },
      { index: 14, text: "{{x}}" },
    ]);
    expect(matches("logic", SYNTAX_PRESETS.liquid, "A {% if vip %} B")).toEqual(
      [{ index: 2, text: "{% if vip %}" }],
    );
  });

  it("keeps custom paste rules on the regex path", () => {
    const syntax = { value: /\[\[.+?\]\]/g, logic: /\[\[#\w+\]\]/g };
    expect(typeof pasteFinder("value", SYNTAX_PRESETS.liquid)).toBe("function");
    expect(pasteFinder("value", syntax)).toBeInstanceOf(RegExp);
    expect(matches("value", syntax, "Hi [[name]]")).toEqual([
      { index: 3, text: "[[name]]" },
    ]);
  });

  it("uses the scanner for a spread preset and regexes for changed patterns", () => {
    const spread = { ...SYNTAX_PRESETS.liquid, opener: "<<" };
    const changedFlags = {
      ...spread,
      value: new RegExp(spread.value.source, "gs"),
    };
    const customValue = { ...spread, value: /\{\{[\s\S]+?\}\}/g };
    expect(typeof pasteFinder("value", spread)).toBe("function");
    expect(typeof pasteFinder("logic", spread)).toBe("function");
    expect(matches("value", spread, "a {{x}} b {{ y }}")).toEqual([
      { index: 2, text: "{{x}}" },
      { index: 10, text: "{{ y }}" },
    ]);
    expect(matches("logic", spread, "{% if vip %}VIP{% endif %}")).toEqual([
      { index: 0, text: "{% if vip %}" },
      { index: 15, text: "{% endif %}" },
    ]);
    expect(pasteFinder("value", changedFlags)).toBeInstanceOf(RegExp);
    expect(pasteFinder("value", customValue)).toBeInstanceOf(RegExp);
  });
});
