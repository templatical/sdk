import { describe, expect, it } from "vitest";
import {
  containsMergeTag,
  resolveHtmlMergeTagLabels,
  scanCombinedSyntaxMatches,
  scanSyntaxMatches,
  SYNTAX_PRESETS,
} from "../src";

describe("built-in merge-tag scanning", () => {
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

  it("scans complete value tags followed by unclosed openers in under 1500 ms", () => {
    const text = "{{x}}".repeat(20_000) + "{{".repeat(90_000);
    const start = performance.now();
    expect(scanCombinedSyntaxMatches(text, SYNTAX_PRESETS.liquid)).toHaveLength(
      20_000,
    );
    expect(performance.now() - start).toBeLessThan(1500);
  });

  it("rewrites past malformed span prefixes in under 1500 ms", () => {
    const html = "<span ".repeat(16_000) + "<span></span>";
    const start = performance.now();
    expect(resolveHtmlMergeTagLabels(html, [])).toBe(html);
    expect(performance.now() - start).toBeLessThan(1500);
  });

  it("rejects many unclosed liquid openers within 1500 ms", () => {
    const input = "{{".repeat(90_000);
    const start = performance.now();
    expect(containsMergeTag(input, SYNTAX_PRESETS.liquid)).toBe(false);
    expect(performance.now() - start).toBeLessThan(1500);
  });

  it("rejects liquid logic prefixes ending at line breaks within 1500 ms", () => {
    const input = "{% if\n".repeat(16_000) + "%}" + "{% if ".repeat(50_000);
    const start = performance.now();
    expect(scanSyntaxMatches(input, SYNTAX_PRESETS.liquid, "logic")).toEqual(
      [],
    );
    expect(performance.now() - start).toBeLessThan(1500);
  });

  it("matches Mailchimp values after many failed prefixes", () => {
    const input = "*|a".repeat(16_000) + "|*";
    expect(scanSyntaxMatches(input, SYNTAX_PRESETS.mailchimp, "value")).toEqual(
      [{ index: input.length - 5, value: "*|a|*" }],
    );
  });

  it("rejects Mailchimp logic prefixes ending at line breaks within 1500 ms", () => {
    const input = "*|IF:\n".repeat(16_000) + "|*" + "*|IF:".repeat(70_000);
    const start = performance.now();
    expect(scanCombinedSyntaxMatches(input, SYNTAX_PRESETS.mailchimp)).toEqual(
      [],
    );
    expect(performance.now() - start).toBeLessThan(1500);
  });
});
