import { describe, expect, it } from "vitest";
import nodeMjml from "mjml";
import {
  createBackgroundImage,
  createDefaultTemplateContent,
  createParagraphBlock,
  createSectionBlock,
  createSlotBlock,
  createWrapperBlock,
  type TemplateContent,
} from "@templatical/types";
import { renderToMjml } from "../src";

/**
 * `fullWidth` on a section wrapper or a layout wrapper is MJML's
 * `full-width="full-width"` on `mj-wrapper`. The band (colour or image) is
 * the outer full-width table; the copy stays in the inner `max-width` box at
 * `settings.width`. Absent or false leaves that attribute off, so the band is
 * the email width. A corner radius is not emitted while full width is on.
 *
 * `mjml` and `mjml-browser` 5.4.1 must agree on that structure in each output
 * mode. Their minifiers do not: the browser build shortens colours and zero
 * lengths (`#112233` / `#ffffff` / `0px auto`) where the node build does not.
 * The comparison is the shell, not the minified bytes.
 */

const EMAIL_WIDTH = 600;
const BAND = "#112233";
const FILL = "#abcdef";
const IMAGE = "https://cdn.test/band.png";

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

const MODES: { name: string; options?: CompileOptions }[] = [
  { name: "default" },
  { name: "beautify", options: { beautify: true } },
  { name: "minify", options: { minify: true } },
];

function sectionContent(fullWidth: boolean | undefined): TemplateContent {
  const content = createDefaultTemplateContent();
  content.settings.width = EMAIL_WIDTH;
  content.blocks = [
    createSectionBlock({
      columns: "1",
      wrapper: {
        backgroundColor: BAND,
        borderRadius: 12,
        ...(fullWidth === undefined ? {} : { fullWidth }),
      },
      styles: {
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        backgroundColor: FILL,
      },
      children: [[createParagraphBlock({ content: "<p>BANDCOPY</p>" })]],
    }),
  ];
  return content;
}

function imageContent(fullWidth: boolean): TemplateContent {
  const content = sectionContent(fullWidth);
  const section = content.blocks[0];
  if (section?.type !== "section" || !section.wrapper) {
    throw new Error("expected a wrapped section");
  }
  section.wrapper = {
    ...section.wrapper,
    backgroundImage: createBackgroundImage(IMAGE),
  };
  return content;
}

function layoutContent(): TemplateContent {
  const content = createDefaultTemplateContent();
  content.settings.width = EMAIL_WIDTH;
  content.blocks = [createParagraphBlock({ content: "<p>BANDCOPY</p>" })];
  return content;
}

function layoutShell(fullWidth: boolean): TemplateContent {
  const layout = createDefaultTemplateContent();
  layout.settings.width = EMAIL_WIDTH;
  layout.blocks = [
    createWrapperBlock({
      fullWidth,
      borderRadius: 16,
      styles: {
        backgroundColor: BAND,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      },
      backgroundImage: createBackgroundImage(IMAGE),
      children: [createSlotBlock()],
    }),
  ];
  return layout;
}

/** `#112233` and the three-digit form a minifier may write (`#123`). */
function colorForms(color: string): string[] {
  const hex = color.toLowerCase();
  const pair = /^#([0-9a-f])\1([0-9a-f])\2([0-9a-f])\3$/i.exec(hex);
  return pair ? [hex, `#${pair[1]}${pair[2]}${pair[3]}`] : [hex];
}

function carries(source: string, marker: string): boolean {
  const lower = source.toLowerCase();
  const forms = marker.startsWith("#")
    ? colorForms(marker)
    : [marker.toLowerCase()];
  return forms.some((form) => lower.includes(form));
}

/** Opening tags, on the real markup. Flattening first glues `<table` to the next attribute and `\b` stops matching. */
function openingTags(html: string, name: string): { index: number; tag: string }[] {
  const re = new RegExp(`<${name}\\b[^>]*>`, "gi");
  return [...html.matchAll(re)].map((match) => ({
    index: match.index ?? 0,
    tag: match[0],
  }));
}

function isFullWidthTable(tag: string): boolean {
  return /width\s*=\s*"100%"/i.test(tag) || /width:\s*100%/i.test(tag);
}

type BandFacts = {
  /** Outer 100% table carries the band; the email-width div does not. */
  shell: boolean;
  /** The email-width div's own opening tag carries the band. */
  bandOnColumn: boolean;
  radius: boolean;
  /** Outlook VML full-width rect. Present for an image band, not a colour. */
  mso: boolean;
  image: boolean;
};

/**
 * The full-width shell MJML emits: some `width: 100%` table before the
 * email-width div holds the band paint, and that div's opening tag does not.
 */
