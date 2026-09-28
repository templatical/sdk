import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import { createDividerBlock, type DividerBlock } from "@templatical/types";
import { renderBlock, RenderContext } from "../src";

const ctx = new RenderContext(600, [], "Arial, sans-serif", true);

function mjmlFor(width: DividerBlock["width"]): string {
  return renderBlock(createDividerBlock({ width }), ctx);
}

async function htmlFor(width: DividerBlock["width"]): Promise<string> {
  const result = await mjml2html(
    `<mjml><mj-body><mj-section><mj-column>${mjmlFor(width)}</mj-column></mj-section></mj-body></mjml>`,
    { validationLevel: "strict" },
  );
  expect(result.errors).toEqual([]);
  return result.html;
}

describe("divider width", () => {
  it("spans the column when full", () => {
    expect(mjmlFor("full")).toContain('width="100%"');
  });

  it("writes a number as pixels", () => {
    expect(mjmlFor(200)).toContain('width="200px"');
  });

  it("passes a percentage through, and MJML renders it as a share of the column", async () => {
    expect(mjmlFor("50%")).toContain('width="50%"');
    expect(await htmlFor("50%")).toContain("width:50%");
  });

  it("keeps a fractional percentage exact", () => {
    expect(mjmlFor("37.5%")).toContain('width="37.5%"');
  });
});
