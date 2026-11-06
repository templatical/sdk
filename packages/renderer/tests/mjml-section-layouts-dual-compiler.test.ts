import { describe, expect, it } from "vitest";
import nodeMjml from "mjml";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createSectionBlock,
  type ColumnLayout,
  type TemplateContent,
} from "@templatical/types";
import { renderToMjml } from "../src";

/**
 * New section layouts compile to native `mj-column` widths through both
 * `mjml` and `mjml-browser` 5.4.1. Stacking is MJML's default: each column is
 * inline `width:100%` and only takes its share inside the desktop media
 * query. `stackOnMobile: false` wraps the columns in `mj-group` (itself
 * `mj-column-per-100`), so each column's share is inline and they stay side
 * by side. The renderer's text CSS in `mj-head` is unrelated to the layout.
 */

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

const LAYOUTS: { layout: ColumnLayout; widths: string[] }[] = [
  { layout: "4", widths: ["25%", "25%", "25%", "25%"] },
  { layout: "1-3", widths: ["25%", "75%"] },
  { layout: "3-1", widths: ["75%", "25%"] },
  { layout: "1-2-1", widths: ["25%", "50%", "25%"] },
];

function content(
  layout: ColumnLayout,
  widths: string[],
  stackOnMobile?: boolean,
): TemplateContent {
  return {
    ...createDefaultTemplateContent(),
    blocks: [
      createSectionBlock({
        columns: layout,
        stackOnMobile,
        children: widths.map((_, index) => [
          createParagraphBlock({ content: `<p>COL${index}</p>` }),
        ]),
      }),
    ],
  };
}

function mjmlColumnWidths(mjml: string): string[] {
  return [...mjml.matchAll(/<mj-column width="([^"]+)"/g)].map(
    (match) => match[1],
  );
}

/** Column divs MJML emits, in order: class percentage and inline width. */
function columnDivs(html: string): { per: string; inline: string }[] {
  return [
    ...html.matchAll(
      /<div class="mj-column-per-([^" ]+)[^"]*" style="([^"]*)"/g,
    ),
  ].map((match) => ({
    per: match[1],
    inline: /(?:^|;)width:([^;]+)/.exec(match[2])?.[1] ?? "",
  }));
}

/**
 * Widths named by the desktop rule, one per percentage class. MJML writes
 * both `width` and `max-width` for that class, so the pair collapses to one.
 */
function desktopWidths(html: string): string[] {
  const query = html.match(
    /@media only screen and \(min-width:480px\) \{([\s\S]*?)\n\s*\}/,
  );
  if (!query) return [];
  const found = [...query[1].matchAll(/width:\s*([^;!\s]+)/g)].map(
    (match) => match[1],
  );
  return [...new Set(found)];
}

/** Column shares, without the `mj-group` wrapper MJML marks `per-100`. */
function columnShares(
  divs: { per: string; inline: string }[],
): { per: string; inline: string }[] {
  return divs.filter((column) => column.per !== "100");
}

describe("new section layouts through node mjml and mjml-browser", () => {
  it.each(LAYOUTS)(
    "$layout stacks on mobile with native column widths",
    async ({ layout, widths }) => {
      const mjml = await renderToMjml(content(layout, widths));
      expect(mjml).not.toContain("<mj-raw");
      expect(mjml).not.toContain("<mj-group");
      expect(mjmlColumnWidths(mjml)).toEqual(widths);

      const node = await nodeMjml(mjml);
      const browser = await (await browserMjml)(mjml);
      expect(node.errors).toEqual([]);
      expect(browser.errors).toEqual([]);

      const nodeDivs = columnDivs(node.html);
      const browserDivs = columnDivs(browser.html);
      expect(browserDivs).toEqual(nodeDivs);
      expect(nodeDivs.map((column) => column.inline)).toEqual(
        widths.map(() => "100%"),
      );
      expect(nodeDivs.map((column) => `${column.per}%`)).toEqual(
        widths.map((width) => `${parseInt(width, 10)}%`),
      );

      const nodeDesktop = desktopWidths(node.html);
      const browserDesktop = desktopWidths(browser.html);
      expect(browserDesktop).toEqual(nodeDesktop);
      expect(nodeDesktop).toEqual([...new Set(widths)]);
    },
  );

  it.each(LAYOUTS)(
    "$layout stays side by side when stackOnMobile is false",
    async ({ layout, widths }) => {
      const mjml = await renderToMjml(content(layout, widths, false));
      expect(mjml).toContain("<mj-group>");
      expect(mjmlColumnWidths(mjml)).toEqual(widths);

      const node = await nodeMjml(mjml);
      const browser = await (await browserMjml)(mjml);
      expect(node.errors).toEqual([]);
      expect(browser.errors).toEqual([]);

      const nodeDivs = columnDivs(node.html);
      const browserDivs = columnDivs(browser.html);
      expect(browserDivs).toEqual(nodeDivs);
      const shares = columnShares(nodeDivs);
      expect(shares.map((column) => column.inline)).toEqual(widths);
      expect(shares.map((column) => `${column.per}%`)).toEqual(
        widths.map((width) => `${parseInt(width, 10)}%`),
      );
      expect(nodeDivs.some((column) => column.per === "100")).toBe(true);
      expect(desktopWidths(browser.html)).toEqual(desktopWidths(node.html));
      expect(desktopWidths(node.html)).toEqual(
        expect.arrayContaining([...new Set(widths)]),
      );
    },
  );
});
