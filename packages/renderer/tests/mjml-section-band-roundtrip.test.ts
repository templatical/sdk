import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createSectionBlock,
} from "@templatical/types";
import { renderToMjml } from "../src";

/**
 * A BeeFree row's container colour is the band outside the content box, and
 * its content colour is the inner box. The editor stores that band as
 * `section.wrapper` and the inner colour as the section fill. The wrapper is
 * the email body width (`settings.width`); the section inside it is the
 * content box. Compiling through mjml shows both tables at that width, with
 * the copy inside the content table.
 *
 * Without `wrapper.fullWidth`, the band stops at the email width. `fullWidth`
 * is the viewport-bleed band (`full-width` on `mj-wrapper`).
 */

const EMAIL_WIDTH = 600;
const BAND = "#f9f9f9";
const FILL = "#abcdef";

async function compile(mjml: string): Promise<string> {
  const result = await mjml2html(mjml);
  expect(result.errors).toEqual([]);
  return result.html;
}

function tableWith(html: string, color: string): string {
  const tags = html.match(/<table\b[^>]*>/gi) ?? [];
  const tag = tags.find((entry) =>
    entry.toLowerCase().includes(`bgcolor="${color}"`),
  );
  expect(tag, color).toBeTruthy();
  return tag ?? "";
}

describe("section band round-trip through MJML", () => {
  it("spans the email width with the band and keeps the copy in the content box", async () => {
    const content = createDefaultTemplateContent();
    content.settings.width = EMAIL_WIDTH;
    content.settings.backgroundColor = "#f1f2f7";
    content.blocks = [
      createSectionBlock({
        columns: "1",
        wrapper: { backgroundColor: BAND },
        styles: {
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          backgroundColor: FILL,
        },
        children: [[createParagraphBlock({ content: "<p>BANDCOPY</p>" })]],
      }),
    ];

    const mjml = await renderToMjml(content);
    expect(mjml).toContain(`<mj-body width="${EMAIL_WIDTH}px"`);
    const wrapperTag = `<mj-wrapper background-color="${BAND}"`;
    const sectionTag = `<mj-section background-color="${FILL}"`;
    expect(mjml).toContain(wrapperTag);
    expect(mjml).toContain(sectionTag);
    // Head CSS names `mj-section` before the body, so compare the painted tags.
    expect(mjml.indexOf(wrapperTag)).toBeLessThan(mjml.indexOf(sectionTag));

    const html = await compile(mjml);
    const band = tableWith(html, BAND);
    const fill = tableWith(html, FILL);
    expect(band).toContain(`width="${EMAIL_WIDTH}"`);
    expect(fill).toContain(`width="${EMAIL_WIDTH}"`);
    expect(html.toLowerCase()).toContain("background-color:#f1f2f7");

    const bandAt = html.toLowerCase().indexOf(`bgcolor="${BAND}"`);
    const fillAt = html.toLowerCase().indexOf(`bgcolor="${FILL}"`);
    const copyAt = html.indexOf("BANDCOPY");
    expect(bandAt).toBeGreaterThan(-1);
    expect(fillAt).toBeGreaterThan(bandAt);
    expect(copyAt).toBeGreaterThan(fillAt);
  });
});
