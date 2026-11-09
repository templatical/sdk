import { describe, expect, it } from "vitest";
import {
  builtInPresetOf,
  containsMergeTag,
  resolveHtmlMergeTagLabels,
  scanCombinedSyntaxMatches,
  scanSyntaxMatches,
  SYNTAX_PRESETS,
} from "../src";
import { expectLinear } from "./helpers/expectLinear";

describe("built-in merge-tag scanning", () => {
  it("matches the regex output for spreads of every built-in preset", () => {
    const corpus = [
      "{{first_name}} {{ first_name | capitalize }} {% if vip %}",
      "{{{html}}} {{#each items}} {{/each}}",
      "*|FNAME|* *|IF:VIP|* *|END:IF|*",
      "%%=v(@name)=%% %%[ IF @name == 1 ]%%",
      "{{}} {{{}} {{x}}} {% - if %}",
      "{{\r{%x}}{{{*|{{{{{{{{*|%}{{ }}",
      "one\ntwo {{x}}\r{% if x %}",
    ];
    for (const name of Object.keys(
      SYNTAX_PRESETS,
    ) as (keyof typeof SYNTAX_PRESETS)[]) {
      const preset = SYNTAX_PRESETS[name];
      const syntax = { ...preset, opener: "<<" };
      expect(builtInPresetOf(syntax)).toBe(name);
      for (const text of corpus) {
        for (const kind of ["value", "logic"] as const) {
          expect(scanSyntaxMatches(text, syntax, kind)).toEqual(
            [...text.matchAll(preset[kind])].map((match) => ({
              index: match.index,
              value: match[0],
            })),
          );
        }
        const combined = new RegExp(
          `(${preset.value.source}|${preset.logic.source})`,
          "g",
        );
        expect(scanCombinedSyntaxMatches(text, syntax)).toEqual(
          [...text.matchAll(combined)].map((match) => ({
            index: match.index,
            value: match[0],
          })),
        );
      }
    }
  });

  it("scans a spread liquid preset with unclosed openers linearly", () => {
    const syntax = { ...SYNTAX_PRESETS.liquid, opener: "<<" };
    const text = "{{".repeat(90_000);
    expect(scanSyntaxMatches(text, syntax, "value")).toEqual([]);
    expectLinear(
      (n) => {
        const value = "{{".repeat(n);
        return () => scanSyntaxMatches(value, syntax, "value");
      },
      500,
      200,
    );
  });

  it("keeps changed flags and custom value patterns on the regex path", () => {
    const dotAll = {
      ...SYNTAX_PRESETS.liquid,
      value: new RegExp(SYNTAX_PRESETS.liquid.value.source, "gs"),
    };
    const customValue = {
      ...SYNTAX_PRESETS.liquid,
      value: /\{\{[\s\S]+?\}\}/g,
    };
    const text = "a {{first\nname}} b";
    expect(scanSyntaxMatches(text, dotAll, "value")).toEqual([
      { index: 2, value: "{{first\nname}}" },
    ]);
    expect(scanSyntaxMatches(text, customValue, "value")).toEqual([
      { index: 2, value: "{{first\nname}}" },
    ]);
    expect(builtInPresetOf(dotAll)).toBe(undefined);
    expect(builtInPresetOf(customValue)).toBe(undefined);
    expect(
      builtInPresetOf({
        ...SYNTAX_PRESETS.liquid,
        logic: /\{%-?\s*(\w+).*?-?%\}/gi,
      }),
    ).toBe(undefined);
    expect(
      builtInPresetOf({
        ...SYNTAX_PRESETS.liquid,
        logic: new RegExp(SYNTAX_PRESETS.liquid.logic.source, "y"),
        value: new RegExp(SYNTAX_PRESETS.liquid.value.source, "y"),
      }),
    ).toBe("liquid");
  });

  it("combines a spread liquid preset with unclosed openers linearly", () => {
    const syntax = { ...SYNTAX_PRESETS.liquid, opener: "<<" };
    const text = "{{x}}".repeat(20_000) + "{{".repeat(90_000);
    expect(scanCombinedSyntaxMatches(text, syntax)).toHaveLength(20_000);
    expectLinear(
      (n) => {
        const value = "{{x}}".repeat(n) + "{{".repeat(n * 4);
        return () => scanCombinedSyntaxMatches(value, syntax);
      },
      100,
      200,
    );
  });

  it("rejects unclosed openers in a spread preset without a full regex scan", () => {
    const syntax = { ...SYNTAX_PRESETS.liquid, opener: "<<" };
    const text = "{{".repeat(90_000);
    expect(containsMergeTag(text, syntax)).toBe(false);
    expectLinear(
      (n) => {
        const value = "{{".repeat(n);
        return () => containsMergeTag(value, syntax);
      },
      400,
      500,
    );
  });

  it("scans custom syntax from an offset without changing its regex state", () => {
    const syntax = { value: /\[\[[a-z]+\]\]/iy, logic: /\[%[a-z]+%\]/iy };
    const text = "[[first]] [%if%] [[SECOND]]";
    syntax.value.lastIndex = 3;

    expect(scanSyntaxMatches(text, syntax, "value", 10, 1)).toEqual([
      { index: 17, value: "[[SECOND]]" },
    ]);
    expect(scanSyntaxMatches(text, syntax, "logic")).toEqual([
      { index: 10, value: "[%if%]" },
    ]);
    expect(syntax.value.lastIndex).toBe(3);
    expect(syntax.logic.lastIndex).toBe(0);
  });

  it("combines custom value and logic matches in text order", () => {
    const syntax = { value: /\[\[[a-z]+\]\]/g, logic: /\[%[a-z]+%\]/g };
    const text = "[%if%] [[name]] [%end%]";

    expect(scanCombinedSyntaxMatches(text, syntax)).toEqual([
      { index: 0, value: "[%if%]" },
      { index: 7, value: "[[name]]" },
      { index: 16, value: "[%end%]" },
    ]);
    const combined = new RegExp(
      `(${syntax.value.source}|${syntax.logic.source})`,
      "g",
    );
    expect(scanCombinedSyntaxMatches(text, syntax)).toEqual(
      [...text.matchAll(combined)].map((match) => ({
        index: match.index,
        value: match[0],
      })),
    );
  });

  it("preserves an attributed span with no closing tag", () => {
    const html = '<p><span data-merge-tag="{{name}}">Name';

    expect(
      resolveHtmlMergeTagLabels(html, [
        { label: "Full Name", value: "{{name}}" },
      ]),
    ).toBe(html);
  });

  it("matches the built-in regexes on real tags and seeded text", () => {
    const examples = [
      "{{first_name}} {{ first_name | capitalize }}",
      "{% if customer %}Hi{% endif %}",
      "{{{html}}} {{#each items}} {{/each}}",
      "*|FNAME|* *|IF:VIP|* *|END:IF|*",
      "%%=v(@name)=%% %%[ IF @name == 1 ]%%",
      "{{}} {{{}} {{x}}} {% - if %}",
      "one\ntwo {{x}}\r{% if x %}",
      "{% if\n{% if\n%} {%\nif %}",
      "%%[\nIF]%% %%[ IF\u2028]%%",
      "*|IF:\n*|IF:\n|* *|a*|a|*",
    ];
    let seed = 0x12345678;
    const alphabet = "{}%*|[]= abcXYZ_1#/-\n\r";
    for (let sample = 0; sample < 200; sample++) {
      let value = "";
      for (let i = 0; i < 80; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        value += alphabet[seed % alphabet.length];
      }
      examples.push(value);
    }
    const chunks = [
      "{{",
      "{{{",
      "}}",
      "}}}",
      "{%",
      "%}",
      "*|",
      "|*",
      "%%=",
      "=%%",
      "%%[",
      "]%%",
      "a",
      "x",
      "1",
      " ",
      ":",
      "#",
      "/",
      "-",
      "\n",
      "\r",
    ];
    for (let sample = 0; sample < 1_000; sample++) {
      let value = "";
      for (let i = 0; i < 15; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        value += chunks[seed % chunks.length];
      }
      examples.push(value);
    }
    for (const preset of Object.values(SYNTAX_PRESETS)) {
      for (const kind of ["value", "logic"] as const) {
        for (const value of examples) {
          const expected = [...value.matchAll(preset[kind])].map((match) => ({
            index: match.index,
            value: match[0],
          }));
          expect(scanSyntaxMatches(value, preset, kind)).toEqual(expected);
        }
      }
    }
  });

  it("preserves value-first combined matching", () => {
    const texts = [
      "{{#if vip}}{{{name}}} *|NAME|**|END:IF|*",
      "{{\r{%x}}{{{*|{{{{{{{{*|%}{{ }}",
      "*|IF:VIP|**|NAME|**|END:IF|*",
    ];
    for (const preset of Object.values(SYNTAX_PRESETS)) {
      for (const text of texts) {
        const combined = new RegExp(
          `(${preset.value.source}|${preset.logic.source})`,
          "g",
        );
        expect(scanCombinedSyntaxMatches(text, preset)).toEqual(
          [...text.matchAll(combined)].map((match) => ({
            index: match.index,
            value: match[0],
          })),
        );
      }
    }
  });

  it("scans complete value tags followed by unclosed openers linearly", () => {
    const text = "{{x}}".repeat(20_000) + "{{".repeat(90_000);
    expect(scanCombinedSyntaxMatches(text, SYNTAX_PRESETS.liquid)).toHaveLength(
      20_000,
    );
    expectLinear(
      (n) => {
        const value = "{{x}}".repeat(n) + "{{".repeat(n * 4);
        return () => scanCombinedSyntaxMatches(value, SYNTAX_PRESETS.liquid);
      },
      100,
      200,
    );
  });

  it("rewrites many spans without the target attribute linearly", () => {
    const short = '<span>a</span><span data-merge-tag="{{x}}">x</span>';
    expect(
      resolveHtmlMergeTagLabels(short, [{ label: "X", value: "{{x}}" }]),
    ).toBe('<span>a</span><span data-merge-tag="{{x}}">X</span>');
    const html = "<span>".repeat(40_000) + "</span>";
    expect(resolveHtmlMergeTagLabels(html, [])).toBe(html);
    expectLinear(
      (n) => {
        const value = "<span>".repeat(n) + "<span ".repeat(n) + "</span>";
        return () => resolveHtmlMergeTagLabels(value, []);
      },
      100,
      1_000,
    );
  });

  it("stops at the first match when only asked whether a tag exists", () => {
    expect(containsMergeTag("{{a}} {{b}}", SYNTAX_PRESETS.liquid)).toBe(true);
    expect(containsMergeTag("no tags here {{", SYNTAX_PRESETS.liquid)).toBe(
      false,
    );
    // A full scan grows with the tags after the first; an early exit does not.
    // Measured like expectLinear (this thread's CPU time, repetitions doubled
    // until a run costs 5 ms, cheapest of five interleaved rounds), but against
    // 64 times the tags: a full scan measures about 64 here, an early exit 1.
    const run = (tags: number) => {
      const text = "{{a}}" + "{{x}}".repeat(tags);
      return () => containsMergeTag(text, SYNTAX_PRESETS.liquid);
    };
    const few = run(1_000);
    const many = run(64_000);
    let repetitions = 1;
    const cost = (scan: () => boolean) => {
      const started = process.threadCpuUsage();
      for (let i = 0; i < repetitions; i++) scan();
      const { user, system } = process.threadCpuUsage(started);
      return (user + system) / 1000;
    };
    while (cost(few) < 5 && repetitions < 1_000_000) repetitions *= 2;
    let fewCost = Infinity;
    let manyCost = Infinity;
    for (let round = 0; round < 5; round++) {
      fewCost = Math.min(fewCost, cost(few));
      manyCost = Math.min(manyCost, cost(many));
    }
    expect(manyCost / fewCost).toBeLessThan(8);
  });

  it("rewrites past malformed span prefixes linearly", () => {
    const html = "<span ".repeat(16_000) + "<span></span>";
    expect(resolveHtmlMergeTagLabels(html, [])).toBe(html);
    expectLinear(
      (n) => {
        const value = "<span ".repeat(n) + "<span></span>";
        return () => resolveHtmlMergeTagLabels(value, []);
      },
      100,
      1_000,
    );
  });

  it("rejects many unclosed liquid openers linearly", () => {
    const input = "{{".repeat(90_000);
    expect(containsMergeTag(input, SYNTAX_PRESETS.liquid)).toBe(false);
    expectLinear(
      (n) => {
        const value = "{{".repeat(n);
        return () => containsMergeTag(value, SYNTAX_PRESETS.liquid);
      },
      400,
      500,
    );
  });

  it("rejects liquid logic prefixes ending at line breaks linearly", () => {
    const input = "{% if\n".repeat(16_000) + "%}" + "{% if ".repeat(50_000);
    expect(scanSyntaxMatches(input, SYNTAX_PRESETS.liquid, "logic")).toEqual(
      [],
    );
    expectLinear(
      (n) => {
        const value = "{% if\n".repeat(n) + "%}" + "{% if ".repeat(n * 3);
        return () => scanSyntaxMatches(value, SYNTAX_PRESETS.liquid, "logic");
      },
      100,
      350,
    );
  });

  it("matches Mailchimp values after many failed prefixes", () => {
    const input = "*|a".repeat(16_000) + "|*";
    expect(scanSyntaxMatches(input, SYNTAX_PRESETS.mailchimp, "value")).toEqual(
      [{ index: input.length - 5, value: "*|a|*" }],
    );
  });

  it("rejects Mailchimp logic prefixes ending at line breaks linearly", () => {
    const input = "*|IF:\n".repeat(16_000) + "|*" + "*|IF:".repeat(70_000);
    expect(scanCombinedSyntaxMatches(input, SYNTAX_PRESETS.mailchimp)).toEqual(
      [],
    );
    expectLinear(
      (n) => {
        const value = "*|IF:\n".repeat(n) + "|*" + "*|IF:".repeat(n * 4);
        return () => scanCombinedSyntaxMatches(value, SYNTAX_PRESETS.mailchimp);
      },
      100,
      350,
    );
  });
});