function bandFacts(html: string, marker: string): BandFacts {
  const column = openingTags(html, "div").find((tag) =>
    /max-width:\s*600px/i.test(tag.tag),
  );
  const bandOnColumn = column !== undefined && carries(column.tag, marker);
  const shell =
    column !== undefined &&
    !bandOnColumn &&
    openingTags(html, "table").some(
      (table) =>
        table.index < column.index &&
        isFullWidthTable(table.tag) &&
        carries(table.tag, marker),
    );
  const lower = html.toLowerCase();
  return {
    shell,
    bandOnColumn,
    radius: lower.includes("border-radius"),
    mso: lower.includes("mso-width-percent:1000"),
    image: lower.includes(IMAGE.toLowerCase()),
  };
}

async function both(mjml: string, options?: CompileOptions) {
  const node = await nodeMjml(mjml, options);
  const browser = await (await browserMjml)(mjml, options);
  expect(node.errors).toEqual([]);
  expect(browser.errors).toEqual([]);
  return { node, browser };
}

describe("full-width bands through node mjml and mjml-browser", () => {
  it.each(MODES)(
    "colour band is viewport-wide in $name when fullWidth is true",
    async ({ options }) => {
      const mjml = await renderToMjml(sectionContent(true));
      expect(mjml).toContain('full-width="full-width"');
      expect(mjml).not.toContain("border-radius");
      expect(mjml).toContain(`background-color="${BAND}"`);

      const { node, browser } = await both(mjml, options);
      const expected: BandFacts = {
        shell: true,
        bandOnColumn: false,
        radius: false,
        mso: false,
        image: false,
      };
      expect(bandFacts(node.html, BAND)).toEqual(expected);
      expect(bandFacts(browser.html, BAND)).toEqual(expected);
      expect(node.html.indexOf("BANDCOPY")).toBeGreaterThan(
        node.html.toLowerCase().indexOf("max-width:600px") === -1
          ? node.html.toLowerCase().indexOf("max-width: 600px")
          : node.html.toLowerCase().indexOf("max-width:600px"),
      );
    },
  );

  it.each(MODES)(
    "colour band stays at the email width in $name when fullWidth is absent",
    async ({ options }) => {
      const mjml = await renderToMjml(sectionContent(undefined));
      expect(mjml).not.toContain("full-width");
      expect(mjml).toContain('border-radius="12px"');

      const { node, browser } = await both(mjml, options);
      const expected: BandFacts = {
        shell: false,
        bandOnColumn: true,
        radius: true,
        mso: false,
        image: false,
      };
      expect(bandFacts(node.html, BAND)).toEqual(expected);
      expect(bandFacts(browser.html, BAND)).toEqual(expected);
      const packed = node.html.toLowerCase().replace(/\s+/g, "");
      expect(packed).toContain("border-radius:12px");
      expect(packed).toContain(`max-width:${EMAIL_WIDTH}px`);
    },
  );

  it.each(MODES)(
    "colour band stays at the email width in $name when fullWidth is false",
    async ({ options }) => {
      const mjml = await renderToMjml(sectionContent(false));
      expect(mjml).not.toContain('full-width="full-width"');
      expect(mjml).toContain('border-radius="12px"');

      const { node, browser } = await both(mjml, options);
      const expected: BandFacts = {
        shell: false,
        bandOnColumn: true,
        radius: true,
        mso: false,
        image: false,
      };
      expect(bandFacts(node.html, BAND)).toEqual(expected);
      expect(bandFacts(browser.html, BAND)).toEqual(expected);
    },
  );

  it.each(MODES)(
    "image band is viewport-wide in $name and keeps the background attributes",
    async ({ options }) => {
      const mjml = await renderToMjml(imageContent(true));
      expect(mjml).toContain('full-width="full-width"');
      expect(mjml).toContain(`background-url="${IMAGE}"`);
      expect(mjml).toContain('background-size="cover"');
      expect(mjml).not.toContain("border-radius");

      const { node, browser } = await both(mjml, options);
      const expected: BandFacts = {
        shell: true,
        bandOnColumn: false,
        radius: false,
        mso: true,
        image: true,
      };
      expect(bandFacts(node.html, IMAGE)).toEqual(expected);
      expect(bandFacts(browser.html, IMAGE)).toEqual(expected);
    },
  );

  it.each(MODES)(
    "layout wrapper block is viewport-wide in $name",
    async ({ options }) => {
      const mjml = await renderToMjml(layoutContent(), {
        layout: layoutShell(true),
      });
      expect(mjml).toContain('full-width="full-width"');
      expect(mjml).toContain(`background-url="${IMAGE}"`);
      expect(mjml).toContain(`background-color="${BAND}"`);
      expect(mjml).not.toContain("border-radius");

      const { node, browser } = await both(mjml, options);
      const expected: BandFacts = {
        shell: true,
        bandOnColumn: false,
        radius: false,
        mso: true,
        image: true,
      };
      expect(bandFacts(node.html, IMAGE)).toEqual(expected);
      expect(bandFacts(browser.html, IMAGE)).toEqual(expected);
      expect(bandFacts(node.html, BAND).shell).toBe(true);
      expect(bandFacts(browser.html, BAND).shell).toBe(true);
    },
  );
});
