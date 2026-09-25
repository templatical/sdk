import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import { createButtonBlock } from "@templatical/types";
import { renderBlock, RenderContext } from "../src";

const ctx = new RenderContext(600, [], "Arial, sans-serif", true);

function mjmlFor(backgroundColor: string): string {
  return renderBlock(createButtonBlock({ backgroundColor, text: "Go" }), ctx);
}

describe("button background", () => {
  it("writes a set fill through", () => {
    expect(mjmlFor("#333333")).toContain('background-color="#333333"');
  });

  it("exports an empty fill as the keyword transparent", async () => {
    const mjml = mjmlFor("");
    expect(mjml).toContain('background-color="transparent"');
    expect(mjml).not.toContain('background-color=""');

    const result = await mjml2html(
      `<mjml><mj-body><mj-section><mj-column>${mjml}</mj-column></mj-section></mj-body></mjml>`,
      { validationLevel: "strict" },
    );
    expect(result.errors).toEqual([]);
    expect(result.html).toContain("background:transparent");
  });

  it("keeps a stored transparent keyword", () => {
    expect(mjmlFor("transparent")).toContain('background-color="transparent"');
  });

  it("keeps a partial-alpha rgba", () => {
    expect(mjmlFor("rgba(0, 0, 0, 0.5)")).toContain(
      'background-color="rgba(0, 0, 0, 0.5)"',
    );
  });
});
