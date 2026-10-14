import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import {
  createButtonBlock,
  createDefaultTemplateContent,
  createDividerBlock,
  createImageBlock,
  createMenuBlock,
  createParagraphBlock,
  createSectionBlock,
  createSlotBlock,
  createSocialIconsBlock,
  createSpacerBlock,
  createTableBlock,
  createTitleBlock,
  createWrapperBlock,
} from "@templatical/types";
import type { Block, TemplateContent } from "@templatical/types";
import { renderToMjml } from "../src";

/**
 * Issue #872: an RTL email reversed its columns but laid out the text inside
 * them left-to-right. `direction="rtl"` on `mj-section` only reaches the
 * section's `<td>`; MJML's `mj-column` and `mj-wrapper` default to
 * `direction="ltr"` and inline `direction:ltr` on their own element, which
 * beats `<html dir="rtl">` and every ancestor for the text inside.
 *
 * The MJML string can't show this — the bug is an attribute MJML fills in by
 * default — so these tests compile through mjml@5 and read the inline
 * `direction` declarations in the resulting HTML. The last declaration before
 * a piece of text is the one on its nearest declaring ancestor, i.e. the
 * direction that text is laid out in.
 */

function rtl(
  blocks: Block[],
  settings: Partial<TemplateContent["settings"]> = { direction: "rtl" },
): TemplateContent {
  const content = createDefaultTemplateContent();
  content.blocks = blocks;
  content.settings = { ...content.settings, ...settings };
  return content;
}

function ltr(blocks: Block[]): TemplateContent {
  const content = createDefaultTemplateContent();
  content.blocks = blocks;
  return content;
}

async function compileBody(mjml: string): Promise<string> {
  const result = await mjml2html(mjml);
  expect(result.errors).toEqual([]);
  return result.html.slice(result.html.indexOf("<body"));
}

function directionDeclarations(html: string): string[] {
  return [...html.matchAll(/direction:\s*(ltr|rtl)/g)].map((m) => m[1]);
}

