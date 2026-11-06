import { describe, expect, it } from "vitest";
import nodeMjml from "mjml";
import {
  createDefaultTemplateContent,
  createImageBlock,
  createSectionBlock,
  type ImageBlock,
  type TemplateContent,
} from "@templatical/types";
import { renderToMjml } from "../src";

/**
 * `mj-image fluid-on-mobile` compiled by node `mjml` and by `mjml-browser`.
 * Both compilers emit this head rule for every image (breakpoint 480px, so
 * the query is `max-width:479px`):
 *
 *   table.mj-full-width-mobile { width: 100% !important; }
 *   td.mj-full-width-mobile { width: auto !important; }
 *
 * The rule does nothing until the image's table and cell carry
 * `mj-full-width-mobile`. An omitted `fluidOnMobile` follows the automatic
 * rule. `true` always emits the attribute; `false` never does.
 */

const SRC = "https://example.com/photo.png";

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

const PAD = { top: 0, right: 10, bottom: 0, left: 10 };

function email(
  width: ImageBlock["width"],
  fluidOnMobile: boolean | undefined,
): TemplateContent {
  const content = createDefaultTemplateContent();
  const image = createImageBlock({
    src: SRC,
    alt: "Photo",
    width,
    styles: { padding: PAD },
    ...(fluidOnMobile === undefined ? {} : { fluidOnMobile }),
  });
  return {
    ...content,
    settings: { ...content.settings, width: 600 },
    blocks: [
      createSectionBlock({
        columns: "2",
        styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
        children: [[image], []],
      }),
    ],
  };
}

/**
 * Whitespace-insensitive, and a minifier may drop the semicolon after
 * `!important`. Beautify, default and minify then compare as one rule.
 */
function compact(html: string): string {
  return html.replace(/\s+/g, "").replace(/!important;/g, "!important");
}

const FLUID_RULE =
  "@mediaonlyscreenand(max-width:479px){table.mj-full-width-mobile{width:100%!important}td.mj-full-width-mobile{width:auto!important}}";

/**
 * MJML puts this head rule on every `mj-image`, used or not. The effect is
 * the `mj-full-width-mobile` class on the image's table and cell.
 */
function hasFluidClass(html: string): boolean {
  return /class="[^"]*\bmj-full-width-mobile\b/.test(html);
}

const CASES: [string, ImageBlock["width"], boolean | undefined, boolean][] = [
  ["filling, absent", 280, undefined, true],
  ["filling, true", 280, true, true],
  ["filling, false", 280, false, false],
  ["narrow, absent", 120, undefined, false],
  ["narrow, true", 120, true, true],
];

const MODES: [string, CompileOptions][] = [
  ["default", {}],
  ["beautify", { beautify: true }],
  ["minify", { minify: true, beautify: true }],
];

const COMPILERS = [
  ["mjml", "node"],
  ["mjml-browser", "browser"],
] as const;

type Case = [
  string,
  string,
  string,
  ImageBlock["width"],
  boolean | undefined,
  boolean,
  CompileOptions,
  "node" | "browser",
];

const GRID: Case[] = CASES.flatMap(([label, width, fluid, on]) =>
  COMPILERS.flatMap(([compilerLabel, kind]) =>
    MODES.map(([mode, options]): Case => [
      label,
      compilerLabel,
      mode,
      width,
      fluid,
      on,
      options,
      kind,
    ]),
  ),
);

describe("image fluid-on-mobile through node mjml and mjml-browser", () => {
  it.each(GRID)(
    "%s / %s / %s",
    async (_label, _compilerLabel, _mode, width, fluid, on, options, kind) => {
      const source = await renderToMjml(email(width, fluid));
      if (on) expect(source).toContain('fluid-on-mobile="true"');
      else expect(source).not.toContain("fluid-on-mobile");

      const compile = kind === "node" ? nodeMjml : await browserMjml;
      const result = await compile(source, options);
      expect(result.errors).toEqual([]);
      expect(compact(result.html)).toContain(FLUID_RULE);
      expect(hasFluidClass(result.html)).toBe(on);
    },
  );
});
