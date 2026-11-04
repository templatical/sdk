import { describe, expect, it } from "vitest";
import nodeMjml from "mjml";
import { createButtonBlock, type ButtonBlock } from "@templatical/types";
import { renderBlock, RenderContext } from "../src";

/**
 * A button's `font-weight` compiled by node `mjml` and by `mjml-browser`.
 * Numeric weights stay `400`, `500` and `700`. An omitted weight stays the
 * keyword `bold`, except minified `mjml-browser` output, which writes `700`.
 */

const ctx = new RenderContext(600, [], "Arial, sans-serif", true);

type CompileOptions = {
  minify?: boolean;
  beautify?: boolean;
};

type Mjml2Html = (
  source: string,
  options?: CompileOptions,
) => Promise<{ html: string; errors: unknown[] }>;

function resolveCompiler(value: unknown): Mjml2Html | undefined {
  if (typeof value === "function") return value as Mjml2Html;
  if (!value || typeof value !== "object") return undefined;
  const record = value as { default?: unknown; mjml?: unknown };
  return resolveCompiler(record.default) ?? resolveCompiler(record.mjml);
}

const browserMjml: Promise<Mjml2Html> = import("mjml-browser").then((mod) => {
  const compile = resolveCompiler(mod);
  if (!compile) throw new Error("mjml-browser did not export a compiler");
  return compile;
});

function wrapBlock(blockMjml: string): string {
  return `<mjml><mj-body><mj-section><mj-column>${blockMjml}</mj-column></mj-section></mj-body></mjml>`;
}

function anchorStyle(html: string): string {
  const match = html.match(/<a\b[^>]*\bstyle="([^"]*)"/);
  if (!match) throw new Error("compiled button has no anchor style");
  return match[1];
}

const WEIGHTS: [string, ButtonBlock["fontWeight"], string][] = [
  ["regular", "regular", "400"],
  ["medium", "medium", "500"],
  ["bold", "bold", "700"],
  ["absent", undefined, "bold"],
];

const MODES: [string, CompileOptions, boolean][] = [
  ["default", {}, false],
  ["beautify", { beautify: true }, false],
  ["minify", { minify: true, beautify: true }, true],
];

const COMPILERS = [
  ["mjml", "node"],
  ["mjml-browser", "browser"],
] as const;

type Case = [
  string,
  string,
  string,
  ButtonBlock["fontWeight"],
  string,
  CompileOptions,
  boolean,
  "node" | "browser",
];

const CASES: Case[] = WEIGHTS.flatMap(([weight, fontWeight, css]) =>
  COMPILERS.flatMap(([compilerLabel, kind]) =>
    MODES.map(([mode, options, minified]): Case => [
      weight,
      compilerLabel,
      mode,
      fontWeight,
      css,
      options,
      minified,
      kind,
    ]),
  ),
);

describe("button font weight through node mjml and mjml-browser", () => {
  it.each(CASES)(
    "%s / %s / %s",
    async (
      _weight,
      _compilerLabel,
      _mode,
      fontWeight,
      css,
      options,
      minified,
      kind,
    ) => {
      const block = createButtonBlock({
        text: "Go",
        url: "https://example.com",
        ...(fontWeight === undefined ? {} : { fontWeight }),
      });
      const blockMjml = renderBlock(block, ctx);
      expect(blockMjml).toContain(`font-weight="${css}"`);

      const compile = kind === "node" ? nodeMjml : await browserMjml;
      const result = await compile(wrapBlock(blockMjml), options);
      expect(result.errors).toEqual([]);

      const style = anchorStyle(result.html);
      // The keyword and its number are the same weight; a minifier may rewrite one as the other.
      const weight = style.match(/font-weight:([^;"]*)/)?.[1];
      const numeric = { bold: "700", normal: "400" }[weight ?? ""] ?? weight;
      expect(numeric).toBe({ bold: "700", normal: "400" }[css] ?? css);
    },
  );
});