/** Inline `direction` of every column div — `mj-group` renders one too. */
function columnDivDirections(html: string): string[] {
  return [
    ...html.matchAll(/<div class="mj-column-per-[^"]*" style="([^"]*)"/g),
  ].map((m) => /direction:\s*(ltr|rtl)/.exec(m[1])?.[1] ?? "none");
}

function directionGoverning(html: string, marker: string): string {
  const at = html.indexOf(marker);
  expect(at).toBeGreaterThan(-1);
  return directionDeclarations(html.slice(0, at)).at(-1) ?? "none";
}

function twoColumns(
  start: string,
  end: string,
  extra: Parameters<typeof createSectionBlock>[0] = {},
): Block {
  return createSectionBlock({
    columns: "2",
    ...extra,
    children: [
      [createParagraphBlock({ content: `<p>${start} مرحبا 2026.</p>` })],
      [createParagraphBlock({ content: `<p>${end} مرحبا 2026.</p>` })],
    ],
  });
}

describe("content direction round-trip through MJML compiler (#872)", () => {
  it("lays out text inside section columns right-to-left", async () => {
    const html = await compileBody(
      await renderToMjml(rtl([twoColumns("START_CELL", "END_CELL")])),
    );

    expect(columnDivDirections(html)).toEqual(["rtl", "rtl"]);
    expect(directionGoverning(html, "START_CELL")).toBe("rtl");
    expect(directionGoverning(html, "END_CELL")).toBe("rtl");
  });

  it("lays out a top-level block's text right-to-left", async () => {
    const html = await compileBody(
      await renderToMjml(
        rtl([
          createParagraphBlock({ content: "<p>TOP_LEVEL مرحبا 2026.</p>" }),
        ]),
      ),
    );

    expect(columnDivDirections(html)).toEqual(["rtl"]);
    expect(directionGoverning(html, "TOP_LEVEL")).toBe("rtl");
  });

  it("resolves RTL columns from an Arabic locale when direction is unset", async () => {
    const html = await compileBody(
      await renderToMjml(
        rtl([twoColumns("START_CELL", "END_CELL")], { locale: "ar" }),
      ),
    );

    expect(columnDivDirections(html)).toEqual(["rtl", "rtl"]);
    expect(directionGoverning(html, "START_CELL")).toBe("rtl");
  });

  it("lays out grouped columns right-to-left when stacking is opted out", async () => {
    const html = await compileBody(
      await renderToMjml(
        rtl([twoColumns("START_CELL", "END_CELL", { stackOnMobile: false })]),
      ),
    );

    // The group's own div, then its two columns.
    expect(columnDivDirections(html)).toEqual(["rtl", "rtl", "rtl"]);
    expect(directionGoverning(html, "START_CELL")).toBe("rtl");
    expect(directionGoverning(html, "END_CELL")).toBe("rtl");
  });

  it("puts direction:rtl on a section.wrapper band", async () => {
    const html = await compileBody(
      await renderToMjml(
        rtl([
          twoColumns("START_CELL", "END_CELL", {
            wrapper: { backgroundColor: "#eeeeee" },
          }),
        ]),
      ),
    );

    // Wrapper td, section td, then the two column divs.
    expect(directionDeclarations(html)).toEqual(["rtl", "rtl", "rtl", "rtl"]);
  });

  it("puts direction:rtl on a layout wrapper block", async () => {
    const layout = ltr([
      createWrapperBlock({
        styles: {
          backgroundColor: "#ffffff",
          padding: { top: 24, right: 24, bottom: 24, left: 24 },
        },
        children: [createSlotBlock()],
      }),
    ]);
    const html = await compileBody(
      await renderToMjml(
        rtl([
          createParagraphBlock({ content: "<p>AUTHOR_BODY مرحبا 2026.</p>" }),
        ]),
        { layout },
      ),
    );

    // Wrapper td, the slot block's section td, then its column div.
    expect(directionDeclarations(html)).toEqual(["rtl", "rtl", "rtl"]);
    expect(directionGoverning(html, "AUTHOR_BODY")).toBe("rtl");
  });

  it("declares no direction:ltr anywhere in an RTL email", async () => {
    const html = await compileBody(
      await renderToMjml(
        rtl([
          createTitleBlock({ content: "<p>عنوان</p>" }),
          createParagraphBlock({ content: "<p>مرحبا 2026.</p>" }),
          createImageBlock({ src: "https://example.com/a.png" }),
          createButtonBlock({ text: "اشترك" }),
          createDividerBlock(),
          createSpacerBlock(),
          createSocialIconsBlock(),
          createMenuBlock(),
          createTableBlock(),
          createSectionBlock({
            columns: "3",
            children: [
              [createParagraphBlock({ content: "<p>واحد</p>" })],
              [createButtonBlock({ text: "اثنان" })],
              [createImageBlock({ src: "https://example.com/b.png" })],
            ],
          }),
          twoColumns("GROUPED_START", "GROUPED_END", {
            stackOnMobile: false,
            wrapper: { backgroundColor: "#eeeeee" },
          }),
        ]),
      ),
    );

    expect(directionDeclarations(html)).not.toContain("ltr");
    expect(directionDeclarations(html).length).toBeGreaterThan(0);
  });

  it("keeps LTR columns direction:ltr and emits no direction attribute", async () => {
    const mjml = await renderToMjml(
      ltr([
        createParagraphBlock({ content: "<p>TOP_LEVEL</p>" }),
        twoColumns("START_CELL", "END_CELL"),
        twoColumns("GROUPED_START", "GROUPED_END", {
          stackOnMobile: false,
          wrapper: { backgroundColor: "#eeeeee" },
        }),
      ]),
    );
    expect(mjml).not.toContain("direction=");

    const html = await compileBody(mjml);
    // Top-level column, two section columns, group div + two grouped columns.
    expect(columnDivDirections(html)).toEqual([
      "ltr",
      "ltr",
      "ltr",
      "ltr",
      "ltr",
      "ltr",
    ]);
    expect(directionDeclarations(html)).not.toContain("rtl");
    expect(directionGoverning(html, "START_CELL")).toBe("ltr");
    expect(directionGoverning(html, "GROUPED_END")).toBe("ltr");
  });
});
